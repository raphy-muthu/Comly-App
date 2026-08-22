# Comly — Abuse Vectors and What Stops Them

Answers the open question *"What are the ways that people could exploit the
ethics of the app?"*

Comly is a neighborhood marketplace where **adults and minors transact in
person**, contact details are gated behind acceptance, and reputation is the
only currency. That combination defines the threat model: most attacks here are
not technical, they are people using the product exactly as designed to reach
someone they should not reach, or to fake a reputation they have not earned.

Each vector below lists what an attacker actually does, what currently stops
them (with the file or migration), and what is still open. Nothing here is
hypothetical hardening — every "Mitigated" line points at code in this repo.

---

## 1. Reaching a minor outside the safety review

**Attack.** An adult wants unsupervised contact with a teen helper. They do not
need to hack anything — they just need a button that hands over a phone number
before anyone has vetted the job.

**Mitigated.**
- Contact details are never on a profile. They live in `profiles_private`
  (owner-only RLS, migration `0004`) and are readable only through the
  `get_job_contact` RPC, which returns nothing unless the caller is the job's
  customer or its accepted helper *and* `contact_unlocked_at` is set.
- "Recommended helpers" deliberately has **no** contact affordance. The ask for
  one is answered by *invite to apply*
  (`src/components/people/InviteHelperSheet.tsx`): the invite carries a job id
  and nothing else, and the helper still applies through the normal flow.
