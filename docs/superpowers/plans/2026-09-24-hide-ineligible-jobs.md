# Hide Age-Ineligible Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the store listing's promise true: minors never see jobs their age rules out. Today every open job is shown to every user, and age is only checked when someone applies.

**Architecture:** One pure function, `canViewJob`, in `src/types/domain.ts` defines who may see a job. The mock backend calls it. A `security definer` SQL function mirrors it, and a new `jobs` SELECT policy uses that function, replacing the current `using (true)`. Because the rule lives in the database, every read path is covered at once: feed, job detail, deep links, saved jobs, and anything added later.

**Tech Stack:** TypeScript, Supabase Postgres RLS, Jest (node environment).

**Estimated effort:** ~6 engineering hours.

## Global Constraints

- **Never commit.** The user commits manually. Every "Commit" step means: stop, and give the suggested message.
- Baseline: `npm run typecheck` is clean and `npm test` passes before and after every task.
- Migration number: this plan uses `0027`. If Plan "Babysitting Category" hasn't run yet, `0025` and `0026` are still free. Use the next free number either way.
- Visibility rule (the product decision this plan encodes):
  - **Hidden** from a viewer: jobs whose tier their age can never satisfy. That means `eighteen_plus_only` for anyone under 18, `sixteen_plus_only` for anyone under 16, and `blocked` for everyone except the job's owner and admins.
  - **Still shown**: `adult_supervision` jobs. Parent approval unlocks them, so hiding them would hide the reason to get approval. The apply-time gate in `eligibilityFor` and the 0018 INSERT policy still refuses the application without approval.
  - **Always shown** to the job's owner, its assigned helper, anyone who already applied to it, and admins, whatever the tier. A job edited to a stricter tier after a teen applied must not vanish from that teen's history.
- Age resolution must match `effectiveAgeBracket()`. A missing `age_bracket` resolves to `'adult'` when `age_group = 'adult'`, and to `'under_14'` otherwise. The SQL must mirror this.
- The SQL function must be `security definer`. The `applications` SELECT policy (0002) already reads `jobs`. A `jobs` policy that reads `applications` under the caller's permissions would cause Postgres's "infinite recursion detected in policy" error. A definer function owned by the migration role reads `applications` without re-entering its policy.

---

### Task 1: Pure visibility rule

**Files:**
- Modify: `src/types/domain.ts` (add after `eligibilityFor`, which ends at line 246)
- Create: `src/__tests__/jobVisibility.test.ts`

**Interfaces:**
- Consumes: `AgeBracket`, `SafetyTier`, `Job` from `src/types/domain.ts`
- Produces:
  - `interface JobViewer { id: string; ageBracket: AgeBracket; isAdmin: boolean }`
  - `tierVisibleTo(tier: SafetyTier, ageBracket: AgeBracket): boolean`
  - `canViewJob(job: Pick<Job, 'customerId' | 'assignedHelperId' | 'safetyTier'>, viewer: JobViewer, hasApplied: boolean): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/jobVisibility.test.ts`:

```ts
/**
 * Who may see a job. The store listing promises that younger helpers never
 * see work their age rules out; this is the rule that makes that true.
 * Mirrored by job_visible_to_viewer() in migration 0027.
 */

import { canViewJob, JobViewer, tierVisibleTo } from '@/types/domain';

describe('tierVisibleTo', () => {
  it('shows adults everything except blocked', () => {
    expect(tierVisibleTo('eighteen_plus_only', 'adult')).toBe(true);
    expect(tierVisibleTo('sixteen_plus_only', 'adult')).toBe(true);
    expect(tierVisibleTo('blocked', 'adult')).toBe(false);
  });

  it('hides 18+ jobs from every minor', () => {
    expect(tierVisibleTo('eighteen_plus_only', 'sixteen_seventeen')).toBe(false);
    expect(tierVisibleTo('eighteen_plus_only', 'fourteen_fifteen')).toBe(false);
    expect(tierVisibleTo('eighteen_plus_only', 'under_14')).toBe(false);
  });

  it('shows 16+ jobs to 16-17 year olds only', () => {
    expect(tierVisibleTo('sixteen_plus_only', 'sixteen_seventeen')).toBe(true);
    expect(tierVisibleTo('sixteen_plus_only', 'fourteen_fifteen')).toBe(false);
    expect(tierVisibleTo('sixteen_plus_only', 'under_14')).toBe(false);
  });

  it('keeps approval-gated and open tiers visible to minors', () => {
    for (const tier of ['teen_safe', 'caution', 'adult_supervision'] as const) {
      expect(tierVisibleTo(tier, 'under_14')).toBe(true);
    }
  });
});

describe('canViewJob', () => {
  const teen: JobViewer = { id: 'u_teen', ageBracket: 'fourteen_fifteen', isAdmin: false };
  const adultJob = {
    customerId: 'u_owner',
    assignedHelperId: undefined,
    safetyTier: 'eighteen_plus_only' as const,
  };

  it('hides an 18+ job from an unrelated minor', () => {
    expect(canViewJob(adultJob, teen, false)).toBe(false);
  });

  it('always shows a job to its owner', () => {
    expect(canViewJob({ ...adultJob, customerId: 'u_teen' }, teen, false)).toBe(true);
  });

  it('keeps showing a job to someone who already applied', () => {
    expect(canViewJob(adultJob, teen, true)).toBe(true);
  });

  it('keeps showing a job to its assigned helper', () => {
    expect(canViewJob({ ...adultJob, assignedHelperId: 'u_teen' }, teen, false)).toBe(true);
  });

  it('shows admins everything, including blocked jobs', () => {
    const admin: JobViewer = { id: 'u_admin', ageBracket: 'adult', isAdmin: true };
    expect(canViewJob({ ...adultJob, safetyTier: 'blocked' }, admin, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/jobVisibility.test.ts`
