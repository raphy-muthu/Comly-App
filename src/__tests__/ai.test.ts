/**
 * Mock AI service — the deterministic safety classifier is part of the app's
 * safety surface, so its tier decisions are pinned by tests.
 */

import { ai } from '@/services/ai';

describe('safetyReview tiers', () => {
  it('blocks roof/electrical work outright', async () => {
    expect((await ai.safetyReview('Fix roof shingles', '')).tier).toBe('blocked');
    expect((await ai.safetyReview('Repair', 'electrical wiring issue')).tier).toBe(
      'blocked'
    );
  });

  it('classifies ladder/gutter work as 18+', async () => {
    expect((await ai.safetyReview('Gutter cleaning', 'bring a ladder')).tier).toBe(
      'eighteen_plus_only'
    );
  });

  it('recommends supervision for pool work', async () => {
    expect(
      (await ai.safetyReview('Pool cleaning assistance', 'skim and vacuum')).tier
    ).toBe('adult_supervision');
  });

  it('marks weather/physical work as caution', async () => {
    expect(
      (await ai.safetyReview('Snow shoveling', 'clear the driveway')).tier
    ).toBe('caution');
  });

  it('defaults harmless tasks to teen-safe', async () => {
    expect((await ai.safetyReview('Algebra tutoring', 'help with exams')).tier).toBe(
      'teen_safe'
    );
  });
});

describe('suggestPay', () => {
  it('returns the fixed-fee band with a midpoint recommendation', async () => {
    const s = await ai.suggestPay('snow_removal', 'Shovel driveway', 'fixed');
    expect(s.min).toBe(35);
    expect(s.max).toBe(45);
    expect(s.recommended).toBe(40);
    expect(s.rationale.length).toBeGreaterThan(0);
  });

  it('returns a materially different, lower range for hourly than fixed', async () => {
    // This is the actual bug report: the two payTypes used to return the
    // identical range, so an hourly job showed a whole-job flat-fee number.
    const fixed = await ai.suggestPay('lawn_care', 'Mow the lawn', 'fixed');
    const hourly = await ai.suggestPay('lawn_care', 'Mow the lawn', 'hourly');
    expect(hourly.min).not.toBe(fixed.min);
    expect(hourly.max).not.toBe(fixed.max);
    expect(hourly.rationale).not.toBe(fixed.rationale);
  });
});

describe('generateResumeSummary', () => {
  it('reflects the helper track record', async () => {
    const summary = await ai.generateResumeSummary({
      jobsCount: 12,
      rating: 4.9,
      skills: ['Reliability', 'Communication'],
      preferredCategories: ['tutoring', 'pet_care'],
    });
    expect(summary).toContain('12 neighborhood service jobs');
    expect(summary).toContain('4.9-star');
  });
});
