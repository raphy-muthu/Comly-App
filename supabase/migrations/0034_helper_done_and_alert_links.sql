-- ════════════════════════════════════════════════════════════════════════════
-- Comly — the helper can say "I'm done", and alerts link to what they're about
--
-- 1. Helper "I'm done". Until now only the poster could start completion
--    (request_job_completion, 0015). If a helper finished and the poster never
--    tapped "Mark as completed", the job sat in progress with no way for the
--    helper to move it. mark_job_done_by_helper() records helper_done_at and
--    alerts the poster. The poster then either confirms (the job completes at
--    once, since both sides have now agreed) or says it isn't finished
--    (decline_helper_done, which clears the flag and tells the helper why).
--    request_job_completion() completes directly when helper_done_at is set,
--    so the poster's "Confirm complete" card and the existing "Mark as
--    completed" menu item behave the same.
--
-- 2. Alert links. notifications.payload has existed since 0001 but no
--    function ever filled it, so the app couldn't open the job an alert was
--    about. Every job-related notification now carries {"job_id": ...}. The
--    functions are recreated from their latest versions (0015, 0028) with only
--    the payload added; their checks are unchanged.
--
-- 3. Two alerts that were declared but never sent: application_received (the
--    poster when someone applies) and review_received (whoever was reviewed).
--
-- Report alerts (report_no_show / resolve_no_show_event) are left as they
-- are: the app routes report_update to the Safety Center by type.
-- ════════════════════════════════════════════════════════════════════════════

alter type notification_type add value if not exists 'helper_marked_done';

alter table jobs add column if not exists helper_done_at timestamptz;

-- ── Guard: helper_done_at is workflow state, like the 0025 columns ───────────
-- Same function as 0025 plus helper_done_at. Must stay non-SECURITY DEFINER
-- (see 0025): current_user is how it tells client writes from the RPCs.
create or replace function guard_job_workflow_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status                  := 'open';
    new.assigned_helper_id      := null;
    new.contact_unlocked_at     := null;
    new.completion_requested_at := null;
    new.completed_at            := null;
    new.helper_done_at          := null;
    return new;
  end if;

  new.assigned_helper_id      := old.assigned_helper_id;
  new.contact_unlocked_at     := old.contact_unlocked_at;
  new.completion_requested_at := old.completion_requested_at;
  new.completed_at            := old.completed_at;
  new.helper_done_at          := old.helper_done_at;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'This job is already closed'
        using errcode = 'check_violation';
    end if;

    if not (
      (new.status = 'paused'    and old.status in ('open', 'reviewing'))
      or (new.status = 'open'   and old.status = 'paused')
      or new.status in ('filled', 'cancelled')
    ) then
      raise exception 'That status change is not allowed'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ── Shared completion step ───────────────────────────────────────────────────
-- What confirm_job_completion (0015) did once both sides agreed, pulled out so
-- the poster confirming a helper's "I'm done" finishes a job the same way.
-- Callers have already locked and checked the job.
create or replace function finish_job_completion(p_job jobs)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update jobs
  set status = 'completed',
      completed_at = now(),
      helper_done_at = null,
      updated_at = now()
  where id = p_job.id;

  -- Completed work is what jobs_count is meant to measure (0015).
  perform set_config('comly.privileged_write', 'on', true);
  update profiles set jobs_count = jobs_count + 1, updated_at = now()
  where id in (p_job.customer_id, p_job.assigned_helper_id);
  perform set_config('comly.privileged_write', 'off', true);

  insert into notifications (user_id, type, title, body, payload)
  values
    (p_job.customer_id, 'completion_confirmed', 'Job confirmed complete',
     '"' || p_job.title || '" is done. Leave a review to build your helper''s reputation.',
     jsonb_build_object('job_id', p_job.id)),
    (p_job.assigned_helper_id, 'completion_confirmed', 'Job complete',
     '"' || p_job.title || '" is complete. Leave a review for the customer.',
     jsonb_build_object('job_id', p_job.id));