Expected: FAIL — `canViewJob`, `JobViewer`, and `tierVisibleTo` are not exported from `@/types/domain`.

- [ ] **Step 3: Implement**

In `src/types/domain.ts`, immediately after `eligibilityFor` (and after `applyCategoryTierFloor`, if Plan "Babysitting Category" is already in), add the code below. `Job` is declared later in the file; that's fine, since TypeScript types are hoisted.

```ts
/** Who is looking at a job, reduced to what visibility depends on. */
export interface JobViewer {
  id: string;
  /** Resolve with effectiveAgeBracket() — never pass a raw, possibly-missing bracket. */
  ageBracket: AgeBracket;
  isAdmin: boolean;
}

/**
 * Whether a tier is something this age could ever take on. Parent approval
 * is deliberately NOT considered: adult_supervision stays visible to minors
 * because approval can unlock it, and eligibilityFor() refuses the
 * application itself until it does.
 */
export function tierVisibleTo(tier: SafetyTier, ageBracket: AgeBracket): boolean {
  if (tier === 'blocked') return false;
  if (ageBracket === 'adult') return true;
  if (tier === 'eighteen_plus_only') return false;
  if (tier === 'sixteen_plus_only') return ageBracket === 'sixteen_seventeen';
  return true;
}

/**
 * Whether a viewer may see a job at all. Mirrored by job_visible_to_viewer()
 * in migration 0027, which is what actually enforces this in production —
 * change both together.
 */
export function canViewJob(
  job: Pick<Job, 'customerId' | 'assignedHelperId' | 'safetyTier'>,
  viewer: JobViewer,
  hasApplied: boolean
): boolean {
  if (job.customerId === viewer.id) return true;
  if (viewer.isAdmin) return true;
  if (job.assignedHelperId === viewer.id || hasApplied) return true;
  return tierVisibleTo(job.safetyTier, viewer.ageBracket);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/jobVisibility.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Add canViewJob rule for hiding age-ineligible jobs`

---

### Task 2: Apply the rule in the mock backend

**Files:**
- Modify: `src/services/mockBackend.ts` (imports ~line 9–26; `listFeedJobs` lines 158–172; `getJob` lines 181–183)
- Create: `src/__tests__/jobVisibilityBackend.test.ts`

**Interfaces:**
- Consumes: `canViewJob`, `JobViewer`, `effectiveAgeBracket` from `src/types/domain.ts`
- Produces: `mockBackend.listFeedJobs()` and `mockBackend.getJob(id)` now respect visibility.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/jobVisibilityBackend.test.ts`. Seed facts it relies on, from `src/lib/mockData.ts`: `j_gutter` is an open `eighteen_plus_only` job owned by `u_marcus`. `u_jordan` (persona `teen@example.com`) is 16–17 and hasn't applied to it. The default session user, Sarah, is an adult admin.

```ts
/**
 * Visibility must hold in mock mode too, or mock-mode QA and screenshots show
 * a feed production would never render. Ordered: runs as Sarah first, then
 * switches to Jordan for the rest of the file.
 */

import { mockBackend, signInAsMockPersona } from '@/services/mockBackend';

