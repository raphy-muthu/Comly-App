-- ════════════════════════════════════════════════════════════════════════════
-- Comly — remove RLS-bypassing views (Supabase Security Advisor: CRITICAL)
--
-- Plain views run with the view OWNER's privileges by default, not the
-- querying user's — meaning they bypass Row Level Security entirely. This was
-- inert while anon/authenticated had no table grants at all, but migration
-- 0007 (which fixed "permission denied for table jobs") also granted these
-- roles SELECT on every object in the schema, views included — so both views
-- below went from harmless-but-wrong to an active RLS bypass as a side effect
-- of that fix.
--
--  1. job_with_applicant_count — unused. Nothing in the app queries it (only
--     a hand-written type reference exists, never a `.from()` call). It also
--     selects `jobs.lat`/`jobs.lng` — the original exact-coordinate columns
--     from migration 0001, distinct from the `public_lat`/`public_lng` pair
--     migration 0003 introduced specifically so exact location is never shown
--     before a job is accepted. Nothing in the real backend currently writes
--     to lat/lng, so no live data has leaked through it — but an unused view
--     that would silently expose exact addresses to anon/authenticated the
--     moment those columns are ever populated is not worth keeping around.
--     Dropped outright rather than patched, since it has no callers.
--
--  2. community_impact_stats — used by the Community Impact screen. Only
--     exposes aggregate counts/averages, and the underlying jobs/profiles
--     tables already have "viewable by everyone" RLS policies, so today's
--     practical exposure is nil. Recreated with `security_invoker = true`
--     (Postgres 15+; this project runs 17.6) so it evaluates as the querying
--     user and respects RLS like a normal query would, rather than silently
--     bypassing it by construction.
-- ════════════════════════════════════════════════════════════════════════════

drop view if exists job_with_applicant_count;

create or replace view community_impact_stats
with (security_invoker = true) as
select
  count(*) filter (where status = 'completed') as completed_jobs,
  count(*) filter (where status = 'completed' and safety_tier = 'teen_safe') as teen_safe_jobs_completed,
  count(distinct customer_id) filter (
    where status = 'completed' and (created_with_senior_mode or 'senior_help' = any(community_tags))
  ) as seniors_helped,
  count(distinct customer_id) filter (
    where status = 'completed' and 'family_support' = any(community_tags)
  ) as families_helped,
  (select avg(reputation_score) from profiles where 'helper' = any(roles)) as average_trust_score,
  (select count(*) from (
     select customer_id from jobs where status = 'completed' group by customer_id having count(*) > 1
   ) r) as repeat_customers,
  (select count(*) from profiles where 'helper' = any(roles) and age_group = 'teen') as active_teen_helpers
from jobs
where deleted_at is null;
