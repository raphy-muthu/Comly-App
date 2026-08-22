/**
 * Pay/duration guidance — the arithmetic behind the fair-pay hint and the
 * "double-check this listing" warnings. Pure functions, no backend.
 */

import {
  combineDateTime,
  durationBoundsError,
  effectiveHourlyRate,
  FEDERAL_MINIMUM_WAGE,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  minimumWageFor,
  scheduleInPast,
  stateFromLocation,
  wageGuidance,
} from '@/lib/wage';

describe('minimum wage lookup', () => {
  it('falls back to the federal floor when no state is given', () => {
    const floor = minimumWageFor('Bryn Mawr');
    expect(floor.amount).toBe(FEDERAL_MINIMUM_WAGE);
    expect(floor.state).toBeNull();
  });

  it('uses the state floor when the location names one', () => {
    const floor = minimumWageFor('Santa Monica, CA');
    expect(floor.state).toBe('CA');
    expect(floor.amount).toBeGreaterThan(FEDERAL_MINIMUM_WAGE);
  });

  it('refuses to guess a state from an unrecognized code', () => {
    // "ZZ" is not a state; quoting the wrong floor is worse than the federal one.
    expect(stateFromLocation('Somewhere, ZZ')).toBeNull();
    expect(minimumWageFor('Somewhere, ZZ').state).toBeNull();
  });

  it('ignores a state code that is not at the end of the string', () => {
    expect(stateFromLocation('CA Street, Bryn Mawr')).toBeNull();
  });
});

describe('effective hourly rate', () => {
  it('treats hourly pay as already being a rate', () => {
    expect(effectiveHourlyRate(18, 'hourly', 30)).toBe(18);
  });

  it('divides fixed pay by the estimated duration', () => {
    expect(effectiveHourlyRate(40, 'fixed', 120)).toBe(20);
  });

  it('cannot compute a fixed-pay rate with no duration', () => {
    expect(effectiveHourlyRate(40, 'fixed', undefined)).toBeNull();
    expect(effectiveHourlyRate(0, 'hourly', 60)).toBeNull();
  });
});

describe('wage guidance', () => {
  it('warns when the implied rate falls under the floor', () => {
    // $20 for a 4-hour job is $5/hr — under the $7.25 federal floor.
    const g = wageGuidance(20, 'fixed', 240, 'Bryn Mawr');
    expect(g.belowFloor).toBe(true);
    expect(g.warning).toContain('below');
  });

  it('stays quiet when the rate clears the floor', () => {
    const g = wageGuidance(60, 'fixed', 120, 'Bryn Mawr');
    expect(g.belowFloor).toBe(false);
    expect(g.warning).toBeUndefined();
    expect(g.hint).toContain('/hr');
  });

  it('still gives a hint when the rate is not computable', () => {
    const g = wageGuidance(0, 'fixed', undefined, 'Bryn Mawr');
    expect(g.hourlyRate).toBeNull();
    expect(g.hint).toContain('Fair-pay guideline');
  });

  it('applies the state floor when the location names one', () => {
    // $12/hr clears the federal floor but not California's.
    expect(wageGuidance(12, 'hourly', 60, 'Santa Monica, CA').belowFloor).toBe(true);
    expect(wageGuidance(12, 'hourly', 60, 'Bryn Mawr').belowFloor).toBe(false);
  });
});

describe('duration bounds', () => {
  it('accepts a duration inside the band', () => {
    expect(durationBoundsError(90)).toBeNull();
    expect(durationBoundsError(MIN_DURATION_MINUTES)).toBeNull();
    expect(durationBoundsError(MAX_DURATION_MINUTES)).toBeNull();
  });

  it('rejects durations outside the band', () => {
    expect(durationBoundsError(MIN_DURATION_MINUTES - 1)).toBeTruthy();
    expect(durationBoundsError(MAX_DURATION_MINUTES + 1)).toBeTruthy();
  });

  it('says nothing when no duration was entered', () => {
    expect(durationBoundsError(undefined)).toBeNull();
  });
});

describe('schedule bounds', () => {
  const tomorrow = () => new Date(Date.now() + 24 * 3600_000);
  const yesterday = () => new Date(Date.now() - 24 * 3600_000);

  it('flags a past date', () => {
    expect(scheduleInPast(yesterday(), null)).toBe(true);
  });

  it('allows a future date', () => {
    expect(scheduleInPast(tomorrow(), null)).toBe(false);
  });

  it('flags a time that has already passed today', () => {
    const today = new Date();
    const earlier = new Date(Date.now() - 3 * 3600_000);
    // Only meaningful if "3 hours ago" is still the same calendar day.
    if (earlier.toDateString() === today.toDateString()) {
      expect(scheduleInPast(today, earlier)).toBe(true);
    }
  });

  it('treats a missing date as unscheduled rather than past', () => {
    expect(scheduleInPast(null, new Date(0))).toBe(false);
    expect(combineDateTime(null, new Date())).toBeNull();
  });

  it('merges the time-of-day onto the chosen date', () => {
    const date = new Date(2030, 0, 15);
    const time = new Date(2020, 5, 5, 14, 30);
    const merged = combineDateTime(date, time)!;
    expect(merged.getFullYear()).toBe(2030);
    expect(merged.getMonth()).toBe(0);
    expect(merged.getDate()).toBe(15);
    expect(merged.getHours()).toBe(14);
    expect(merged.getMinutes()).toBe(30);
  });
});
