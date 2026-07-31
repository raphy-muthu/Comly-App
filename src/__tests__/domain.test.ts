/**
 * Domain rules — teen-safety eligibility gate, badge derivation, category
 * labels. These encode Comly's core safety promises, so they get direct tests.
 */

import {
  categoryLabel,
  deriveBadges,
  eligibilityFor,
  VerificationStatus,
} from '@/types/domain';

const verified = (parentApproved: boolean): VerificationStatus => ({
  emailVerified: true,
  phoneAdded: true,
  photoAdded: true,
  schoolEmailVerified: false,
  parentApproved,
});

describe('eligibilityFor (teen-safety gate)', () => {
  it('blocks everyone from blocked jobs', () => {
    expect(eligibilityFor('blocked', 'adult', false).canApply).toBe(false);
    expect(eligibilityFor('blocked', 'teen', true).canApply).toBe(false);
  });

  it('lets adults apply to any non-blocked tier', () => {
    expect(eligibilityFor('teen_safe', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('caution', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('adult_supervision', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('eighteen_plus_only', 'adult', false).canApply).toBe(true);
  });

  it('never lets minors apply to 18+ jobs', () => {
    expect(eligibilityFor('eighteen_plus_only', 'teen', false).canApply).toBe(false);
    // Parent approval must NOT override the 18+ restriction.
    expect(eligibilityFor('eighteen_plus_only', 'teen', true).canApply).toBe(false);
  });

  it('gates supervision-tier jobs on parent approval for teens', () => {
    expect(eligibilityFor('adult_supervision', 'teen', false).canApply).toBe(false);
    expect(eligibilityFor('adult_supervision', 'teen', true).canApply).toBe(true);
  });

  it('lets teens apply to teen-safe and caution jobs', () => {
    expect(eligibilityFor('teen_safe', 'teen', false).canApply).toBe(true);
    expect(eligibilityFor('caution', 'teen', false).canApply).toBe(true);
  });

  it('explains every refusal', () => {
    expect(eligibilityFor('blocked', 'adult', false).reason).toBeTruthy();
    expect(eligibilityFor('eighteen_plus_only', 'teen', false).reason).toBeTruthy();
    expect(eligibilityFor('adult_supervision', 'teen', false).reason).toBeTruthy();
  });
});

describe('deriveBadges', () => {
  it('awards the full ladder to a strong parent-approved teen', () => {
    const badges = deriveBadges({
      rating: 4.9,
      jobsCount: 30,
      reputationScore: 95,
      ageGroup: 'teen',
      verification: verified(true),
    });
    expect(badges).toEqual(
      expect.arrayContaining([
        'parent_approved',
        'teen_safe_helper',
        'top_rated',
        'reliable_helper',
        'community_builder',
        'trusted_neighbor',
      ])
    );
  });

  it('awards nothing to a brand-new adult account', () => {
    const badges = deriveBadges({
      rating: 0,
      jobsCount: 0,
      reputationScore: 0,
      ageGroup: 'adult',
      verification: verified(false),
    });
    expect(badges).toHaveLength(0);
  });
});

describe('categoryLabel', () => {
  it('uses the custom text for "other"', () => {
    expect(categoryLabel('other', 'Backyard cleanup')).toBe('Backyard cleanup');
  });
  it('falls back to the preset label', () => {
    expect(categoryLabel('snow_removal')).toBe('Snow Shoveling');
    expect(categoryLabel('other')).toBe('Other');
  });
});