end;
$$;

-- ── Completion RPCs (0015 + payload + helper_done_at) ────────────────────────
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

  -- The helper already said it's done, so both sides agree: finish now.
  if v_job.helper_done_at is not null then
    perform finish_job_completion(v_job);
    return;
  end if;

  update jobs
  set status = 'pending_confirmation',
      completion_requested_at = now(),
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_job.assigned_helper_id, 'completion_requested', 'Confirm the job is done',
    'The customer marked "' || v_job.title ||
      '" complete. Confirm so you can both leave reviews.',
    jsonb_build_object('job_id', v_job.id)
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

  perform finish_job_completion(v_job);
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

  update jobs
  set status = 'in_progress',
      completion_requested_at = null,
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_job.customer_id, 'completion_requested', 'Completion not confirmed',
    'Your helper says "' || v_job.title || '" isn''t finished yet: ' ||
      coalesce(nullif(trim(p_reason), ''), 'no reason given'),
    jsonb_build_object('job_id', v_job.id)
  );
end;
$$;

-- ── Helper "I'm done" ────────────────────────────────────────────────────────
create or replace function mark_job_done_by_helper(p_job_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_helper_name text;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.assigned_helper_id is distinct from auth.uid() then
    raise exception 'Only the accepted helper can mark this job done';
  end if;
  if v_job.status not in ('accepted', 'in_progress') then
    raise exception 'Only an accepted job can be marked done';
  end if;
  if v_job.helper_done_at is not null then
    raise exception 'You already let them know. They just need to confirm.';
  end if;

  update jobs set helper_done_at = now(), updated_at = now() where id = p_job_id;

  select name into v_helper_name from profiles where id = auth.uid();

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_job.customer_id, 'helper_marked_done', 'Your helper says the job is done',
    coalesce(nullif(trim(v_helper_name), ''), 'Your helper') || ' finished "' ||
      v_job.title || '". Confirm it so you can both leave reviews.',
    jsonb_build_object('job_id', v_job.id)
  );
end;
$$;

create or replace function decline_helper_done(p_job_id uuid, p_reason text)
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
    raise exception 'Only the job owner can answer this';
  end if;
  if v_job.helper_done_at is null or v_job.status not in ('accepted', 'in_progress') then
    raise exception 'Your helper hasn''t marked this job done';
  end if;

  update jobs set helper_done_at = null, updated_at = now() where id = p_job_id;

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_job.assigned_helper_id, 'completion_requested', 'Not finished yet',
    'The customer says "' || v_job.title || '" isn''t finished yet: ' ||
      coalesce(nullif(trim(p_reason), ''), 'no reason given'),
    jsonb_build_object('job_id', v_job.id)
  );
end;
$$;

-- ── accept_application (0028 + payload) ──────────────────────────────────────
create or replace function accept_application(p_job_id uuid, p_application_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_helper uuid;
  v_status application_status;
  v_title text;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can accept applications';
  end if;
  if v_job.status not in ('open', 'reviewing') then
    raise exception 'This job already has an outcome';
  end if;

  select helper_id, status into v_helper, v_status
  from applications
  where id = p_application_id and job_id = p_job_id;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'That application is no longer pending';
  end if;

  -- The tier may have changed since this person applied.
  if not helper_eligible_for_tier(v_helper, v_job.safety_tier) then
    raise exception 'This helper is not eligible for this job''s safety tier'
      using errcode = 'check_violation';
  end if;

  v_title := v_job.title;

  update applications set status = 'accepted', updated_at = now()
  where id = p_application_id;

  update applications set status = 'not_selected', updated_at = now()
  where job_id = p_job_id and id <> p_application_id and status = 'pending';

  update jobs
  set status = 'accepted',
      assigned_helper_id = v_helper,
      contact_unlocked_at = now(),
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_helper, 'application_accepted', 'You''re hired!',
    'You were accepted for "' || v_title || '". Contact details are now unlocked.',
    jsonb_build_object('job_id', p_job_id)
  );
  insert into notifications (user_id, type, title, body, payload)
  select a.helper_id, 'application_declined', 'Application update',
         'Another helper was selected for "' || v_title || '". Thanks for applying!',
         jsonb_build_object('job_id', p_job_id)
  from applications a
  where a.job_id = p_job_id and a.id <> p_application_id and a.status = 'not_selected';
