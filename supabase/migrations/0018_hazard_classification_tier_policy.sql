-- ════════════════════════════════════════════════════════════════════════════
-- Comly — gate applications on the sixteen_plus_only safety tier
--
-- Follows 0017_hazard_classification_tier.sql, which added the
-- 'sixteen_plus_only' safety_tier value in its own transaction so this
-- migration is free to reference it (see 0017's header for why the two
-- couldn't share one transaction).
--
-- Recreates the "Helpers apply to eligible open jobs" policy from 0004 with
-- one new branch: a helper may apply to a 'sixteen_plus_only' job only if
-- they're 16 or older. The bracket check mirrors effectiveAgeBracket() in
-- src/types/domain.ts, which every other age-gated check in the client goes
-- through, for the same two cases:
--
--   • age_bracket in ('sixteen_seventeen', 'adult') — the normal case, a
--     profile that went through 0013's age verification and has a real
--     bracket on file.
--
--   • age_bracket is null and age_group = 'adult' — a legacy account created
--     before 0013 added the age_bracket column at all. That profile was
--     already validated as an adult under the age_group-only scheme in force
--     at the time, so effectiveAgeBracket() resolves the missing bracket to
--     'adult' rather than penalizing the account for a column that didn't
--     exist yet. Admitted.
--
--   A legacy account with age_bracket null and age_group = 'teen' is NOT
--   admitted: effectiveAgeBracket() has no way to tell a legacy 13-year-old
--   from a legacy 17-year-old, so it resolves the unknown to the most
--   conservative bracket ('under_14') rather than guess upward. 'under_14'
--   fails the `in ('sixteen_seventeen', 'adult')` check above, so the branch
--   as a whole falls through and the helper is refused this tier — the same
--   outcome the client-side helper produces.
--
-- p.age_group = 'adult' at the very top of the policy already lets every true
-- adult through regardless of tier, so the new branch's own
-- `age_group = 'adult'` fallback only matters for the inconsistent-but-real
-- edge case where age_group somehow reads 'teen' while age_bracket already
-- reads 'adult'. Kept as its own explicit check rather than assumed away.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Helpers apply to eligible open jobs" on applications;

create policy "Helpers apply to eligible open jobs"
  on applications for insert
  with check (
    auth.uid() = helper_id
    and exists (
      select 1
      from jobs j
      join profiles p on p.id = auth.uid()
      where j.id = applications.job_id
        and j.deleted_at is null
        and j.status = 'open'
        and j.customer_id <> auth.uid()
        and j.safety_tier <> 'blocked'
        and (
          p.age_group = 'adult'
          or j.safety_tier in ('teen_safe', 'caution')
          or (
            j.safety_tier = 'sixteen_plus_only'
            and (
              p.age_bracket in ('sixteen_seventeen', 'adult')
              or (p.age_bracket is null and p.age_group = 'adult')
            )
          )
          or (
            j.safety_tier = 'adult_supervision'
            and exists (
              select 1 from verification_status v
              where v.user_id = auth.uid() and v.parent_approved
            )
          )
        )
    )
  );
