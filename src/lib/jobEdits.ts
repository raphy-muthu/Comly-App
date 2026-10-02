/**
 * Safety fields to save alongside an edit. Changing a job's wording changes
 * what the safety review was judging, so the tier is re-derived from the new
 * text rather than carried over from the old one. (The database's keyword
 * floor, migration 0027, applies on top either way.)
 */

import type { SafetyResult } from '@/services/ai';
import type { JobUpdateInput } from '@/services/types';

export async function safetyFieldsForEdit(
  job: { title: string; description: string },
  title: string,
  description: string,
  review: (title: string, description: string) => Promise<SafetyResult>
): Promise<Pick<JobUpdateInput, 'safetyTier' | 'safetyNotes'>> {
  if (title === job.title && description === job.description) return {};
  const result = await review(title, description);
  return { safetyTier: result.tier, safetyNotes: result.note };
}
