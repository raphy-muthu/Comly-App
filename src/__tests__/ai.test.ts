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

  it('puts power-driven equipment behind the 16 floor, not a caution label', async () => {
    // Regression: mowing used to sit in the caution list, which let a
    // 13-year-old apply to a lawn-mowing job with only a warning attached.
    expect((await ai.safetyReview('Lawn mowing', 'front and back yard')).tier).toBe(
      'sixteen_plus_only'
    );
    expect(
      (await ai.safetyReview('Yard help', 'hedge trimmer and leaf blower')).tier
    ).toBe('sixteen_plus_only');
    expect(
      (await ai.safetyReview('Driveway', 'run the snow blower after the storm')).tier
    ).toBe('sixteen_plus_only');
  });

  it('applies the 16 floor from the category when the wording hides it', async () => {
    // No flagged keyword anywhere in this text, but the category the poster
    // picked is literally labelled "Lawn Mowing".
    expect(
      (await ai.safetyReview('Yard tidy-up', 'tidy the grass out front', 'lawn_care'))
        .tier
    ).toBe('sixteen_plus_only');
  });

  it('lets the text raise a tier above its category floor, never lower it', async () => {
    // snow_removal floors at caution…
    expect((await ai.safetyReview('Driveway', 'clear it', 'snow_removal')).tier).toBe(
      'caution'
    );
    // …and a hazard in the text still wins.
    expect(
      (await ai.safetyReview('Driveway', 'also clean the gutters', 'snow_removal')).tier
    ).toBe('eighteen_plus_only');
  });

  it('keeps the un-powered version of the same chore at caution', async () => {
    // The line is the equipment, not the task: shovelling is still fine.
    expect(
      (await ai.safetyReview('Snow shoveling', 'by hand, no machines')).tier
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
