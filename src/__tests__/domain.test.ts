/**
 * Domain rules — teen-safety eligibility gate, badge derivation, category
 * labels. These encode Comly's core safety promises, so they get direct tests.
 */

import {
  bracketFromDateOfBirth,
  categoryLabel,
  deriveBadges,
  effectiveAgeBracket,
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

describe('bracketFromDateOfBirth (age floor)', () => {
  // A fixed reference date keeps these assertions stable as real time passes.
  const TODAY = new Date('2026-08-25T12:00:00Z');

  it('rejects anyone under 13', () => {
    // 12 years and 364 days old — one day short of the floor.
    expect(bracketFromDateOfBirth('2013-08-26', TODAY)).toBeNull();
  });

  it('admits a 13-year-old on their birthday, as under_14', () => {
    expect(bracketFromDateOfBirth('2013-08-25', TODAY)).toBe('under_14');
  });

  it('brackets 14- and 15-year-olds together', () => {
    expect(bracketFromDateOfBirth('2012-08-25', TODAY)).toBe('fourteen_fifteen');
    expect(bracketFromDateOfBirth('2010-08-26', TODAY)).toBe('fourteen_fifteen');
  });

  it('brackets 16- and 17-year-olds together', () => {
    expect(bracketFromDateOfBirth('2010-08-25', TODAY)).toBe('sixteen_seventeen');
    expect(bracketFromDateOfBirth('2008-08-26', TODAY)).toBe('sixteen_seventeen');
  });

  it('treats 18 and over as adult', () => {
    expect(bracketFromDateOfBirth('2008-08-25', TODAY)).toBe('adult');
    expect(bracketFromDateOfBirth('1985-03-14', TODAY)).toBe('adult');
  });

  it('rejects unparseable input rather than defaulting to adult', () => {
    // NaN comparisons are all false, so an unguarded ladder would fall
    // through to 'adult' and hand full privileges to garbage input.
    expect(bracketFromDateOfBirth('not-a-date', TODAY)).toBeNull();
    expect(bracketFromDateOfBirth('', TODAY)).toBeNull();
  });

  it('rejects a future date of birth', () => {
    expect(bracketFromDateOfBirth('2030-01-01', TODAY)).toBeNull();
  });
});

describe('effectiveAgeBracket', () => {
  it('passes a defined bracket through unchanged, ignoring ageGroup', () => {
    expect(effectiveAgeBracket('sixteen_seventeen', 'teen')).toBe('sixteen_seventeen');
  });

  it('treats a legacy adult (no bracket on file) as adult', () => {
    expect(effectiveAgeBracket(undefined, 'adult')).toBe('adult');
  });

  it('falls back a legacy teen (no bracket on file) to the most conservative bracket', () => {
    // Their real age within the teen range is unknown, so assume the
    // narrowest one rather than risk under-restricting them.
    expect(effectiveAgeBracket(undefined, 'teen')).toBe('under_14');
  });
});

describe('eligibilityFor (teen-safety gate)', () => {
  it('blocks everyone from blocked jobs', () => {
    expect(eligibilityFor('blocked', 'adult', false).canApply).toBe(false);
    expect(eligibilityFor('blocked', 'sixteen_seventeen', true).canApply).toBe(false);
  });

  it('lets adults apply to any non-blocked tier', () => {
    expect(eligibilityFor('teen_safe', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('caution', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('adult_supervision', 'adult', false).canApply).toBe(true);
    expect(eligibilityFor('eighteen_plus_only', 'adult', false).canApply).toBe(true);
  });

  it('never lets minors apply to 18+ jobs', () => {
    expect(eligibilityFor('eighteen_plus_only', 'sixteen_seventeen', false).canApply).toBe(false);
    // Parent approval must NOT override the 18+ restriction.
    expect(eligibilityFor('eighteen_plus_only', 'sixteen_seventeen', true).canApply).toBe(false);
  });

  it('gates supervision-tier jobs on parent approval for teens', () => {
    expect(eligibilityFor('adult_supervision', 'sixteen_seventeen', false).canApply).toBe(false);
    expect(eligibilityFor('adult_supervision', 'sixteen_seventeen', true).canApply).toBe(true);
  });

  it('lets teens apply to teen-safe and caution jobs', () => {
    expect(eligibilityFor('teen_safe', 'sixteen_seventeen', false).canApply).toBe(true);
    expect(eligibilityFor('caution', 'sixteen_seventeen', false).canApply).toBe(true);
  });

  it('explains every refusal', () => {
    expect(eligibilityFor('blocked', 'adult', false).reason).toBeTruthy();
    expect(eligibilityFor('eighteen_plus_only', 'sixteen_seventeen', false).reason).toBeTruthy();
    expect(eligibilityFor('adult_supervision', 'sixteen_seventeen', false).reason).toBeTruthy();
  });
});

describe('eligibilityFor (sixteen_plus_only tier)', () => {
  it('blocks under-14 helpers', () => {
    expect(eligibilityFor('sixteen_plus_only', 'under_14', false).canApply).toBe(false);
  });

  it('blocks 14-15 helpers', () => {
    expect(eligibilityFor('sixteen_plus_only', 'fourteen_fifteen', false).canApply).toBe(false);
  });

  it('admits 16-17 helpers', () => {
    expect(eligibilityFor('sixteen_plus_only', 'sixteen_seventeen', false).canApply).toBe(true);
  });

  it('admits adults', () => {
    expect(eligibilityFor('sixteen_plus_only', 'adult', false).canApply).toBe(true);
  });

  it('explains the refusal', () => {
    expect(eligibilityFor('sixteen_plus_only', 'under_14', false).reason).toBeTruthy();
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
