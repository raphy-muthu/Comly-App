/**
 * In-memory mock backend.
 *
 * Seeds itself from `lib/mockData` into mutable arrays so writes (new jobs,
 * applications, accept/decline, reports, profile edits) persist for the app
 * session. Every call has a small artificial delay so loading states render.
 */

import {
  ACTIVE_JOB_STATUSES,
  Application,
  compareApplications,
  compareFeedJobs,
  ImpactStats,
  Job,
  JobInvite,
  JobStatus,
  NoShowEvent,
  NO_SHOW_POLICY,
  NotificationType,
  PRIORITY_REASON_PRO_HELPER,
  Report,
  Review,
  SupportTicket,
  UserProfile,
} from '@/types/domain';
import {
  applications as seedApplications,
  currentUser as seedCurrentUser,
  jobs as seedJobs,
  notifications as seedNotifications,
  reports as seedReports,
  reviews as seedReviews,
  supportTickets as seedTickets,
  userRef,
  users as seedUsers,
} from '@/lib/mockData';
import {
  ApplyToJobInput,
  CreateJobInput,
  CreateReportInput,
  CreateReviewInput,
  CreateSupportTicketInput,
  DataBackend,
  InviteHelperInput,
  JobUpdateInput,
  LimitError,
  ReportNoShowInput,
  WorkflowError,
} from './types';

// Mutable session state (cloned so we never mutate the seed module).
let sessionUser: UserProfile = { ...seedCurrentUser };
const db = {
  users: seedUsers.map((u) => (u.id === sessionUser.id ? sessionUser : { ...u })),
  jobs: seedJobs.map((j) => ({ ...j })),
  applications: seedApplications.map((a) => ({ ...a })),
  notifications: seedNotifications.map((n) => ({ ...n })),
  reviews: [...seedReviews],
  reports: seedReports.map((r) => ({ ...r })),
  tickets: seedTickets.map((t) => ({ ...t })),
  noShows: [] as NoShowEvent[],
  invites: [] as JobInvite[],
  blocked: new Set<string>(),
};

const delay = <T>(value: T, ms = 320): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const uid = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const newest = (a: { createdAt: string }, b: { createdAt: string }) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

function pushNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string
) {
  db.notifications.unshift({
    id: uid('n'),
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function requireJob(id: string): Job {
  const job = db.jobs.find((j) => j.id === id && !j.deletedAt);
  if (!job) throw new Error('Job not found');
  return job;
}

const FREE_ACTIVE_LIMIT = 3;
const RATE_LIMIT_PER_HOUR = 5;

export const mockBackend: DataBackend = {
  // ── Jobs ──
  async listFeedJobs() {
    const feed = db.jobs
      .filter(
        (j) =>
          j.customerId !== sessionUser.id &&
          j.status === 'open' &&
          !j.isPaused &&
          !j.deletedAt &&
          !db.blocked.has(j.customerId)
      )
      // Boosted → Comly Plus → match score → distance → newest. Free
      // listings are never excluded, only outranked.
      .sort((a, b) => compareFeedJobs(a, b));
    return delay(feed);
  },

  async listMyJobs() {
    const mine = db.jobs
      .filter((j) => j.customerId === sessionUser.id && !j.deletedAt)
      .sort(newest);
    return delay(mine);
  },

  async getJob(id) {
    return delay(db.jobs.find((j) => j.id === id && !j.deletedAt) ?? null);
  },

  async createJob(input: CreateJobInput) {
    // Listing limit + rate limit (no premium tier exists, so applies to all).
    const active = db.jobs.filter(
      (j) =>
        j.customerId === sessionUser.id &&
        !j.deletedAt &&
        ACTIVE_JOB_STATUSES.includes(j.status)
    );
    if (active.length >= FREE_ACTIVE_LIMIT) {
      throw new LimitError(
        `You can have up to ${FREE_ACTIVE_LIMIT} active job listings at a time. Mark one as filled or completed to post another.`
      );
    }
    const lastHour = db.jobs.filter(
      (j) =>
        j.customerId === sessionUser.id &&
        Date.now() - new Date(j.createdAt).getTime() < 3600_000
    );
    if (lastHour.length >= RATE_LIMIT_PER_HOUR) {
      throw new LimitError(
        'You are posting too quickly. Please wait a bit before creating another listing.'
      );
    }

    const job: Job = {
      id: uid('j'),
      customerId: sessionUser.id,
      customer: userRef(sessionUser),
      category: input.category,
      customCategoryText: input.customCategoryText,
      title: input.title,
      description: input.description,
      pay: input.pay,
      payType: input.payType,
      status: 'open',
      safetyTier: input.safetyTier,
      safetyNotes: input.safetyNotes,
      requiresAdultSupervision: input.requiresAdultSupervision,
      equipmentStatus: input.equipmentStatus,
      equipmentDetails: input.equipmentDetails,
      communityTags: input.communityTags,
      neighborhood: input.neighborhood,
      distanceMiles: 0,
      location: { lat: 40.0212, lng: -75.3149 },
      scheduledFor: input.scheduledFor,
      isTimeFlexible: input.isTimeFlexible,
      durationMinutes: input.durationMinutes,
      estimatedDuration: input.estimatedDuration,
      photos: input.photos ?? [],
      applicantsCount: 0,
      createdWithSeniorMode: input.createdWithSeniorMode ?? false,
      familyContact: input.familyContact,
      // A Plus customer's listings are boosted on posting; the boost is a
      // visibility perk of the plan, not a separate purchase.
      isBoosted: sessionUser.isCustomerPlus,
      boostedUntil: sessionUser.isCustomerPlus
        ? new Date(Date.now() + 7 * 24 * 3600_000).toISOString()
        : null,
      isPaused: false,
      createdAt: new Date().toISOString(),
    };
    db.jobs.unshift(job);
    return delay(job);
  },

  async updateJob(id, patch: JobUpdateInput) {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    if (job.customerId !== sessionUser.id)
      throw new Error('You can only edit your own jobs.');
    Object.assign(job, patch);
    return delay(job);
  },

  async setJobStatus(id, status: JobStatus) {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    if (job.customerId !== sessionUser.id)
      throw new Error('You can only change your own jobs.');
    job.status = status;
    job.isPaused = status === 'paused';
    return delay(job);
  },

  async deleteJob(id) {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    if (job.customerId !== sessionUser.id)
      throw new Error('You can only delete your own jobs.');
    job.deletedAt = new Date().toISOString();
    return delay(undefined, 150);
  },

  // ── Applications ──
  async listApplicationsForJob(jobId) {
    const apps = db.applications
      .filter((a) => a.jobId === jobId)
      // Accepted → Pro Helper priority → rating → completed jobs → earliest.
      .sort(compareApplications);
    return delay(apps);
  },

  async listMyApplications() {
    const mine = db.applications
      .filter((a) => a.helperId === sessionUser.id)
      .sort(newest);
    return delay(mine);
  },

  async applyToJob(input: ApplyToJobInput) {
    const existing = db.applications.find(
      (a) => a.jobId === input.jobId && a.helperId === sessionUser.id
    );
    if (existing) throw new Error('You already applied to this job.');

    const app: Application = {
      id: uid('app'),
      jobId: input.jobId,
      helperId: sessionUser.id,
      helper: userRef(sessionUser),
      message: input.message,
      proposedPay: input.proposedPay,
      availability: input.availability,
      status: 'pending',
      // Derived from the applicant's plan, never taken from client input —
      // otherwise priority is just a field anyone can set on themselves.
      isPriority: sessionUser.isHelperPro,
      priorityReason: sessionUser.isHelperPro
        ? PRIORITY_REASON_PRO_HELPER
        : undefined,
      createdAt: new Date().toISOString(),
    };
    db.applications.unshift(app);
    const job = db.jobs.find((j) => j.id === input.jobId);
    if (job) {
      job.applicantsCount += 1;
      if (job.status === 'open') job.status = 'reviewing';
      pushNotification(
        job.customerId,
        'application_received',
        'New application',
        `${sessionUser.name} applied to your "${job.title}" job.`
      );
    }
    return delay(app);
  },

  async acceptApplication(jobId, applicationId) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    if (job.customerId !== sessionUser.id)
      throw new Error('Only the job owner can accept applications.');
    if (['accepted', 'completed', 'cancelled'].includes(job.status))
      throw new Error('This job already has an outcome.');

    const accepted = db.applications.find((a) => a.id === applicationId);
    if (!accepted || accepted.jobId !== jobId)
      throw new Error('Application not found');
    if (accepted.status !== 'pending')
      throw new Error('That application is no longer pending.');

    accepted.status = 'accepted';
    job.status = 'accepted';
    job.assignedHelperId = accepted.helperId;
    job.contactUnlockedAt = new Date().toISOString();

    // Everyone else still *pending* is not selected. Applications the owner
    // already declined, or the helper withdrew, keep their outcome — matching
    // the accept_application RPC, which only touches status = 'pending'.
    db.applications
      .filter((a) => a.jobId === jobId && a.id !== applicationId && a.status === 'pending')
      .forEach((a) => {
        a.status = 'not_selected';
        pushNotification(
          a.helperId,
          'application_declined',
          'Application update',
          `Another helper was selected for "${job.title}". Thanks for applying!`
        );
      });

    pushNotification(
      accepted.helperId,
      'application_accepted',
      'You’re hired!',
      `You were accepted for "${job.title}". Contact details are now unlocked.`
    );
    return delay(undefined);
  },

  async getJobContact(jobId) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || !job.contactUnlockedAt) return delay(null);

    // Only the matched pair may see contact details.
    const otherId =
      job.customerId === sessionUser.id
        ? job.assignedHelperId
        : job.assignedHelperId === sessionUser.id
          ? job.customerId
          : undefined;
    if (!otherId) return delay(null);

    const other = db.users.find((u) => u.id === otherId);
    if (!other) return delay(null);
    return delay({
      name: other.name,
      avatarUrl: other.avatarUrl,
      neighborhood: other.neighborhood,
      phoneNumber: other.phoneNumber,
      preferredContactMethod: other.preferredContactMethod,
    });
  },

  async declineApplication(jobId, applicationId) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    if (job.customerId !== sessionUser.id)
      throw new Error('Only the job owner can decline applications.');
    const app = db.applications.find((a) => a.id === applicationId);
    if (!app || app.jobId !== jobId) throw new Error('Application not found');
    app.status = 'declined';
    pushNotification(
      app.helperId,
      'application_declined',
      'Application update',
      `Your application for "${job.title}" was declined.`
    );
    return delay(undefined);
  },

  // ── Completion (mutual confirmation) ──
  async requestJobCompletion(jobId) {
    const job = requireJob(jobId);
    if (job.customerId !== sessionUser.id)
      throw new WorkflowError('Only the job owner can mark a job complete.');
    if (!['accepted', 'in_progress'].includes(job.status))
      throw new WorkflowError('Only an accepted job can be marked complete.');
    if (!job.assignedHelperId)
      throw new WorkflowError('This job has no accepted helper yet.');

    job.status = 'pending_confirmation';
    job.completionRequestedAt = new Date().toISOString();
    pushNotification(
      job.assignedHelperId,
      'completion_requested',
      'Confirm the job is done',
      `${sessionUser.name} marked "${job.title}" complete. Confirm so you can both leave reviews.`
    );
    return delay(job);
  },

  async confirmJobCompletion(jobId) {
    const job = requireJob(jobId);
    if (job.assignedHelperId !== sessionUser.id)
      throw new WorkflowError('Only the accepted helper can confirm completion.');
    if (job.status !== 'pending_confirmation')
      throw new WorkflowError('This job is not awaiting your confirmation.');

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    pushNotification(
      job.customerId,
      'completion_confirmed',
      'Job confirmed complete',
      `${sessionUser.name} confirmed "${job.title}" is done. Leave a review to build their reputation.`
    );
    pushNotification(
      sessionUser.id,
      'completion_confirmed',
      'Job complete',
      `"${job.title}" is complete. Leave a review for the customer.`
    );
    return delay(job);
  },

  async disputeJobCompletion(jobId, reason) {
    const job = requireJob(jobId);
    if (job.assignedHelperId !== sessionUser.id)
      throw new WorkflowError('Only the accepted helper can dispute completion.');
    if (job.status !== 'pending_confirmation')
      throw new WorkflowError('This job is not awaiting your confirmation.');

    // Back to in_progress rather than straight to a report: most disputes are
    // "we're not finished yet", not abuse. Either side can still file a real
    // report from the job screen.
    job.status = 'in_progress';
    job.completionRequestedAt = null;
    pushNotification(
      job.customerId,
      'completion_requested',
      'Completion not confirmed',
      `${sessionUser.name} says "${job.title}" isn't finished yet: ${reason}`
    );
    return delay(job);
  },

  // ── Invites ──
  async inviteHelper(input: InviteHelperInput) {
    const job = requireJob(input.jobId);
    if (job.customerId !== sessionUser.id)
      throw new WorkflowError('You can only invite helpers to your own jobs.');
    if (job.status !== 'open' && job.status !== 'reviewing')
      throw new WorkflowError('You can only invite helpers to an open listing.');
    if (db.blocked.has(input.helperId))
      throw new WorkflowError('You have blocked this helper.');

    const existing = db.invites.find(
      (i) => i.jobId === input.jobId && i.helperId === input.helperId
    );
    if (existing) throw new WorkflowError('You already invited this helper.');

    const invite: JobInvite = {
      id: uid('inv'),
      jobId: job.id,
      jobTitle: job.title,
      customerId: sessionUser.id,
      helperId: input.helperId,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    db.invites.unshift(invite);
    pushNotification(
      input.helperId,
      'job_invite',
      'You were invited to apply',
      `${sessionUser.name} thinks you'd be a good fit for "${job.title}". Open it to apply.`
    );
    return delay(invite);
  },

  async listMyInvites() {
    return delay(
      db.invites.filter((i) => i.helperId === sessionUser.id).sort(newest)
    );
  },

  async listInvitesForJob(jobId) {
    return delay(db.invites.filter((i) => i.jobId === jobId).sort(newest));
  },

  // ── People ──
  async getProfile(id) {
    if (id === sessionUser.id) return delay(sessionUser);
    return delay(db.users.find((u) => u.id === id) ?? null);
  },

  async listRecommendedHelpers() {
    const helpers = db.users
      .filter(
        (u) =>
          u.roles.includes('helper') &&
          u.id !== sessionUser.id &&
          !db.blocked.has(u.id)
      )
      .sort((a, b) => b.reputationScore - a.reputationScore);
    return delay(helpers);
  },

  async listReviewsForUser(userId) {
    const list = db.reviews
      .filter((r) => r.revieweeId === userId)
      .sort(newest);
    return delay(list);
  },

  async listReviewsForJob(jobId) {
    return delay(db.reviews.filter((r) => r.jobId === jobId).sort(newest));
  },

  async createReview(input: CreateReviewInput) {
    const job = requireJob(input.jobId);
    if (job.status !== 'completed')
      throw new WorkflowError('You can only review after a job is complete.');

    // Both parties of THIS job, and only about each other — a review outside a
    // real working relationship is the main way a reputation system gets gamed.
    const parties = [job.customerId, job.assignedHelperId].filter(Boolean);
    if (!parties.includes(sessionUser.id))
      throw new WorkflowError('You were not part of this job.');
    if (input.revieweeId === sessionUser.id)
      throw new WorkflowError('You cannot review yourself.');
    if (!parties.includes(input.revieweeId))
      throw new WorkflowError('That person was not part of this job.');

    const already = db.reviews.find(
      (r) => r.jobId === input.jobId && r.reviewerId === sessionUser.id
    );
    if (already) throw new WorkflowError('You already reviewed this job.');

    const review: Review = {
      id: uid('rev'),
      jobId: input.jobId,
      reviewerId: sessionUser.id,
      revieweeId: input.revieweeId,
      ratings: input.ratings,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    db.reviews.unshift(review);

    // Keep the reviewee's headline rating consistent with the reviews on screen.
    const target = db.users.find((u) => u.id === input.revieweeId);
    if (target) {
      const theirs = db.reviews.filter((r) => r.revieweeId === target.id);
      const avg =
        theirs.reduce((sum, r) => {
          const vals = Object.values(r.ratings);
          return sum + vals.reduce((a, b) => a + b, 0) / vals.length;
        }, 0) / theirs.length;
      target.rating = Math.round(avg * 10) / 10;
      if (target.id === sessionUser.id) sessionUser = target;
    }

    pushNotification(
      input.revieweeId,
      'review_received',
      'New review',
      `${sessionUser.name} left you a review for "${job.title}".`
    );
    return delay(review);
  },

  // ── No-show strikes ──
  async reportNoShow(input: ReportNoShowInput) {
    const job = requireJob(input.jobId);
    const parties = [job.customerId, job.assignedHelperId].filter(Boolean);
    if (!parties.includes(sessionUser.id))
      throw new WorkflowError('You were not part of this job.');
    if (input.reportedUserId === sessionUser.id)
      throw new WorkflowError('You cannot report yourself.');
    if (!parties.includes(input.reportedUserId))
      throw new WorkflowError('That person was not part of this job.');
    if (!['accepted', 'in_progress', 'pending_confirmation'].includes(job.status))
      throw new WorkflowError('No-shows can only be reported on an accepted job.');

    const duplicate = db.noShows.find(
      (e) => e.jobId === input.jobId && e.reporterId === sessionUser.id
    );
    if (duplicate)
      throw new WorkflowError('You already reported a no-show for this job.');

    const event: NoShowEvent = {
      id: uid('ns'),
      jobId: job.id,
      jobTitle: job.title,
      reportedUserId: input.reportedUserId,
      reporterId: sessionUser.id,
      note: input.note,
      // Pending, not an instant strike: an unreviewed accusation is exactly
      // what a retaliating user would weaponize.
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.noShows.unshift(event);
    pushNotification(
      input.reportedUserId,
      'report_update',
      'A no-show was reported',
      `A no-show was reported for "${job.title}". An admin reviews it before any strike applies. ${NO_SHOW_POLICY.appealNote}`
    );
    return delay(event);
  },

  async listNoShowEventsForUser(userId) {
    return delay(
      db.noShows.filter((e) => e.reportedUserId === userId).sort(newest)
    );
  },

  async listAllNoShowEvents() {
    return delay([...db.noShows].sort(newest));
  },

  async resolveNoShowEvent(id, patch) {
    const event = db.noShows.find((e) => e.id === id);
    if (!event) throw new Error('No-show report not found');
    const wasConfirmed = event.status === 'confirmed';
    event.status = patch.status;
    if (patch.adminNotes !== undefined) event.adminNotes = patch.adminNotes;

    // Strikes follow confirmations in BOTH directions, so reversing an admin
    // decision actually returns the strike instead of leaving it stuck on.
    const target = db.users.find((u) => u.id === event.reportedUserId);
    if (target) {
      if (!wasConfirmed && patch.status === 'confirmed') {
        target.strikes += 1;
        pushNotification(
          target.id,
          'report_update',
          'No-show strike applied',
          `A no-show strike was applied for "${event.jobTitle ?? 'a job'}". You now have ${target.strikes}. ${NO_SHOW_POLICY.appealNote}`
        );
      } else if (wasConfirmed && patch.status !== 'confirmed') {
        target.strikes = Math.max(0, target.strikes - 1);
      }
      target.isSuspended = target.strikes >= NO_SHOW_POLICY.suspensionThreshold;
      if (target.id === sessionUser.id) sessionUser = target;
    }
    return delay(event);
  },

  async updateProfile(patch) {
    sessionUser = { ...sessionUser, ...patch, id: sessionUser.id };
    const idx = db.users.findIndex((u) => u.id === sessionUser.id);
    if (idx >= 0) db.users[idx] = sessionUser;
    return delay(sessionUser);
  },

  // ── Notifications ──
  async listNotifications() {
    const list = db.notifications
      .filter((n) => n.userId === sessionUser.id)
      .sort(newest);
    return delay(list);
  },

  async markNotificationRead(id) {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    return delay(undefined, 120);
  },

  // ── Reports ──
  async createReport(input: CreateReportInput) {
    const report: Report = {
      id: uid('rep'),
      reporterId: sessionUser.id,
      reportedUserId: input.reportedUserId,
      jobId: input.jobId,
      category: input.category,
      description: input.description,
      riskLevel: riskFor(input.category),
      aiSummary: summarizeReport(input.category),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    db.reports.unshift(report);
    return delay(report);
  },

  async listMyReports() {
    return delay(
      db.reports.filter((r) => r.reporterId === sessionUser.id).sort(newest)
    );
  },

  async listAllReports() {
    return delay([...db.reports].sort(newest));
  },

  async updateReport(id, patch) {
    const r = db.reports.find((x) => x.id === id);
    if (!r) throw new Error('Report not found');
    if (patch.status) r.status = patch.status;
    if (patch.adminNotes !== undefined) r.adminNotes = patch.adminNotes;
    return delay(r);
  },

  // ── Support ──
  async createSupportTicket(input: CreateSupportTicketInput) {
    const ticket: SupportTicket = {
      id: uid('tic'),
      userId: sessionUser.id,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    db.tickets.unshift(ticket);
    return delay(ticket);
  },

  async listMySupportTickets() {
    return delay(
      db.tickets.filter((t) => t.userId === sessionUser.id).sort(newest)
    );
  },

  async listAllSupportTickets() {
    return delay([...db.tickets].sort(newest));
  },

  async updateSupportTicket(id, patch) {
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found');
    t.status = patch.status;
    return delay(t);
  },

  // ── Blocking ──
  async listBlockedUserIds() {
    return delay(Array.from(db.blocked));
  },

  async blockUser(userId) {
    db.blocked.add(userId);
    return delay(undefined, 120);
  },

  async unblockUser(userId) {
    db.blocked.delete(userId);
    return delay(undefined, 120);
  },

  // ── Community impact (seeded demo numbers; no dollar metrics) ──
  async getImpactStats() {
    const stats: ImpactStats = {
      completedJobs: 42,
      seniorsHelped: 18,
      familiesHelped: 27,
      teenSafeJobsCompleted: 24,
      averageTrustScore: 96,
      repeatCustomers: 12,
      activeTeenHelpers: 9,
      topCategories: [
        { label: 'Snow Shoveling', count: 14 },
        { label: 'Tutoring', count: 9 },
        { label: 'Dog Walking', count: 7 },
      ],
    };
    return delay(stats);
  },
};

// Deterministic mock risk scoring for reports.
function riskFor(category: CreateReportInput['category']): Report['riskLevel'] {
  switch (category) {
    case 'underage_safety':
    case 'harassment':
    case 'dangerous_task':
      return 'critical';
    case 'unsafe_behavior':
    case 'scam':
      return 'high';
    case 'inappropriate_contact':
    case 'no_show':
    case 'payment_issue':
      return 'medium';
    default:
      return 'low';
  }
}

function summarizeReport(category: CreateReportInput['category']): string {
  return `Auto-triage: "${category.replace(/_/g, ' ')}" report. Review details and follow community safety procedures.`;
}
