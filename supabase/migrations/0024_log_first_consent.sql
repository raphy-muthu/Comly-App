-- ════════════════════════════════════════════════════════════════════════════
-- Comly — log first consent, not only re-consent
--
-- 0023 added the legal_consents history and backfilled the accounts that
-- existed when it ran, but only accept_legal_versions() writes to it. That
-- leaves a hole that testing surfaced immediately: a brand new signup gets
-- terms_version on its profile and NO history row at all.
--
-- So the log would have recorded every re-acceptance while missing the
-- original one — the opposite of useful, since first consent is the agreement
-- that actually let the account exist. Both entry points now append.
--
-- Only the consent logging is new below. The date-of-birth handling is
-- unchanged from 0021 and still refuses under-13 signups outright.
-- ════════════════════════════════════════════════════════════════════════════

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

  -- The history entry for first consent. Same condition as the timestamp
  -- above: log only what was actually supplied.
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

  insert into public.profiles_private (user_id)
  values (new.id);

  return new;
end;
$$;

-- ── The OAuth first-consent path logs too ────────────────────────────────────
-- Unchanged in behaviour otherwise: still fills only null columns, so a retry
-- cannot move an earlier acceptance forward or re-point it at a newer version.
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

  -- Log what the profile now actually holds rather than what was passed in:
  -- if a previous call already recorded an acceptance, the coalesce above kept
  -- it, and logging the argument instead would invent a consent that the
  -- profile itself does not claim.
  insert into legal_consents (user_id, document, version)
  select v_uid, 'terms', terms_version from profiles
   where id = v_uid and terms_version is not null
  on conflict (user_id, document, version) do nothing;

  insert into legal_consents (user_id, document, version)
  select v_uid, 'privacy', privacy_version from profiles
   where id = v_uid and privacy_version is not null
  on conflict (user_id, document, version) do nothing;
end;
$$;

revoke all on function record_legal_consent(text, text) from public;
revoke all on function record_legal_consent(text, text) from anon;
grant execute on function record_legal_consent(text, text) to authenticated;
