-- ════════════════════════════════════════════════════════════════════════════
-- Comly — guardian consent, by emailed approval link
--
-- `verification_status.parent_approved` has gated adult_supervision-tier work
-- since 0003, and 0005 correctly pinned it against self-service writes so a
-- minor cannot approve themselves. What never existed was the other half: any
-- mechanism at all by which a real guardian could set it. The Profile screen
-- has been showing a toast telling the user to ask a guardian, with nothing
-- behind it — the flag could only ever be false.
--
-- This closes that loop without giving guardians their own accounts. A minor
-- names a guardian email; the guardian receives a one-time link; following it
-- approves them. No login, no app install, no new account type. (Real
-- guardian accounts — and the parent-set hour limits that would depend on an
-- ongoing guardian session — are deliberately deferred.)
--
-- SECURITY — the token is stored hashed, never in plaintext.
-- The raw token exists only inside the emailed URL. Anyone holding a raw token
-- can approve a minor for supervised work, so a leak of this table must not
-- hand that capability over. Same reasoning as password hashing; the lookup
-- below hashes the presented token and compares digests.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists parent_consent_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  parent_email text not null,
  -- sha256 hex of the raw token. Unique so a digest collision or a duplicate
  -- insert surfaces as an error rather than two rows racing to approve.
  token_hash   text not null unique,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'expired', 'revoked')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  expires_at   timestamptz not null
);

create index if not exists parent_consent_requests_user_idx
  on parent_consent_requests (user_id, status);

alter table parent_consent_requests enable row level security;

-- A minor may read their own requests, which is what renders the
-- pending/approved state on their Profile. Deliberately no insert, update or
-- delete policy: every write goes through the SECURITY DEFINER paths below or
-- the service role. token_hash is readable by the owning user, which is
-- harmless — it is a digest, and they already hold the underlying secret's
-- delivery channel by definition.
drop policy if exists "Minors read their own consent requests" on parent_consent_requests;
create policy "Minors read their own consent requests"
  on parent_consent_requests for select
  using (auth.uid() = user_id);

-- 0007 set default privileges granting full DML on new tables to
-- anon/authenticated. That blanket default is wrong for this table: there is
-- no legitimate client write path, so the grant is narrowed to SELECT and the
-- rest revoked. RLS already blocks those writes; removing the grant puts a
-- harder gate in front of RLS, the same reasoning 0007 itself documents.
revoke insert, update, delete on parent_consent_requests from anon, authenticated;
grant select on parent_consent_requests to authenticated;
grant all on parent_consent_requests to service_role;

-- ── Let the verification guard honour the privileged-write flag ──────────────
-- 0005's version steps aside only when auth.uid() is null. 0015 introduced
-- comly_privileged_write_active() so a SECURITY DEFINER routine could make a
-- legitimate write to a pinned column while a JWT is still in scope, and
-- extended the *profiles* guard to honour it — the verification guard was
-- never updated to match. approve_parent_consent below needs exactly that,
-- so the two guards are brought back into line here.
create or replace function guard_verification_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;

  new.email_verified        := old.email_verified;
  new.school_email_verified := old.school_email_verified;
  new.parent_approved       := old.parent_approved;
  new.user_id               := old.user_id;

  return new;
end;
$$;

-- ── Request creation ────────────────────────────────────────────────────────
-- The edge function could insert this row directly with the service role, but
-- creating a request also has to move profiles.parent_approval_status to
-- 'pending', and that column is pinned by the 0005 guard. Routing both writes
-- through one SECURITY DEFINER function that raises the privileged-write flag
-- keeps every write to a pinned column inside the same explicit, auditable
-- pattern, rather than relying on the service role happening to present a null
-- auth.uid().
create or replace function create_parent_consent_request(
  p_user_id      uuid,
  p_parent_email text,
  p_token_hash   text,
  p_expires_at   timestamptz
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
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

-- ── Approval ────────────────────────────────────────────────────────────────
-- Returns a boolean rather than raising, and returns the *same* false for an
-- unknown, already-used, and expired token. The caller renders one generic
-- failure page from it, so following a link never reveals whether a given
-- token was real — that distinction is only useful to someone guessing.
create or replace function approve_parent_consent(p_token text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_req  parent_consent_requests%rowtype;
  v_hash text;
begin
  if p_token is null or length(p_token) < 20 then
    return false;
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_req
  from parent_consent_requests
  where token_hash = v_hash
  for update;

  if not found then
    return false;
  end if;

  if v_req.status <> 'pending' then
    return false;
  end if;

  if v_req.expires_at <= now() then
    update parent_consent_requests set status = 'expired' where id = v_req.id;
    return false;
  end if;

  perform set_config('comly.privileged_write', 'on', true);

  update verification_status
  set parent_approved = true, updated_at = now()
  where user_id = v_req.user_id;

  update profiles
  set parent_approval_status = 'approved', updated_at = now()
  where id = v_req.user_id;

  update parent_consent_requests
  set status = 'approved', approved_at = now()
  where id = v_req.id;

  perform set_config('comly.privileged_write', 'off', true);

  return true;
end;
$$;

-- Only the server may approve. A signed-in user has no legitimate reason to
-- call this, and the guardian who does follow the link has no account at all —
-- the edge function calls it on their behalf with the service role.
revoke execute on function public.approve_parent_consent(text) from public;
revoke execute on function public.approve_parent_consent(text) from anon;
revoke execute on function public.approve_parent_consent(text) from authenticated;
grant  execute on function public.approve_parent_consent(text) to service_role;

-- Same reasoning: only the server creates requests. A client that could call
-- this directly could mint a consent row for any user id it named.
revoke execute on function
  public.create_parent_consent_request(uuid, text, text, timestamptz) from public;
revoke execute on function
  public.create_parent_consent_request(uuid, text, text, timestamptz) from anon;
revoke execute on function
  public.create_parent_consent_request(uuid, text, text, timestamptz) from authenticated;
grant execute on function
  public.create_parent_consent_request(uuid, text, text, timestamptz) to service_role;

revoke execute on function public.guard_verification_privileged_columns() from public;
