-- ════════════════════════════════════════════════════════════════════════════
-- Comly — security hardening (pre-launch audit)
--
-- Fixes four audit findings:
--  1. CRITICAL  Private PII (phone, parent contacts, school email) was readable
--               by every authenticated user via `profiles` SELECT-all RLS.
--               → moved to `profiles_private` (owner-only RLS) + a contact RPC
--                 that only unlocks between matched parties.
--  2. HIGH      A helper could self-accept their own application (the old
--               UPDATE policy let helpers change `status` arbitrarily).
--               → acceptance now happens ONLY through an atomic
--                 SECURITY DEFINER RPC; helper updates restricted to
--                 pending/withdrawn.
--  3. HIGH      Teen-safety gating was client-side only; a minor could apply
--               to an 18+/blocked job via direct API.
--               → enforced in the applications INSERT policy.
--  4. MEDIUM    Listing limit (3 active) and rate limit (5/hr) were
--               client-side only. → enforced by a BEFORE INSERT trigger.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Split private PII out of profiles ─────────────────────────────────────
create table if not exists profiles_private (
  user_id                   uuid primary key references profiles (id) on delete cascade,
  phone_number              text,
  preferred_contact_method  text,
  parent_name               text,
  parent_email              text,
  school_email              text,
  updated_at                timestamptz not null default now()
);

alter table profiles_private enable row level security;

create policy "Owner reads own private profile"
  on profiles_private for select using (auth.uid() = user_id);
create policy "Owner inserts own private profile"
  on profiles_private for insert with check (auth.uid() = user_id);
create policy "Owner updates own private profile"
  on profiles_private for update using (auth.uid() = user_id);

-- Migrate existing data, then drop the exposed columns.
insert into profiles_private
  (user_id, phone_number, preferred_contact_method, parent_name, parent_email, school_email)
select id, phone_number, preferred_contact_method, parent_name, parent_email, school_email
from profiles
on conflict (user_id) do nothing;

alter table profiles drop column if exists phone_number;
alter table profiles drop column if exists preferred_contact_method;
alter table profiles drop column if exists parent_name;
alter table profiles drop column if exists parent_email;
alter table profiles drop column if exists school_email;

-- Keep the signup trigger provisioning both rows.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, neighborhood)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', '')
  );
  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);
  insert into public.profiles_private (user_id)
  values (new.id);
  return new;
end;
$$;

-- ── Contact unlock RPC (replaces fetching another user's profile) ────────────
-- Returns the OTHER party's contact card, only when the caller is the job's
-- customer or its accepted helper AND contact has been unlocked.
create or replace function get_job_contact(p_job_id uuid)
returns table (
  name text,
  avatar_url text,
  neighborhood text,
  phone_number text,
  preferred_contact_method text
)
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_other uuid;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null;
  if not found or v_job.contact_unlocked_at is null then
    return;
  end if;

  if auth.uid() = v_job.customer_id then
    v_other := v_job.assigned_helper_id;
  elsif auth.uid() = v_job.assigned_helper_id then
    v_other := v_job.customer_id;
  else
    return; -- caller is not a party to this job
  end if;

  if v_other is null then
    return;
  end if;

  return query
    select p.name, p.avatar_url, p.neighborhood, pp.phone_number, pp.preferred_contact_method
    from profiles p
    left join profiles_private pp on pp.user_id = p.id
    where p.id = v_other;
end;
$$;

-- ── 2. Atomic, owner-only acceptance ─────────────────────────────────────────
create or replace function accept_application(p_job_id uuid, p_application_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_helper uuid;
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

  select helper_id into v_helper
  from applications
  where id = p_application_id and job_id = p_job_id;
  if not found then
    raise exception 'Application not found';
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

  insert into notifications (user_id, type, title, body)
  values (
    v_helper, 'application_accepted', 'You''re hired!',
    'You were accepted for "' || v_title || '". Contact details are now unlocked.'
  );
  insert into notifications (user_id, type, title, body)
  select a.helper_id, 'application_declined', 'Application update',
         'Another helper was selected for "' || v_title || '". Thanks for applying!'
  from applications a
  where a.job_id = p_job_id and a.id <> p_application_id and a.status = 'not_selected';
end;
$$;

-- Helpers may no longer flip their own status to 'accepted'; owners decline
-- via a constrained direct update, and accept ONLY via the RPC above.
drop policy if exists "Helper can update own application; owner can update status" on applications;

create policy "Helpers update own pending applications"
  on applications for update
  using (auth.uid() = helper_id)
  with check (status in ('pending', 'withdrawn'));

create policy "Owners decline applications"
  on applications for update
  using (auth.uid() = (select customer_id from jobs where jobs.id = applications.job_id))
  with check (status in ('declined', 'not_selected'));

-- ── 3. Server-side teen-safety + open-job gate on applications ───────────────
drop policy if exists "Helpers can apply" on applications;

create policy "Helpers apply to eligible open jobs"
  on applications for insert
  with check (
    auth.uid() = helper_id
    and exists (
      select 1
      from jobs j
      join profiles p on p.id = auth.uid()
      where j.id = applications.job_id
        and j.deleted_at is null
        and j.status = 'open'
        and j.customer_id <> auth.uid()
        and j.safety_tier <> 'blocked'
        and (
          p.age_group = 'adult'
          or j.safety_tier in ('teen_safe', 'caution')
          or (
            j.safety_tier = 'adult_supervision'
            and exists (
              select 1 from verification_status v
              where v.user_id = auth.uid() and v.parent_approved
            )
          )
        )
    )
  );

-- ── 4. Listing + rate limits enforced server-side ────────────────────────────
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
    and status in ('open', 'reviewing', 'accepted', 'paused');
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

drop trigger if exists trg_job_limits on jobs;
create trigger trg_job_limits
  before insert on jobs
  for each row execute function enforce_job_limits();

-- ── Perf: feed query index (status filter + newest-first, live rows only) ────
create index if not exists jobs_feed_idx
  on jobs (status, created_at desc)
  where deleted_at is null;
