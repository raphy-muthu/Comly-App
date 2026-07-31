/**
 * Core domain model for Comly.
 *
 * Shared vocabulary across screens, components, the mock data layer, and the
 * Supabase row types. The UI never depends directly on the database shape.
 *
 * Comly is a *matchmaking* marketplace: payment is arranged off-platform, so
 * pay fields are informational. No premium/subscription concepts exist.
 */

// ── Roles ────────────────────────────────────────────────────────────────────
export type Role = 'customer' | 'helper' | 'admin';

/** Coarse age bracket — drives teen-safety gating, not an exact birth date. */
export type AgeGroup = 'teen' | 'adult';

export type ParentApprovalStatus = 'not_required' | 'pending' | 'approved';

// ── Verification (government ID intentionally removed) ───────────────────────
export interface VerificationStatus {
  emailVerified: boolean;
  phoneAdded: boolean;
  photoAdded: boolean;
  schoolEmailVerified: boolean; // optional, for student helpers
  parentApproved: boolean; // required for helpers under 18
}

export type VerificationKey = keyof VerificationStatus;

export const VERIFICATION_BADGES: Record<
  VerificationKey,
  { label: string; description: string; icon: string }
> = {
  emailVerified: {
    label: 'Email Verified',
    description: 'Email address confirmed',
    icon: 'mail-outline',
  },
  phoneAdded: {
    label: 'Phone Added',
    description: 'Phone number on file',
    icon: 'call-outline',
  },
  photoAdded: {
    label: 'Profile Photo',
    description: 'Profile photo added',
    icon: 'person-circle-outline',
  },
  schoolEmailVerified: {
    label: 'School Email',
    description: 'Verified student email',
    icon: 'school-outline',
  },
  parentApproved: {
    label: 'Parent Approved',
    description: 'Parent/guardian approval completed',
    icon: 'shield-checkmark-outline',
  },
};

// ── Job taxonomy ─────────────────────────────────────────────────────────────
export type JobCategory =
  | 'snow_removal'
  | 'yard_work'
  | 'lawn_care'
  | 'leaf_cleanup'
  | 'pool_cleaning'
  | 'pet_care'
  | 'dog_walking'
  | 'tutoring'
  | 'tech_help'
  | 'moving_help'
  | 'errands'
  | 'cleaning'
  | 'organization'
  | 'plant_watering'
  | 'car_washing'
  | 'house_sitting'
  | 'other';

export const JOB_CATEGORIES: Record<
  JobCategory,
  { label: string; icon: string }
> = {
  snow_removal: { label: 'Snow Shoveling', icon: 'snow-outline' },
  yard_work: { label: 'Yard Work', icon: 'leaf-outline' },
  lawn_care: { label: 'Lawn Mowing', icon: 'cut-outline' },
  leaf_cleanup: { label: 'Leaf Cleanup', icon: 'trash-outline' },
  pool_cleaning: { label: 'Pool Help', icon: 'water-outline' },
  pet_care: { label: 'Pet Care', icon: 'paw-outline' },
  dog_walking: { label: 'Dog Walking', icon: 'footsteps-outline' },
  tutoring: { label: 'Tutoring', icon: 'school-outline' },
  tech_help: { label: 'Tech Help', icon: 'laptop-outline' },
  moving_help: { label: 'Moving Help', icon: 'cube-outline' },
  errands: { label: 'Errands', icon: 'cart-outline' },
  cleaning: { label: 'Cleaning', icon: 'sparkles-outline' },
  organization: { label: 'Organization', icon: 'file-tray-stacked-outline' },
  plant_watering: { label: 'Plant Watering', icon: 'flower-outline' },
  car_washing: { label: 'Car Washing', icon: 'car-outline' },
  house_sitting: { label: 'House Sitting', icon: 'home-outline' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-outline' },
};

// ── Safety tiers (5 levels) ──────────────────────────────────────────────────
export type SafetyTier =
  | 'teen_safe'
  | 'caution'
  | 'adult_supervision'
  | 'eighteen_plus_only'
  | 'blocked';

export type SafetyTone = 'success' | 'warning' | 'danger';

export const SAFETY_TIERS: Record<
  SafetyTier,
  { label: string; tone: SafetyTone; description: string }
> = {
  teen_safe: {
    label: 'Teen Safe',
    tone: 'success',
    description: 'Appropriate for teen helpers.',
  },
  caution: {
    label: 'Caution',
    tone: 'warning',
    description: 'May involve weather or light physical work. Helpers should only accept jobs they can safely complete.',
  },
  adult_supervision: {
    label: 'Adult Supervision',
    tone: 'warning',
    description: 'Comly recommends adult supervision. Teen helpers need parent/guardian approval.',
  },
  eighteen_plus_only: {
    label: '18+ Only',
    tone: 'danger',
    description: 'Helpers under 18 cannot apply to this task.',
  },
  blocked: {
    label: 'Not Allowed',
    tone: 'danger',
    description: 'This task is not allowed on Comly for safety reasons.',
  },
};

/** Whether a helper may apply to a job of the given tier. */
export function eligibilityFor(
  tier: SafetyTier,
  ageGroup: AgeGroup,
  parentApproved: boolean
): { canApply: boolean; reason?: string } {
  if (tier === 'blocked') {
    return { canApply: false, reason: 'This task is not allowed on Comly.' };
  }
  if (ageGroup === 'adult') return { canApply: true };
  // Teen helper:
  if (tier === 'eighteen_plus_only') {
    return { canApply: false, reason: 'Helpers under 18 cannot apply to 18+ jobs.' };
  }
  if (tier === 'adult_supervision' && !parentApproved) {
    return {
      canApply: false,
      reason: 'Parent/guardian approval is required for this task.',
    };
  }
  return { canApply: true };
}

// ── Equipment ────────────────────────────────────────────────────────────────
export type EquipmentStatus = 'yes' | 'no' | 'some' | 'not_needed';

export const EQUIPMENT_LABELS: Record<EquipmentStatus, string> = {
  yes: 'Equipment Provided',
  no: 'Bring Your Own Equipment',
  some: 'Some Equipment Provided',
  not_needed: 'No Equipment Needed',
};

// ── Community support tags ───────────────────────────────────────────────────
export type CommunityTag =
  | 'senior_help'
  | 'family_support'
  | 'accessibility_support'
  | 'student_friendly'
  | 'quick_task'
  | 'recurring_help'
  | 'weather_related';

export const COMMUNITY_TAGS: Record<
  CommunityTag,
  { label: string; icon: string }
> = {
  senior_help: { label: 'Senior Help', icon: 'happy-outline' },
  family_support: { label: 'Family Support', icon: 'people-outline' },
  accessibility_support: { label: 'Accessibility', icon: 'accessibility-outline' },
  student_friendly: { label: 'Student-Friendly', icon: 'school-outline' },
  quick_task: { label: 'Quick Task', icon: 'flash-outline' },
  recurring_help: { label: 'Recurring Help', icon: 'repeat-outline' },
  weather_related: { label: 'Weather Help', icon: 'rainy-outline' },
};

// ── Pay & status ─────────────────────────────────────────────────────────────
export type PayType = 'fixed' | 'hourly';

export type JobStatus =
  | 'open'
  | 'reviewing'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'paused'
  | 'filled'
  | 'cancelled';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: 'Open',
  reviewing: 'Reviewing',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  paused: 'Paused',
  filled: 'Filled',
  cancelled: 'Cancelled',
};

