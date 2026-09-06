# Launch prep — three workstreams

**Date:** 2026-09-04
**Status:** Approved, implementing
**Origin:** Launch readiness split — the three items marked "buildable now"

Three independent pieces, planned together because they're being executed
together, not because they share architecture. Each stands alone.

---

## Workstream 1 — App Store screenshots + store description

**Approach:** capture from the iOS simulator in mock mode. Mock mode is the
correct choice here rather than a compromise: seeded demo data is exactly what
marketing screenshots should show, and it avoids putting real user rows on a
storefront.

**Shot list** (6, chosen to tell the safety story rather than tour features):
1. Onboarding — "Safe by design"
2. A job showing a safety-tier badge
3. AI job-posting preview (fair-pay + safety check running)
4. Contact unlocked after acceptance
5. Leave-a-review screen
6. Profile — verification badges / trust score

**Sizes:** iPhone 16 Pro Max class (6.9", currently mandatory for App Store
Connect) as the primary set. `app.json` sets `supportsTablet: true`, so iPad
captures are a required second pass before actual submission — noted, not done
in this pass.

**Copy:** App Store subtitle + description, and Play Store short + full
description, written around the positioning already developed for this project:
the AI classifies every job before a teen can see it.

**Deliverable:** PNGs on disk plus a markdown file holding the draft copy. No
app code changes.

---

## Workstream 2 — Guardian consent flow

Email-link approval. The guardian never creates a Comly account.

### Why this shape
`parentName` / `parentEmail` are currently free-text fields the *teen* types in,
and `verification_status.parent_approved` has no mechanism that can ever set it
— the Profile screen literally shows a toast saying to ask a guardian, with
nothing behind it. This closes that loop with the smallest thing that actually
works.

### Schema — migration `0019_parent_consent.sql`

`parent_consent_requests`: `id`, `user_id`, `parent_email`, `token_hash`,
`status` (`pending` | `approved` | `expired` | `revoked`), `created_at`,
`approved_at`, `expires_at`.

**The token is stored hashed, never in plaintext.** The raw token exists only
in the emailed URL. A database leak must not hand someone the ability to
approve minors for supervised work — same reasoning as password hashing.

RLS: a teen may `select` their own rows (to render pending/approved state).
No client `insert`, `update`, or `delete` at all — every write goes through a
`SECURITY DEFINER` RPC.

### RPCs

- `approve_parent_consent(p_token text) returns boolean` — hashes the supplied
  token, finds a matching `pending`, unexpired row, and inside the
  `comly_privileged_write_active()` flag (the pattern established in `0015`)
  sets `verification_status.parent_approved = true` and
  `profiles.parent_approval_status = 'approved'`, then marks the request
  `approved`. Returns false rather than raising for an unknown/expired/used
  token, so the caller can render a friendly page without leaking which case
  it was.
- Consent requests are inserted by the edge function using the service role;
  no client-callable insert path exists.

### Edge function `parent-consent`

- `POST` (authenticated): body `{ parentEmail }`. Refuses if the caller is not
  a minor, or if an unexpired pending request already exists (dedupe, not a
  rate-limit table). Generates a random token, stores its hash, sends the
  email, returns `{ ok: true }`.
- `GET ?token=…` (public — the token *is* the credential, the guardian has no
  account): calls `approve_parent_consent` and returns a small HTML page,
  success or failure.

### Email dependency — real, and currently unmet

Nothing in this codebase sends email today; Supabase Auth's own confirmation
mail is the only outbound mail and it isn't general-purpose. The function is
written against a `RESEND_API_KEY` edge-function secret. **Until that key
exists, the flow is complete but cannot deliver mail** — the function will
report a clear failure rather than pretending success. Adding the key later is
configuration, not code.

### Client

`ProfileScreen`'s `parentApproved` row stops being a dead toast. It becomes:
enter/confirm a guardian email → "Request approval" → pending state with the
date sent and a resend affordance → approved state once the guardian clicks
through.

### Deferred, tracked for post-launch (explicitly, per decision)

- Real guardian accounts linked to a minor's account.
- Parent-set hour limits (item #7's deferred follow-up) — needs an ongoing
  guardian session, which an email link does not provide.

---

## Workstream 3 — End-to-end tests (Maestro)

**Tool:** Maestro. Chosen over Detox because `android/` isn't generated (only
`ios/` exists), and Maestro drives a built app without needing both native
project folders wired into a runner.

**Target:** local simulator against a dev build, mock mode. Mock mode first is
a deliberate tradeoff: it's deterministic and needs no test-data teardown.
Real-backend E2E would catch more of the class of bug this project has actually
hit (an RLS false positive, a migration trigger collision), but reliable
account creation and cleanup at test speed is a materially harder problem.
Shipping a green mock-mode suite now beats stalling on the better version.

**Core flows** (the safety-critical spine, not full coverage):
1. Sign up — including that an under-13 date of birth is refused
2. Post a job as a customer
3. Apply as a helper, with the eligibility gate exercised
4. Accept an applicant and see contact unlock

Completion / reviews / no-show reporting are a second batch once the core suite
is green.

**Deliverable:** `.maestro/` flow files plus a short README describing how to
run them.

---

## Out of scope for all three

- iPad screenshot set (flagged above, needed before actual submission)
- Real-backend E2E
- Anything requiring an account we don't have: EAS, App Store Connect, Play
  Console, and — for workstream 2's final mile — the email provider key.
