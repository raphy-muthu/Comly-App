-- ════════════════════════════════════════════════════════════════════════════
-- Comly — record which legal terms each user actually agreed to
--
-- The sign-up screen now requires an explicit consent tick before an account
-- can be created. A tick that isn't written down proves nothing, so this
-- migration stores four things per profile:
--
--   terms_accepted_at / privacy_accepted_at — WHEN, set server-side with now()
--     rather than from the device clock, which the user controls.
--   terms_version / privacy_version         — WHAT, so a later change to the
--     documents can be compared against what each user saw. "The user agreed"
--     is close to useless without knowing which text they agreed to; this is
--     also what a re-consent prompt would key off.
--
-- All four are nullable. Accounts created before this migration never saw a
-- consent box, and back-filling them would be fabricating a record.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table profiles add column if not exists terms_accepted_at   timestamptz;
alter table profiles add column if not exists privacy_accepted_at timestamptz;
alter table profiles add column if not exists terms_version       text;
alter table profiles add column if not exists privacy_version     text;

comment on column profiles.terms_accepted_at is
  'Server-owned. Set once, at the moment consent was given. Written only by '
  'handle_new_user (email signup) or record_legal_consent (OAuth signup).';

-- ── 2. Signup: capture consent alongside the age gate ────────────────────────
-- Replaces the 0013 version. Only the consent handling is new; the date of
-- birth logic is unchanged and still refuses under-13 signups outright.
--
-- Consent metadata is recorded when present but is NOT required here, unlike
-- the date of birth. The reason is OAuth: Google and Apple create the auth row
-- themselves and there is no place to attach our metadata, so a hard
-- requirement in this trigger would make social sign-up impossible. Those
-- accounts call record_legal_consent immediately after the session is adopted
-- instead. The consent gate that actually blocks account creation is the
-- checkbox on the sign-up screen, which covers all three paths.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role      text;
  v_roles     user_role[];
  v_dob_raw   text;
  v_dob       date;
  v_bracket   age_bracket;
  v_age       age_group;
  v_terms_v   text;
  v_privacy_v text;
begin
  v_role := coalesce(new.raw_user_meta_data->'roles'->>0, 'customer');
  if v_role not in ('customer', 'helper') then
    v_role := 'customer';
  end if;
  v_roles := array[v_role]::user_role[];

  v_dob_raw := new.raw_user_meta_data->>'date_of_birth';
  if v_dob_raw is null or v_dob_raw = '' then
    raise exception 'A date of birth is required to create an account'
      using errcode = 'check_violation';
  end if;

  -- A value that is not a date is a rejection, never a fallback: silently
  -- admitting unparseable input is how an age gate stops being a gate.
  begin
    v_dob := v_dob_raw::date;
  exception when others then
    raise exception 'That date of birth is not a valid date'
      using errcode = 'check_violation';
  end;

  v_bracket := compute_age_bracket(v_dob);
  if v_bracket is null then
    raise exception 'You must be at least 13 years old to use Comly'
      using errcode = 'check_violation';
  end if;

  v_age := case when v_bracket = 'adult' then 'adult' else 'teen' end::age_group;

  v_terms_v   := nullif(new.raw_user_meta_data->>'terms_version', '');
  v_privacy_v := nullif(new.raw_user_meta_data->>'privacy_version', '');

  insert into public.profiles (
    id, name, neighborhood, roles, age_group, date_of_birth, age_bracket,
    terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', ''),
    v_roles,
    v_age,
    v_dob,
    v_bracket,
    v_terms_v,
    -- The timestamp is tied to the version, not set independently: a row with
    -- an acceptance time but no version would record that something was agreed
    -- to without recording what.
    case when v_terms_v is null then null else now() end,
    v_privacy_v,
    case when v_privacy_v is null then null else now() end
  );

  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);

  insert into public.profiles_private (user_id)
  values (new.id);

  return new;
end;
$$;

-- ── 3. Pin consent against self-service edits ────────────────────────────────
-- Same reasoning as 0005/0013: RLS decides which ROW you may write, never
-- which COLUMNS. A consent record a user can rewrite is not a record.
--
-- record_legal_consent needs a way through, and it cannot rely on the
-- auth.uid() escape hatch below — a SECURITY DEFINER function still runs with
-- the caller's JWT claims, so auth.uid() is their id, not null. Hence the
-- transaction-local flag: set only inside that function, cleared when the
-- transaction ends, and unreachable from a plain PostgREST update.
create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.is_admin := old.is_admin;

  -- Age inputs to the safety gate.
  new.age_group := old.age_group;
  new.date_of_birth := old.date_of_birth;
  new.age_bracket := old.age_bracket;
  new.parent_approval_status := old.parent_approval_status;

  -- Legal consent record.
  if coalesce(current_setting('comly.allow_consent_write', true), 'off') <> 'on' then
    new.terms_accepted_at := old.terms_accepted_at;
    new.privacy_accepted_at := old.privacy_accepted_at;
    new.terms_version := old.terms_version;
    new.privacy_version := old.privacy_version;
  end if;

  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  new.id := old.id;

  return new;
end;
$$;

-- ── 4. Consent for accounts we did not create ourselves ──────────────────────
-- OAuth sign-up path. Idempotent by construction: it only ever fills columns
-- that are still null, so a second call (a retry, or a user who signs in again
-- before the first write landed) cannot move an earlier acceptance forward or
-- silently re-point it at a newer version of the documents.
create or replace function record_legal_consent(
  p_terms_version text,
  p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_terms_version, '') = '' or coalesce(p_privacy_version, '') = '' then
    raise exception 'A document version is required to record consent'
      using errcode = 'check_violation';
  end if;

  perform set_config('comly.allow_consent_write', 'on', true);

  update profiles
  set terms_version       = coalesce(terms_version, p_terms_version),
      terms_accepted_at   = coalesce(terms_accepted_at, now()),
      privacy_version     = coalesce(privacy_version, p_privacy_version),
      privacy_accepted_at = coalesce(privacy_accepted_at, now())
  where id = v_uid;
end;
$$;

-- Callable by signed-in users only — it records consent for auth.uid() and
-- nobody else, so there is nothing an authenticated caller can do with it
-- except consent on their own behalf. anon has no session and would only ever
-- hit the 'Not signed in' branch (see 0010/0011 on revoking PUBLIC).
revoke all on function record_legal_consent(text, text) from public;
revoke all on function record_legal_consent(text, text) from anon;
grant execute on function record_legal_consent(text, text) to authenticated;
