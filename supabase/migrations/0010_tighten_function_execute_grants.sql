-- ════════════════════════════════════════════════════════════════════════════
-- Comly — scope EXECUTE grants to the functions that are actually an API
--
-- Migration 0007 fixed "permission denied for table jobs" by granting broad
-- privileges to anon/authenticated, and included `grant execute on all
-- functions in schema public`. That was wider than it needed to be: it also
-- handed out EXECUTE on every *trigger* function, which PostgREST then exposes
-- at /rest/v1/rpc/<name>. Supabase's advisor flags each one.
--
-- Direct invocation of a trigger function fails anyway (PostgreSQL refuses to
-- call one outside a trigger context), so this is hardening rather than an
-- open door — but they are SECURITY DEFINER and have no business being
-- reachable from the public API at all.
--
-- Note on safety: revoking EXECUTE does NOT disable the triggers. Trigger
-- functions are invoked by the table owner as part of the firing trigger and
-- do not consult the caller's EXECUTE privilege. The guards from 0005 and the
-- limits from 0004 keep working exactly as before.
--
-- The two genuine RPCs stay callable by signed-in users (the app depends on
-- them) but lose the pointless `anon` grant: both derive everything from
-- auth.uid(), so an anonymous caller could only ever get an error or an empty
-- result.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Trigger + event-trigger functions: not an API surface ───────────────────
revoke execute on function public.enforce_job_limits()                    from anon, authenticated;
revoke execute on function public.guard_application_mutations()           from anon, authenticated;
revoke execute on function public.guard_profile_privileged_columns()      from anon, authenticated;
revoke execute on function public.guard_verification_privileged_columns() from anon, authenticated;
revoke execute on function public.handle_new_user()                       from anon, authenticated;
revoke execute on function public.sync_email_verified()                   from anon, authenticated;
revoke execute on function public.set_updated_at()                        from anon, authenticated;
revoke execute on function public.rls_auto_enable()                       from anon, authenticated;

-- ── Real RPCs: signed-in callers only ───────────────────────────────────────
revoke execute on function public.accept_application(uuid, uuid) from anon;
revoke execute on function public.get_job_contact(uuid)          from anon;
grant  execute on function public.accept_application(uuid, uuid) to authenticated;
grant  execute on function public.get_job_contact(uuid)          to authenticated;

-- ── Pin a mutable search_path ───────────────────────────────────────────────
-- Every other function already sets this; set_updated_at (from 0001) was the
-- one holdout. An unpinned search_path lets whatever schema precedes public
-- resolve the function's references.
create or replace function set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