/** Statuses that count toward a customer's active-listing limit. */
export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'open',
  'reviewing',
  'accepted',
  'paused',
];

// ── Family contact (Senior Help Mode, private) ───────────────────────────────
export interface FamilyContact {
  name?: string;
  phone?: string;
  email?: string;
  notify: boolean;
}

// ── Entities ─────────────────────────────────────────────────────────────────
/** Compact public reference to a user, embedded in jobs/applications. */
export interface UserRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  jobsCount: number;
  isTrusted: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  neighborhood: string;
  roles: Role[];
  ageGroup: AgeGroup;
  rating: number; // 0–5
  jobsCount: number; // jobs posted (customer) or completed (helper)
  reputationScore: number; // 0–100, shown as "Trust Score"
  isTrusted: boolean;
  verification: VerificationStatus;
  parentApprovalStatus: ParentApprovalStatus;
  parentName?: string;
  parentEmail?: string;
  schoolEmail?: string;
  phoneNumber?: string;
  preferredContactMethod?: 'phone' | 'text' | 'email';
  skills: string[];
  preferredCategories: JobCategory[];
  resumeSummary?: string;
  bio?: string;
  isAdmin?: boolean;
  memberSince: string; // ISO date
}

export interface Job {
  id: string;
  customerId: string;
  customer: UserRef;
  category: JobCategory;
  customCategoryText?: string;
  title: string;
  description: string;
  pay: number;
  payType: PayType;
  status: JobStatus;
  assignedHelperId?: string;
  safetyTier: SafetyTier;
  safetyNotes?: string;
  requiresAdultSupervision: boolean;
  equipmentStatus: EquipmentStatus;
  equipmentDetails?: string;
  communityTags: CommunityTag[];
  neighborhood: string;
  distanceMiles: number;
  /** Coarse coordinates only; exact address hidden until accepted. */
  location: { lat: number; lng: number };
  /** Human display, e.g. "Today, 2 PM" — derived from the structured fields. */
  scheduledFor: string;
  isTimeFlexible: boolean;
  durationMinutes?: number;
  estimatedDuration: string; // display, e.g. "1-2 hours"
  photos: string[];
  applicantsCount: number;
  createdWithSeniorMode: boolean;
  familyContact?: FamilyContact; // private, never shown publicly
  /** AI match score for the viewing helper (0–100), when available. */
  matchScore?: number;
  isPaused: boolean;
  deletedAt?: string | null;
  contactUnlockedAt?: string | null;
  createdAt: string;
}

export type ApplicationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'not_selected'
  | 'withdrawn';

export interface Application {
  id: string;
  jobId: string;
  helperId: string;
  helper: UserRef;
  message: string;
  proposedPay?: number;
  availability?: string;
  status: ApplicationStatus;
  createdAt: string;
}

