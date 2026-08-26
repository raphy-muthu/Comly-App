-- ════════════════════════════════════════════════════════════════════════════
-- Comly — real age verification
--
-- Until now the only age signal in the system was `age_group`, a two-value
-- enum ('teen' | 'adult') that the user picked for themselves on the sign-up
-- screen. Two problems followed from that:
--
--   1. NO AGE FLOOR
--      Nothing recorded how old a user actually is, so nothing could enforce a
--      minimum. A 9-year-old selecting "Under 18" was indistinguishable from a
--      17-year-old, and both were admitted.
--
--   2. TEEN/ADULT IS TOO COARSE TO BE USEFUL
--      Federal hazardous-occupation and hours rules draw their lines at 14, 16
--      and 18. A single teen/adult split cannot express "old enough to mow, too
--      young to work past 7pm", so hazard- and hours-aware gating had nothing to
--      key off.
--
-- This migration stores an actual date of birth and derives everything else
-- from it server-side. The critical change is that `age_group` is no longer
-- read from client-supplied signup metadata at all — it is computed from the
-- stored date of birth, which closes the self-reported-age hole entirely.
--
-- Migration 0005 pinned `age_group` against self-service edits for exactly this
-- reason; the same protection is extended here to `date_of_birth` and
-- `age_bracket`, since all three are now inputs to the safety gate.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Bracket vocabulary ────────────────────────────────────────────────────
-- Mirrors the AgeBracket union in src/types/domain.ts. There is deliberately no
-- bracket below 'under_14': anyone younger than MIN_SIGNUP_AGE has no valid
-- bracket and is refused outright rather than filed under a lowest tier.
do $$ begin
  create type age_bracket as enum (
    'under_14',
    'fourteen_fifteen',
    'sixteen_seventeen',
    'adult'
  );
exception when duplicate_object then null; end $$;

-- ── 2. Columns ───────────────────────────────────────────────────────────────
-- Both nullable: rows created before this migration have no date of birth, and
-- back-filling them requires contacting those users rather than guessing. New
-- signups are required to supply one (see handle_new_user below), so the null
-- case is strictly historical.
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists age_bracket age_bracket;

comment on column profiles.date_of_birth is
  'Server-owned. Set once at signup, pinned against self-service edits by '
  'guard_profile_privileged_columns(). Source of truth for age_bracket and age_group.';

-- ── 3. Bracket derivation ────────────────────────────────────────────────────
-- The SQL counterpart of bracketFromDateOfBirth() in src/types/domain.ts. Both
-- must agree; the client copy exists only to give instant feedback on the
-- signup form, and this one is the gate that actually decides.
--
-- age() is used rather than subtracting years, because it accounts for whether
-- the birthday has already occurred this year — a plain year subtraction reports
-- someone as 13 for the ~year before they actually turn 13.
create or replace function compute_age_bracket(p_dob date)
returns age_bracket
language plpgsql
immutable
set search_path = public as $$
declare
  v_years int;
begin
  if p_dob is null then
    return null;
  end if;

  v_years := extract(year from age(current_date, p_dob));

  -- Below the floor, and future-dated births (which yield a negative age),
  -- both resolve to null — there is no bracket that admits them.
  if v_years < 13 then return null; end if;
  if v_years < 14 then return 'under_14'::age_bracket; end if;
  if v_years < 16 then return 'fourteen_fifteen'::age_bracket; end if;
  if v_years < 18 then return 'sixteen_seventeen'::age_bracket; end if;
  return 'adult'::age_bracket;
end;
$$;

-- ── 4. Signup: require a date of birth, derive everything from it ────────────
-- Replaces the 0006 version. The differences that matter:
--
--   • date_of_birth is now required, and a malformed or missing value aborts
--     the signup rather than defaulting to something permissive.
--   • Users below the floor are refused. Because this trigger is AFTER INSERT
--     on auth.users, raising here rolls back the auth row too, so a refused
--     signup leaves no orphaned account behind.
--   • age_group is DERIVED, not read from raw_user_meta_data. The client can
--     still send whatever it likes; nothing reads it any more.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role    text;
  v_roles   user_role[];
  v_dob_raw text;
  v_dob     date;
  v_bracket age_bracket;
  v_age     age_group;
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

  -- Everything downstream keys off the bracket, so age_group stops being an
  -- independent claim and becomes a projection of it.
  v_age := case when v_bracket = 'adult' then 'adult' else 'teen' end::age_group;

  insert into public.profiles (
    id, name, neighborhood, roles, age_group, date_of_birth, age_bracket
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', ''),
    v_roles,
    v_age,
    v_dob,
    v_bracket
  );

  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);

  insert into public.profiles_private (user_id)
  values (new.id);

  return new;
end;
$$;

-- ── 5. Pin the new columns against self-service edits ────────────────────────
-- Same rationale as 0005: RLS decides which ROW you may write, never which
-- COLUMNS. Without this, a signed-in user could raise their own date of birth
-- and re-derive themselves into the adult bracket with one API call, which is
-- the very hole this migration exists to close.
--
-- Server-side callers (service role, triggers) have no end-user JWT, so
-- auth.uid() is null for them and the guard steps aside — that remains the
-- intended path for a legitimate, verified correction.
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

  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  new.id := old.id;

  return new;
end;
$$;

-- ── 6. Keep the bracket honest as users age ──────────────────────────────────
-- age_bracket is a cached derivation of a moving value: a 15-year-old becomes
-- 16 without anything in the system changing. Recomputing on read everywhere
-- would be correct but scatters the rule; instead this recomputes the stored
-- bracket for every profile that has a date of birth, and is safe to schedule
-- daily (or run manually) since it only ever writes rows whose bracket is
-- actually stale.
create or replace function refresh_age_brackets()
returns int
language plpgsql
security definer
set search_path = public as $$
declare
  v_updated int;
begin
  with recomputed as (
    update profiles p
    set age_bracket = compute_age_bracket(p.date_of_birth),
        age_group = case
          when compute_age_bracket(p.date_of_birth) = 'adult' then 'adult'
          else 'teen'
        end::age_group
    where p.date_of_birth is not null
      and p.age_bracket is distinct from compute_age_bracket(p.date_of_birth)
    returning 1
  )
  select count(*) into v_updated from recomputed;

  return v_updated;
end;
$$;

-- Not callable from the client: this rewrites the inputs to the safety gate,
-- so it is a server-side maintenance routine only (see 0010/0011 for why the
-- implicit PUBLIC grant has to be revoked explicitly, not just from anon).
revoke all on function refresh_age_brackets() from public;
revoke all on function refresh_age_brackets() from anon;
revoke all on function refresh_age_brackets() from authenticated;
revoke all on function compute_age_bracket(date) from public;
revoke all on function compute_age_bracket(date) from anon;
revoke all on function compute_age_bracket(date) from authenticated;
