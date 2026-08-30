/**
 * Hours/time-of-day advisory for 14-15-year-old helpers (FLSA-inspired,
 * client-side guidance only — nothing here blocks a post or an application).
 */

import { hoursGuidanceFor, isSummer } from '@/lib/hours';

describe('isSummer (FLSA summer window: June 1 - Labor Day)', () => {
  it('is not summer on May 31', () => {
    expect(isSummer(new Date('2026-05-31T12:00:00'))).toBe(false);
  });

  it('is summer on June 1', () => {
    expect(isSummer(new Date('2026-06-01T12:00:00'))).toBe(true);
  });

  it('is summer on Labor Day itself (first Monday of September)', () => {
    // Labor Day 2026 is September 7.
    expect(isSummer(new Date('2026-09-07T12:00:00'))).toBe(true);
  });

  it('is not summer the day after Labor Day', () => {
    expect(isSummer(new Date('2026-09-08T12:00:00'))).toBe(false);
  });
});

describe('hoursGuidanceFor', () => {
  it('returns null for brackets FLSA does not restrict', () => {
    const scheduledFor = new Date('2026-09-10T18:00:00'); // Thursday, non-summer, 6pm
    expect(hoursGuidanceFor('under_14', scheduledFor, 60)).toBeNull();
    expect(hoursGuidanceFor('sixteen_seventeen', scheduledFor, 60)).toBeNull();
    expect(hoursGuidanceFor('adult', scheduledFor, 60)).toBeNull();
  });

  it('flags a non-summer evening job that runs past 7pm', () => {
    // Thursday, starts 6:30pm, 1 hour -> ends 7:30pm, past the 7pm cutoff.
    const scheduledFor = new Date('2026-09-10T18:30:00');
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 60);
    expect(guidance).not.toBeNull();
    expect(guidance!.outsideWindow).toBe(true);
  });

  it('does not flag the same evening slot during summer (9pm cutoff)', () => {
    // Wednesday in summer, starts 6:30pm, 1 hour -> ends 7:30pm, fine at a 9pm cutoff.
    const scheduledFor = new Date('2026-07-08T18:30:00');
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 60);
    expect(guidance!.outsideWindow).toBe(false);
  });

  it('does not flag a mid-morning job well inside the window', () => {
    const scheduledFor = new Date('2026-09-10T10:00:00'); // Thursday 10am, non-summer
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 60);
    expect(guidance!.outsideWindow).toBe(false);
  });

  it('caps a non-summer weekday (approximated school day) at 3 hours', () => {
    const scheduledFor = new Date('2026-09-10T10:00:00'); // Thursday, non-summer
    const under = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 3 * 60);
    const over = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 3 * 60 + 1);
    expect(under!.overDurationCap).toBe(false);
    expect(over!.overDurationCap).toBe(true);
  });

  it('allows up to 8 hours on a non-summer weekend', () => {
    const scheduledFor = new Date('2026-09-12T10:00:00'); // Saturday, non-summer
    const under = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 8 * 60);
    const over = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 8 * 60 + 1);
    expect(under!.overDurationCap).toBe(false);
    expect(over!.overDurationCap).toBe(true);
  });

  it('allows up to 8 hours on ANY day during summer, including a weekday', () => {
    const scheduledFor = new Date('2026-07-08T10:00:00'); // Wednesday, summer
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 8 * 60);
    expect(guidance!.overDurationCap).toBe(false);
  });

  it('skips the duration check entirely when duration is unknown', () => {
    const scheduledFor = new Date('2026-09-10T10:00:00');
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, undefined);
    expect(guidance!.overDurationCap).toBe(false);
    expect(guidance!.durationNote).toBeUndefined();
  });

  it('provides a human-readable note whenever a flag is raised', () => {
    const scheduledFor = new Date('2026-09-10T20:00:00'); // Thursday 8pm, non-summer
    const guidance = hoursGuidanceFor('fourteen_fifteen', scheduledFor, 60);
    expect(guidance!.outsideWindow).toBe(true);
    expect(guidance!.windowNote).toBeTruthy();
  });
});
