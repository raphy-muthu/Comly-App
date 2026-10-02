-- ════════════════════════════════════════════════════════════════════════════
-- Comly — job owners can no longer forge an assignment, a contact unlock, or a
-- workflow status
--
-- 0002 lets an owner insert and update their own jobs with no column limits,
-- and until now only the boost columns were guarded (0016). That left the
-- columns the rest of the system trusts as proof of a real match writable by
-- the owner directly:
--
--   • assigned_helper_id + contact_unlocked_at — get_job_contact() (0004)
--     returns the other party's phone number when both are set. An owner could
--     set assigned_helper_id to ANY user id (ids are public) plus
--     contact_unlocked_at = now(), then read that person's phone number without
--     them ever applying. Verified locally: a 14-year-old's number leaked.
--   • status — setting 'completed' directly satisfied the review policy (0015),
--     and a forged assignment satisfied report_no_show() (0015), so an owner
--     could post reviews for, or file no-show strikes against, anyone.
--
-- The legitimate writers of these columns are the SECURITY DEFINER workflow
-- functions: accept_application, request/confirm/dispute_job_completion. Inside
-- a SECURITY DEFINER function current_user is the function's owner, while a
-- direct PostgREST write runs as 'authenticated'. So this guard enforces its
-- rules only when current_user is a client role, and lets the server's own
-- functions (and the service role) through without having to rewrite them.
--
-- For that reason this trigger function must NOT be SECURITY DEFINER: inside
-- one, current_user would always be the definer and the check would never
-- fire.
--
-- Owner status changes still allowed directly (matches JobOwnerMenu):
--   open/reviewing → paused, paused → open,
--   any unfinished status → filled or cancelled.
-- Everything else (accepted, in_progress, pending_confirmation, completed)
-- only happens through the workflow functions.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function guard_job_workflow_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status                  := 'open';
    new.assigned_helper_id      := null;
    new.contact_unlocked_at     := null;
    new.completion_requested_at := null;
    new.completed_at            := null;
    return new;
  end if;

  new.assigned_helper_id      := old.assigned_helper_id;
  new.contact_unlocked_at     := old.contact_unlocked_at;
  new.completion_requested_at := old.completion_requested_at;
  new.completed_at            := old.completed_at;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'This job is already closed'
        using errcode = 'check_violation';
    end if;

    if not (
      (new.status = 'paused'    and old.status in ('open', 'reviewing'))
      or (new.status = 'open'   and old.status = 'paused')
      or new.status in ('filled', 'cancelled')
    ) then
      raise exception 'That status change is not allowed'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_job_workflow on jobs;
create trigger trg_guard_job_workflow
  before insert or update on jobs
  for each row execute function guard_job_workflow_columns();

-- 0011 pattern: trigger functions are not callable directly.
revoke execute on function public.guard_job_workflow_columns() from public;