end;
$$;

-- ── invite_helper_to_job (0028 + payload) ────────────────────────────────────
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

  if not helper_eligible_for_tier(p_helper_id, v_job.safety_tier) then
    raise exception 'That helper is not eligible for this job''s safety tier'
      using errcode = 'check_violation';
  end if;

  if (
    select count(*) from job_invites
    where customer_id = auth.uid() and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'You have sent too many invites today. Please try again tomorrow.'
      using errcode = 'check_violation';
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
      insert into notifications (user_id, type, title, body, payload)
      select p_helper_id, 'job_invite', 'You were invited to apply',
             'A neighbor thinks you''d be a good fit for "' || v_job.title ||
               '". Open it to apply.',
             jsonb_build_object('job_id', p_job_id)
      returning 1
    )
    select * from inserted;
end;
$$;

-- ── New alerts: someone applied / someone reviewed you ───────────────────────
create or replace function notify_application_received()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_helper_name text;
begin
  select * into v_job from jobs where id = new.job_id;
  if not found then
    return new;
  end if;
  select name into v_helper_name from profiles where id = new.helper_id;

  insert into notifications (user_id, type, title, body, payload)
  values (
    v_job.customer_id, 'application_received', 'New application',
    coalesce(nullif(trim(v_helper_name), ''), 'A neighbor') || ' applied to "' ||
      v_job.title || '".',
    jsonb_build_object('job_id', new.job_id, 'application_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_application_received on applications;
create trigger trg_notify_application_received
  after insert on applications
  for each row execute function notify_application_received();

create or replace function notify_review_received()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  select title into v_title from jobs where id = new.job_id;
  insert into notifications (user_id, type, title, body, payload)
  values (
    new.reviewee_id, 'review_received', 'You got a new review',
    'Someone left you a review for "' || coalesce(v_title, 'a job') || '".',
    jsonb_build_object('job_id', new.job_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_review_received on reviews;
create trigger trg_notify_review_received
  after insert on reviews
  for each row execute function notify_review_received();

-- ── Grants (0011 pattern) ────────────────────────────────────────────────────
revoke execute on function public.guard_job_workflow_columns() from public;
revoke execute on function public.finish_job_completion(jobs) from public, anon, authenticated;
revoke execute on function public.notify_application_received() from public;
revoke execute on function public.notify_review_received() from public;

revoke execute on function public.request_job_completion(uuid) from public, anon;
revoke execute on function public.confirm_job_completion(uuid) from public, anon;
revoke execute on function public.dispute_job_completion(uuid, text) from public, anon;
revoke execute on function public.mark_job_done_by_helper(uuid) from public, anon;
revoke execute on function public.decline_helper_done(uuid, text) from public, anon;
revoke execute on function public.accept_application(uuid, uuid) from public, anon;
revoke execute on function public.invite_helper_to_job(uuid, uuid) from public, anon;

grant execute on function public.request_job_completion(uuid) to authenticated, service_role;
grant execute on function public.confirm_job_completion(uuid) to authenticated, service_role;
grant execute on function public.dispute_job_completion(uuid, text) to authenticated, service_role;
grant execute on function public.mark_job_done_by_helper(uuid) to authenticated, service_role;
grant execute on function public.decline_helper_done(uuid, text) to authenticated, service_role;
grant execute on function public.accept_application(uuid, uuid) to authenticated, service_role;
grant execute on function public.invite_helper_to_job(uuid, uuid) to authenticated, service_role;
