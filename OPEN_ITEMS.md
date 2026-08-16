# Comly — Open Feature Requests

Context: Comly is a React Native/Expo neighborhood-services marketplace (residents post small jobs, helpers — including teens — apply). Backend is Supabase (Auth, Postgres, RLS, Storage, Edge Functions), with an existing safety-tier system (`teen_safe` / `caution` / `adult_supervision` / `eighteen_plus_only` / `blocked`) that gates who can apply to what, and a contact-unlock-after-acceptance model (helper/customer contact info is hidden until a job application is accepted, specifically to keep interactions inside the app's safety review). Mock-mode-first architecture: most things can be built and tested against `EXPO_PUBLIC_USE_MOCKS=true` without touching production data.

Each item below has: what was asked, what currently exists (verified by reading the code, not assumed), the design tension if any, and a suggested scope.

---

## 1. AI realistic-duration check + minimum-wage guideline

**Ask:** "Set a time boundary, have AI check if it's realistic" + "Add minimum wage guideline when signing up."

**Current state:** The `ai-job-assistant` edge function (`supabase/functions/ai-job-assistant/index.ts`) already returns `estimatedDuration` as a free-text string from Gemini when a job is posted. There is no validation of that duration against anything, and no minimum-wage display anywhere in the signup or job-posting flow.

**Scope:**
- Have the edge function's Gemini prompt also flag if the *user-entered* duration/pay combination looks unrealistic (e.g., "$20 for 8 hours" implies a sub-minimum-wage rate), returning a warning string the client can surface as a caution banner — reuse the existing safety-review caution UI pattern rather than inventing a new one.
- For minimum wage: this needs a real data source. There's no per-state/locality minimum wage table in the app today. Cheapest correct approach: a static lookup table (federal + a curated set of state minimums) surfaced as a hint on the pay-entry step, not a hard block — job pay is informal/negotiated, so this should inform, not gate.
- Federal minimum wage is $7.25/hr as a floor; if you want per-state accuracy, that's a maintenance burden (states update yearly) — flag this to the user rather than silently building a self-maintaining number.

---

## 2. Contact option for recommended helpers — ⚠️ SAFETY CONFLICT

**Ask:** "For recommended helpers, add an option where they can possibly contact them."

**Current state:** `src/components/people/HelperRow.tsx` — recommended-helper rows currently only have a "View" button that opens the helper's profile. No contact affordance exists. This is not an oversight — it's deliberate: contact information is unlocked only after a job application is *accepted*, specifically so that unvetted contact never happens outside the safety-review pipeline (relevant given teen users).

**The conflict:** Adding a direct "contact" button on a recommendation card (before any application/acceptance) bypasses that gate entirely — a resident could message a teen helper with zero safety review having occurred on a specific job.

**Recommended approach (needs a decision, not just code):**
- Do NOT expose raw contact info (phone/email) pre-acceptance.
- Instead, add an in-app "invite to apply" or "request to hire" action on the recommendation card — this creates a job-scoped application/invite record (reusing the existing application flow) rather than a raw contact channel. Contact stays locked until that invite is accepted, preserving the safety review.
- If the goal is lower-friction discovery rather than literal messaging, this satisfies the ask without reopening the safety gap.

---

## 3. No-show strike/penalty system

**Ask:** "If you accept a job, and you don't show up, point penalty/strike system."

**Current state:** `src/types/domain.ts` has `'no_show'` only as one value in the generic `ReportCategory` enum (i.e., it can be *reported* as a category of abuse). There is no strike counter, no trust-score field, no automated consequence, and no schema for tracking repeated no-shows per user.

**Scope (this is a real feature, not a bug fix):**
- New DB column(s): a `strikes` or `trust_score` counter on the user/profile table, plus a `no_show_events` table (job id, accused user id, reporter id, timestamp, resolution status) so strikes are auditable, not just a silently incrementing number.
- Define the actual policy before building: what counts as a no-show (reported by the other party? time-based auto-detection if a job's scheduled time passes with no check-in?), how many strikes trigger what (temporary suspension? permanent ban? just a visible badge to future posters?), and whether there's an appeal path (recommended — false reports are a real risk here).
- UI: strike count visible to the affected user (transparency), and probably to admins in `AdminScreen.tsx` (which already has a ticket/moderation surface to extend).
- This has real fairness/liability implications for a marketplace with teen users — recommend defining the policy in writing before implementation, not just shipping a counter.

---

## 4. AI for "Short Message to Customer"

**Ask:** "Add AI for 'Short Message to Customer'."

**Current state:** `src/screens/jobs/ApplyToJobScreen.tsx` has a free-text `Input` field labeled "Short message to customer" (the helper's intro message when applying to a job) — currently 100% manually typed, no AI assist.

**Scope:**
- Add a small "suggest message" affordance next to that field, backed by a new lightweight prompt to the existing `ai-job-assistant` Gemini integration (`supabase/functions/_shared/gemini.ts` is the shared client — reuse it, don't add a new provider integration).
- Input to the prompt: job title/category/description (already loaded on this screen via `useJob`) + the helper's basic profile blurb if available.
- Keep it a *suggestion the user edits*, not an auto-send — same pattern as the existing pay-suggestion chip (`suggestion.recommended` → tappable chip that fills the field, not auto-submits).
- This is the most contained/lowest-risk item on this list — no schema changes, no safety-architecture questions, additive to a self-contained screen.

---

## 5. "My Jobs" and "My Listings" settings

**Ask:** "Add a 'My Jobs' and 'My Listing' settings."

**Current state:** Not yet investigated in depth — needs clarification from whoever picks this up on what's actually missing. The app already has job lists (posted jobs, applied-to jobs) somewhere in the navigation; the ask may be:
- (a) a settings-screen entry point that surfaces these lists in one place, or
- (b) actual new list views that don't currently exist, or
- (c) management actions (edit/cancel a posted listing, withdraw an application) that are missing from an existing list.

**Recommended first step:** grep the navigation stack (`src/navigation/`) and existing screens for any current "my jobs" / "my listings" surface before writing code — this item needs a scoping pass, not a blind build.

---

## 6. Mutual job-completion confirmation

**Ask:** "Add a confirmation that the job was complete."

**Current state:** `src/components/job/JobOwnerMenu.tsx` already has a one-sided action: the job *owner* (the resident who posted it) can mark a job `completed` via `change('completed', 'Job completed — nice work!')`. The helper has no corresponding confirmation step — completion is unilateral.

**Scope:**
- Add a job status step between "in progress" and "completed" — e.g. `pending_confirmation` — set when the owner marks it done, requiring the helper to confirm (or dispute) before the job flips to a final `completed` state.
- This needs a new state in the job-status enum (`src/types/domain.ts`) and corresponding UI on the helper's side (a confirm/dispute prompt, likely on the job detail screen).
- Natural pairing with item 7 (review/feedback) — mutual completion confirmation is the natural trigger point for prompting both sides to leave a review, so consider sequencing these two together.

---

## 7. Review/feedback screens for both ends

**Ask:** "Add a review/feedback screen for both ends."

**Current state:** Confirmed via `src/services/types.ts` — the `DataBackend` interface only has `listReviewsForUser(userId)` (reading reviews). **There is no `createReview`/`submitReview` method anywhere in the interface, the mock backend, or the Supabase backend.** This is the biggest gap on the list — reviews can theoretically be displayed but can never be created; nothing writes to whatever review storage exists.

**Scope (full-stack, largest item here):**
- Confirm/design the review schema: rating (1–5?), free-text comment, reviewer id, reviewee id, job id (to prevent reviewing outside a real completed job), timestamp. Check if a `reviews` table already exists in the Supabase schema (`supabase/migrations/`) even though nothing writes to it — if so, reuse it; if not, it needs a new migration + RLS policies (reviewer can only write once per job, can only review the other party on a job they were actually part of).
- Add `createReview`/`submitReview` to the `DataBackend` interface, then implement in both the mock backend and the real Supabase backend (this codebase's established pattern — every feature has a mock-mode implementation and a real one, keep both in sync).
- Build the actual review-submission UI, likely triggered right after job completion (see item 6 — pairs naturally as "job marked complete → prompt both sides to review each other").
- Surface reviews on profile screens (partially exists — `listReviewsForUser` already reads them, so display may already work; verify).
- Given this touches trust/reputation for a marketplace with teen users, consider whether reviews need moderation (the existing `AdminScreen.tsx` ticket/moderation surface could be extended) before they're publicly visible, to prevent retaliatory or abusive reviews.

---

## Suggested build order

Roughly increasing complexity / decreasing self-containment:

1. **Item 4** (AI message suggestion) — smallest, no schema changes, no safety questions.
2. **Item 1** (duration/wage guidance) — small, mostly UI + a static data table.
3. **Item 5** (My Jobs/Listings) — needs a scoping pass first, but likely small once scoped.
4. **Item 6** (mutual completion confirmation) — one new status + one new UI step.
5. **Item 7** (reviews) — full-stack, sequence right after item 6 since they're naturally linked.
6. **Item 3** (no-show strikes) — needs a written policy decision before code.
7. **Item 2** (contact recommended helpers) — needs a product decision on the safety-gate question before any code is written; don't let an agent silently expose contact info pre-acceptance to satisfy the ticket.
