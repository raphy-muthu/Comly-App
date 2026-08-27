-- ════════════════════════════════════════════════════════════════════════════
-- Comly — mutual completion, reviews, no-show strikes, and job invites
--
-- Covers the second revisions round:
--   1. Job completion becomes two-sided. The owner requests it, the accepted
--      helper confirms or disputes it. Completion was previously unilateral,
--      which meant a customer could mark a job done (and unlock reviews) with
--      no input from the person who actually did the work.
--   2. Reviews become *writable*. The `reviews` table has existed since 0001
--      but nothing ever inserted into it, and its 0002 INSERT policy only
--      checked `auth.uid() = reviewer_id` — i.e. any signed-in user could
--      review any stranger on any job. Tightened to the two parties of a
--      genuinely completed job.
--   3. No-show strikes. Auditable rows, not a silently incrementing counter:
--      a report lands `pending` and only an admin confirming it applies a
--      strike, so a retaliatory accusation can be reversed.
--   4. Job invites. A customer can nudge a recommended helper toward an open
--      listing WITHOUT any contact information crossing over — the
--      contact-unlock-after-acceptance rule stays intact.
--
-- Enum note: PostgreSQL forbids *using* an enum value in the same transaction
-- that adds it. Every new value below is only referenced from plpgsql function
-- bodies (parsed at call time, not at creation), never from a default, a check
-- constraint, or a top-level statement — same discipline migration 0003 used.
-- ════════════════════════════════════════════════════════════════════════════

-- ── New enum values ──────────────────────────────────────────────────────────
alter type job_status add value if not exists 'pending_confirmation';

alter type notification_type add value if not exists 'job_invite';
alter type notification_type add value if not exists 'completion_requested';
alter type notification_type add value if not exists 'completion_confirmed';

-- ── jobs: completion timestamps ──────────────────────────────────────────────
alter table jobs add column if not exists completion_requested_at timestamptz;
alter table jobs add column if not exists completed_at timestamptz;

-- ── profiles: no-show strikes (server-owned) ─────────────────────────────────
alter table profiles add column if not exists strikes integer not null default 0
  check (strikes >= 0);
alter table profiles add column if not exists is_suspended boolean not null default false;

-- These join the columns 0005 pins against self-service writes. Without this a
-- user could clear their own strikes and lift their own suspension with a
-- single PATCH — the exact escalation 0005 exists to close.
-- The 0005 guard steps aside only when `auth.uid()` is null — true for the
-- service role, but NOT for a signed-in user calling a SECURITY DEFINER RPC:
-- their JWT is still in scope, so the guard fires and silently reverts the
-- write. Three flows below legitimately need to touch pinned columns from
-- inside such an RPC (strikes, suspension, jobs_count, rating), so they raise
-- a transaction-local flag the guard honours.
--
-- A PostgREST client cannot set this itself — only `request.*` GUCs come from
-- the request, and this lives in the `comly.` namespace, reachable only from
-- SQL that already runs on the server.
create or replace function comly_privileged_write_active()
returns boolean language sql stable as $$
  select coalesce(current_setting('comly.privileged_write', true), 'off') = 'on';
$$;

create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;

  new.is_admin := old.is_admin;

  new.age_group := old.age_group;
  new.parent_approval_status := old.parent_approval_status;

  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  -- Moderation outcomes. Applied only by resolve_no_show_event (below), via
  -- the privileged-write flag above.
  new.strikes := old.strikes;
  new.is_suspended := old.is_suspended;

  new.id := old.id;

  return new;
end;
$$;

-- ── no_show_events ───────────────────────────────────────────────────────────
create table if not exists no_show_events (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs (id) on delete cascade,
  reported_user_id  uuid not null references profiles (id) on delete cascade,
  reporter_id       uuid not null references profiles (id) on delete cascade,
  note              text not null default '',
  status            text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'dismissed')),
  admin_notes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One report per person per job. Re-reporting is not extra evidence.
  unique (job_id, reporter_id),
  check (reported_user_id <> reporter_id)
);

create index if not exists no_show_events_user_idx
  on no_show_events (reported_user_id, created_at desc);

alter table no_show_events enable row level security;

