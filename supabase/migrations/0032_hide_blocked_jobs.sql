-- ════════════════════════════════════════════════════════════════════════════
-- Comly — Blocked jobs are visible only to their owner and admins
--
-- The Terms (§6) say a Blocked task is "not permitted on Comly", and the app
-- shows teens age-restricted jobs with a clear "You can't apply" label rather
-- than hiding them. That only works if prohibited work is never in anyone's
-- feed. The posting screen refuses a Blocked classification, but a job can
-- still be stored Blocked — an edit that adds hazardous wording, or the 0027
-- keyword floor raising a direct API write — and 0002's "Jobs are viewable by
-- everyone" policy then showed it to every user, minors included.
--
-- The owner keeps sight of their own listing (so they can see why it isn't
-- getting applicants, and edit or delete it), and admins keep it for
-- moderation. Applications to Blocked jobs were already refused by 0018.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Jobs are viewable by everyone" on jobs;
drop policy if exists "Jobs are viewable unless blocked" on jobs;
create policy "Jobs are viewable unless blocked"
  on jobs for select
  using (
    safety_tier <> 'blocked'
    or customer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
