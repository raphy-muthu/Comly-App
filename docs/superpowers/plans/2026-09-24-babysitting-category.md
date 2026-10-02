# Babysitting Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers post babysitting/childcare jobs, gated so that no minor can accept one without a parent's approval. Also fix the existing bug that stops 9 of 17 categories from being saved to the production database.

**Architecture:** `babysitting` becomes a new `JobCategory` value. A new "category tier floor" makes sure a babysitting job can never be stored below `adult_supervision`, whatever the keyword-based safety review says. The floor lives in one pure function in `src/types/domain.ts`, which the client and mock backend use. A Postgres trigger mirrors it, so a client can't write around it. A migration adds every missing value to the `job_category` Postgres enum, and a new test keeps the app and database category lists from drifting apart again.

**Tech Stack:** TypeScript, React Native/Expo SDK 56, Supabase (Postgres enums, triggers), Jest (node environment, `src/__tests__/*.test.ts`).

**Estimated effort:** ~5.5 engineering hours, plus a counsel check (Task 0) that runs on their schedule.

## Global Constraints

- **Never commit.** The user commits manually. Every "Commit" step below means: stop, and hand the user the suggested commit message instead of running `git commit`.
- Baseline before starting: `npm run typecheck` is clean, and `npm test` shows 146/146 passing. Both must still hold (plus the new tests) at the end of every task.
- Migration numbering: the newest existing migration is `0024_log_first_consent.sql`. This plan uses `0025` and `0026`. If another plan has already taken those numbers, use the next free ones and keep the two files in this order.
- `alter type ... add value` cannot share a transaction with SQL that *uses* the new value (see the header of `supabase/migrations/0017_hazard_classification_tier.sql`). That's why the enum migration (0025) and the trigger that references `'babysitting'` (0026) are separate files.
- Mock and real backends must behave the same. Any rule added to `supabaseBackend.ts` or SQL gets a matching rule in `mockBackend.ts`.
- Category floor for babysitting: **`adult_supervision`**. Any minor needs parent approval before applying; adults can apply freely. This is a product decision. The stricter option is `sixteen_plus_only`, which would bar under-16s even with a parent's approval. To switch, change the single value in `CATEGORY_TIER_FLOOR` and the matching literal in migration 0026.

---

### Task 0: Counsel and liability check (non-code gate, do before shipping)

**Files:** none

Childcare is a different risk profile from yard work or dog walking. Two decisions already made in this project were made before childcare was in scope:
- The approved §2 casual-labor clause in `src/legal/content.ts` lists example jobs ("yard work, pet sitting, tutoring...") without childcare.
- The founders decided to launch with no legal entity and no insurance (see the launch-readiness artifact, "Injury liability and insurance"). Injury to a child in a helper's care is a much bigger exposure than injury to a helper doing yard work.

- [ ] **Step 1:** Ask counsel two questions. (a) Does §2 need a childcare-specific sentence, for example that Comly does not background-check helpers and parents are responsible for vetting anyone caring for their children? (b) Does adding childcare change their advice on operating without an entity or insurance?
- [ ] **Step 2:** If counsel wants new ToS language, add it to §2 in `src/legal/content.ts`, then bump `TERMS_VERSION` and `TERMS_RECONSENT_SINCE` to that day's date. Follow the changelog comment convention already in that file.
- [ ] **Step 3:** Do not release the category (Task 3 ships it to users) until Steps 1–2 are resolved.

---

### Task 1: Make the database accept every app category (fixes a live bug)

This is a bug fix that ships on its own merits. `supabase/migrations/0001_init.sql` created the `job_category` enum with 8 values. The app has offered 17 categories since then, and no migration ever added the other 9. Against the real backend, posting a Yard Work, Leaf Cleanup, Dog Walking, Moving Help, Cleaning, Organization, Plant Watering, Car Washing, or Other job fails with `invalid input value for enum job_category`. Mock mode never touches Postgres enums, which is why this went unnoticed. It's the same bug class `0008_enum_value_mismatches.sql` fixed for other enums.

