-- ════════════════════════════════════════════════════════════════════════════
-- Comly — premium visibility (Comly Plus / Pro Helper)
--
-- Premium here is VISIBILITY ONLY. There is deliberately no subscription
-- table, no price, and no billing integration, because Comly processes no
-- money at all — pay is arranged between neighbors off-platform. What these
-- flags buy is sort order and a badge:
--
--   • profiles.is_customer_plus  → the customer's listings sort higher and
--                                  post pre-boosted.
--   • profiles.is_helper_pro     → the helper's applications sort above
--                                  regular ones on the customer's screen.
--   • jobs.is_boosted            → a time-boxed listing boost.
--   • applications.is_priority   → derived from the applicant's plan.
--
-- Free listings and free applicants are never hidden, only outranked — the
-- comparators in types/domain.ts fall through to match score, distance,
-- rating, and recency, so an unpaid listing with a better match still beats a
-- boosted one on every tiebreak below the boost.
--
-- Both plan flags are SERVER-OWNED. Granting them is an out-of-band admin /
-- service-role action; a client that could set its own is_helper_pro would
-- make application priority meaningless.
-- ════════════════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_customer_plus boolean not null default false;
alter table profiles add column if not exists is_helper_pro    boolean not null default false;

-- ── jobs ─────────────────────────────────────────────────────────────────────
alter table jobs add column if not exists is_boosted    boolean not null default false;
alter table jobs add column if not exists boosted_until timestamptz;

-- ── applications ─────────────────────────────────────────────────────────────
alter table applications add column if not exists is_priority boolean not null default false;
alter table applications add column if not exists priority_reason text;

-- ── Plan flags join the pinned columns ───────────────────────────────────────
-- Same reasoning as strikes in 0013: RLS gates the row, not the column, so a
-- BEFORE UPDATE trigger is what actually stops `update profiles set
-- is_helper_pro = true where id = <self>`.
create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;

  new.is_admin := old.is_admin;

  new.age_group := old.age_group;
  new.parent_approval_status := old.parent_approval_status;

  new.is_trusted := old.is_trusted;
  new.rating := old.rating;
  new.jobs_count := old.jobs_count;
  new.reputation_score := old.reputation_score;

  new.strikes := old.strikes;
  new.is_suspended := old.is_suspended;

  -- Paid/granted visibility tiers. Self-service assignment would let anyone
  -- put their own application at the top of every customer's list.
  new.is_customer_plus := old.is_customer_plus;
  new.is_helper_pro := old.is_helper_pro;

  new.id := old.id;

  return new;
end;
$$;

-- ── Boost is derived from the poster's plan, not client input ────────────────
-- The client sends no boost fields at all; a customer who could set
-- `is_boosted` on their own insert would get the perk for free.
create or replace function apply_listing_boost()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plus boolean;
begin
  select is_customer_plus into v_plus from profiles where id = new.customer_id;

  if coalesce(v_plus, false) then
    new.is_boosted := true;
    new.boosted_until := now() + interval '7 days';
  else
    new.is_boosted := false;
    new.boosted_until := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_listing_boost on jobs;
create trigger trg_apply_listing_boost
  before insert on jobs
  for each row execute function apply_listing_boost();

-- Owners may edit their listings (0002), which would otherwise let them flip
-- is_boosted themselves on a later update.
create or replace function guard_job_boost_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or comly_privileged_write_active() then
    return new;
  end if;
  new.is_boosted := old.is_boosted;
  new.boosted_until := old.boosted_until;
  return new;
end;
$$;

drop trigger if exists trg_guard_job_boost on jobs;
create trigger trg_guard_job_boost
  before update on jobs
  for each row execute function guard_job_boost_columns();

-- ── Application priority is derived from the applicant's plan ───────────────
create or replace function apply_application_priority()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pro boolean;
begin
  select is_helper_pro into v_pro from profiles where id = new.helper_id;

  new.is_priority := coalesce(v_pro, false);
  new.priority_reason := case
    when coalesce(v_pro, false) then 'Pro Helper — priority application'
    else null
  end;

  return new;
end;
$$;

drop trigger if exists trg_apply_application_priority on applications;
create trigger trg_apply_application_priority
  before insert on applications
  for each row execute function apply_application_priority();

-- 0005 already pins job_id/helper_id and post-decision terms on applications;
-- priority joins that set so a helper can't promote their own row after the
-- fact.
create or replace function guard_application_mutations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.job_id    := old.job_id;
  new.helper_id := old.helper_id;

  -- Derived from the applicant's plan at insert time; never client-editable.
  new.is_priority     := old.is_priority;
  new.priority_reason := old.priority_reason;

  if old.status in ('accepted', 'declined', 'not_selected') and auth.uid() = old.helper_id then
    new.message      := old.message;
    new.proposed_pay := old.proposed_pay;
    new.availability := old.availability;
  end if;

  return new;
end;
$$;

-- ── Feed index covering the boost-first ordering ─────────────────────────────
create index if not exists jobs_feed_boost_idx
  on jobs (is_boosted desc, created_at desc)
  where deleted_at is null;

-- ── Grants (0011 pattern: trigger functions stay unreachable) ────────────────
revoke execute on function public.apply_listing_boost()          from public;
revoke execute on function public.guard_job_boost_columns()      from public;
revoke execute on function public.apply_application_priority()   from public;
revoke execute on function public.guard_application_mutations()  from public;
revoke execute on function public.guard_profile_privileged_columns() from public;
