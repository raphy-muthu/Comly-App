/**
 * Database types.
 *
 * Hand-authored to mirror the SQL schema in supabase/migrations. Once you've
 * linked a real project you can regenerate this with:
 *
 *   npx supabase gen types typescript --linked > src/types/database.ts
 *
 * The Supabase client in Phase 8 is typed with `Database` from this file.
 */

export type UserRoleEnum = 'customer' | 'helper';
export type JobCategoryEnum =
  | 'snow_removal'
  | 'lawn_care'
  | 'tutoring'
  | 'pool_cleaning'
  | 'pet_care'
  | 'tech_help'
  | 'errands'
  | 'house_sitting';
export type SafetyTierEnum = 'teen_safe' | 'adult_supervision' | 'adults_only';
export type PayTypeEnum = 'fixed' | 'hourly';
export type JobStatusEnum =
  | 'open'
  | 'reviewing'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type ApplicationStatusEnum =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';
export type NotificationTypeEnum =
  | 'application_received'
  | 'application_accepted'
  | 'job_match'
  | 'review_received'
  | 'verification'
  | 'safety';

type ProfileRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  neighborhood: string;
  roles: UserRoleEnum[];
  bio: string | null;
  rating: number;
  jobs_count: number;
  reputation_score: number;
  trust_level: number;
  member_since: string;
  created_at: string;
  updated_at: string;
}

type JobRow = {
  id: string;
  customer_id: string;
  category: JobCategoryEnum;
  title: string;
  description: string;
  pay: number;
  pay_type: PayTypeEnum;
  status: JobStatusEnum;
  safety_tier: SafetyTierEnum;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  scheduled_for: string | null;
  estimated_duration: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

type ApplicationRow = {
  id: string;
  job_id: string;
  helper_id: string;
  message: string;
  proposed_pay: number | null;
  availability: string | null;
  status: ApplicationStatusEnum;
  created_at: string;
  updated_at: string;
}

type ReviewRow = {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reliability: number;
  quality: number;
  communication: number;
  professionalism: number;
  comment: string;
  created_at: string;
}

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationTypeEnum;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

type VerificationRow = {
  user_id: string;
  email_verified: boolean;
  phone_verified: boolean;
  id_verified: boolean;
  neighborhood_verified: boolean;
  updated_at: string;
}

type TableShape<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  // supabase-js v2 type helpers expect this key on every table.
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow>;
      jobs: TableShape<JobRow, Omit<JobRow, 'id' | 'created_at' | 'updated_at'>>;
      applications: TableShape<
        ApplicationRow,
        Omit<ApplicationRow, 'id' | 'created_at' | 'updated_at' | 'status'> & {
          status?: ApplicationStatusEnum;
        }
      >;
      reviews: TableShape<ReviewRow, Omit<ReviewRow, 'id' | 'created_at'>>;
      notifications: TableShape<NotificationRow>;
      verification_status: TableShape<VerificationRow>;
    };
    // job_with_applicant_count removed (migration 0009): unused, and it
    // exposed jobs.lat/lng (exact coordinates) via a view that bypassed RLS.
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRoleEnum;
      job_category: JobCategoryEnum;
      safety_tier: SafetyTierEnum;
      pay_type: PayTypeEnum;
      job_status: JobStatusEnum;
      application_status: ApplicationStatusEnum;
      notification_type: NotificationTypeEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