-- Visible to the two people involved and to admins. Inserts go exclusively
-- through report_no_show (which validates job membership), so there is no
-- INSERT policy here at all.
drop policy if exists "No-show events visible to the parties and admins" on no_show_events;
create policy "No-show events visible to the parties and admins"
  on no_show_events for select using (
    auth.uid() = reporter_id
    or auth.uid() = reported_user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ── job_invites ──────────────────────────────────────────────────────────────
create table if not exists job_invites (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs (id) on delete cascade,
  customer_id  uuid not null references profiles (id) on delete cascade,
  helper_id    uuid not null references profiles (id) on delete cascade,
  status       text not null default 'sent'
                 check (status in ('sent', 'applied', 'dismissed')),
  created_at   timestamptz not null default now(),
  unique (job_id, helper_id),
  check (customer_id <> helper_id)
);

create index if not exists job_invites_helper_idx
  on job_invites (helper_id, created_at desc);

alter table job_invites enable row level security;

drop policy if exists "Invites visible to sender and recipient" on job_invites;
create policy "Invites visible to sender and recipient"
  on job_invites for select using (
    auth.uid() = customer_id or auth.uid() = helper_id
  );

-- Recipients may dismiss an invite; nobody may edit one into existence.
drop policy if exists "Helpers update their own invites" on job_invites;
create policy "Helpers update their own invites"
  on job_invites for update
  using (auth.uid() = helper_id)
  with check (status in ('applied', 'dismissed'));

-- ── reviews: real authorization ──────────────────────────────────────────────
-- 0002's policy was `auth.uid() = reviewer_id` and nothing else, so any signed-in
-- user could fabricate a review of any stranger against any job id. Reviews are
-- the entire reputation system, so this is the gate that has to hold.
drop policy if exists "Users can write reviews as themselves" on reviews;

drop policy if exists "Parties of a completed job can review each other" on reviews;
create policy "Parties of a completed job can review each other"
  on reviews for insert with check (
    auth.uid() = reviewer_id
    and reviewer_id <> reviewee_id
    and exists (
      select 1 from jobs j
      where j.id = reviews.job_id
        and j.status = 'completed'
        and j.deleted_at is null
        -- Reviewer and reviewee must be the job's two parties, in either
        -- direction: customer reviews helper, helper reviews customer.
        and (
          (auth.uid() = j.customer_id and reviews.reviewee_id = j.assigned_helper_id)
          or
          (auth.uid() = j.assigned_helper_id and reviews.reviewee_id = j.customer_id)
        )
    )
  );

-- Reviews are a permanent record of a finished interaction: no self-service
-- edit or delete path (an admin acts through the service role).
drop policy if exists "Reviewers can edit their reviews" on reviews;

-- Keeps profiles.rating consistent with the reviews actually on file. Runs with
-- no end-user JWT, so the 0005 guard steps aside and lets it write.
create or replace function recalc_reviewee_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_avg numeric;
begin
  select avg((reliability + quality + communication + professionalism) / 4.0)
    into v_avg
  from reviews
  where reviewee_id = new.reviewee_id;

  perform set_config('comly.privileged_write', 'on', true);
  update profiles
  set rating = round(coalesce(v_avg, 0), 1),
      updated_at = now()
  where id = new.reviewee_id;
  perform set_config('comly.privileged_write', 'off', true);

  return new;
end;
$$;

drop trigger if exists trg_recalc_reviewee_rating on reviews;
create trigger trg_recalc_reviewee_rating
  after insert on reviews
  for each row execute function recalc_reviewee_rating();

-- ── Completion RPCs ──────────────────────────────────────────────────────────
-- The helper has no UPDATE grant on `jobs` (0002 gives that to the customer
-- only), so the confirm/dispute half of this flow cannot be a table write. All
-- three run security definer and re-check the caller themselves.

create or replace function request_job_completion(p_job_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can mark a job complete';
  end if;
  if v_job.status not in ('accepted', 'in_progress') then
    raise exception 'Only an accepted job can be marked complete';
  end if;
  if v_job.assigned_helper_id is null then
    raise exception 'This job has no accepted helper yet';
  end if;

  update jobs
  set status = 'pending_confirmation',
      completion_requested_at = now(),
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_job.assigned_helper_id, 'completion_requested', 'Confirm the job is done',
    'The customer marked "' || v_job.title ||
      '" complete. Confirm so you can both leave reviews.'
  );
end;
$$;

create or replace function confirm_job_completion(p_job_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.assigned_helper_id is distinct from auth.uid() then
    raise exception 'Only the accepted helper can confirm completion';
  end if;
  if v_job.status <> 'pending_confirmation' then
    raise exception 'This job is not awaiting your confirmation';
  end if;

  update jobs
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;

  -- Completed work is what jobs_count is meant to measure, so it moves here
  -- rather than when a job is merely accepted.
  perform set_config('comly.privileged_write', 'on', true);
  update profiles set jobs_count = jobs_count + 1, updated_at = now()
  where id in (v_job.customer_id, v_job.assigned_helper_id);
  perform set_config('comly.privileged_write', 'off', true);

  insert into notifications (user_id, type, title, body)
  values
    (v_job.customer_id, 'completion_confirmed', 'Job confirmed complete',
     'Your helper confirmed "' || v_job.title ||
       '" is done. Leave a review to build their reputation.'),
    (v_job.assigned_helper_id, 'completion_confirmed', 'Job complete',
     '"' || v_job.title || '" is complete. Leave a review for the customer.');
end;
$$;

create or replace function dispute_job_completion(p_job_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.assigned_helper_id is distinct from auth.uid() then
    raise exception 'Only the accepted helper can dispute completion';
  end if;
  if v_job.status <> 'pending_confirmation' then
    raise exception 'This job is not awaiting your confirmation';
  end if;

  -- Back to in_progress, not straight to a report: most disputes are "we're
  -- not finished yet", not abuse. Either side can still file a real report.
  update jobs
  set status = 'in_progress',
      completion_requested_at = null,
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_job.customer_id, 'completion_requested', 'Completion not confirmed',
    'Your helper says "' || v_job.title || '" isn''t finished yet: ' ||
      coalesce(nullif(trim(p_reason), ''), 'no reason given')
  );
end;
$$;

-- ── Invite RPC ───────────────────────────────────────────────────────────────
create or replace function invite_helper_to_job(p_job_id uuid, p_helper_id uuid)
returns setof job_invites
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_is_helper boolean;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'You can only invite helpers to your own jobs';
  end if;
  if v_job.status not in ('open', 'reviewing') then
    raise exception 'You can only invite helpers to an open listing';
  end if;

  select 'helper' = any(roles) into v_is_helper from profiles where id = p_helper_id;
  if not coalesce(v_is_helper, false) then
    raise exception 'That neighbor is not signed up as a helper';
  end if;

  if exists (
    select 1 from blocked_users
    where (user_id = auth.uid() and blocked_user_id = p_helper_id)
       or (user_id = p_helper_id and blocked_user_id = auth.uid())
  ) then
    raise exception 'You cannot invite this helper';
  end if;

  if exists (select 1 from job_invites where job_id = p_job_id and helper_id = p_helper_id) then
    raise exception 'You already invited this helper';
  end if;

  return query
    with inserted as (
      insert into job_invites (job_id, customer_id, helper_id)
      values (p_job_id, auth.uid(), p_helper_id)
      returning *
    ),
    notified as (
      insert into notifications (user_id, type, title, body)
      select p_helper_id, 'job_invite', 'You were invited to apply',
             'A neighbor thinks you''d be a good fit for "' || v_job.title ||
               '". Open it to apply.'
      returning 1
    )
    select * from inserted;
end;
$$;

-- ── No-show RPCs ─────────────────────────────────────────────────────────────
create or replace function report_no_show(
  p_job_id uuid,
  p_reported_user_id uuid,
  p_note text
)
returns setof no_show_events
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null;
  if not found then
    raise exception 'Job not found';
  end if;
  if auth.uid() not in (v_job.customer_id, v_job.assigned_helper_id) then
    raise exception 'You were not part of this job';
  end if;
  if p_reported_user_id = auth.uid() then
    raise exception 'You cannot report yourself';
  end if;
  if p_reported_user_id not in (v_job.customer_id, v_job.assigned_helper_id) then
    raise exception 'That person was not part of this job';
  end if;
  if v_job.status not in ('accepted', 'in_progress', 'pending_confirmation') then
    raise exception 'No-shows can only be reported on an accepted job';
  end if;
  if exists (
    select 1 from no_show_events where job_id = p_job_id and reporter_id = auth.uid()
  ) then
    raise exception 'You already reported a no-show for this job';
  end if;

  return query
    with inserted as (
      insert into no_show_events (job_id, reported_user_id, reporter_id, note)
      values (p_job_id, p_reported_user_id, auth.uid(), coalesce(p_note, ''))
      returning *
    ),
    notified as (
      insert into notifications (user_id, type, title, body)
      select p_reported_user_id, 'report_update', 'A no-show was reported',
             'A no-show was reported for "' || v_job.title ||
               '". An admin reviews it before any strike applies.'
      returning 1
    )
    select * from inserted;
end;
$$;

-- Admin-only. Strikes move in BOTH directions so reversing a decision actually
-- returns the strike rather than leaving it stuck on.
create or replace function resolve_no_show_event(
  p_event_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns setof no_show_events
language plpgsql security definer set search_path = public as $$
declare
  v_event no_show_events%rowtype;
  v_was_confirmed boolean;
  v_strikes integer;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('pending', 'confirmed', 'dismissed') then
    raise exception 'Unknown resolution status: %', p_status;
  end if;

  select * into v_event from no_show_events where id = p_event_id for update;
  if not found then
    raise exception 'No-show report not found';
  end if;

  v_was_confirmed := v_event.status = 'confirmed';

  perform set_config('comly.privileged_write', 'on', true);

  update no_show_events
  set status = p_status,
      admin_notes = coalesce(p_admin_notes, admin_notes),
      updated_at = now()
  where id = p_event_id
  returning * into v_event;

  if not v_was_confirmed and p_status = 'confirmed' then
    update profiles set strikes = strikes + 1, updated_at = now()
    where id = v_event.reported_user_id
    returning strikes into v_strikes;

    insert into notifications (user_id, type, title, body)
    values (
      v_event.reported_user_id, 'report_update', 'No-show strike applied',
      'A no-show strike was applied to your account. You now have ' ||
        v_strikes || '. Open Help & Support to appeal.'
    );
  elsif v_was_confirmed and p_status <> 'confirmed' then
    update profiles set strikes = greatest(strikes - 1, 0), updated_at = now()
    where id = v_event.reported_user_id
    returning strikes into v_strikes;
  else
    select strikes into v_strikes from profiles where id = v_event.reported_user_id;
  end if;

  -- Threshold mirrors NO_SHOW_POLICY.suspensionThreshold in types/domain.ts.
  update profiles set is_suspended = (coalesce(v_strikes, 0) >= 3), updated_at = now()
  where id = v_event.reported_user_id;
  perform set_config('comly.privileged_write', 'off', true);

  return next v_event;
end;
$$;

-- ── Listing limit: keep the server's "active" definition in sync ─────────────
-- The client counts pending_confirmation and in_progress as active (they hold a
-- helper's commitment). The 0004 trigger did not, so a customer could sit on
-- three in-flight jobs and still post three more.
create or replace function enforce_job_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_active int;
  v_recent int;
begin
  select count(*) into v_active
  from jobs
  where customer_id = new.customer_id
    and deleted_at is null
    and status in ('open', 'reviewing', 'accepted', 'in_progress',
                   'pending_confirmation', 'paused');
  if v_active >= 3 then
    raise exception 'You can have up to 3 active job listings at a time. Mark one as filled or completed to post another.';
  end if;

  select count(*) into v_recent
  from jobs
  where customer_id = new.customer_id
    and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'You are posting too quickly. Please wait a bit before creating another listing.';
  end if;

  return new;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- 0007's default privileges cover the new tables; the new functions still need
-- the 0011 treatment (strip the implicit PUBLIC grant, hand it back explicitly).
grant select, insert, update, delete on no_show_events to anon, authenticated;
grant select, insert, update, delete on job_invites   to anon, authenticated;
grant all on no_show_events to service_role;
grant all on job_invites    to service_role;

revoke execute on function public.request_job_completion(uuid)              from public;
revoke execute on function public.confirm_job_completion(uuid)              from public;
revoke execute on function public.dispute_job_completion(uuid, text)        from public;
revoke execute on function public.invite_helper_to_job(uuid, uuid)          from public;
revoke execute on function public.report_no_show(uuid, uuid, text)          from public;
revoke execute on function public.resolve_no_show_event(uuid, text, text)   from public;

grant execute on function public.request_job_completion(uuid)            to authenticated, service_role;
grant execute on function public.confirm_job_completion(uuid)            to authenticated, service_role;
grant execute on function public.dispute_job_completion(uuid, text)      to authenticated, service_role;
grant execute on function public.invite_helper_to_job(uuid, uuid)        to authenticated, service_role;
grant execute on function public.report_no_show(uuid, uuid, text)        to authenticated, service_role;
grant execute on function public.resolve_no_show_event(uuid, text, text) to authenticated, service_role;

-- Trigger functions: nothing should call these directly.
revoke execute on function public.recalc_reviewee_rating() from public;
revoke execute on function public.comly_privileged_write_active() from public;
revoke execute on function public.enforce_job_limits() from public;
revoke execute on function public.guard_profile_privileged_columns() from public;
