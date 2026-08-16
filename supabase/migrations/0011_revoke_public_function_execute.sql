-- ════════════════════════════════════════════════════════════════════════════
-- Comly — revoke the implicit PUBLIC EXECUTE grant on functions
--
-- Follow-up to 0010, which was necessary but not sufficient. Verifying the
-- result showed `get_job_contact` still answering an anon-key caller with 200
-- despite `revoke execute ... from anon` having succeeded.
--
-- Cause: PostgreSQL grants EXECUTE to PUBLIC automatically when a function is
-- created. The ACL read `=X/postgres` — a grantee with an empty name, i.e.
-- PUBLIC. Revoking the role-specific grant leaves that inherited one intact,
-- so anon kept the privilege through PUBLIC. Revoking from a role only helps
-- once PUBLIC's own grant is gone.
--
-- Pattern here: strip PUBLIC, then grant back explicitly and only to the roles
-- that need it. Triggers are unaffected either way (a firing trigger does not
-- consult the caller's EXECUTE privilege), so the trigger functions get no
-- grant back at all.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Real RPCs: PUBLIC out, signed-in users + server back in ─────────────────
revoke execute on function public.accept_application(uuid, uuid) from public;
revoke execute on function public.get_job_contact(uuid)          from public;

grant execute on function public.accept_application(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_job_contact(uuid)          to authenticated, service_role;

-- ── Trigger + event-trigger functions: no caller should reach these ─────────
revoke execute on function public.enforce_job_limits()                    from public;
revoke execute on function public.guard_application_mutations()           from public;
revoke execute on function public.guard_profile_privileged_columns()      from public;
revoke execute on function public.guard_verification_privileged_columns() from public;
revoke execute on function public.handle_new_user()                       from public;
revoke execute on function public.sync_email_verified()                   from public;
revoke execute on function public.set_updated_at()                        from public;
revoke execute on function public.rls_auto_enable()                       from public;
