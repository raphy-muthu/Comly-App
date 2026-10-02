-- ════════════════════════════════════════════════════════════════════════════
-- Comly — date of birth is private; signed-out callers read nothing
--
-- 0004 moved phone numbers and parent/school emails into profiles_private
-- because `profiles` is readable by everyone (0002: `using (true)`). 0013 then
-- added `date_of_birth` to `profiles` itself, so every user's EXACT birth date
-- — alongside their name and neighborhood — was readable by any signed-in
-- user, and, because 0007 granted SELECT to `anon`, by anyone holding the
-- public anon key compiled into the app. For a marketplace built around
-- minors, that is a list of children's birthdays and neighborhoods.
-- Verified locally before this migration: a stranger read a 14-year-old's
-- birth date, and the anon role read every profile.
--
-- The client never reads date_of_birth back (it only sends it at signup; the
-- server derives age_bracket from it). So it moves to profiles_private, which
-- only its owner can read, and is pinned there against self-edits.
--
-- Separately: the app requires sign-in for everything, and nothing on the
-- signed-out screens reads a table, so the anon role loses table access
-- entirely. RPCs are governed by function grants and are unaffected.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Move the column ──────────────────────────────────────────────────────
alter table profiles_private add column if not exists date_of_birth date;

insert into profiles_private (user_id)
select p.id from profiles p
where not exists (select 1 from profiles_private pp where pp.user_id = p.id);

-- Guarded so a re-run after step 6 (column already dropped) is a no-op.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'date_of_birth'
  ) then
    update profiles_private pp
    set date_of_birth = p.date_of_birth
    from profiles p
    where p.id = pp.user_id and p.date_of_birth is not null;
  end if;
end $$;

-- ── 2. Profile guard without date_of_birth ──────────────────────────────────
-- Sixth definition of this function (0005 → 0013 → 0015 → 0016 → 0021 → this).
-- Identical to 0021's except the date_of_birth line, which would fail once the
-- column is dropped below. Every other pinned column is carried over.
create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;

  new.is_admin := old.is_admin;

  -- Age inputs to the safety gate (0013). date_of_birth now lives in
  -- profiles_private and is pinned by guard_private_profile_columns().
  new.age_group := old.age_group;
  new.age_bracket := old.age_bracket;
  new.parent_approval_status := old.parent_approval_status;

  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  -- Moderation outcomes (0015).
  new.strikes := old.strikes;
  new.is_suspended := old.is_suspended;

  -- Paid/granted visibility tiers (0016).
  new.is_customer_plus := old.is_customer_plus;
  new.is_helper_pro := old.is_helper_pro;

  -- Legal consent record (0021).
  if coalesce(current_setting('comly.allow_consent_write', true), 'off') <> 'on' then
    new.terms_accepted_at := old.terms_accepted_at;
    new.privacy_accepted_at := old.privacy_accepted_at;
    new.terms_version := old.terms_version;
    new.privacy_version := old.privacy_version;
  end if;

  new.id := old.id;

  return new;
end;
$$;

-- ── 3. Pin date_of_birth in its new home ────────────────────────────────────
-- profiles_private's owner-update policy (0004) allows every column, which is
-- right for phone numbers but not for the source of truth behind age_bracket.
create or replace function guard_private_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;
  new.user_id := old.user_id;
  new.date_of_birth := old.date_of_birth;
  return new;
end;
$$;

drop trigger if exists trg_guard_private_profile_columns on profiles_private;
create trigger trg_guard_private_profile_columns
  before update on profiles_private
  for each row execute function guard_private_profile_columns();

-- ── 4. Signup writes the birth date to the private table ────────────────────
-- Same as 0024's handle_new_user except where date_of_birth is stored.
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
    id, name, neighborhood, roles, age_group, age_bracket,
    terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'neighborhood', ''),
    v_roles,
    v_age,
    v_bracket,
    v_terms_v,
    case when v_terms_v is null then null else now() end,
    v_privacy_v,
    case when v_privacy_v is null then null else now() end
  );

  if v_terms_v is not null then
    insert into public.legal_consents (user_id, document, version)
    values (new.id, 'terms', v_terms_v)
    on conflict (user_id, document, version) do nothing;
  end if;

  if v_privacy_v is not null then
    insert into public.legal_consents (user_id, document, version)
    values (new.id, 'privacy', v_privacy_v)
    on conflict (user_id, document, version) do nothing;
  end if;

  insert into public.verification_status (user_id, email_verified)
  values (new.id, new.email_confirmed_at is not null);

  insert into public.profiles_private (user_id, date_of_birth)
  values (new.id, v_dob);

  return new;
end;
$$;

-- ── 5. Bracket refresh reads the private birth date ─────────────────────────
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
    set age_bracket = compute_age_bracket(pp.date_of_birth),
        age_group = case
          when compute_age_bracket(pp.date_of_birth) = 'adult' then 'adult'
          else 'teen'
        end::age_group
    from profiles_private pp
    where pp.user_id = p.id
      and pp.date_of_birth is not null
      and p.age_bracket is distinct from compute_age_bracket(pp.date_of_birth)
    returning 1
  )
  select count(*) into v_updated from recomputed;

  return v_updated;
end;
$$;

-- ── 6. Drop the public copy ─────────────────────────────────────────────────
alter table profiles drop column if exists date_of_birth;

-- ── 7. Signed-out callers read no app tables ────────────────────────────────
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ── Grants (0011 pattern) ───────────────────────────────────────────────────
revoke execute on function public.guard_private_profile_columns() from public;
revoke all on function public.refresh_age_brackets() from public, anon, authenticated;