describe('job visibility in the mock backend', () => {
  it('shows the 18+ gutter job to an adult', async () => {
    const feed = await mockBackend.listFeedJobs();
    expect(feed.some((j) => j.id === 'j_gutter')).toBe(true);
  });

  it('removes the 18+ gutter job from a 16-17 year old feed', async () => {
    signInAsMockPersona('teen@example.com');
    const feed = await mockBackend.listFeedJobs();
    expect(feed.some((j) => j.id === 'j_gutter')).toBe(false);
  });

  it('treats a deep link to a hidden job as not found', async () => {
    expect(await mockBackend.getJob('j_gutter')).toBeNull();
  });

  it('still shows the teen the jobs they are old enough for', async () => {
    const feed = await mockBackend.listFeedJobs();
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((j) => j.safetyTier !== 'eighteen_plus_only')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/jobVisibilityBackend.test.ts`
Expected: tests 2–4 FAIL (the gutter job is still in the teen's feed and still returned by `getJob`).

- [ ] **Step 3: Implement**

In `src/services/mockBackend.ts`, add `canViewJob`, `effectiveAgeBracket`, and `JobViewer` to the existing `from '@/types/domain'` import.

Right after the `db` object definition (after the line `blocked: new Set<string>(),` and its closing `};`), add:

```ts
/** The session user as canViewJob() sees them. */
function currentViewer(): JobViewer {
  return {
    id: sessionUser.id,
    ageBracket: effectiveAgeBracket(sessionUser.ageBracket, sessionUser.ageGroup),
    isAdmin: !!sessionUser.isAdmin,
  };
}

function viewerHasApplied(jobId: string): boolean {
  return db.applications.some(
    (a) => a.jobId === jobId && a.helperId === sessionUser.id
  );
}

/** Same rule the production jobs SELECT policy (migration 0027) enforces. */
function visibleToSession(job: Job): boolean {
  return canViewJob(job, currentViewer(), viewerHasApplied(job.id));
}
```

In `listFeedJobs`, add `&& visibleToSession(j)` as the last condition of the filter:

```ts
      .filter(
        (j) =>
          j.customerId !== sessionUser.id &&
          j.status === 'open' &&
          !j.isPaused &&
          !j.deletedAt &&
          !db.blocked.has(j.customerId) &&
          visibleToSession(j)
      )
```

Replace `getJob` with:

```ts
  async getJob(id) {
    const job = db.jobs.find((j) => j.id === id && !j.deletedAt);
    return delay(job && visibleToSession(job) ? job : null);
  },
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/jobVisibilityBackend.test.ts && npm run typecheck && npm test`
Expected: 4/4 PASS, and the whole suite still passes. The existing `mockBackend.test.ts` runs as Sarah (an admin), so its `getJob` calls are unaffected.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Hide age-ineligible jobs from the mock feed and job detail`

---

### Task 3: Enforce the rule in production with RLS

**Files:**
- Create: `supabase/migrations/0027_age_gated_job_visibility.sql`

**Interfaces:**
- Consumes: tables `jobs` (`customer_id`, `assigned_helper_id`, `id`, `safety_tier`), `applications` (`job_id`, `helper_id`), `profiles` (`id`, `is_admin`, `age_bracket`, `age_group`)
- Produces: SQL function `job_visible_to_viewer(uuid, uuid, uuid, safety_tier) returns boolean`; policy `"Jobs visible to age-eligible viewers"` on `jobs` (replaces `"Jobs are viewable by everyone"`)

No application code changes. `supabaseBackend.listFeedJobs` and `getJob` already read through RLS, and `getJob` uses `.maybeSingle()`, so a hidden job returns `null`. `JobDetailScreen` already renders "Job not found." for `null` (line 89).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0027_age_gated_job_visibility.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- Comly — minors never see jobs their age rules out
--
-- 0002 made every job readable by everyone (`using (true)`); age was only
-- checked when applying (0018). The store listing promises more than that:
-- younger helpers shouldn't see 18+ work at all. This replaces the open
-- SELECT policy with one that mirrors canViewJob() in src/types/domain.ts:
--
--   • owner, assigned helper, anyone who already applied, admins → always
--   • blocked → nobody else
--   • teen_safe / caution / adult_supervision → everyone (adult_supervision
--     stays visible because parent approval can unlock it; 0018 still
--     refuses the application without that approval)
--   • sixteen_plus_only → adults and 16–17
--   • eighteen_plus_only (and the unused legacy 'adults_only') → adults
--
-- Adulthood follows effectiveAgeBracket(): age_bracket = 'adult', or a legacy
-- profile with no bracket and age_group = 'adult'. A legacy teen with no
-- bracket resolves to under_14 — the most conservative reading.
--
-- SECURITY DEFINER is load-bearing, not a convenience: the applications
-- SELECT policy (0002) reads jobs, so a jobs policy that read applications as
-- the caller would recurse ("infinite recursion detected in policy"). The
-- definer (the migration role, which owns these tables) reads applications
-- without re-entering its policy.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function job_visible_to_viewer(
  p_customer_id        uuid,
  p_assigned_helper_id uuid,
  p_job_id             uuid,
  p_safety_tier        safety_tier
) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_customer_id = auth.uid()
    or p_assigned_helper_id = auth.uid()
    or exists (
      select 1 from applications a
      where a.job_id = p_job_id and a.helper_id = auth.uid()
    )
    or exists (
      select 1 from profiles p where p.id = auth.uid() and p.is_admin
    )
    or (
      p_safety_tier <> 'blocked'
      and (
        p_safety_tier in ('teen_safe', 'caution', 'adult_supervision')
        or exists (
          select 1 from profiles p
          where p.id = auth.uid()
            and (
              p.age_bracket = 'adult'
              or (p.age_bracket is null and p.age_group = 'adult')
              or (p_safety_tier = 'sixteen_plus_only'
                  and p.age_bracket = 'sixteen_seventeen')
            )
        )
      )
    )
  );
$$;

-- 0011 revoked default EXECUTE on functions; RLS evaluates this as the
-- querying role, so authenticated users need it explicitly.
revoke all on function job_visible_to_viewer(uuid, uuid, uuid, safety_tier) from public;
grant execute on function job_visible_to_viewer(uuid, uuid, uuid, safety_tier) to authenticated;

drop policy if exists "Jobs are viewable by everyone" on jobs;

create policy "Jobs visible to age-eligible viewers"
  on jobs for select
  using (job_visible_to_viewer(customer_id, assigned_helper_id, id, safety_tier));
```

- [ ] **Step 2: Apply**

Run: `npx supabase db push`
Expected: applies without error.

- [ ] **Step 3: Verify the policy as three different users**

You need three test accounts on the real backend: an adult, a 16–17-year-old, and a 14–15-year-old. You also need one open job at each of the tiers `eighteen_plus_only`, `sixteen_plus_only`, and `adult_supervision`, owned by the adult. In the SQL Editor, run this once per account:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<test account uuid>", "role": "authenticated"}';
select id, title, safety_tier from jobs where status = 'open' order by safety_tier;
rollback;
```

Expected:

| Viewer | 18+ job | 16+ job | adult_supervision job |
|---|---|---|---|
| Adult (owner) | visible | visible | visible |
| 16–17 | hidden | visible | visible |
| 14–15 | hidden | hidden | visible |

Also confirm there's no recursion error: as the adult owner, run `select * from applications where job_id = '<18+ job id>';`. Expected: rows return and there is no "infinite recursion" error.

- [ ] **Step 4: Verify the "already applied" exception**

As the 16–17 account, apply to the `sixteen_plus_only` job in the app. Then, in the SQL Editor as the adult, change that job's tier to `eighteen_plus_only`. Re-run the Step 3 query as the 16–17 account. Expected: the job is still visible, because they applied. Revert the tier afterward.

- [ ] **Step 5: Commit (user runs this)**

Suggested message: `Enforce age-gated job visibility with an RLS SELECT policy`

---

### Task 4: Verify on device and make the store copy exactly true

**Files:**
- Modify: `store-assets/STORE_LISTING.md` (description "SAFETY CHECKED BEFORE IT'S VISIBLE" paragraph)

- [ ] **Step 1: Walk through it on the simulator in mock mode**

With `EXPO_PUBLIC_USE_MOCKS=true`:
1. As the default user (Sarah), open the job feed. The ladder/gutter job is present.
2. Sign out, then sign in as `teen@example.com`. The gutter job is gone from the feed, and no filter chip brings it back.
3. Search the feed for "gutter". No results.

- [ ] **Step 2: Walk through it against the real backend**

With `EXPO_PUBLIC_USE_MOCKS=false`, repeat Step 1 using the three test accounts from Task 3. Results should match the table in Task 3, Step 3.

- [ ] **Step 3: Tighten the store copy to match exactly what the app does**

In `store-assets/STORE_LISTING.md`, replace the paragraph under `SAFETY CHECKED BEFORE IT'S VISIBLE` with:

```
Every job posted is reviewed and sorted into a safety tier. Yard work a 14-year-old can safely do is treated differently from work that needs to be 16+, which is treated differently again from adults-only jobs. Younger helpers never see work their age rules out — 16+ and 18+ jobs aren't hidden behind a warning, they aren't shown at all. Jobs that need a parent's OK say so up front, and can't be accepted until a parent approves.
```

The promotional text line, "Every job is safety-checked before a teen can see it", only stays true if edits re-run the safety review. The earlier code review found that `EditJobScreen` never calls `ai.safetyReview`. Until that's fixed, change the promotional text to:

```
Teens only see jobs their age allows, and contact stays private until you accept. Post small jobs and find trusted local helpers nearby.
```

- [ ] **Step 4: Commit (user runs this)**

Suggested message: `Align store copy with age-gated job visibility`

---

## Time estimate

| Task | Est. |
|---|---|
| 1 — Pure visibility rule + tests | 1 h |
| 2 — Mock backend + tests | 1 h |
| 3 — RLS migration + SQL verification with 3 accounts | 2.5 h |
| 4 — Device check + store copy | 1.5 h |
| **Total** | **~6 h** |
