/**
 * Neutral age screen: once a too-young date is submitted, sign-up stays
 * closed on the device for a day, so "go back and pick an older year" doesn't
 * work. The window arithmetic is the part most likely to be quietly wrong.
 */
import {
  __resetSignupLockForTests,
  AGE_GATE_LOCK_MS,
  isSignupLocked,
  lockIsActive,
  lockSignup,
} from '@/lib/ageGateLock';

describe('lockIsActive', () => {
  const lockedAt = new Date('2026-10-05T12:00:00Z');

  it('is inactive with no stored lock', () => {
    expect(lockIsActive(null, lockedAt)).toBe(false);
  });

  it('is inactive for an unparseable value rather than throwing', () => {
    expect(lockIsActive('not-a-date', lockedAt)).toBe(false);
  });

  it('holds for the whole window', () => {
    const justBefore = new Date(lockedAt.getTime() + AGE_GATE_LOCK_MS - 1);
    expect(lockIsActive(lockedAt.toISOString(), justBefore)).toBe(true);
  });

  it('expires once the window has passed', () => {
    const atExpiry = new Date(lockedAt.getTime() + AGE_GATE_LOCK_MS);
    expect(lockIsActive(lockedAt.toISOString(), atExpiry)).toBe(false);
  });

  it('stays locked if the device clock is moved backwards', () => {
    const earlier = new Date(lockedAt.getTime() - 60 * 60 * 1000);
    expect(lockIsActive(lockedAt.toISOString(), earlier)).toBe(true);
  });
});

describe('lockSignup / isSignupLocked', () => {
  afterEach(() => __resetSignupLockForTests());

  it('starts unlocked', async () => {
    expect(await isSignupLocked()).toBe(false);
  });

  it('locks after an ineligible attempt and reopens a day later', async () => {
    const at = new Date('2026-10-05T12:00:00Z');
    await lockSignup(at);
    expect(await isSignupLocked(new Date(at.getTime() + 60_000))).toBe(true);
    expect(await isSignupLocked(new Date(at.getTime() + AGE_GATE_LOCK_MS))).toBe(false);
  });
});
