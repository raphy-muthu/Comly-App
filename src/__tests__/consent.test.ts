/**
 * Re-consent threshold logic.
 *
 * consentIsCurrent decides whether an existing account is interrupted with a
 * blocking prompt, so both failure directions are costly: too eager and every
 * user is nagged over a typo fix, too lax and people keep operating under text
 * they never saw.
 */

import {
  PRIVACY_RECONSENT_SINCE,
  TERMS_RECONSENT_SINCE,
  PRIVACY_VERSION,
  TERMS_VERSION,
  consentIsCurrent,
} from '@/legal/content';

describe('consentIsCurrent', () => {
  it('accepts an account holding the current versions', () => {
    expect(consentIsCurrent(TERMS_VERSION, PRIVACY_VERSION)).toBe(true);
  });

  it('accepts versions newer than the threshold but older than current', () => {
    // The 2026-09-07 privacy revision documented account deletion and was
    // deliberately not a re-consent event, so someone on 09-06 stays current.
    expect(consentIsCurrent(TERMS_RECONSENT_SINCE, PRIVACY_RECONSENT_SINCE)).toBe(true);
  });

  it('prompts an account that predates the terms threshold', () => {
    expect(consentIsCurrent('2026-09-04', PRIVACY_VERSION)).toBe(false);
  });

  it('prompts an account that predates the privacy threshold', () => {
    // The stub-era privacy policy. Agreeing to a placeholder is not agreement
    // to the real document that replaced it.
    expect(consentIsCurrent(TERMS_VERSION, '2026-09-04')).toBe(false);
  });

  it('prompts an account with no recorded consent at all', () => {
    expect(consentIsCurrent(null, null)).toBe(false);
    expect(consentIsCurrent(undefined, undefined)).toBe(false);
  });

  it('prompts when only one document was ever accepted', () => {
    expect(consentIsCurrent(TERMS_VERSION, null)).toBe(false);
    expect(consentIsCurrent(null, PRIVACY_VERSION)).toBe(false);
  });

  it('treats an empty string as no consent rather than as a version', () => {
    expect(consentIsCurrent('', '')).toBe(false);
  });

  it('compares ISO dates chronologically, not by length', () => {
    // Guards the string-comparison shortcut: it only holds while versions stay
    // zero-padded ISO dates. A scheme like "v10" would break this silently.
    expect(consentIsCurrent('2027-01-01', '2027-01-01')).toBe(true);
    expect(consentIsCurrent('2025-12-31', '2025-12-31')).toBe(false);
  });

  it('keeps the thresholds at or behind the published versions', () => {
    // A threshold ahead of the current document would prompt every user and
    // then reject the very version the prompt asks them to accept.
    expect(TERMS_RECONSENT_SINCE <= TERMS_VERSION).toBe(true);
    expect(PRIVACY_RECONSENT_SINCE <= PRIVACY_VERSION).toBe(true);
  });
});