export type ReviewCategory =
  | 'reliability'
  | 'quality'
  | 'communication'
  | 'professionalism';

export interface Review {
  id: string;
  jobId: string;
  reviewerId: string;
  revieweeId: string;
  ratings: Record<ReviewCategory, number>;
  comment: string;
  createdAt: string;
}

// ── Badges ───────────────────────────────────────────────────────────────────
export type BadgeKey =
  | 'parent_approved'
  | 'teen_safe_helper'
  | 'top_rated'
  | 'fast_responder'
  | 'reliable_helper'
  | 'community_builder'
  | 'skill_builder'
  | 'trusted_neighbor';

export const BADGES: Record<
  BadgeKey,
  { label: string; icon: string; description: string }
> = {
  parent_approved: { label: 'Parent Approved', icon: 'shield-checkmark', description: 'Guardian approval completed' },
  teen_safe_helper: { label: 'Teen Safe Helper', icon: 'happy', description: 'Completes teen-safe jobs' },
  top_rated: { label: 'Top Rated', icon: 'star', description: '4.8+ average rating' },
  fast_responder: { label: 'Fast Responder', icon: 'flash', description: 'Replies quickly' },
  reliable_helper: { label: 'Reliable Helper', icon: 'checkmark-done', description: 'High completion rate' },
  community_builder: { label: 'Community Builder', icon: 'people', description: 'Helps many neighbors' },
  skill_builder: { label: 'Skill Builder', icon: 'construct', description: 'Works across categories' },
  trusted_neighbor: { label: 'Trusted Neighbor', icon: 'ribbon', description: 'High trust score' },
};

// ── Reports ──────────────────────────────────────────────────────────────────
export type ReportCategory =
  | 'unsafe_behavior'
  | 'inappropriate_contact'
  | 'fake_listing'
  | 'scam'
  | 'payment_issue'
  | 'no_show'
  | 'harassment'
  | 'underage_safety'
  | 'dangerous_task'
  | 'other';

export const REPORT_CATEGORIES: Record<ReportCategory, string> = {
  unsafe_behavior: 'Unsafe behavior',
  inappropriate_contact: 'Inappropriate message/contact',
  fake_listing: 'Fake listing',
  scam: 'Scam',
  payment_issue: 'Payment issue',
  no_show: 'No-show',
  harassment: 'Harassment',
  underage_safety: 'Underage safety concern',
  dangerous_task: 'Dangerous task',
  other: 'Other',
};

export type ReportRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'escalated';

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  jobId?: string;
  category: ReportCategory;
  description: string;
  riskLevel: ReportRiskLevel;
  aiSummary?: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
}

// ── Support ──────────────────────────────────────────────────────────────────
export type SupportCategory =
  | 'general'
  | 'bug'
  | 'account'
  | 'safety'
  | 'payment'
  | 'other';

export const SUPPORT_CATEGORIES: Record<SupportCategory, string> = {
  general: 'General question',
  bug: 'Report a bug',
  account: 'Account help',
  safety: 'Safety concern',
  payment: 'Payment guidance',
  other: 'Other',
};

export type SupportStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  userId: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  createdAt: string;
}

// ── Notifications ────────────────────────────────────────────────────────────
export type NotificationType =
  | 'application_received'
  | 'application_accepted'
  | 'application_declined'
  | 'job_match'
  | 'review_received'
  | 'verification'
  | 'report_update'
  | 'safety';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ── Contact unlock ───────────────────────────────────────────────────────────
/**
 * The other party's contact card, revealed only to a job's customer and its
 * accepted helper after acceptance. Fetched through a privileged path (RPC in
 * production) — never by reading another user's profile directly.
 */
export interface JobContact {
  name: string;
  avatarUrl: string | null;
  neighborhood: string;
  phoneNumber?: string;
  preferredContactMethod?: 'phone' | 'text' | 'email';
}

// ── Community impact (no dollar metrics) ─────────────────────────────────────
export interface ImpactStats {
  completedJobs: number;
  seniorsHelped: number;
  familiesHelped: number;
  teenSafeJobsCompleted: number;
  averageTrustScore: number;
  repeatCustomers: number;
  activeTeenHelpers: number;
  topCategories: { label: string; count: number }[];
}

// ── Derivations ──────────────────────────────────────────────────────────────
export function deriveBadges(
  p: Pick<
    UserProfile,
    'rating' | 'jobsCount' | 'reputationScore' | 'ageGroup' | 'verification'
  >
): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (p.verification.parentApproved) badges.push('parent_approved');
  if (p.ageGroup === 'teen') badges.push('teen_safe_helper');
  if (p.rating >= 4.8) badges.push('top_rated');
  if (p.jobsCount >= 10) badges.push('reliable_helper');
  if (p.jobsCount >= 25) badges.push('community_builder');
  if (p.reputationScore >= 90) badges.push('trusted_neighbor');
  return badges;
}

export function categoryLabel(
  category: JobCategory,
  custom?: string
): string {
  if (category === 'other' && custom) return custom;
  return JOB_CATEGORIES[category].label;
}
