/**
 * Second-revisions flows against the mock backend: mutual job completion,
 * review authorization, no-show strikes, and invite-to-apply.
 *
 * These mirror the server-side rules in migration 0013, the same way
 * mockBackend.test.ts mirrors 0004. Like that suite, the backend is stateful
 * per session, so these run as one ordered sequence.
 *
 * Fixtures: the seeded session user is `u_sarah`, who owns `j_snow_sarah`
 * (status `reviewing`, three pending applications) and `j_grocery_sarah`
 * (already `accepted`, assigned to `u_alex`).
 */

import { mockBackend } from '@/services/mockBackend';
import { WorkflowError } from '@/services/types';
import { checkRealismLocally } from '@/services/ai';
import { NO_SHOW_POLICY } from '@/types/domain';

const OWNER = 'u_sarah';

describe('mutual job completion', () => {
  it('accepts a helper so there is a working relationship to finish', async () => {
    await mockBackend.acceptApplication('j_snow_sarah', 'app_2');
    const job = await mockBackend.getJob('j_snow_sarah');
    expect(job?.status).toBe('accepted');
    expect(job?.assignedHelperId).toBe('u_diego');
  });

  it('moves the job to pending_confirmation instead of completing it outright', async () => {
    const job = await mockBackend.requestJobCompletion('j_snow_sarah');
    expect(job.status).toBe('pending_confirmation');
    expect(job.completionRequestedAt).toBeTruthy();
    expect(job.completedAt).toBeFalsy();
  });

  it('refuses to let the owner confirm on the helper’s behalf', async () => {
    // The session user is the owner, not the assigned helper — this is the
    // whole point of the change: completion is no longer unilateral.
    await expect(
      mockBackend.confirmJobCompletion('j_snow_sarah')
    ).rejects.toBeInstanceOf(WorkflowError);
    expect((await mockBackend.getJob('j_snow_sarah'))?.status).toBe(
      'pending_confirmation'
    );
  });

  it('refuses a second completion request while one is outstanding', async () => {
    await expect(
      mockBackend.requestJobCompletion('j_snow_sarah')
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('blocks a review while the job is still awaiting confirmation', async () => {
    await expect(
      mockBackend.createReview({
        jobId: 'j_snow_sarah',
        revieweeId: 'u_diego',
        ratings: { reliability: 5, quality: 5, communication: 5, professionalism: 5 },
        comment: 'Too early.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });
});

describe('reviews', () => {
  // The helper's own confirmation can't be simulated from the owner's session,
  // so the job is finished through the owner's existing lifecycle control.
  beforeAll(async () => {
    await mockBackend.setJobStatus('j_snow_sarah', 'completed');
  });

  it('lets a party of the completed job review the other', async () => {
    const review = await mockBackend.createReview({
      jobId: 'j_snow_sarah',
      revieweeId: 'u_diego',
      ratings: { reliability: 5, quality: 4, communication: 5, professionalism: 5 },
      comment: 'Cleared the whole driveway.',
    });
    expect(review.reviewerId).toBe(OWNER);
    expect(review.revieweeId).toBe('u_diego');

    const forJob = await mockBackend.listReviewsForJob('j_snow_sarah');
    expect(forJob.some((r) => r.id === review.id)).toBe(true);
  });

  it('recomputes the reviewee’s headline rating', async () => {
    const profile = await mockBackend.getProfile('u_diego');
    expect(profile?.rating).toBeGreaterThan(0);
    expect(profile?.rating).toBeLessThanOrEqual(5);
  });

  it('allows only one review per reviewer per job', async () => {
    await expect(
      mockBackend.createReview({
        jobId: 'j_snow_sarah',
        revieweeId: 'u_diego',
        ratings: { reliability: 1, quality: 1, communication: 1, professionalism: 1 },
        comment: 'Second thoughts.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('refuses a review aimed at someone who was not on the job', async () => {
    await expect(
      mockBackend.createReview({
        jobId: 'j_snow_sarah',
        revieweeId: 'u_jordan',
        ratings: { reliability: 1, quality: 1, communication: 1, professionalism: 1 },
        comment: 'Wrong person.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('refuses a self-review', async () => {
    await expect(
      mockBackend.createReview({
        jobId: 'j_snow_sarah',
        revieweeId: OWNER,
        ratings: { reliability: 5, quality: 5, communication: 5, professionalism: 5 },
        comment: 'I was great.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });
});

describe('no-show strikes', () => {
  let eventId: string;

  it('cannot be reported once the job is finished', async () => {
    await expect(
      mockBackend.reportNoShow({
        jobId: 'j_snow_sarah',
        reportedUserId: 'u_diego',
        note: 'Never arrived.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('files as pending rather than applying a strike immediately', async () => {
    // j_grocery_sarah is seeded accepted with u_alex assigned.
    const event = await mockBackend.reportNoShow({
      jobId: 'j_grocery_sarah',
      reportedUserId: 'u_alex',
      note: 'Waited an hour, no word.',
    });
    eventId = event.id;

    expect(event.status).toBe('pending');
    expect((await mockBackend.getProfile('u_alex'))?.strikes).toBe(0);
  });

  it('rejects a report aimed at someone who was not on the job', async () => {
    await expect(
      mockBackend.reportNoShow({
        jobId: 'j_grocery_sarah',
        reportedUserId: 'u_jordan',
        note: 'Wrong person.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('rejects a duplicate report for the same job', async () => {
    await expect(
      mockBackend.reportNoShow({
        jobId: 'j_grocery_sarah',
        reportedUserId: 'u_alex',
        note: 'Again.',
      })
    ).rejects.toBeInstanceOf(WorkflowError);
  });

  it('applies a strike only when an admin confirms', async () => {
    await mockBackend.resolveNoShowEvent(eventId, { status: 'confirmed' });
    expect((await mockBackend.getProfile('u_alex'))?.strikes).toBe(1);
  });

  it('does not double-count a repeated confirmation', async () => {
    await mockBackend.resolveNoShowEvent(eventId, { status: 'confirmed' });
    expect((await mockBackend.getProfile('u_alex'))?.strikes).toBe(1);
  });

  it('returns the strike when the decision is reversed', async () => {
    await mockBackend.resolveNoShowEvent(eventId, {
      status: 'dismissed',
      adminNotes: 'Both parties rescheduled.',
    });
    const profile = await mockBackend.getProfile('u_alex');
    expect(profile?.strikes).toBe(0);
    expect(profile?.isSuspended).toBe(false);
  });

  it('lists the event for the reported user and for admins', async () => {
    expect((await mockBackend.listNoShowEventsForUser('u_alex')).length).toBe(1);
    expect((await mockBackend.listAllNoShowEvents()).length).toBe(1);
  });

  it('warns before it suspends', () => {
    expect(NO_SHOW_POLICY.suspensionThreshold).toBeGreaterThan(
      NO_SHOW_POLICY.warningThreshold
    );
  });
});

describe('invite to apply', () => {
  it('creates an invite without unlocking any contact details', async () => {
    // Reopen a listing so there is something invitable. j_snow_sarah is
    // completed and j_grocery_sarah is accepted by this point.
    const job = await mockBackend.createJob({
      category: 'errands',
      title: 'Return a package',
      description: 'Drop a prepaid box at the UPS store.',
      pay: 20,
      payType: 'fixed',
      neighborhood: 'Bryn Mawr',
      scheduledFor: 'Flexible',
      isTimeFlexible: true,
      durationMinutes: 30,
      estimatedDuration: '30 minutes',
      safetyTier: 'teen_safe',
      requiresAdultSupervision: false,
      equipmentStatus: 'not_needed',
      communityTags: [],
    });

    const invite = await mockBackend.inviteHelper({
      jobId: job.id,
      helperId: 'u_diego',
    });
    expect(invite.status).toBe('sent');
    expect(invite.helperId).toBe('u_diego');
    // The record points at a job. It carries no phone number or email — that
    // is the entire reason invites exist instead of a "contact" button.
    expect(Object.keys(invite)).not.toContain('phoneNumber');

    // And contact stays locked, because nobody has been accepted.
    expect(await mockBackend.getJobContact(job.id)).toBeNull();

    await expect(
      mockBackend.inviteHelper({ jobId: job.id, helperId: 'u_diego' })
    ).rejects.toBeInstanceOf(WorkflowError);

    expect((await mockBackend.listInvitesForJob(job.id)).length).toBe(1);
  });
});

describe('listing realism check', () => {
  it('flags pay that works out below the wage floor', () => {
    const result = checkRealismLocally({
      category: 'yard_work',
      title: 'Full day of yard work',
      description: 'Rake, bag, and haul.',
      pay: 20,
      payType: 'fixed',
      durationMinutes: 300,
      location: 'Bryn Mawr',
    });
    expect(result.ok).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/below/i);
  });

  it('flags a duration far outside the category norm', () => {
    const result = checkRealismLocally({
      category: 'dog_walking',
      title: 'Walk the dog',
      description: 'Around the block.',
      pay: 200,
      payType: 'fixed',
      durationMinutes: 420,
      location: 'Bryn Mawr',
    });
    expect(result.ok).toBe(false);
  });

  it('passes a plausible listing', () => {
    const result = checkRealismLocally({
      category: 'snow_removal',
      title: 'Shovel the driveway',
      description: 'Two-car driveway and front walk.',
      pay: 45,
      payType: 'fixed',
      durationMinutes: 60,
      location: 'Bryn Mawr',
    });
    expect(result.ok).toBe(true);
    expect(result.impliedHourlyRate).toBe(45);
  });
});
