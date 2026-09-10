# Run the Maestro E2E Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the existing four-flow Maestro E2E suite (`.maestro/*.yaml`) against the already-built Release/mock iOS simulator app, entirely with tooling already on this machine, and produce a written, evidence-backed pass/fail report — without touching app or test source unless a run reveals something that needs a human decision first.

**Architecture:** No new application code. This is an operational run: (1) get a booted simulator with the existing Release+mock `.app` installed, (2) run each flow through `.maestro/run.sh` one at a time so a hang in one flow doesn't block triage of the others, (3) capture Maestro's own output plus a screenshot at the point of any failure, (4) write one Markdown report under `docs/superpowers/plans/` summarizing what passed, what failed, and — critically — *why*, distinguishing an app defect from a stale test assertion.

**Tech Stack:** Maestro CLI (`~/.maestro/bin/maestro`), Homebrew `openjdk` (keg-only, not on PATH — `.maestro/run.sh` already exports it), `xcrun simctl`, the iOS Simulator MCP tool for screenshots on failure.

## Global Constraints

- Never modify `src/` or `.maestro/*.yaml` as part of *running* the suite. A run that fails gets diagnosed and reported in this plan's Task 5 output; fixing what it finds is separate follow-up work requiring its own plan/approval.
- Never `git add` or `git commit` anything (standing instruction: the user commits manually).
- Never erase or reset the simulator's contents (`simctl erase`) without asking first — booting/installing/launching is fine, wiping device state is not.
- Each flow must run with `launchApp: clearState: true` (already in every `.yaml`) so runs are independent of whatever state a prior manual session left behind.
- If a flow hangs (no Maestro progress for the flow's own timeout, or a system-level alert like "Save Password?" steals focus), kill that flow's `maestro test` process, screenshot the frozen state, mark it `HUNG`, and move to the next flow rather than blocking the whole task.

---

### Task 1: Verify environment and get a clean simulator ready

**Files:**
- None created or modified. Read-only verification plus simulator/process state changes (reversible, no app or test code touched).

**Interfaces:**
- Consumes: `.maestro/run.sh` (already in repo, already handles the Java-on-PATH gotcha).
- Produces: a booted `iPhone 17 Pro Max` simulator (UDID `E57F337E-DC83-4C0E-8014-DF1ED728E5B4`) with `com.comly.app` installed, ready for Task 2 onward.

- [ ] **Step 1: Confirm Maestro and Java are both reachable the way `run.sh` expects**

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
java -version
~/.maestro/bin/maestro --version
```

Expected: `java -version` prints an OpenJDK version banner (no "Unable to locate a Java Runtime" error), and `maestro --version` prints a version string. If either fails, stop — this is a prerequisite gap the plan's Global Constraints don't authorize working around silently (e.g. don't `brew install` anything without flagging it).

- [ ] **Step 2: Boot the simulator if it isn't already**

```bash
xcrun simctl list devices booted
```

If `iPhone 17 Pro Max` is not listed as `Booted`:

```bash
xcrun simctl boot E57F337E-DC83-4C0E-8014-DF1ED728E5B4
```

Expected: exits 0, or errors with "current state: Booted" (already booted — fine, not a failure).

- [ ] **Step 3: Confirm the Release/mock build is still installed; reinstall from the existing DerivedData `.app` if not (do not rebuild from scratch)**

```bash
xcrun simctl get_app_container E57F337E-DC83-4C0E-8014-DF1ED728E5B4 com.comly.app
```

If that errors (app missing — can happen if the simulator was erased since the last session), reinstall the **already-built** bundle rather than re-running `expo run:ios` (which takes ~20 minutes and isn't needed since no source changed since that build):

```bash
xcrun simctl install E57F337E-DC83-4C0E-8014-DF1ED728E5B4 \
  /Users/puneetmuthu/Library/Developer/Xcode/DerivedData/Comly-fbhezmufwxvxuxehhkwupukanizt/Build/Products/Release-iphonesimulator/Comly.app
```

Expected: `get_app_container` now succeeds and prints a path.

- [ ] **Step 4: Neutralize the "Save Password?" system alert before it can steal focus mid-flow**

Every flow past `01` types a password via `inputText`, which triggers iOS's Keychain "Save Password?" alert after submission — a SpringBoard-level alert that Maestro's accessibility-based taps may or may not dismiss reliably, and that visually covers the exact screen the next assertion checks. Disable it and respring so the setting actually takes effect (a bare `defaults write` without a respring was observed *not* to take effect earlier in this project):

```bash
xcrun simctl spawn E57F337E-DC83-4C0E-8014-DF1ED728E5B4 \
  defaults write com.apple.Preferences AutoFillPasswords -bool NO
xcrun simctl spawn E57F337E-DC83-4C0E-8014-DF1ED728E5B4 \
  launchctl stop com.apple.SpringBoard
sleep 6
xcrun simctl spawn E57F337E-DC83-4C0E-8014-DF1ED728E5B4 \
  defaults read com.apple.Preferences AutoFillPasswords
```

Expected: last command prints `0`. Respringing does not erase installed apps or app data — `com.comly.app` stays installed.

- [ ] **Step 5: Confirm the app actually launches clean post-respring**

```bash
xcrun simctl launch E57F337E-DC83-4C0E-8014-DF1ED728E5B4 com.comly.app
```

Then take one screenshot via the iOS Simulator MCP tool (`control` action `screenshot`) to visually confirm the onboarding/welcome screen renders with no crash and no stray system dialog on top. This is the last manual-verification step — Tasks 2–4 run unattended from here.

---

### Task 2: Run flow `01-signup` and `02-post-job`, capture full output

**Files:**
- Create: `docs/superpowers/plans/e2e-run-2026-09-09/01-signup.log`
- Create: `docs/superpowers/plans/e2e-run-2026-09-09/02-post-job.log`
- Create (only on failure): `docs/superpowers/plans/e2e-run-2026-09-09/01-signup-failure.png` / `02-post-job-failure.png`

**Interfaces:**
- Consumes: booted+installed simulator from Task 1.
- Produces: two log files and (if applicable) failure screenshots that Task 5 reads to write the summary.

- [ ] **Step 1: Create the run-output directory**

```bash
mkdir -p ~/Documents/comly/docs/superpowers/plans/e2e-run-2026-09-09
```

- [ ] **Step 2: Run flow 01 with a hard wall-clock timeout, tee'd to a log**

```bash
cd ~/Documents/comly
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
timeout 120 ~/.maestro/bin/maestro test .maestro/01-signup.yaml \
  2>&1 | tee docs/superpowers/plans/e2e-run-2026-09-09/01-signup.log
echo "exit=$?" >> docs/superpowers/plans/e2e-run-2026-09-09/01-signup.log
```

Expected: log ends with either Maestro's own "Flow Passed" / "Flow Failed" banner, or `exit=124` (the `timeout` wrapper's own code for "killed after 120s" — treat that as `HUNG`, not `FAIL`, in the Task 5 report, since it means the flow never got a definitive answer).

- [ ] **Step 3: If Step 2 ended in `HUNG` or `FAIL`, screenshot the simulator immediately (state is still on screen) before the next flow's `clearState` wipes it**

Use the iOS Simulator MCP tool's `screenshot` action, save to `01-signup-failure.png` in the same run-output directory.

- [ ] **Step 4: Repeat Steps 2–3 for flow 02**

```bash
timeout 120 ~/.maestro/bin/maestro test .maestro/02-post-job.yaml \
  2>&1 | tee docs/superpowers/plans/e2e-run-2026-09-09/02-post-job.log
echo "exit=$?" >> docs/superpowers/plans/e2e-run-2026-09-09/02-post-job.log
```

Same failure-screenshot rule, filename `02-post-job-failure.png`.

- [ ] **Step 5: Do not proceed to Task 3 if the simulator itself has stopped responding** (e.g. `xcrun simctl launch` starts failing outright rather than the app just showing wrong content). That is an environment failure, not a test failure — stop and report it as blocking, since continuing would produce noise rather than signal.

---

### Task 3: Run flow `03-apply-eligibility`, capture full output

**Files:**
- Create: `docs/superpowers/plans/e2e-run-2026-09-09/03-apply-eligibility.log`
- Create (only on failure): `docs/superpowers/plans/e2e-run-2026-09-09/03-apply-eligibility-failure.png`

**Interfaces:**
- Consumes: same booted simulator, now possibly mid-state from flow 02 — irrelevant, since `clearState: true` at the top of `03-apply-eligibility.yaml` resets it before any assertions run.
- Produces: one log file (+ optional screenshot) for Task 5.

- [ ] **Step 1: Run it**

```bash
cd ~/Documents/comly
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
timeout 120 ~/.maestro/bin/maestro test .maestro/03-apply-eligibility.yaml \
  2>&1 | tee docs/superpowers/plans/e2e-run-2026-09-09/03-apply-eligibility.log
echo "exit=$?" >> docs/superpowers/plans/e2e-run-2026-09-09/03-apply-eligibility.log
```

- [ ] **Step 2: On `HUNG` or `FAIL`, screenshot immediately** to `03-apply-eligibility-failure.png`, same as Task 2.

- [ ] **Step 3: Note for Task 5 — this flow selects the first job card by `id: "job-card", index: 0`, not by text.** Whichever job the mock feed sorts to the top of the helper's "Jobs" tab is what gets opened; if the assertion fails, check the log for *which* job's tier badge and Apply/Not-eligible text actually appeared before concluding the gate itself is broken.

---

### Task 4: Run flow `04-accept-contact-unlock`, capture full output

**Files:**
- Create: `docs/superpowers/plans/e2e-run-2026-09-09/04-accept-contact-unlock.log`
- Create (only on failure): `docs/superpowers/plans/e2e-run-2026-09-09/04-accept-contact-unlock-failure.png`

**Interfaces:**
- Consumes: same booted simulator; `clearState: true` resets mock data to the fixture baseline in `src/lib/mockData.ts` before this flow's assertions run.
- Produces: one log file (+ optional screenshot) for Task 5.

- [ ] **Step 1: Run it**

```bash
cd ~/Documents/comly
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
timeout 120 ~/.maestro/bin/maestro test .maestro/04-accept-contact-unlock.yaml \
  2>&1 | tee docs/superpowers/plans/e2e-run-2026-09-09/04-accept-contact-unlock.log
echo "exit=$?" >> docs/superpowers/plans/e2e-run-2026-09-09/04-accept-contact-unlock.log
```

- [ ] **Step 2: On failure, screenshot to `04-accept-contact-unlock-failure.png`.**

- [ ] **Step 3: Before writing Task 5's verdict on this flow, check the log against this known, pre-diagnosed risk rather than assuming any failure here is a fresh app bug:**

The flow's final assertion is:

```yaml
- assertVisible:
    text: ".*[0-9]{3}-[0-9]{3}-[0-9]{4}.*"
```

— a plain `XXX-XXX-XXXX` pattern. Every seeded phone number in `src/lib/mockData.ts` (e.g. `'(610) 555-0142'`) and every rendering of it in `src/components/job/ContactCard.tsx:57` (`{person.phoneNumber}`, printed verbatim, no reformatting) is `(XXX) XXX-XXXX` — parentheses and a space before the prefix, not a third hyphen. That pattern cannot match this format: there is no literal `-` between the area code and the prefix.

If the log shows the flow reaching the final assertion and failing there specifically (not on an earlier step, and the `CONTACT UNLOCKED` header assertion on the line above it *did* pass), that is this known mismatch — a stale test assertion written against a phone format the app never used, not a regression in the unlock feature itself. Record it as `FAIL — known assertion/format mismatch`, not `FAIL — feature broken`, and say so plainly in the report; do not silently loosen the regex or "fix" it as part of this run.

If instead the flow fails *earlier* — e.g. the pre-acceptance "hidden" assertion incorrectly finds a phone number already visible, or `CONTACT UNLOCKED` never appears after tapping Accept — that *is* a real feature regression and should be reported as such, distinctly from the format mismatch above.

---

### Task 5: Write the summary report

**Files:**
- Create: `docs/superpowers/plans/e2e-run-2026-09-09/SUMMARY.md`

**Interfaces:**
- Consumes: the four `.log` files and any `*-failure.png` screenshots from Tasks 2–4.
- Produces: the one document handed back to the user — everything else in this plan is scaffolding for this file.

- [ ] **Step 1: Write the summary using this structure**

```markdown
# E2E Suite Run — 2026-09-09

Environment: iPhone 17 Pro Max simulator, iOS 26.5, Release build with
EXPO_PUBLIC_USE_MOCKS=true (same build verified working across manual
testing earlier in this session — no rebuild performed for this run).

| Flow | Result | Notes |
|---|---|---|
| 01-signup | <PASS/FAIL/HUNG> | <one line, cite the log> |
| 02-post-job | <PASS/FAIL/HUNG> | <one line, cite the log> |
| 03-apply-eligibility | <PASS/FAIL/HUNG> | <one line, cite the log> |
| 04-accept-contact-unlock | <PASS/FAIL/HUNG> | <see Task 4 Step 3 triage — state explicitly whether this is the known phone-format mismatch or a real regression> |

## Detail

<one subsection per flow, each with: the exact failing assertion line quoted
from its .yaml if it failed, the relevant log excerpt, and — for any FAIL —
an explicit recommendation: "fix the test assertion" vs. "fix the app," so
the next person doesn't have to re-diagnose it.>

## What this run did not cover

- Screenshot 05 (review/completion flow) and any real-device-only behavior
  (push notifications, camera/photo picker permission prompts, real Sign in
  with Apple/Google) are out of scope for this suite as written.
- This was a single run. A flaky failure (native date-picker timing in 01,
  as its own comment warns) should be re-run once before being reported as
  a stable failure.
```

- [ ] **Step 2: Re-run any flow that failed for a reason unrelated to the Task 4 Step 3 known issue, exactly once, to rule out flakiness** (the `01-signup` comment explicitly warns the native date-picker interaction is the most likely source of one-off flakiness). Note in `SUMMARY.md` whether the re-run changed the result.

- [ ] **Step 3: Stop here.** Per Global Constraints, do not edit `.maestro/*.yaml` or any `src/` file based on what this run finds, and do not `git add`/`git commit` the new `docs/superpowers/plans/e2e-run-2026-09-09/` files — hand the summary back and let the user decide what, if anything, gets fixed next.

---

## Self-Review

**Spec coverage:** All four existing flows are run (Tasks 2–4), environment prerequisites are verified rather than assumed (Task 1), and the one already-known landmine (phone-format regex vs. actual rendering) is pre-diagnosed so it's reported correctly instead of triggering a scramble mid-run (Task 4 Step 3). The user's two standing constraints — never commit, never take irreversible/destructive action without asking — are stated once in Global Constraints and apply to every task.

**Placeholder scan:** No TBD/TODO; every step has the literal command to run and its expected output. The `SUMMARY.md` template has bracketed fill-ins by design (`<PASS/FAIL/HUNG>` etc.) since its content depends on the run's actual output — that's data to be filled from logs, not a deferred implementation detail.

**Type/name consistency:** File paths, the run-output directory name (`e2e-run-2026-09-09`), and the simulator UDID are used identically across all five tasks.
