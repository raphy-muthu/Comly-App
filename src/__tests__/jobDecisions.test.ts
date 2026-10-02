/**
 * When an owner can still accept/decline applicants. Must match
 * accept_application() on the server, which only proceeds for open/reviewing.
 * The screen used to show Accept on filled/paused/in-progress jobs, and the
 * mock backend accepted onto them.
 */

import { jobAcceptsDecisions, JobStatus } from '@/types/domain';
import { mockBackend } from '@/services/mockBackend';

describe('jobAcceptsDecisions', () => {
  it.each<[JobStatus, boolean]>([
    ['open', true],
    ['reviewing', true],
    ['paused', false],
    ['filled', false],
    ['accepted', false],
    ['in_progress', false],
    ['pending_confirmation', false],
    ['completed', false],
    ['cancelled', false],
  ])('%s → %s', (status, expected) => {
    expect(jobAcceptsDecisions(status)).toBe(expected);
  });
});

describe('mock acceptApplication matches the server', () => {
  it('refuses to accept onto a filled job', async () => {
    // j_snow_sarah is Sarah's open job with pending app_1 (seed data).
    await mockBackend.setJobStatus('j_snow_sarah', 'filled');
    await expect(mockBackend.acceptApplication('j_snow_sarah', 'app_1')).rejects.toThrow(
      /outcome/i
    );
  });
});
