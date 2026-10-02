/**
 * Editing a job's wording re-runs the safety review. Before this, a job
 * approved as "Water plants" (teen_safe) could be edited into anything and
 * keep showing Teen Safe everywhere.
 */

import { safetyFieldsForEdit } from '@/lib/jobEdits';
import { SafetyResult } from '@/services/ai';

const original = { title: 'Water plants', description: 'Easy, 20 minutes' };

describe('safetyFieldsForEdit', () => {
  it('does not re-review when the wording is unchanged', async () => {
    const review = jest.fn();
    expect(await safetyFieldsForEdit(original, original.title, original.description, review)).toEqual({});
    expect(review).not.toHaveBeenCalled();
  });

  it('re-reviews and returns the new tier and note when the description changes', async () => {
    const review = jest.fn(async (): Promise<SafetyResult> => ({
      safe: false,
      tier: 'eighteen_plus_only',
      note: 'Mentions "ladder".',
    }));
    const fields = await safetyFieldsForEdit(original, original.title, 'Also clean gutters from a ladder', review);
    expect(review).toHaveBeenCalledWith('Water plants', 'Also clean gutters from a ladder');
    expect(fields).toEqual({ safetyTier: 'eighteen_plus_only', safetyNotes: 'Mentions "ladder".' });
  });

  it('re-reviews when only the title changes', async () => {
    const review = jest.fn(async (): Promise<SafetyResult> => ({ safe: true, tier: 'teen_safe', note: 'ok' }));
    await safetyFieldsForEdit(original, 'Water plants and walk dog', original.description, review);
    expect(review).toHaveBeenCalledTimes(1);
  });
});