**Files:**
- Create: `supabase/migrations/0025_job_category_enum_values.sql`
- Create: `src/__tests__/categoryEnum.test.ts`
- Modify: `src/types/database.ts:13-21` (`JobCategoryEnum`)

**Interfaces:**
- Consumes: `JOB_CATEGORIES` from `src/types/domain.ts`
- Produces: the database enum contains `'babysitting'` (used by Task 3's trigger)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/categoryEnum.test.ts`:

```ts
/**
 * The app's category list and the Postgres job_category enum must match.
 *
 * They drifted once already: 0001 created the enum with 8 values while the app
 * grew to 17, and every job in the other 9 categories failed to insert against
 * the real database. Mock mode never touches Postgres enums, so nothing else
 * would catch that. This test reads the migrations directly.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { JOB_CATEGORIES } from '@/types/domain';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

function jobCategoryEnumValues(): Set<string> {
  const values = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const created = sql.match(/create type job_category as enum \(([^)]*)\)/i);
    if (created) {
      for (const m of created[1].matchAll(/'([a-z_]+)'/g)) values.add(m[1]);
    }
    for (const m of sql.matchAll(
      /alter type job_category add value if not exists '([a-z_]+)'/gi
    )) {
      values.add(m[1]);
    }
  }
  return values;
}

describe('job_category enum', () => {
  it('has a database value for every category the app can post', () => {
    const inDb = jobCategoryEnumValues();
    const missing = Object.keys(JOB_CATEGORIES).filter((c) => !inDb.has(c));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/categoryEnum.test.ts`
Expected: FAIL, with `missing` listing `yard_work`, `leaf_cleanup`, `dog_walking`, `moving_help`, `cleaning`, `organization`, `plant_watering`, `car_washing`, `other`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0025_job_category_enum_values.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- Comly — add the job_category values the app has always used
--
-- 0001 created job_category with 8 values. The app's JobCategory type grew to
-- 17 without a matching migration, so a real INSERT for any of the other 9
-- failed with `invalid input value for enum job_category`. Mock mode never
-- touches Postgres enums, so this surfaced only against the real database —
-- the same bug class 0008 fixed for job_status and notification_type.
--
-- 'babysitting' is added here too, ahead of the app code that uses it, so the
-- enum is never behind the client. It is referenced by the tier-floor trigger
-- in 0026, which must be a separate migration: a value added by ALTER TYPE
-- cannot be used in the same transaction that added it.
--
-- src/__tests__/categoryEnum.test.ts parses these statements to keep the app
-- and the enum from drifting apart again.
-- ════════════════════════════════════════════════════════════════════════════

alter type job_category add value if not exists 'yard_work';
alter type job_category add value if not exists 'leaf_cleanup';
alter type job_category add value if not exists 'dog_walking';
alter type job_category add value if not exists 'moving_help';
alter type job_category add value if not exists 'cleaning';
alter type job_category add value if not exists 'organization';
alter type job_category add value if not exists 'plant_watering';
alter type job_category add value if not exists 'car_washing';
alter type job_category add value if not exists 'other';
alter type job_category add value if not exists 'babysitting';
```

- [ ] **Step 4: Update the hand-written database types**

In `src/types/database.ts`, replace the `JobCategoryEnum` type (currently lines 13–21) with:

```ts
export type JobCategoryEnum =
  | 'snow_removal'
  | 'yard_work'
  | 'lawn_care'
  | 'leaf_cleanup'
  | 'pool_cleaning'
  | 'pet_care'
  | 'dog_walking'
  | 'tutoring'
  | 'tech_help'
  | 'moving_help'
  | 'errands'
  | 'cleaning'
  | 'organization'
  | 'plant_watering'
  | 'car_washing'
  | 'house_sitting'
  | 'babysitting'
  | 'other';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx jest src/__tests__/categoryEnum.test.ts && npm run typecheck && npm test`
Expected: the new test PASSES, typecheck is clean, full suite 147/147.

- [ ] **Step 6: Apply the migration and verify against the real database**

Run: `npx supabase db push`
Then in the Supabase SQL Editor run:

```sql
select unnest(enum_range(null::job_category)) as value;
```

Expected: 18 rows, including `yard_work`, `other`, and `babysitting`.
Smoke test: in a build pointed at the real backend (`EXPO_PUBLIC_USE_MOCKS=false`), post a "Yard Work" job. Expected: it posts. Before this migration, it failed.

- [ ] **Step 7: Commit (user runs this)**

Suggested message: `Add missing job_category enum values so every category can be posted`

---

### Task 2: Add the babysitting category and the category tier floor

**Files:**
- Modify: `src/types/domain.ts:126-166` (`JobCategory`, `JOB_CATEGORIES`)
- Modify: `src/types/domain.ts` (add `CATEGORY_TIER_FLOOR` and `applyCategoryTierFloor` right after `eligibilityFor`, which ends at line 246)
- Modify: `src/services/ai.ts` (`DURATION_BANDS` ~line 57, `FIXED_PAY_BANDS` ~line 176, `HOURLY_PAY_BANDS` ~line 202)
- Create: `src/__tests__/babysitting.test.ts`

**Interfaces:**
- Consumes: `SafetyTier`, `JobCategory` from `src/types/domain.ts`
- Produces: `applyCategoryTierFloor(category: JobCategory, tier: SafetyTier): SafetyTier` and `CATEGORY_TIER_FLOOR: Partial<Record<JobCategory, SafetyTier>>`, both exported from `src/types/domain.ts` and used by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/babysitting.test.ts`:

```ts
/**
 * Babysitting is a category whose risk doesn't show up in the job's wording.
 * "Watch my two kids Friday night" contains none of the keywords the safety
 * review looks for, so without a category floor it would be classed
 * teen_safe and a 13-year-old could accept it with no parent involved.
 */

import { applyCategoryTierFloor, categoryLabel } from '@/types/domain';

describe('babysitting category', () => {
  it('has a display label', () => {
    expect(categoryLabel('babysitting')).toBe('Babysitting');
  });
});

describe('applyCategoryTierFloor', () => {
  it('raises babysitting jobs below the floor to adult_supervision', () => {
    expect(applyCategoryTierFloor('babysitting', 'teen_safe')).toBe('adult_supervision');
    expect(applyCategoryTierFloor('babysitting', 'caution')).toBe('adult_supervision');
  });

  it('never lowers a stricter tier', () => {
    expect(applyCategoryTierFloor('babysitting', 'adult_supervision')).toBe('adult_supervision');
    expect(applyCategoryTierFloor('babysitting', 'sixteen_plus_only')).toBe('sixteen_plus_only');
    expect(applyCategoryTierFloor('babysitting', 'eighteen_plus_only')).toBe('eighteen_plus_only');
    expect(applyCategoryTierFloor('babysitting', 'blocked')).toBe('blocked');
  });

  it('leaves categories without a floor untouched', () => {
    expect(applyCategoryTierFloor('dog_walking', 'teen_safe')).toBe('teen_safe');
    expect(applyCategoryTierFloor('house_sitting', 'caution')).toBe('caution');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/babysitting.test.ts`
Expected: FAIL. TypeScript reports that `'babysitting'` is not assignable to `JobCategory`, and that `applyCategoryTierFloor` is not exported.

- [ ] **Step 3: Add the category**

In `src/types/domain.ts`, add `| 'babysitting'` to the `JobCategory` union, between `| 'house_sitting'` and `| 'other'`:

```ts
  | 'house_sitting'
  | 'babysitting'
  | 'other';
```

In `JOB_CATEGORIES`, add this entry between `house_sitting` and `other`:

```ts
  babysitting: { label: 'Babysitting', icon: 'happy-outline' },
```

- [ ] **Step 4: Add the tier floor**

In `src/types/domain.ts`, immediately after the closing brace of `eligibilityFor` (currently line 246), add:

```ts
/** Least to most restrictive — the same order as the SafetyTier union. */
const TIER_RANK: Record<SafetyTier, number> = {
  teen_safe: 0,
  caution: 1,
  adult_supervision: 2,
  sixteen_plus_only: 3,
  eighteen_plus_only: 4,
  blocked: 5,
};

/**
 * Minimum tier for categories whose risk isn't visible in the job's wording.
 * The keyword safety review can only raise a tier based on what a poster
 * writes; "watch my kids Friday" reads as harmless, but caring for children
 * should never be something a minor takes on without a parent knowing.
 *
 * Mirrored by the enforce_category_tier_floor trigger (migration 0026), so a
 * client can't write a lower tier directly. Change both together.
 */
export const CATEGORY_TIER_FLOOR: Partial<Record<JobCategory, SafetyTier>> = {
  babysitting: 'adult_supervision',
};

/** Raises `tier` to the category's floor if it's below it; never lowers it. */
export function applyCategoryTierFloor(
  category: JobCategory,
  tier: SafetyTier
): SafetyTier {
  const floor = CATEGORY_TIER_FLOOR[category];
  if (!floor) return tier;
  return TIER_RANK[tier] >= TIER_RANK[floor] ? tier : floor;
}
```

- [ ] **Step 5: Add the AI pay and duration bands**

These three maps are typed `Record<JobCategory, ...>`, so typecheck fails until every one has a `babysitting` entry. In `src/services/ai.ts`:

In `DURATION_BANDS`, after `house_sitting: [60, 480],`, add:
```ts
  babysitting: [60, 360],
```

In `FIXED_PAY_BANDS`, after `house_sitting: [40, 60],`, add:
```ts
  babysitting: [30, 60],
```

In `HOURLY_PAY_BANDS`, after `house_sitting: [12, 18],`, add:
```ts
  babysitting: [15, 22],
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx jest src/__tests__/babysitting.test.ts src/__tests__/categoryEnum.test.ts && npm run typecheck && npm test`
Expected: both files PASS (the enum test still passes because 0025 already added `babysitting`), typecheck is clean, full suite passes.

If typecheck reports another `Record<JobCategory, ...>` missing `babysitting`, add an entry there too, following the pattern of `house_sitting` in that same map.

- [ ] **Step 7: Commit (user runs this)**

Suggested message: `Add babysitting category with a parent-approval tier floor`

---

### Task 3: Enforce the floor everywhere a job's tier is written

**Files:**
- Create: `supabase/migrations/0026_category_tier_floor.sql`
- Modify: `src/services/mockBackend.ts:185-249` (`createJob`) and `:250-257` (`updateJob`)
- Modify: `src/services/supabaseBackend.ts:349-351` (`createJob` insert)
- Modify: `src/screens/jobs/CreateJobScreen.tsx` (review badge ~line 696, `post()` ~line 277)
- Create: `src/__tests__/babysittingBackend.test.ts`

**Interfaces:**
- Consumes: `applyCategoryTierFloor` from Task 2
- Produces: nothing new. After this task, no code path can store a babysitting job below `adult_supervision`.

- [ ] **Step 1: Write the failing backend tests**

Create `src/__tests__/babysittingBackend.test.ts`. It's a separate file because the mock backend is stateful per module, and Jest gives each test file a fresh module registry.

```ts
/**
 * The babysitting tier floor has to hold at the storage layer, not just in
 * the posting screen — the edit flow and any direct call bypass the screen.
 */

import { mockBackend, signInAsMockPersona } from '@/services/mockBackend';
import { CreateJobInput } from '@/services/types';

const babysittingJob: CreateJobInput = {
  category: 'babysitting',
  title: 'Watch two kids Friday evening',
  description: 'Ages 6 and 9. Dinner is ready, bedtime at 8:30.',
  pay: 18,
  payType: 'hourly',
  neighborhood: 'Wayne',
  scheduledFor: 'Fri · 6:00 PM',
  isTimeFlexible: false,
  estimatedDuration: '3 hours',
  safetyTier: 'teen_safe',
  requiresAdultSupervision: false,
  equipmentStatus: 'not_needed',
  communityTags: [],
};

describe('babysitting tier floor in the mock backend', () => {
  beforeAll(() => {
    // Jordan has no active listings, so the 3-listing cap can't interfere.
    signInAsMockPersona('teen@example.com');
  });

  it('stores a babysitting job no lower than adult_supervision', async () => {
    const job = await mockBackend.createJob(babysittingJob);
    expect(job.safetyTier).toBe('adult_supervision');
    expect(job.requiresAdultSupervision).toBe(true);
  });

  it('re-applies the floor when the owner edits the tier down', async () => {
    const job = await mockBackend.createJob({
      ...babysittingJob,
      title: 'Saturday sitter',
      safetyTier: 'adult_supervision',
    });
    const updated = await mockBackend.updateJob(job.id, { safetyTier: 'teen_safe' });
    expect(updated.safetyTier).toBe('adult_supervision');
  });

  it('does not touch other categories', async () => {
    const job = await mockBackend.createJob({
      ...babysittingJob,
      category: 'dog_walking',
      title: 'Walk Biscuit',
    });
    expect(job.safetyTier).toBe('teen_safe');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/babysittingBackend.test.ts`
Expected: the first two tests FAIL (`Expected: "adult_supervision"`, `Received: "teen_safe"`). The third PASSES.

- [ ] **Step 3: Enforce the floor in the mock backend**

In `src/services/mockBackend.ts`, add `applyCategoryTierFloor` to the existing `from '@/types/domain'` import (the block that ends at line 26).

In `createJob`, just before `const job: Job = {`, add:

```ts
    const safetyTier = applyCategoryTierFloor(input.category, input.safetyTier);
```

Then in the object literal, replace:

```ts
      safetyTier: input.safetyTier,
      safetyNotes: input.safetyNotes,
      requiresAdultSupervision: input.requiresAdultSupervision,
```

with:

```ts
      safetyTier,
      safetyNotes: input.safetyNotes,
      requiresAdultSupervision:
        input.requiresAdultSupervision || safetyTier === 'adult_supervision',
```

In `updateJob`, replace:

```ts
    Object.assign(job, patch);
    return delay(job);
```

with:

```ts
    Object.assign(job, patch);
    job.safetyTier = applyCategoryTierFloor(job.category, job.safetyTier);
    if (job.safetyTier === 'adult_supervision') job.requiresAdultSupervision = true;
    return delay(job);
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/babysittingBackend.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Enforce the floor in the real backend's insert**

In `src/services/supabaseBackend.ts`, add `applyCategoryTierFloor` to its `@/types/domain` import. In `createJob`'s `.insert({...})`, replace:

```ts
        safety_tier: input.safetyTier,
        safety_notes: input.safetyNotes,
        requires_adult_supervision: input.requiresAdultSupervision,
```

with:

```ts
        safety_tier: applyCategoryTierFloor(input.category, input.safetyTier),
        safety_notes: input.safetyNotes,
        requires_adult_supervision:
          input.requiresAdultSupervision ||
          applyCategoryTierFloor(input.category, input.safetyTier) === 'adult_supervision',
```

`updateJob` doesn't know the job's category (`JobUpdateInput` has no `category`), so the trigger in Step 6 covers edits in production.

- [ ] **Step 6: Add the database trigger (the real enforcement)**

Create `supabase/migrations/0026_category_tier_floor.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- Comly — category tier floor (babysitting ≥ adult_supervision)
--
-- The keyword safety review can only raise a job's tier based on its wording,
-- and "watch my two kids Friday" contains nothing it flags. Caring for
-- children should never be something a minor accepts without a parent
-- knowing, so babysitting jobs are held to adult_supervision at minimum:
-- any minor needs parent approval to apply (see the applications INSERT policy
-- in 0018), adults are unaffected.
--
-- Mirrors applyCategoryTierFloor() / CATEGORY_TIER_FLOOR in
-- src/types/domain.ts. The client applies it too, but this trigger is what
-- stops a direct API write (or an edit, which never re-runs the review) from
-- storing a lower tier. Change both together.
--
-- Separate from 0025 because 'babysitting' was added to the enum there, and a
-- new enum value can't be used in the transaction that added it.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function enforce_category_tier_floor()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.category = 'babysitting'
     and new.safety_tier in ('teen_safe', 'caution') then
    new.safety_tier := 'adult_supervision';
    new.requires_adult_supervision := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_category_tier_floor on jobs;
create trigger trg_category_tier_floor
  before insert or update of safety_tier, category on jobs
  for each row execute function enforce_category_tier_floor();
```

- [ ] **Step 7: Show the floored tier on the posting screen**

Today the review step shows the raw AI tier (defaulting to `teen_safe`), while `post()` saves `caution` on failure. The earlier code review flagged this mismatch. Computing one effective tier fixes it for every category.

In `src/screens/jobs/CreateJobScreen.tsx`, add `applyCategoryTierFloor` to the existing `@/types/domain` import. Immediately before `const post = () => {` (currently line 259), add:

```ts
  // One tier for both the review badge and what gets saved, so the preview
  // can never promise something the stored job doesn't match.
  const effectiveTier = applyCategoryTierFloor(
    category,
    (safety?.tier ?? 'caution') as SafetyTier
  );
```

In `post()`, replace:

```ts
        safetyTier: (safety?.tier ?? 'caution') as SafetyTier,
        safetyNotes: safety?.note ?? 'Awaiting safety review.',
        requiresAdultSupervision: safety?.tier === 'adult_supervision',
```

with:

```ts
        safetyTier: effectiveTier,
        safetyNotes: safety?.note ?? 'Awaiting safety review.',
        requiresAdultSupervision: effectiveTier === 'adult_supervision',
```

At the review badge (~line 696), replace:

```tsx
                <SafetyBadge tier={(safety?.tier ?? 'teen_safe') as SafetyTier} />
```

with:

```tsx
                <SafetyBadge tier={effectiveTier} />
```

- [ ] **Step 8: Run everything**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 9: Apply the trigger and verify it in the real database**

Run: `npx supabase db push`
In the SQL Editor, with any existing job id:

```sql
update jobs set category = 'babysitting', safety_tier = 'teen_safe'
where id = '<some test job id>'
returning category, safety_tier, requires_adult_supervision;
```

Expected: `babysitting | adult_supervision | true`. Then restore that job's original category and tier, or delete the test job.

- [ ] **Step 10: Verify in the app**

In mock mode (`EXPO_PUBLIC_USE_MOCKS=true`), launch on the simulator:
1. As the default customer, post a job with category **Babysitting**, title "Watch my kids Friday". The review step should show the **Adult Supervision** badge, not Teen Safe.
2. Sign out, sign in as `teen@example.com` (Jordan, 16–17, parent-approved). Open the job. **Apply** should be enabled, since Jordan has parent approval.
3. In `src/lib/mockData.ts`, temporarily set Jordan's `verification.parentApproved` to `false` and reload. **Apply** should now be refused with "Parent/guardian approval is required for this task." Revert the temporary change.

- [ ] **Step 11: Commit (user runs this)**

Suggested message: `Enforce adult_supervision floor on babysitting jobs in client, mock, and database`

---

### Task 4: Update store copy for the new category

**Files:**
- Modify: `store-assets/STORE_LISTING.md` (description "WHAT PEOPLE USE IT FOR" line, keywords)

- [ ] **Step 1:** In the description's "WHAT PEOPLE USE IT FOR" line, add `Babysitting` after `Tutoring`:

```
Snow shoveling · Lawn mowing · Leaf cleanup · Dog walking · Pet sitting · Tutoring · Babysitting · Tech help for grandparents · Moving help · Errands · Car washing · Plant watering · House sitting
```

- [ ] **Step 2:** The `babysitting` keyword is now accurate and stays. Recount the keyword field: it must be 100 characters or fewer.
- [ ] **Step 3:** In the "Age rating" section of the same file, add a bullet: `- It includes **childcare jobs** (babysitting), which some questionnaires ask about as unsupervised contact with minors.` Answer that question honestly when you fill in the questionnaire.
- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Add babysitting to store listing copy`

---

## Time estimate

| Task | Est. |
|---|---|
| 0 — Counsel / liability check | 0.5 h of your time, plus counsel's turnaround |
| 1 — Database enum fix + drift test | 1.5 h |
| 2 — Category + tier floor | 1.5 h |
| 3 — Enforce floor in mock, client, DB | 2 h |
| 4 — Store copy | 0.5 h |
| **Total** | **~5.5 h engineering + 0.5 h yours** |
