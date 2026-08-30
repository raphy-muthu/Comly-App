# Hours / time-of-day advisory — design

**Date:** 2026-08-30
**Status:** Approved, implementing
**Origin:** Legal risk register item #7 — "Hours / time-of-day limits for 14–15-year-olds"

## Problem

FLSA restricts 14–15-year-olds to work between 7am–7pm (7am–9pm during summer,
June 1–Labor Day), capped at 3 hours on a school day and 8 hours otherwise.
The app has no time-of-day or duration validation at all. This became
buildable once migration `0013`/the #3 fix wired up real `age_bracket` data —
`sixteen_seventeen` has no federal hour restriction (only the hazard-tier
rule #3 already covers), so this only applies to `fourteen_fifteen`.

## Decisions from brainstorming

- **Advisory only, never blocking** — a hard block on work hours is itself a
  mild signal of employer-like control, the same tension as the no-show
  strike system (#6). This mirrors #6's resolution: don't add classification
  risk to close a lower-severity gap.
- **Parent-set hour limits are explicitly out of scope for this pass** —
  a genuinely better long-term answer (the restriction's authority shifts
  from the platform to the guardian, sidestepping the classification tension
  almost entirely), but it needs guardian-account infrastructure that
  doesn't exist yet (register item #4). Ship this advisory now; revisit
  parent-set limits as the first real slice of #4.
- **"School day" is approximated as any non-summer weekday.** The app has no
  school-calendar data. Rather than skip duration guidance entirely, a known
  simplification is accepted, with copy that reads as guidance, not a
  factual claim about someone's actual school schedule.
- **The summer boundary is shared between both rules**, because that's how
  FLSA actually draws it: during summer (school not in session at all),
  *every* day gets the relaxed 8-hour cap regardless of weekday/weekend —
  the weekday/weekend duration split only applies outside summer. One
  boundary check, not two independent special cases.

## Design

### 1. `hoursGuidanceFor()` — a pure function, same pattern as `wageGuidance`/`bracketFromDateOfBirth`

New file `src/lib/hours.ts` (parallel to the existing `src/lib/wage.ts`):

```ts
export interface HoursGuidance {
  outsideWindow: boolean;
  windowNote?: string;
  overDurationCap: boolean;
  durationNote?: string;
}

export function isSummer(date: Date): boolean; // June 1 – Labor Day (first Monday of September)
export function hoursGuidanceFor(
  ageBracket: AgeBracket,
  scheduledFor: Date,
  durationMinutes: number | undefined,
): HoursGuidance | null; // null for every bracket except 'fourteen_fifteen'
```

- Window: 7am–7pm normally, 7am–9pm when `isSummer(scheduledFor)`. Checked
  against the job's full scheduled interval — `scheduledFor` through
  `scheduledFor + durationMinutes` when a duration is known, not just the
  start time — so a job starting at 6:30pm for one hour is correctly flagged
  in the non-summer window (it runs until 7:30pm, past the 7pm cutoff) even
  though 6:30pm alone looks fine. When no duration is set, only the start
  time can be checked, and that's what's checked.
- Duration cap: only evaluated when `durationMinutes` is present (it's
  optional on `Job` — no cap check without a real number to check). 8 hours
  during summer; outside summer, 3 hours Mon–Fri, 8 hours Sat/Sun.
- Returns `null` (not an empty/false result) for brackets it doesn't apply
  to, so call sites can `if (!guidance) return` and skip rendering entirely
  — same style as `minimumWageFor`'s `null` state.

### 2. Two advisory placements, both purely additive UI

- **`CreateJobScreen`** — a low-key note near the schedule/duration fields
  when the chosen time/duration would trip the rule, worded for the
  customer (they don't yet know if a 14–15-year-old will apply): *"Some
  younger teen helpers may not be able to accept this time — outside typical
  hours for helpers under 16 on a school day (Mon–Fri, non-summer)."*
- **`JobDetailScreen` / `ApplyToJobScreen`** — a clearer banner shown only
  when the *viewing* helper's own `ageBracket` is `fourteen_fifteen` and the
  job trips the rule. This is the actually load-bearing case; the posting-side
  note is a courtesy.

Both are pure UI reads of `hoursGuidanceFor()` — no new state, no new
migration, no RLS change. Nothing is blocked; the Apply/Post buttons stay
enabled either way.

### 3. Tests (TDD, test-first for every behavior change)

New `src/__tests__/hours.test.ts`, alongside the existing `wage.test.ts`:
- `isSummer`: boundary dates (May 31 vs June 1, Labor Day itself, day after).
- `hoursGuidanceFor`: returns `null` for `under_14`/`sixteen_seventeen`/`adult`;
  correctly flags a 6pm–9pm non-summer slot as outside-window but a 6pm–8pm
  summer slot as fine; correctly applies 3hr cap on a non-summer Tuesday
  and 8hr cap on a non-summer Saturday and on any summer day, using a fixed
  reference date the same way `domain.test.ts`'s `bracketFromDateOfBirth`
  tests do.

## Out of scope

- Weekly hour caps (18 hrs/school week, 40/non-school week) — needs
  cross-job aggregation across a helper's whole week, a separate and larger
  problem.
- Parent-set limits — deferred to register item #4.
- Any server-side/RLS enforcement — this is pure client advisory, unlike #2
  and #3.
- Actual school-calendar integration — the weekday approximation is a
  deliberate, accepted simplification, not a placeholder for something this
  pass will also attempt.