- Teen-safety tiers gate applications **server-side**, not just in the UI
  (migration `0004`'s applications INSERT policy), so a minor cannot apply to an
  18+ or blocked job by calling the API directly.

**Residual risk.** Once a job is legitimately accepted, contact is real contact.
That is the product. The controls that matter after unlock are reporting,
blocking, and the strike system — not prevention.

---

## 2. Age forgery

**Attack.** A minor sets `age_group = 'adult'` to unlock 18+ jobs, or an adult
sets `'teen'` to look less threatening on a teen-heavy feed.

**Mitigated.** `age_group` is captured at signup and pinned by the
`guard_profile_privileged_columns` trigger (migration `0005`) — RLS controls
which *row* you may write, never which *columns*, so the pin is a trigger, not a
policy. `parent_approval_status` and the `parent_approved` verification badge are
pinned the same way.

**Residual risk.** Self-declared age at signup is unverified, and government ID
verification was intentionally removed. This is a deliberate product tradeoff:
collecting government ID from minors creates a worse problem than it solves. The
mitigation is behavioral (safety tiers, parent approval, reporting), not
documentary.

---

## 3. Fabricated reputation

**Attack.** Create a second account, "hire" yourself, review yourself five stars,
repeat. Or review a stranger you never worked with, positively or negatively.

**Mitigated.** Reviews were previously *unwritable* — the table existed since
migration `0001` but nothing inserted into it, and the 0002 INSERT policy
checked only `auth.uid() = reviewer_id`, i.e. any signed-in user could review any
stranger against any job id. Migration `0013` replaces it:
- A review requires an existing job with `status = 'completed'`.
- Reviewer and reviewee must be that job's two parties, in either direction.
- `unique (job_id, reviewer_id, reviewee_id)` caps it at one review per job.
- Self-review is blocked explicitly.
- `profiles.rating` is recomputed by a trigger from the reviews on file — it is
  not a number a client can set (it is pinned by the 0005 guard).

**Residual risk.** Two colluding real accounts can still stage a job and review
each other. Detecting that needs graph analysis (repeat pairs, one-way traffic)
which is not built. Volume caps make it slow: three active listings and five
posts per hour (migration `0004`, now including in-flight statuses via `0013`).

---

## 4. Weaponizing the strike system

**Attack.** A customer is unhappy about something unrelated and reports the
helper as a no-show. Repeated across accounts, this suspends a real person.

**Mitigated.** This is why a no-show report is **not** a strike:
- `report_no_show` files a row with `status = 'pending'` and touches nothing on
  the reported account.
- Only `resolve_no_show_event` (admin-only) converts a report into a strike, and
  reversing that decision **decrements** the counter — the strike is genuinely
  returned, not left stuck on.
- One report per reporter per job (`unique (job_id, reporter_id)`), and both the
  reporter and the accused must have actually been on the job.
- The accused sees every report against them and the appeal path on their own
  Profile screen (`NO_SHOW_POLICY.appealNote`).
- A public "recent no-shows" caution only appears at **two** confirmed strikes,
  so a single bad report cannot mark someone publicly.

**Residual risk.** It concentrates judgment in admins. That is intentional —
automated consequences are exactly what makes a strike system abusable — but it
means moderation quality is the ceiling on fairness here.

---

## 5. Unilateral job completion

**Attack.** A customer marks a job "completed" the helper never finished, or
before paying, to close it out and move on.

**Mitigated.** Completion is now two-sided (migration `0013`). The owner calls
`request_job_completion`, which moves the job to `pending_confirmation`; only the
assigned helper's `confirm_job_completion` finalizes it. The helper can
`dispute_job_completion` with a reason, which returns the job to `in_progress`
and notifies the customer. `jobs_count` only increments on genuine completion.

**Residual risk.** A helper can stall by never confirming. There is no
auto-confirm timeout — adding one would hand the stalling power back to whoever
benefits from silence. Today this is a support-ticket path.

---

## 6. Underpayment dressed up as a fair offer

**Attack.** Post "$20, easy afternoon job", have it quietly mean eight hours of
manual labor. Teens with no wage reference are the intended target.

**Mitigated.** Pay is informational (Comly never handles money), so this is a
disclosure problem, not a payments problem:
- `wageGuidance` (`src/lib/wage.ts`) converts pay + duration into an effective
  hourly rate and compares it against a wage floor — the state minimum when the
  location names a state, the federal floor otherwise.
- The AI preview step shows that rate in dollars-per-hour and warns when it falls
  under the floor (`checkRealismLocally` in `src/services/ai.ts`), alongside a
  category-plausibility check on the duration itself.
- The same guideline appears at signup, so a first-time teen helper sees a number
  before they ever see an offer.

**Residual risk.** Advisory by design — none of it blocks a post. State minimums
are a curated snapshot, not a live feed, and are labeled as guidance rather than
law.

---

## 7. Listing spam and feed flooding

**Attack.** Bulk-post listings to dominate the feed or farm applications.

**Mitigated.** Three active listings and five posts per hour, enforced by a
`BEFORE INSERT` trigger (migration `0004`) rather than client-side. Migration
`0013` closes a gap in that count: `in_progress` and `pending_confirmation` jobs
now count as active, so a customer cannot sit on three in-flight jobs and still
post three more.

---

## 7b. Buying your way over everyone

**Attack.** Premium tiers, done carelessly, become pay-to-bury: free listings
stop being seen, or a paid applicant beats a better-qualified free one outright.

**Mitigated.** Premium on Comly is *ordering only*, and the ordering is written
down as two comparators (`compareFeedJobs`, `compareApplications` in
`src/types/domain.ts`) rather than scattered through queries:
- Nothing is excluded. Both comparators fall through to match score, distance,
  rating, completed jobs, and recency, so a free listing outranks a paid one on
  every tiebreak below the premium key.
- The accepted applicant always sorts above priority applicants.
- Boosts expire, and `boostActive` re-checks the expiry on read.
- The badge is mandatory: a promoted application shows *why* it is on top.
- `is_customer_plus` / `is_helper_pro` / `is_boosted` / `is_priority` are all
  server-derived and pinned against self-service writes (migration `0014`), so
  the perk cannot be self-granted.

**Residual risk.** Visibility advantage is still an advantage. The mitigation is
that it is bounded, labeled, and never exclusive.

---

## 8. Privilege escalation to the moderation console

**Attack.** `update profiles set is_admin = true where id = <self>` — one API
call to read every abuse report and support ticket platform-wide.

**Mitigated.** `is_admin` is pinned by the 0005 guard trigger, as are
`is_trusted`, `rating`, `jobs_count`, `reputation_score`, and now `strikes` /
`is_suspended`. Legitimate server-side writes raise a transaction-local
`comly.privileged_write` flag from inside a SECURITY DEFINER function; a
PostgREST client cannot set it, because only `request.*` GUCs come from the
request.

---

## 9. Safety-label laundering

**Attack.** Describe a roof job as "light outdoor cleanup" so the AI tags it
`teen_safe`, then reveal the real task in person.

**Mitigated (partially).** Keyword and model-based tiering runs at post time,
the tier is re-validated client-side before it reaches the UI (an unrecognized
tier is rejected outright, `src/services/ai.ts`), and a failed safety review
falls back to `caution` rather than `teen_safe` — never asserting a task is
minor-appropriate on the strength of a request that failed.

**Residual risk.** A determined liar defeats text classification. The real
backstop is the helper's own judgment, the "report a dangerous task" category,
and the fact that a teen can walk away — which is why the app's safety copy says
helpers should only accept jobs they can safely complete, and never asks a helper
to waive responsibility for injuries.

---

## 10. A note on liability language

The original request included wording where a teen accepting a risky job would
acknowledge "the person who listed it is not responsible for their injuries."
That is **not implemented**, deliberately. A liability waiver signed by a minor
is not enforceable, and shipping one would push Comly toward *permitting* unsafe
jobs with paperwork instead of *preventing* them. The implemented alternative is
the one already in `SAFETY_TIERS`: state the risk plainly, require parent
approval where it matters, and hard-block minors from 18+ and disallowed tasks
server-side.

---

## Still open

- **Collusion detection** between repeat account pairs (vector 3).
- **Review moderation** — reviews are public immediately; a retaliatory review
  currently needs a report to remove.
- **Completion timeout** policy for a helper who never confirms (vector 5).
- **Rate limiting on reports and invites** — both are currently deduplicated but
  not throttled.
