/**
 * Pay & duration sanity guidance.
 *
 * Comly is a matchmaking app — pay is agreed between neighbors and handled off
 * the platform, so nothing here *blocks* a post. These helpers only inform:
 * they turn a pay amount plus an estimated duration into an effective hourly
 * rate and compare it against a minimum-wage floor.
 *
 * Maintenance note (deliberate, not an oversight): state minimums change most
 * Januaries. This table is a curated snapshot, not a live feed, so it is used
 * for a *hint* and the federal floor is what the app falls back to. Nothing
 * downstream treats these numbers as authoritative.
 */

import { PayType } from '@/types/domain';

/** Federal floor (29 U.S.C. §206). States may set a higher one. */
export const FEDERAL_MINIMUM_WAGE = 7.25;

/** Snapshot of state minimums, as of 2025. Only used for the hint text. */
export const STATE_MINIMUM_WAGES: Record<string, number> = {
  AK: 11.91, AL: 7.25, AR: 11.0, AZ: 14.7, CA: 16.5, CO: 14.81,
  CT: 16.35, DC: 17.5, DE: 15.0, FL: 13.0, GA: 7.25, HI: 14.0,
  IA: 7.25, ID: 7.25, IL: 15.0, IN: 7.25, KS: 7.25, KY: 7.25,
  LA: 7.25, MA: 15.0, MD: 15.0, ME: 14.65, MI: 12.48, MN: 11.13,
  MO: 13.75, MS: 7.25, MT: 10.55, NC: 7.25, ND: 7.25, NE: 13.5,
  NH: 7.25, NJ: 15.49, NM: 12.0, NV: 12.0, NY: 15.5, OH: 10.7,
  OK: 7.25, OR: 14.7, PA: 7.25, RI: 15.0, SC: 7.25, SD: 11.5,
  TN: 7.25, TX: 7.25, UT: 7.25, VA: 12.41, VT: 14.01, WA: 16.66,
  WI: 7.25, WV: 8.75, WY: 7.25,
};

/**
 * Best-effort state lookup from a free-text neighborhood ("Bryn Mawr, PA").
 * Returns null rather than guessing when there is no explicit state code —
 * showing the wrong state's floor is worse than showing the federal one.
 */
export function stateFromLocation(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.toUpperCase().match(/\b([A-Z]{2})\b\s*$/);
  if (!match) return null;
  return match[1] in STATE_MINIMUM_WAGES ? match[1] : null;
}

export interface WageFloor {
  amount: number;
  /** Two-letter state code when one was recognized, otherwise null. */
  state: string | null;
  label: string;
}

export function minimumWageFor(location?: string): WageFloor {
  const state = stateFromLocation(location);
  if (state) {
    return {
      amount: STATE_MINIMUM_WAGES[state],
      state,
      label: `${state} minimum wage`,
    };
  }
  return {
    amount: FEDERAL_MINIMUM_WAGE,
    state: null,
    label: 'federal minimum wage',
  };
}

/**
 * Effective hourly rate a helper would earn. Hourly pay is already a rate;
 * fixed pay has to be divided by the estimated duration, which is why a
 * duration is required for a fixed-pay job to be checkable at all.
 */
export function effectiveHourlyRate(
  pay: number,
  payType: PayType,
  durationMinutes?: number
): number | null {
  if (!Number.isFinite(pay) || pay <= 0) return null;
  if (payType === 'hourly') return pay;
  if (!durationMinutes || durationMinutes <= 0) return null;
  return (pay / durationMinutes) * 60;
}

export const money = (n: number): string =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

export interface WageGuidance {
  /** Null when the rate can't be computed (no pay, or fixed pay with no duration). */
  hourlyRate: number | null;
  floor: WageFloor;
  belowFloor: boolean;
  /** Always present — the informational line shown next to the pay field. */
  hint: string;
  /** Set only when the rate falls under the floor. */
  warning?: string;
}

export function wageGuidance(
  pay: number,
  payType: PayType,
  durationMinutes: number | undefined,
  location?: string
): WageGuidance {
  const floor = minimumWageFor(location);
  const hourlyRate = effectiveHourlyRate(pay, payType, durationMinutes);
  const floorText = `${money(floor.amount)}/hr (${floor.label})`;

  if (hourlyRate === null) {
    return {
      hourlyRate: null,
      floor,
      belowFloor: false,
      hint: `Fair-pay guideline: at least ${floorText}. State and local minimums may be higher.`,
    };
  }

  const belowFloor = hourlyRate < floor.amount;
  return {
    hourlyRate,
    floor,
    belowFloor,
    hint: `That works out to about ${money(
      Math.round(hourlyRate * 100) / 100
    )}/hr. Fair-pay guideline: at least ${floorText}.`,
    warning: belowFloor
      ? `About ${money(Math.round(hourlyRate * 100) / 100)}/hr — below the ${
          floor.label
        } of ${money(floor.amount)}/hr. Comly doesn't handle payment, but paying at least the local minimum keeps things fair for your helper.`
      : undefined,
  };
}

// ── Duration boundaries ──────────────────────────────────────────────────────
/**
 * A neighborhood errand isn't an 80-hour week. These bounds keep an obvious
 * typo (5 minutes, or 3000 minutes) from becoming a listing, and give the AI
 * realism check something concrete to compare against.
 */
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 8 * 60;

export function durationBoundsError(minutes: number | undefined): string | null {
  if (minutes === undefined || Number.isNaN(minutes)) return null;
  if (minutes < MIN_DURATION_MINUTES) {
    return `Jobs on Comly are at least ${MIN_DURATION_MINUTES} minutes.`;
  }
  if (minutes > MAX_DURATION_MINUTES) {
    return `Comly jobs cap at ${MAX_DURATION_MINUTES / 60} hours. Split a longer project into separate listings.`;
  }
  return null;
}

/**
 * Combines a date and a time-of-day into one Date. Returns null when the date
 * is missing — a time alone has no calendar day to sit on.
 */
export function combineDateTime(date: Date | null, time: Date | null): Date | null {
  if (!date) return null;
  const out = new Date(date);
  if (time) {
    out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  } else {
    out.setHours(23, 59, 0, 0);
  }
  return out;
}

/** "You can't schedule a job in the past" check, tolerant of clock skew. */
export function scheduleInPast(date: Date | null, time: Date | null): boolean {
  const when = combineDateTime(date, time);
  if (!when) return false;
  return when.getTime() < Date.now() - 60_000;
}
