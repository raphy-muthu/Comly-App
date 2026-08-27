# Comly — Open Feature Requests

Context: Comly is a React Native/Expo neighborhood-services marketplace (residents post small jobs, helpers — including teens — apply). Backend is Supabase (Auth, Postgres, RLS, Storage, Edge Functions), with an existing safety-tier system (`teen_safe` / `caution` / `adult_supervision` / `eighteen_plus_only` / `blocked`) that gates who can apply to what, and a contact-unlock-after-acceptance model (helper/customer contact info is hidden until a job application is accepted, specifically to keep interactions inside the app's safety review). Mock-mode-first architecture: most things can be built and tested against `EXPO_PUBLIC_USE_MOCKS=true` without touching production data.

**Status: every item below is now implemented.** Each entry keeps the original
ask and the state it was found in, followed by what shipped. Abuse-model
analysis for the new surfaces lives in [SAFETY_AND_ETHICS.md](SAFETY_AND_ETHICS.md).

---

## 1. AI realistic-duration check + minimum-wage guideline — ✅ done

**Ask:** "Set a time boundary, have AI check if it's realistic" + "Add minimum wage guideline when signing up."

**Was:** The `ai-job-assistant` edge function returned `estimatedDuration` as free text with no validation, and no minimum-wage figure appeared anywhere.

**Shipped:**
- `src/lib/wage.ts` — federal floor plus a curated state table, `effectiveHourlyRate` (hourly pay is already a rate; fixed pay divides by duration), and `wageGuidance`, which produces the hint line and the below-floor warning. State lookup returns `null` rather than guessing when the location has no explicit state code.
- Hard duration bounds (15 minutes – 8 hours) with inline validation on the custom-duration field, and a category-plausibility band on top (`DURATION_BANDS` in `src/services/ai.ts`).
- `ai.checkRealism` runs the arithmetic locally and deterministically, then layers Gemini's qualitative read on top via the edge function's new `checkRealism` flag. A model failure leaves the local warnings standing.
- The guideline shows on the signup screen (role-appropriate wording) and again beside the pay field on the AI preview step.
- Advisory throughout — nothing blocks a post, because pay is agreed off-platform.

**Known limit, by design:** state minimums are a curated snapshot, not a live feed, and are labeled as guidance.

---

## 2. Contact option for recommended helpers — ✅ done (as invite-to-apply)

**Ask:** "For recommended helpers, add an option where they can possibly contact them."

**The conflict:** a direct contact button pre-acceptance bypasses the safety gate entirely — a resident could reach a teen helper with no safety review having happened on any specific job.

**Shipped:** the resolution recommended here, not a raw contact channel.
`src/components/people/InviteHelperSheet.tsx` adds an **Invite** action to
recommendation rows. It lists the customer's own open listings and creates a
`job_invites` row plus a notification. No phone number, email, or free text
crosses over; the helper applies through the normal flow and contact still
unlocks only on acceptance. Invites are deduplicated per (job, helper), refuse
blocked users in either direction, and only target open listings
(`invite_helper_to_job`, migration 0013). Helpers see them at the top of
**My Jobs**.

---

## 3. No-show strike/penalty system — ✅ done

**Ask:** "If you accept a job, and you don't show up, point penalty/strike system."

**Was:** `'no_show'` existed only as a `ReportCategory` value. No counter, no events table, no consequence.

**Shipped, with the policy written down first** (`NO_SHOW_POLICY` in `src/types/domain.ts`, so UI, admin console, and docs cannot drift):
- `no_show_events` table — job, accused, reporter, note, status, admin notes. Auditable rows, not a silent counter.
- **A report is not a strike.** It files as `pending` and touches nothing. Only an admin confirming it increments `profiles.strikes`, and reversing that decision decrements it again.
- Never auto-detected from a passing scheduled time — neighbors reschedule.
- One report per reporter per job; both parties must actually have been on the job; only on an accepted/in-progress job.
- The affected user sees every event and the appeal path on their own Profile. A public caution appears only at **2** confirmed strikes; suspension at **3**.
- Admin console gains a **No-shows** tab with confirm / dismiss / reopen.
- `strikes` and `is_suspended` are pinned against self-service writes by the 0005 guard trigger, extended in 0013.

---

## 4. AI for "Short Message to Customer" — ✅ done

**Ask:** "Add AI for 'Short Message to Customer'."

**Shipped:** a "Draft for me" / "Rewrite" affordance beside the message field on
`ApplyToJobScreen`, backed by `ai.suggestApplicationMessage`. It reuses the
existing shared Gemini client through a new `applicationMessage` flag on
`ai-job-assistant`, falls back to a deterministic local draft, and fills the
field for the helper to edit — same "suggestion you accept" pattern as the pay
chip, never an auto-send.

---

## 5. "My Jobs" and "My Listings" settings — ✅ done

**Ask:** "Add a 'My Jobs' and 'My Listing' settings."

**Scoping pass result:** the lists existed but only inside the role-specific
Jobs *tab*, so whichever role you were not currently in was unreachable — that
was the actual gap.

**Shipped:** two entries under Profile → settings, both visible to both roles
(plenty of neighbors post one week and help the next):
- **My listings** → `MyListingsScreen`, a pushable wrapper reusing `MyJobsScreen` via a new `embedded` prop rather than duplicating the list.
- **My jobs & applications** → `MyApplicationsScreen`, a new helper-side view: accepted work first, then pending applications, with open invitations to apply pinned above.

---

## 6. Mutual job-completion confirmation — ✅ done

**Ask:** "Add a confirmation that the job was complete."

**Was:** the owner could flip a job to `completed` unilaterally via `JobOwnerMenu`.

**Shipped:** a `pending_confirmation` status between in-progress and completed.
"Mark as completed" now calls `request_job_completion`; the assigned helper sees
a confirm/dispute card on the job detail screen. Disputing returns the job to
`in_progress` with a reason and notifies the customer. `jobs_count` increments
only on genuine completion. All three transitions are SECURITY DEFINER RPCs
because the helper has no UPDATE grant on `jobs` at all.

---

## 7. Review/feedback screens for both ends — ✅ done

**Ask:** "Add a review/feedback screen for both ends."

**Was:** the biggest gap on the list — `DataBackend` had only `listReviewsForUser`. Nothing could ever create a review, and the 0002 INSERT policy checked only `auth.uid() = reviewer_id`, so any signed-in user could have fabricated a review of any stranger against any job id.

**Shipped:**
- Reused the existing `reviews` table from migration 0001 (four category scores + comment).
- `createReview` / `listReviewsForJob` added to `DataBackend` and implemented in **both** the mock and Supabase backends.
- Migration 0013 replaces the RLS policy: the job must be `completed`, and reviewer/reviewee must be its two parties in either direction. One review per reviewer per job; no self-review; no self-service edit or delete.
- `profiles.rating` is recomputed by an `AFTER INSERT` trigger, so the headline number always matches the reviews on file.
- `LeaveReviewScreen` derives the reviewee **from the job**, never from a route param. It is reached from a card that appears on the job for both parties once completion is confirmed — the natural pairing with item 6.

**Still open:** reviews are public immediately. Pre-publication moderation for retaliatory reviews is not built (tracked in SAFETY_AND_ETHICS.md).

---

## Also addressed from the same round

- **Date & time overlap / time running off screen** — the schedule fields are stacked full-width rather than side-by-side (iOS's spinner ignores a parent's flex constraint). On top of that, the time picker now floors at the current clock time when the chosen date is today, so "today at 9 AM" selected at 6 PM no longer produces a listing in the past; both fields show inline validation.
- **AI per-hour price guideline** — fixed and hourly suggestions come from genuinely separate rate tables, the suggestion refetches when the Fixed/Per-hour toggle changes, and the pay step now states the implied hourly rate in dollars.
- **Profile picture backend** — verified working end to end: `expo-image-picker` → Supabase Storage `avatars` bucket (migration 0012) → public URL with a cache-busting query, one stable path per user so re-uploads overwrite rather than accumulate. Mock mode keeps the local URI.
- **Where do support tickets go?** — into the admin console's Tickets tab the moment they are submitted, with status visible to the submitter under "My Tickets". Now stated explicitly in the Help & Support FAQ.
- **Help & Support back button** — the screen had no header at all; it has one now.
- **Ethics/abuse question** — answered in [SAFETY_AND_ETHICS.md](SAFETY_AND_ETHICS.md).

## From the first revisions round: premium visibility — ✅ done

**Ask:** "For job applications requests premium users get their application sent to the top" + "Premium request helpers their job listing gets sent to the top."

**Was:** removed from the codebase entirely — `types/domain.ts` stated "No premium/subscription concepts exist", on the reasoning that Comly is a matchmaking app that handles no money.

**Shipped, reconciling both:** premium exists as **visibility only**, with no
purchase flow, price, subscription table, or billing integration — because the
app still processes no money. `profiles.is_customer_plus` and
`profiles.is_helper_pro` are server-owned flags granted out of band, pinned
against self-service writes by the same guard trigger that protects `is_admin`
and `strikes` (migration 0014).

- **Listings:** a Plus customer's jobs post pre-boosted (`jobs.is_boosted` /
  `boosted_until`, set by a `BEFORE INSERT` trigger from the poster's plan — the
  client sends no boost fields, and an owner editing their listing can't flip
  the flag). Feed order is boosted → Plus → AI match score → distance → newest.
- **Applications:** `applications.is_priority` is derived from the applicant's
  plan by a trigger, never from client input, and is pinned on update.
  Application order is accepted → priority → rating → completed jobs → earliest
  applied.
- **Badges:** `PremiumBadge` renders on the job card, job detail, profile, and
  the applications list — including the priority *reason*, so a promoted
  application always says why it is on top.
- **Free is outranked, never hidden.** Both comparators fall through to match
  score, distance, rating, and recency, and `premium.test.ts` asserts a free
  listing is never dropped from the ordering and wins every tiebreak below the
  premium key.

Boost expiry is honoured client-side too (`boostActive`), so an elapsed boost
stops promoting a listing even before anything clears the flag.

## Deliberately not built

- **"Make our own model."** Training a model is not warranted here: the checks
  that matter (implied hourly rate, duration bands, safety keywords) are
  deterministic arithmetic and rules, which a model would make slower and less
  predictable without making more accurate. The qualitative half already runs
  through the existing shared Gemini client behind a server-side key.
- **Injury liability waiver for teen helpers.** Not enforceable against a minor,
  and it would push the product toward permitting unsafe jobs with paperwork
  instead of preventing them. See SAFETY_AND_ETHICS.md §10.
