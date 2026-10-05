/**
 * Babysitting is a category whose risk doesn't show up in the job's wording.
 * "Watch my two kids Friday night" contains none of the keywords the safety
 * floor looks for, so without a category floor it would be classed teen_safe
 * and a 13-year-old could accept it with no parent involved.
 */

import { applyCategoryTierFloor, categoryLabel, eligibilityFor } from '@/types/domain';
import { keywordTier } from '@/lib/safetyKeywords';
import { mockBackend, signInAsMockPersona } from '@/services/mockBackend';
import { CreateJobInput } from '@/services/types';

describe('babysitting category', () => {
  it('has a display label', () => {
    expect(categoryLabel('babysitting')).toBe('Babysitting');
  });
});

describe('applyCategoryTierFloor', () => {
  it('raises babysitting jobs below the floor to adult_supervision', () => {
    expect(applyCategoryTierFloor('babysitting', 'teen_safe')).toBe('adult_supervision');
    expect(applyCategoryTierFloor('babysitting', 'caution')).toBe('adult_supervision');
  });

  it('never lowers a stricter tier', () => {
    for (const t of ['adult_supervision', 'sixteen_plus_only', 'eighteen_plus_only', 'blocked'] as const) {
      expect(applyCategoryTierFloor('babysitting', t)).toBe(t);
    }
  });

  it('leaves categories without a floor untouched', () => {
    expect(applyCategoryTierFloor('dog_walking', 'teen_safe')).toBe('teen_safe');
    expect(applyCategoryTierFloor('house_sitting', 'caution')).toBe('caution');
  });

  it('means a minor needs parent approval, and an adult does not', () => {
    const tier = applyCategoryTierFloor('babysitting', 'teen_safe');
    expect(eligibilityFor(tier, 'fourteen_fifteen', false).canApply).toBe(false);
    expect(eligibilityFor(tier, 'fourteen_fifteen', true).canApply).toBe(true);
    expect(eligibilityFor(tier, 'adult', false).canApply).toBe(true);
  });
});

describe('childcare keywords', () => {
  it('floor a babysitting job posted under another category', () => {
    expect(keywordTier('Need a babysitter Saturday').tier).toBe('adult_supervision');
    expect(keywordTier('Babysitting two kids').tier).toBe('adult_supervision');
    expect(keywordTier('Looking for a nanny').tier).toBe('adult_supervision');
    expect(keywordTier('After-school child care').tier).toBe('adult_supervision');
  });

  it('do not catch pet or house sitting', () => {
    expect(keywordTier('Pet sitter for my cat').tier).toBe('teen_safe');
    expect(keywordTier('House sitter while we travel').tier).toBe('teen_safe');
  });
});

describe('babysitting floor in the mock backend', () => {
  const babysittingJob: CreateJobInput = {
    category: 'babysitting',
    title: 'Watch two kids Friday evening',
    description: 'Ages 6 and 9. Dinner is ready, bedtime at 8:30.',
    pay: 18,
    payType: 'hourly',
    neighborhood: 'Wayne',
    scheduledFor: 'Fri · 6:00 PM',
    isTimeFlexible: false,
    estimatedDuration: '3 hours',
    safetyTier: 'teen_safe',
    requiresAdultSupervision: false,
    equipmentStatus: 'not_needed',
    communityTags: [],
  };

  beforeAll(() => signInAsMockPersona('teen@example.com'));

  it('stores a babysitting job no lower than adult_supervision', async () => {
    const job = await mockBackend.createJob(babysittingJob);
    expect(job.safetyTier).toBe('adult_supervision');
    expect(job.requiresAdultSupervision).toBe(true);
  });

  it('re-applies the floor when the owner edits the tier down', async () => {
    const job = await mockBackend.createJob({ ...babysittingJob, title: 'Saturday evening' });
    const updated = await mockBackend.updateJob(job.id, { safetyTier: 'teen_safe' });
    expect(updated.safetyTier).toBe('adult_supervision');
  });

  it('does not touch other categories', async () => {
    const job = await mockBackend.createJob({
      ...babysittingJob,
      category: 'dog_walking',
      title: 'Walk Biscuit',
      description: 'Twenty minutes around the block.',
    });
    expect(job.safetyTier).toBe('teen_safe');
  });
});
