-- ════════════════════════════════════════════════════════════════════════════
-- Comly — re-consent, and a consent history to record it in
--
-- Two problems with consent as it stood after 0021:
--
--   1. record_legal_consent() cannot advance a version. It fills only NULL
--      columns (`coalesce(terms_version, p_terms_version)`), which was right
--      for its purpose — the OAuth signup path, where a retry must not move an
--      earlier acceptance forward — but means there is no way to record that
--      someone accepted a NEW version of a document.
--
--   2. Even if it could, it would overwrite. The profile carries one version
--      per document, so recording agreement to v2 destroys the evidence that
--      the user ever agreed to v1 — exactly the evidence that matters if a
--      dispute concerns conduct that happened while v1 was live.
--
-- So consent becomes an append-only log, in the same spirit as no_show_events
-- in 0015: auditable rows rather than a value that gets rewritten. The columns
-- on `profiles` stay as the denormalised "what is current", because every
-- read of a profile wants that and nobody wants a join for it.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The log ───────────────────────────────────────────────────────────────
create table if not exists legal_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  document     text not null check (document in ('terms', 'privacy')),
  version      text not null,
  accepted_at  timestamptz not null default now(),
  -- Accepting the same version twice is a no-op, not a second data point.
  unique (user_id, document, version)
);

create index if not exists legal_consents_user_idx
  on legal_consents (user_id, accepted_at desc);

comment on table legal_consents is
  'Append-only record of every legal document version a user has accepted. '
  'profiles.terms_version / privacy_version hold the current values; this is '
  'the history behind them.';

alter table legal_consents enable row level security;

-- A user may read their own consent history and nothing else. There is no
-- client insert policy: rows are written only by the SECURITY DEFINER routines
-- below, so a user cannot fabricate an acceptance they never gave.
drop policy if exists "Owner reads own consent history" on legal_consents;
create policy "Owner reads own consent history"
  on legal_consents for select using (auth.uid() = user_id);

-- 0007 granted blanket table privileges; narrow them the way 0019 did.
revoke insert, update, delete on legal_consents from anon, authenticated;
grant select on legal_consents to authenticated;
grant all on legal_consents to service_role;

-- ── 2. Backfill what we already know ─────────────────────────────────────────
-- Existing profiles carry a version and a timestamp but no log row. Insert the
-- acceptance we have on record so the history is not misleadingly empty for
-- accounts that predate this table. Only where both are present — a version
-- without a timestamp would be a fabricated date.
insert into legal_consents (user_id, document, version, accepted_at)
select id, 'terms', terms_version, terms_accepted_at
  from profiles
 where terms_version is not null and terms_accepted_at is not null
on conflict (user_id, document, version) do nothing;

insert into legal_consents (user_id, document, version, accepted_at)
select id, 'privacy', privacy_version, privacy_accepted_at
  from profiles
 where privacy_version is not null and privacy_accepted_at is not null
on conflict (user_id, document, version) do nothing;

-- ── 3. Accepting a new version ───────────────────────────────────────────────
-- Distinct from record_legal_consent(), which stays as-is for first consent.
-- This one deliberately DOES move the stored version forward, and logs it.
--
-- Guarded the same way as 0021: the consent columns on profiles are pinned by
-- guard_profile_privileged_columns(), so the transaction-local flag is what
-- lets this routine through while a plain PostgREST update stays blocked.
create or replace function accept_legal_versions(
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

  insert into legal_consents (user_id, document, version)
  values (v_uid, 'terms', p_terms_version)
  on conflict (user_id, document, version) do nothing;

  insert into legal_consents (user_id, document, version)
  values (v_uid, 'privacy', p_privacy_version)
  on conflict (user_id, document, version) do nothing;

  perform set_config('comly.allow_consent_write', 'on', true);

  -- Unlike record_legal_consent this is a straight assignment, not a coalesce:
  -- advancing the version is the entire point. greatest() keeps it monotonic
  -- so a stale client cannot walk a user back to an older acceptance.
  update profiles
  set terms_version       = greatest(coalesce(terms_version, ''), p_terms_version),
      terms_accepted_at   = case
                              when coalesce(terms_version, '') < p_terms_version
                              then now() else terms_accepted_at
                            end,
      privacy_version     = greatest(coalesce(privacy_version, ''), p_privacy_version),
      privacy_accepted_at = case
                              when coalesce(privacy_version, '') < p_privacy_version
                              then now() else privacy_accepted_at
                            end
  where id = v_uid;
end;
$$;

-- Callable by signed-in users only, and only ever for themselves: the routine
-- reads auth.uid() and takes no user id, so an authenticated caller can do
-- nothing with it except consent on their own behalf (see 0010/0011).
revoke all on function accept_legal_versions(text, text) from public;
revoke all on function accept_legal_versions(text, text) from anon;
grant execute on function accept_legal_versions(text, text) to authenticated;
