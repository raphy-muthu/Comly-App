-- ════════════════════════════════════════════════════════════════════════════
-- Comly — accepting and inviting a helper both re-check age eligibility
--
-- Age eligibility was enforced in exactly one place: the applications INSERT
-- policy (0018). Two paths went around it:
--
--   • accept_application (0005) never looked at eligibility. A job whose tier
--     was raised after a teen applied (an owner edit, or the keyword floor in
--     0027 catching new wording) could still accept that teen — unlocking
--     contact between an adult and a minor on an 18+ job.
--   • invite_helper_to_job (0015) never looked at it either, and had no rate
--     limit. The invite notification carries the job's title, which the owner
--     writes, so any adult could push arbitrary text to any teen's
--     notifications, as often as they liked.
--
-- helper_eligible_for_tier() is the single SQL statement of the rule. It
-- mirrors the 0018 policy branch for branch (and eligibilityFor() in
-- src/types/domain.ts). Both functions below are otherwise identical to their
-- latest versions (0005 and 0015).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function helper_eligible_for_tier(p_helper uuid, p_tier safety_tier)
returns boolean language sql stable security definer set search_path = public as $$
  select p_tier <> 'blocked' and exists (
    select 1 from profiles p
    where p.id = p_helper
      and (
        p.age_group = 'adult'
        or p_tier in ('teen_safe', 'caution')
        or (
          p_tier = 'sixteen_plus_only'
          and (
            p.age_bracket in ('sixteen_seventeen', 'adult')
            or (p.age_bracket is null and p.age_group = 'adult')
          )
        )
        or (
          p_tier = 'adult_supervision'
          and exists (
            select 1 from verification_status v
            where v.user_id = p_helper and v.parent_approved
          )
        )
      )
  )
$$;

-- ── accept_application (0005 + eligibility) ─────────────────────────────────
create or replace function accept_application(p_job_id uuid, p_application_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_helper uuid;
  v_status application_status;
  v_title text;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can accept applications';
  end if;
  if v_job.status not in ('open', 'reviewing') then
    raise exception 'This job already has an outcome';
  end if;

  select helper_id, status into v_helper, v_status
  from applications
  where id = p_application_id and job_id = p_job_id;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'That application is no longer pending';
  end if;

  -- The tier may have changed since this person applied.
  if not helper_eligible_for_tier(v_helper, v_job.safety_tier) then
    raise exception 'This helper is not eligible for this job''s safety tier'
      using errcode = 'check_violation';
  end if;

  v_title := v_job.title;

  update applications set status = 'accepted', updated_at = now()
  where id = p_application_id;

  update applications set status = 'not_selected', updated_at = now()
  where job_id = p_job_id and id <> p_application_id and status = 'pending';

  update jobs
  set status = 'accepted',
      assigned_helper_id = v_helper,
      contact_unlocked_at = now(),
      updated_at = now()
  where id = p_job_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_helper, 'application_accepted', 'You''re hired!',
    'You were accepted for "' || v_title || '". Contact details are now unlocked.'
  );
  insert into notifications (user_id, type, title, body)
  select a.helper_id, 'application_declined', 'Application update',
         'Another helper was selected for "' || v_title || '". Thanks for applying!'
  from applications a
  where a.job_id = p_job_id and a.id <> p_application_id and a.status = 'not_selected';
end;
$$;

-- ── invite_helper_to_job (0015 + eligibility + daily cap) ────────────────────
create or replace function invite_helper_to_job(p_job_id uuid, p_helper_id uuid)
returns setof job_invites
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs%rowtype;
  v_is_helper boolean;
begin
  select * into v_job from jobs where id = p_job_id and deleted_at is null;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'You can only invite helpers to your own jobs';
  end if;
  if v_job.status not in ('open', 'reviewing') then
    raise exception 'You can only invite helpers to an open listing';
  end if;

  select 'helper' = any(roles) into v_is_helper from profiles where id = p_helper_id;
  if not coalesce(v_is_helper, false) then
    raise exception 'That neighbor is not signed up as a helper';
  end if;

  if exists (
    select 1 from blocked_users
    where (user_id = auth.uid() and blocked_user_id = p_helper_id)
       or (user_id = p_helper_id and blocked_user_id = auth.uid())
  ) then
    raise exception 'You cannot invite this helper';
  end if;

  if not helper_eligible_for_tier(p_helper_id, v_job.safety_tier) then
    raise exception 'That helper is not eligible for this job''s safety tier'
      using errcode = 'check_violation';
  end if;

  if (
    select count(*) from job_invites
    where customer_id = auth.uid() and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'You have sent too many invites today. Please try again tomorrow.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from job_invites where job_id = p_job_id and helper_id = p_helper_id) then
    raise exception 'You already invited this helper';
  end if;

  return query
    with inserted as (
      insert into job_invites (job_id, customer_id, helper_id)
      values (p_job_id, auth.uid(), p_helper_id)
      returning *
    ),
    notified as (
      insert into notifications (user_id, type, title, body)
      select p_helper_id, 'job_invite', 'You were invited to apply',
             'A neighbor thinks you''d be a good fit for "' || v_job.title ||
               '". Open it to apply.'
      returning 1
    )
    select * from inserted;
end;
$$;

-- ── Grants (0011 pattern) ────────────────────────────────────────────────────
revoke execute on function public.helper_eligible_for_tier(uuid, safety_tier) from public, anon, authenticated;
revoke execute on function public.accept_application(uuid, uuid) from public, anon;
grant execute on function public.accept_application(uuid, uuid) to authenticated, service_role;
revoke execute on function public.invite_helper_to_job(uuid, uuid) from public, anon;
grant execute on function public.invite_helper_to_job(uuid, uuid) to authenticated, service_role;
