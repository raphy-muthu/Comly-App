-- ════════════════════════════════════════════════════════════════════════════
-- Comly — privilege-escalation hardening
--
-- Migration 0002 granted users a blanket UPDATE on their own `profiles` row and
-- their own `verification_status` row:
--
--     create policy "Users can update their own profile"
--       on profiles for update using (auth.uid() = id);
--
-- RLS gates WHICH ROW you may write, never WHICH COLUMNS. Because trust,
-- moderation, and the entire teen-safety gate are all driven by columns on
-- those two rows, any signed-in user could escalate with a single API call:
--
--   1. ADMIN TAKEOVER
--      update profiles set is_admin = true where id = <self>
--      → unlocks the admin console: every abuse report and support ticket
--        platform-wide (0003's report/ticket policies trust `p.is_admin`).
--
--   2. TEEN-SAFETY BYPASS
--      update profiles set age_group = 'adult' where id = <self>
--      → 0004's application INSERT policy short-circuits on
--        `p.age_group = 'adult'`, so a minor self-clears 18+/blocked gating.
--
--   3. PARENT-APPROVAL FORGERY
--      update verification_status set parent_approved = true where user_id = <self>
--      → satisfies 0004's adult_supervision branch with no guardian involved.
--
--   4. REPUTATION FORGERY
--      update profiles set is_trusted = true, rating = 5, reputation_score = 100
--      → fabricates every trust signal the marketplace is built on.
--
-- These columns are server-owned. RLS alone cannot express that, so a BEFORE
-- UPDATE trigger pins them to their prior values for user-initiated writes.
--
-- Server-side callers (service role, DB triggers, webhooks) authenticate with
-- no end-user JWT, so `auth.uid()` is null for them and the guard steps aside —
-- that is the intended path for legitimately awarding a badge, granting admin,
-- or recomputing reputation.
-- ════════════════════════════════════════════════════════════════════════════

-- ── profiles: pin server-owned columns on self-service updates ───────────────
create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only constrain writes made by an end user acting on their own row.
  -- Service-role/trigger contexts have no JWT and pass through untouched.
  if auth.uid() is null then
    return new;
  end if;

  -- Moderation capability.
  new.is_admin := old.is_admin;

  -- Teen-safety gate input: changing this is an age claim, and 0004's
  -- application policy trusts it. Must come from a verified server flow.
  new.age_group := old.age_group;
  new.parent_approval_status := old.parent_approval_status;

  -- Earned reputation — derived from completed work and reviews, never
  -- self-asserted.
  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  -- Identity is fixed at signup; re-pointing a row would let a user graft
  -- their profile onto another account id.
  new.id := old.id;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_columns on profiles;
create trigger trg_guard_profile_columns
  before update on profiles
  for each row execute function guard_profile_privileged_columns();

-- ── verification_status: badges are awarded, never self-claimed ──────────────
-- photo_added / phone_added reflect data the user genuinely supplied, so those
-- stay writable. email_verified, school_email_verified and parent_approved are
-- attestations that require an out-of-band check.
create or replace function guard_verification_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.email_verified        := old.email_verified;
  new.school_email_verified := old.school_email_verified;
  new.parent_approved       := old.parent_approved;
  new.user_id               := old.user_id;

  return new;
end;
$$;

drop trigger if exists trg_guard_verification_columns on verification_status;
create trigger trg_guard_verification_columns
  before update on verification_status
  for each row execute function guard_verification_privileged_columns();

-- ── applications: stop helpers rewriting immutable fields ────────────────────
-- 0004 restricted the *status* a helper may set, but left job_id/helper_id and
-- post-decision edits open: an applicant could re-point their row at another
-- job, or silently rewrite their offer after being accepted.
create or replace function guard_application_mutations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- An application's identity never changes after insert.
  new.job_id    := old.job_id;
  new.helper_id := old.helper_id;

  -- Once decided, the terms are part of an agreement between two people.
  if old.status in ('accepted', 'declined', 'not_selected') and auth.uid() = old.helper_id then
    new.message      := old.message;
    new.proposed_pay := old.proposed_pay;
    new.availability := old.availability;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_application_mutations on applications;
create trigger trg_guard_application_mutations
  before update on applications
  for each row execute function guard_application_mutations();

-- ── accept_application: reject already-decided applications ──────────────────
-- The 0004 RPC checked that the *job* was undecided but never that the chosen
-- application was still pending, so an owner could "accept" a withdrawn or
-- previously-declined applicant.
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
