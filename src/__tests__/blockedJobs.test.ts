/**
 * "Label, don't hide": teens see jobs they can't apply to, clearly marked.
 * That's only acceptable if prohibited (Blocked) work is never in anyone's
 * feed — it isn't age-restricted, it isn't allowed at all. Mirrors the jobs
 * SELECT policy in migration 0032.
 */

import { eligibilityForUser } from '@/types/domain';
import { mockBackend, signInAsMockPersona } from '@/services/mockBackend';
import { CreateJobInput } from '@/services/types';

const hazardous: CreateJobInput = {
  category: 'yard_work',
  title: 'Tree branches',
  description: 'Bring a chainsaw',
  pay: 40,
  payType: 'fixed',
  neighborhood: 'Wayne',
  scheduledFor: 'Sat · 10:00 AM',
  isTimeFlexible: true,
  estimatedDuration: '2 hours',
  safetyTier: 'teen_safe',
  requiresAdultSupervision: false,
  equipmentStatus: 'no',
  communityTags: [],
};

describe('Blocked jobs in the mock backend', () => {
  // The default demo account posts the job (it is also an admin); Jordan is a
  // non-admin helper who doesn't own it.
  let blockedId: string;

  beforeAll(async () => {
    signInAsMockPersona('owner@example.com');
    const job = await mockBackend.createJob(hazardous);
    expect(job.safetyTier).toBe('blocked'); // keyword floor
    blockedId = job.id;
  });

  it('stay visible to their owner (and admins)', async () => {
    signInAsMockPersona('owner@example.com');
    expect(await mockBackend.getJob(blockedId)).not.toBeNull();
  });

  it('never appear in anyone else’s feed', async () => {
    signInAsMockPersona('teen@example.com');
    const feed = await mockBackend.listFeedJobs();
    expect(feed.some((j) => j.id === blockedId)).toBe(false);
    expect(feed.some((j) => j.safetyTier === 'blocked')).toBe(false);
  });

  it('cannot be opened by id by anyone else', async () => {
    signInAsMockPersona('teen@example.com');
    expect(await mockBackend.getJob(blockedId)).toBeNull();
  });
});

describe('eligibilityForUser (the card label)', () => {
  const teen = (parentApproved: boolean) => ({
    ageBracket: 'fourteen_fifteen' as const,
    ageGroup: 'teen' as const,
    verification: { parentApproved },
  });

  it('tells a 14–15-year-old they can’t apply to 16+ or 18+ work', () => {
    expect(eligibilityForUser('sixteen_plus_only', teen(true)).canApply).toBe(false);
    expect(eligibilityForUser('eighteen_plus_only', teen(true)).canApply).toBe(false);
  });

  it('ties parent-approval jobs to the approval', () => {
    expect(eligibilityForUser('adult_supervision', teen(false)).canApply).toBe(false);
    expect(eligibilityForUser('adult_supervision', teen(true)).canApply).toBe(true);
  });

  it('shows no label while the user is still loading', () => {
    expect(eligibilityForUser('eighteen_plus_only', null).canApply).toBe(true);
  });
});
