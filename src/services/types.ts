/**
 * Backend-agnostic data access contract.
 *
 * Both the mock backend and the Supabase backend implement this same
 * `DataBackend` shape, so screens/hooks never change when we flip the mock
 * toggle.
 */

import {
  Application,
  AppNotification,
  CommunityTag,
  EquipmentStatus,
  FamilyContact,
  ImpactStats,
  Job,
  JobCategory,
  JobContact,
  JobStatus,
  PayType,
  Report,
  ReportCategory,
  Review,
  SafetyTier,
  SupportCategory,
  SupportTicket,
  UserProfile,
} from '@/types/domain';

export interface CreateJobInput {
  category: JobCategory;
  customCategoryText?: string;
  title: string;
  description: string;
  pay: number;
  payType: PayType;
  neighborhood: string;
  scheduledFor: string;
  isTimeFlexible: boolean;
  durationMinutes?: number;
  estimatedDuration: string;
  safetyTier: SafetyTier;
  safetyNotes?: string;
  requiresAdultSupervision: boolean;
  equipmentStatus: EquipmentStatus;
  equipmentDetails?: string;
  communityTags: CommunityTag[];
  photos?: string[];
  createdWithSeniorMode?: boolean;
  familyContact?: FamilyContact;
}

export type JobUpdateInput = Partial<
  Pick<
    Job,
    | 'title'
    | 'description'
    | 'pay'
    | 'payType'
    | 'scheduledFor'
    | 'estimatedDuration'
    | 'equipmentStatus'
    | 'equipmentDetails'
    | 'communityTags'
    | 'safetyTier'
  >
>;

export interface ApplyToJobInput {
  jobId: string;
  message: string;
  proposedPay?: number;
  availability?: string;
}

export interface CreateReportInput {
  reportedUserId?: string;
  jobId?: string;
  category: ReportCategory;
  description: string;
}

export interface CreateSupportTicketInput {
  category: SupportCategory;
  subject: string;
  message: string;
}

export interface DataBackend {
  // ── Jobs ──
  listFeedJobs(): Promise<Job[]>;
  listMyJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  createJob(input: CreateJobInput): Promise<Job>;
  updateJob(id: string, patch: JobUpdateInput): Promise<Job>;
  setJobStatus(id: string, status: JobStatus): Promise<Job>;
  deleteJob(id: string): Promise<void>;

  // ── Applications ──
  listApplicationsForJob(jobId: string): Promise<Application[]>;
  listMyApplications(): Promise<Application[]>;
  applyToJob(input: ApplyToJobInput): Promise<Application>;
  acceptApplication(jobId: string, applicationId: string): Promise<void>;
  declineApplication(jobId: string, applicationId: string): Promise<void>;
  /** The other party's contact card — only for the job's matched pair. */
  getJobContact(jobId: string): Promise<JobContact | null>;

  // ── People ──
  getProfile(id: string): Promise<UserProfile | null>;
  listRecommendedHelpers(): Promise<UserProfile[]>;
  listReviewsForUser(userId: string): Promise<Review[]>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;

  // ── Notifications ──
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;

  // ── Reports ──
  createReport(input: CreateReportInput): Promise<Report>;
  listMyReports(): Promise<Report[]>;
  listAllReports(): Promise<Report[]>; // admin
  updateReport(
    id: string,
    patch: { status?: Report['status']; adminNotes?: string }
  ): Promise<Report>;

  // ── Support ──
  createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicket>;
  listMySupportTickets(): Promise<SupportTicket[]>;
  listAllSupportTickets(): Promise<SupportTicket[]>; // admin
  updateSupportTicket(
    id: string,
    patch: { status: SupportTicket['status'] }
  ): Promise<SupportTicket>;

  // ── Blocking ──
  listBlockedUserIds(): Promise<string[]>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;

  // ── Community impact ──
  getImpactStats(): Promise<ImpactStats>;
}

/** Thrown by createJob when a customer hits a listing/rate limit. */
export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitError';
  }
}
