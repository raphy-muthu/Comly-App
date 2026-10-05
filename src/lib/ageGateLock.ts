/**
 * Device lock after an ineligible sign-up attempt.
 *
 * The FTC's guidance for a COPPA age screen is that it be neutral — it asks
 * for a birth date without announcing the cutoff — and that a child who is
 * refused can't simply go back and enter an older date. The first half lives
 * in SignUpScreen's copy; this is the second half. Once a too-young date is
 * submitted, sign-up stays closed on this device for AGE_GATE_LOCK_MS.
 *
 * Stored in SecureStore (Keychain / Keystore) rather than AsyncStorage
 * because the iOS Keychain survives an uninstall, so deleting and
 * reinstalling the app doesn't reopen the form. Where SecureStore is
 * unavailable (Expo web) the lock falls back to memory, which still covers
 * the "press back and change the date" case for the rest of the session.
 *
 * This is a deterrent, not the gate: the database refuses any account whose
 * date of birth is under the minimum, whatever the device says.
 */
import * as SecureStore from 'expo-secure-store';

export const AGE_GATE_LOCK_KEY = 'comly.ageGate.lockedAt';
export const AGE_GATE_LOCK_MS = 24 * 60 * 60 * 1000;

let memoryLockedAt: string | null = null;

/** Pure check, kept separate so the window logic is testable without storage. */
export function lockIsActive(lockedAtIso: string | null, now: Date): boolean {
  if (!lockedAtIso) return false;
  const lockedAt = Date.parse(lockedAtIso);
  if (Number.isNaN(lockedAt)) return false;
  // A timestamp in the future means the device clock moved backwards; keep the
  // lock rather than treating a skewed clock as a way out.
  return now.getTime() - lockedAt < AGE_GATE_LOCK_MS;
}

async function readLockedAt(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(AGE_GATE_LOCK_KEY)) ?? memoryLockedAt;
  } catch {
    return memoryLockedAt;
  }
}

export async function isSignupLocked(now: Date = new Date()): Promise<boolean> {
  return lockIsActive(await readLockedAt(), now);
}

export async function lockSignup(now: Date = new Date()): Promise<void> {
  const iso = now.toISOString();
  memoryLockedAt = iso;
  try {
    await SecureStore.setItemAsync(AGE_GATE_LOCK_KEY, iso);
  } catch {
    // Memory lock above still holds for this session.
  }
}

/** Test-only: clears both the stored and in-memory lock. */
export async function __resetSignupLockForTests(): Promise<void> {
  memoryLockedAt = null;
  try {
    await SecureStore.deleteItemAsync(AGE_GATE_LOCK_KEY);
  } catch {
    // Nothing stored.
  }
}
