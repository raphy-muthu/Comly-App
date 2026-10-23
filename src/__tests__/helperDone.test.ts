/**
 * The helper's "I'm done" (migration 0034) against the mock backend, plus the
 * job link alerts now carry. Mirrors the SQL scenarios: only the hired helper
 * can say done, only once; the poster either declines (flag cleared, helper
 * told) or confirms, which completes the job at once.
 *
 * The session switches between Sarah (the poster) and the teen persona
 * Jordan (the helper), so this runs as one ordered sequence.
 */

import {
  currentMockUser,
  mockBackend,
  signInAsMockPersona,
} from '@/services/mockBackend';
import { WorkflowError } from '@/services/types';

const asSarah = () => signInAsMockPersona('sarah@example.com');
const asJordan = () => signInAsMockPersona('teen@example.com');

let jobId = '';

describe("helper says they're done", () => {
  beforeAll(async () => {
    asSarah();
    const job = await mockBackend.createJob({
      category: 'tutoring',
      title: 'Algebra homework help',
      description: 'An hour of help with algebra homework.',
      pay: 25,
      payType: 'fixed',
      neighborhood: 'Bryn Mawr',
      scheduledFor: 'Saturday',
      isTimeFlexible: true,
      estimatedDuration: '1 hour',
      safetyTier: 'teen_safe',
      requiresAdultSupervision: false,
      equipmentStatus: 'not_needed',
      communityTags: [],
    });
    jobId = job.id;

    asJordan();
    await mockBackend.applyToJob({ jobId, message: 'Happy to help with algebra.' });

    asSarah();
    const [app] = await mockBackend.listApplicationsForJob(jobId);
    await mockBackend.acceptApplication(jobId, app.id);
  });

  it('alerts the poster about the application, linked to the job', async () => {
    const alert = (await mockBackend.listNotifications()).find(
      (n) => n.type === 'application_received' && n.jobId === jobId
    );
    expect(alert).toBeDefined();
  });

  it('only lets the hired helper mark it done', async () => {
    asSarah();
    await expect(mockBackend.markJobDoneByHelper(jobId)).rejects.toBeInstanceOf(WorkflowError);
  });

  it('records the helper is done and alerts the poster with a link', async () => {
    asJordan();
    expect(currentMockUser().id).toBe('u_jordan');
    const job = await mockBackend.markJobDoneByHelper(jobId);
    expect(job.helperDoneAt).toBeTruthy();
    expect(job.status).toBe('accepted');

    asSarah();
    const alert = (await mockBackend.listNotifications()).find(
      (n) => n.type === 'helper_marked_done'
    );
    expect(alert?.jobId).toBe(jobId);
  });

  it("doesn't let the helper send it twice", async () => {
    asJordan();
    await expect(mockBackend.markJobDoneByHelper(jobId)).rejects.toBeInstanceOf(WorkflowError);
  });

  it('lets the poster say it is not finished, clearing the flag', async () => {
    asSarah();
    const job = await mockBackend.declineHelperDone(jobId, 'One more worksheet to go');
    expect(job.helperDoneAt).toBeNull();
    expect(job.status).toBe('accepted');
  });

  it('completes at once when the poster confirms after the helper said done', async () => {
    asJordan();
    await mockBackend.markJobDoneByHelper(jobId);

    asSarah();
    const job = await mockBackend.requestJobCompletion(jobId);
    expect(job.status).toBe('completed');
    expect(job.completedAt).toBeTruthy();
    expect(job.helperDoneAt).toBeNull();
  });
});
