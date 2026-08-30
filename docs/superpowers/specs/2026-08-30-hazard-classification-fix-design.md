# Hazard classification fix — design

**Date:** 2026-08-30
**Status:** Approved, implementing
**Origin:** Legal risk register item #3 — "Hazard classification gap"

## Problem

`age_bracket` (`under_14` | `fourteen_fifteen` | `sixteen_seventeen` | `adult`)
was added to `profiles` by migration `0013_age_verification.sql`, but nothing
in the application reads it except the sign-up screen that writes it. Every
eligibility decision still runs on the coarse `AgeGroup` (`teen` | `adult`),
so the app cannot express age-specific restrictions.

The concrete consequence: `'mow'` sits in `ai.ts`'s lowest-severity
`CAUTION_TERMS` list, so a helper of any age — including a 13-year-old — can
accept a lawn-mowing job with no approval step. Weed whackers, string
trimmers, and hedge trimmers aren't represented in any list. Driving,
delivery, and door-to-door sales aren't either.

## Goal

Lawn-care power equipment should require the helper to be at least 16.
Driving/delivery and door-to-door sales should require 18+, matching the
platform's existing adult-only tier. Nothing else about the safety-tier
system changes.

## Design

### 1. Surface `age_bracket` on `UserProfile`

Add `ageBracket?: AgeBracket` to `UserProfile` in `src/types/domain.ts`.
Map it in `src/services/supabaseBackend.ts`'s `mapProfile()` from
`row.age_bracket`, the same way `date_of_birth` is already mapped. Give the
seeded teen users in `src/lib/mockData.ts` realistic brackets so mock mode
exercises the new tier.

### 2. New safety tier: `sixteen_plus_only`

Add to the `SafetyTier` union and `SAFETY_TIERS` record in `domain.ts`
(tone `danger`, positioned between `adult_supervision` and
`eighteen_plus_only` in severity). Migration `0017`:
- `alter type safety_tier add value if not exists 'sixteen_plus_only';`
- Updates the `0004` application-insert RLS policy so this tier admits
  `age_bracket in ('sixteen_seventeen', 'adult')` (or a NULL bracket on a
  legacy row falls back to the existing `age_group = 'adult'` check, so a
  pre-migration-0013 account isn't newly locked out of anything it could
  already do).

### 3. `eligibilityFor()` takes `ageBracket`, not `ageGroup`

Signature changes from `eligibilityFor(tier, ageGroup, parentApproved)` to
`eligibilityFor(tier, ageBracket, parentApproved)`. `AgeBracket` already
distinguishes `'adult'` from every teen sub-bracket, so it's a strict
superset of what `ageGroup` provided for this function. `ageGroup` itself is
untouched everywhere else (badges, display) — only this function and its two
call sites (`JobDetailScreen.tsx`, `ApplyToJobScreen.tsx`) change.

New branch: `sixteen_plus_only` refuses `under_14` and `fourteen_fifteen`,
admits everything else.

A profile with no `ageBracket` (a row created before migration `0013`
backfilled it) falls back to `ageGroup`: a legacy `'adult'` is treated as
admitted, since they were already validated as an adult under the old
system and shouldn't be newly restricted by a fix that only adds
information; a legacy `'teen'` falls back to the most conservative bracket,
`under_14`, since their real age within that range is unknown. This is the
same rule the RLS policy in step 2 applies server-side — one fallback,
enforced in both places, not two different ones.

### 4. Classifier keyword lists

`src/services/ai.ts`:
- Remove `'mow'` from `CAUTION_TERMS`.
- New `SIXTEEN_TERMS = ['mow', 'weed whacker', 'string trimmer', 'hedge trimmer']`,
  checked before `CAUTION_TERMS` in severity order, routing to
  `sixteen_plus_only`.
- Add `'driving'`, `'deliver'`, `'door-to-door'`, `'door to door'`,
  `'canvassing'` to `EIGHTEEN_TERMS` (not `BLOCKED_TERMS` — these need an age
  floor, not a platform-wide ban).

`supabase/functions/ai-safety-review/index.ts`: update the Gemini prompt's
tier list and examples so live classification matches the mock's categories
and severity ordering.

### 5. Tests (TDD, test-first for every behavior change)

- `domain.test.ts`: `eligibilityFor` branches for the new tier — blocks
  `under_14`/`fourteen_fifteen`, admits `sixteen_seventeen`/`adult`; the
  missing-bracket fallback.
- `ai.test.ts`: mower/trimmer prompts classify as `sixteen_plus_only`;
  driving/door-to-door prompts classify as `eighteen_plus_only`; existing
  `CAUTION_TERMS` cases (snow, ice, carry) still classify as `caution`, not
  swept up by the new list.

## Out of scope

- Hours/time-of-day limits (register item #7) — separate fix, depends on
  this one but isn't part of it.
- Any change to `eighteen_plus_only`'s or `blocked`'s existing behavior.
- Retroactively reclassifying already-posted jobs — the new tier only
  applies to jobs classified after this ships.
