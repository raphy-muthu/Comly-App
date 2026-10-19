-- ════════════════════════════════════════════════════════════════════════════
-- Comly — neutral age refusal, and age brackets that keep up with birthdays
--
-- 1. Neutral refusal. The sign-up screen stopped naming the minimum age (FTC
--    COPPA guidance: a neutral age screen), but handle_new_user still raised
--    "You must be at least 13 years old", which anyone calling the API
--    directly would see. Same function as 0026's, only that message changed.
--    Legal documents still state the minimum age; that's expected and fine.
--
-- 2. Daily age-bracket refresh. age_bracket is cached from date_of_birth
--    (0013) and refresh_age_brackets() recomputes stale rows, but nothing ever
--    called it, so a 15-year-old who turned 16 stayed in the under-16
--    bracket and was refused 16+ work. Scheduled daily with pg_cron. Guarded:
--    if pg_cron isn't available (e.g. a local stack without it), the rest of
--    this migration still applies and the schedule is skipped with a notice.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Neutral refusal ──────────────────────────────────────────────────────
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
    raise exception 'We can''t create a Comly account with these details'
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

-- ── 2. Daily age-bracket refresh ────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- cron.schedule upserts by job name, so re-running this is harmless.
    -- 05:15 UTC = shortly after midnight US Eastern; birthdays roll over
    -- within a day of the date changing.
    perform cron.schedule(
      'refresh-age-brackets',
      '15 5 * * *',
      'select public.refresh_age_brackets();'
    );
  else
    raise notice 'pg_cron not available: refresh-age-brackets was not scheduled';
  end if;
end $$;
