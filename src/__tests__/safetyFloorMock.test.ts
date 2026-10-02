/**
 * The mock backend applies the same keyword floor the database trigger does
 * (migration 0027), so mock-mode QA can't show a tier production wouldn't store.
 */

import { mockBackend, signInAsMockPersona } from '@/services/mockBackend';
import { CreateJobInput } from '@/services/types';

const job: CreateJobInput = {
  category: 'yard_work',
  title: 'Yard help',
  description: 'Bring your chainsaw for the branches',
  pay: 30,
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

describe('keyword floor in the mock backend', () => {
  beforeAll(() => signInAsMockPersona('teen@example.com'));

  it('raises a tampered tier on create', async () => {
    expect((await mockBackend.createJob(job)).safetyTier).toBe('blocked');
  });

  it('raises the tier when an edit adds hazardous work', async () => {
    const created = await mockBackend.createJob({ ...job, title: 'Water plants', description: 'Easy' });
    expect(created.safetyTier).toBe('teen_safe');
    const edited = await mockBackend.updateJob(created.id, { description: 'Now also mow the lawn' });
    expect(edited.safetyTier).toBe('sixteen_plus_only');
  });
});
