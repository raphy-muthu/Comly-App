-- ════════════════════════════════════════════════════════════════════════════
-- Comly — let a guardian approval request be re-sent
--
-- 0019 created one consent request per user and the edge function refused a
-- second one while the first was still pending. Two problems with that:
--
--   1. THE PROFILE SHEET OFFERS "SEND AGAIN". The server refused it, so the
--      button was dead — UI and server disagreed about whether a resend was a
--      supported action.
--
--   2. A FAILED EMAIL LOCKED THE USER OUT FOR THE FULL TTL. The request row is
--      written before the mail provider is called. If sending failed (no API
--      key configured, provider outage, typo'd address), the row and the
--      'pending' status stayed behind with no mail ever delivered, and the
--      dedupe check then blocked any retry for seven days. The only state a
--      user could reach was "waiting for an email that will never arrive".
--
-- A resend now supersedes: any still-pending request for that user is revoked
-- and a fresh token issued. Only the newest link ever works, which is also the
-- safer property — a link that was emailed to a mistyped address stops being
-- valid the moment a corrected one is sent.
--
-- A short cooldown replaces the dedupe as the abuse guard, since the point was
-- never "one request ever", it was "don't let this be used to send mail
-- repeatedly at someone".
-- ════════════════════════════════════════════════════════════════════════════

create or replace function create_parent_consent_request(
  p_user_id      uuid,
  p_parent_email text,
  p_token_hash   text,
  p_expires_at   timestamptz
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_recent timestamptz;
begin
  -- Abuse guard: one send per minute per user. Deliberately short — this is
  -- here to stop a loop mailing someone, not to ration legitimate retries
  -- after a typo or a provider failure.
  select max(created_at) into v_recent
  from parent_consent_requests
  where user_id = p_user_id;

  if v_recent is not null and v_recent > now() - interval '1 minute' then
    raise exception 'Please wait a moment before sending another approval request'
      using errcode = 'check_violation';
  end if;

  -- Supersede anything still outstanding, so only the newest link is live.
  update parent_consent_requests
  set status = 'revoked'
  where user_id = p_user_id
    and status = 'pending';

  insert into parent_consent_requests (user_id, parent_email, token_hash, expires_at)
  values (p_user_id, p_parent_email, p_token_hash, p_expires_at)
  returning id into v_id;

  perform set_config('comly.privileged_write', 'on', true);
  update profiles
  set parent_approval_status = 'pending', updated_at = now()
  where id = p_user_id
    -- Never walk an already-approved account backwards into 'pending'.
    and parent_approval_status <> 'approved';
  perform set_config('comly.privileged_write', 'off', true);

  return v_id;
end;
$$;
