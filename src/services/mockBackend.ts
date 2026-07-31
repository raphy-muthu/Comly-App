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
  ImpactStats,
  Job,
  JobStatus,
  NotificationType,
  Report,
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
  CreateSupportTicketInput,
  DataBackend,
  JobUpdateInput,
  LimitError,
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
      .sort((a, b) => {
        const ms = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        if (ms !== 0) return ms;
        if (a.distanceMiles !== b.distanceMiles)
          return a.distanceMiles - b.distanceMiles;
        return newest(a, b);
      });
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
      .sort((a, b) => {
        // Accepted first, then by helper rating, then newest.
        if (a.status === 'accepted' && b.status !== 'accepted') return -1;
        if (b.status === 'accepted' && a.status !== 'accepted') return 1;
        if (b.helper.rating !== a.helper.rating)
          return b.helper.rating - a.helper.rating;
        return newest(a, b);
      });
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

    accepted.status = 'accepted';
    job.status = 'accepted';
    job.assignedHelperId = accepted.helperId;
    job.contactUnlockedAt = new Date().toISOString();

    // Everyone else for this job is not selected.
    db.applications
      .filter((a) => a.jobId === jobId && a.id !== applicationId)
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
