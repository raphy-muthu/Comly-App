/**
 * Supabase implementation of DataBackend (production adapter).
 *
 * Maps database rows to the app's domain types so screens stay backend-agnostic.
 * Used when EXPO_PUBLIC_USE_MOCKS=false and credentials are present.
 *
 * NOTE: This adapter queries columns/tables added across migrations 0001–0003.
 * Regenerate `src/types/database.ts` from your live schema
 * (`npx supabase gen types typescript --linked`) for full end-to-end typing; we
 * use a loosely-typed client here so new columns don't require hand-editing the
 * generated types. Row→domain mappers below remain strict.
 */

import {
  Application,
  AppNotification,
  compareApplications,
  compareFeedJobs,
  ImpactStats,
  Job,
  JobInvite,
  NoShowEvent,
  Report,
  Review,
  SupportTicket,
  UserProfile,
  UserRef,
} from '@/types/domain';
import { getSupabase } from './supabaseClient';
import {
  ApplyToJobInput,
  CreateJobInput,
  CreateReportInput,
  CreateReviewInput,
  CreateSupportTicketInput,
  DataBackend,
  InviteHelperInput,
  JobUpdateInput,
  ReportNoShowInput,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Loosely-typed client for queries that touch columns beyond the generated
// types. Mappers below restore type-safety at the domain boundary.
const sb = () => getSupabase() as any;

const PROFILE_REF =
  'id, name, avatar_url, rating, jobs_count, is_trusted, is_customer_plus, is_helper_pro';
const JOB_SELECT = `*, customer:profiles!jobs_customer_id_fkey(${PROFILE_REF}), applications(count)`;

function mapRef(row: any): UserRef {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    rating: Number(row.rating ?? 0),
    jobsCount: row.jobs_count ?? 0,
    isTrusted: !!row.is_trusted,
    isCustomerPlus: !!row.is_customer_plus,
    isHelperPro: !!row.is_helper_pro,
  };
}

function mapJob(row: any): Job {
  return {
    id: row.id,
    customerId: row.customer_id,
    customer: row.customer
      ? mapRef(row.customer)
      : {
          id: row.customer_id,
          name: '',
          avatarUrl: null,
          rating: 0,
          jobsCount: 0,
          isTrusted: false,
          isCustomerPlus: false,
          isHelperPro: false,
        },
    category: row.category,
    customCategoryText: row.custom_category_text ?? undefined,
    title: row.title,
    description: row.description ?? '',
    pay: Number(row.pay ?? 0),
    payType: row.pay_type,
    status: row.status,
    assignedHelperId: row.assigned_helper_id ?? undefined,
    safetyTier: row.safety_tier,
    safetyNotes: row.safety_notes ?? undefined,
    requiresAdultSupervision: !!row.requires_adult_supervision,
    equipmentStatus: row.equipment_status ?? 'not_needed',
    equipmentDetails: row.equipment_details ?? undefined,
    communityTags: row.community_tags ?? [],
    neighborhood: row.neighborhood ?? '',
    distanceMiles: 0,
    location: { lat: row.public_lat ?? 0, lng: row.public_lng ?? 0 },
    scheduledFor: row.scheduled_for ?? 'Flexible',
    isTimeFlexible: !!row.is_time_flexible,
    durationMinutes: row.duration_minutes ?? undefined,
    estimatedDuration: row.estimated_duration ?? '',
    photos: row.photos ?? [],
    applicantsCount: row.applications?.[0]?.count ?? 0,
    createdWithSeniorMode: !!row.created_with_senior_mode,
    isBoosted: !!row.is_boosted,
    boostedUntil: row.boosted_until ?? null,
    familyContact:
      row.family_contact_name || row.family_contact_phone || row.family_contact_email
        ? {
            name: row.family_contact_name ?? undefined,
            phone: row.family_contact_phone ?? undefined,
            email: row.family_contact_email ?? undefined,
            notify: !!row.notify_family_contact,
          }
        : undefined,
    isPaused: row.status === 'paused',
    deletedAt: row.deleted_at ?? null,
    contactUnlockedAt: row.contact_unlocked_at ?? null,
    completionRequestedAt: row.completion_requested_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  };
}

function mapApplication(row: any): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    helperId: row.helper_id,
    helper: row.helper
      ? mapRef(row.helper)
      : {
          id: row.helper_id,
          name: '',
          avatarUrl: null,
          rating: 0,
          jobsCount: 0,
          isTrusted: false,
          isCustomerPlus: false,
          isHelperPro: false,
        },
    message: row.message ?? '',
    proposedPay: row.proposed_pay ?? undefined,
    availability: row.availability ?? undefined,
    status: row.status,
    isPriority: !!row.is_priority,
    priorityReason: row.priority_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function mapProfile(row: any): UserProfile {
  const v = row.verification_status?.[0] ?? row.verification_status ?? {};
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    neighborhood: row.neighborhood ?? '',
    roles: row.roles ?? ['customer'],
    ageGroup: row.age_group ?? 'adult',
    rating: Number(row.rating ?? 0),
    jobsCount: row.jobs_count ?? 0,
    reputationScore: row.reputation_score ?? 0,
    isTrusted: !!row.is_trusted,
    strikes: row.strikes ?? 0,
    isSuspended: !!row.is_suspended,
    isCustomerPlus: !!row.is_customer_plus,
    isHelperPro: !!row.is_helper_pro,
    verification: {
      emailVerified: !!v.email_verified,
      phoneAdded: !!v.phone_added,
      photoAdded: !!v.photo_added,
      schoolEmailVerified: !!v.school_email_verified,
      parentApproved: !!v.parent_approved,
    },
    parentApprovalStatus: row.parent_approval_status ?? 'not_required',
    // parentName/parentEmail/schoolEmail/phoneNumber/preferredContactMethod are
    // deliberately absent here: migration 0004 moved them to profiles_private,
    // and only getProfile (owner-only) merges them back in. Reading them off a
    // public `profiles` row would always yield undefined and invites someone to
    // "fix" it by re-exposing the columns.
    skills: row.skills ?? [],
    preferredCategories: row.preferred_categories ?? [],
    resumeSummary: row.resume_summary ?? undefined,
    bio: row.bio ?? undefined,
    isAdmin: !!row.is_admin,
    memberSince: row.member_since ?? row.created_at,
  };
}

function mapReview(row: any): Review {
  return {
    id: row.id,
    jobId: row.job_id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    ratings: {
      reliability: row.reliability,
      quality: row.quality,
      communication: row.communication,
      professionalism: row.professionalism,
    },
    comment: row.comment ?? '',
    createdAt: row.created_at,
  };
}

function mapNoShow(row: any): NoShowEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job?.title ?? undefined,
    reportedUserId: row.reported_user_id,
    reporterId: row.reporter_id,
    note: row.note ?? '',
    status: row.status,
    adminNotes: row.admin_notes ?? undefined,
    createdAt: row.created_at,
  };
}

function mapInvite(row: any): JobInvite {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job?.title ?? undefined,
    customerId: row.customer_id,
    helperId: row.helper_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body ?? '',
    read: !!row.read,
    createdAt: row.created_at,
  };
}

function mapReport(row: any): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id ?? undefined,
    jobId: row.job_id ?? undefined,
    category: row.category,
    description: row.description ?? '',
    riskLevel: row.ai_risk_level ?? 'medium',
    aiSummary: row.ai_summary ?? undefined,
    status: row.status,
    adminNotes: row.admin_notes ?? undefined,
    createdAt: row.created_at,
  };
}

function mapTicket(row: any): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Re-reads a job after an RPC changed it. The RPCs return void, and the caller
 * wants the fresh row — a missing job here means the RPC succeeded against
 * something that has since disappeared, which is an error, not a null.
 */
async function reloadJob(be: DataBackend, jobId: string): Promise<Job> {
  const job = await be.getJob(jobId);
  if (!job) throw new Error('Job not found after update');
  return job;
}

async function uid(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export const supabaseBackend: DataBackend = {
  async listFeedJobs() {
    const me = await uid();
    const { data, error } = await sb()
      .from('jobs')
      .select(JOB_SELECT)
      .eq('status', 'open')
      .is('deleted_at', null)
      .neq('customer_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // The full precedence keys off the *joined* customer's plan and an
    // expiry-aware boost, neither of which PostgREST can order by, so the
    // final sort happens here against the same comparator the mock uses.
    return (data ?? []).map(mapJob).sort((a: Job, b: Job) => compareFeedJobs(a, b));
  },

  async listMyJobs() {
    const me = await uid();
    const { data, error } = await sb()
      .from('jobs')
      .select(JOB_SELECT)
      .eq('customer_id', me)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapJob);
  },

  async getJob(id) {
    const { data, error } = await sb()
      .from('jobs')
      .select(JOB_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data) : null;
  },

  async createJob(input: CreateJobInput) {
    const me = await uid();
    const { data, error } = await sb()
      .from('jobs')
      .insert({
        customer_id: me,
        category: input.category,
        custom_category_text: input.customCategoryText,
        title: input.title,
        description: input.description,
        pay: input.pay,
        pay_type: input.payType,
        status: 'open',
        safety_tier: input.safetyTier,
        safety_notes: input.safetyNotes,
        requires_adult_supervision: input.requiresAdultSupervision,
        equipment_status: input.equipmentStatus,
        equipment_details: input.equipmentDetails,
        community_tags: input.communityTags,
        neighborhood: input.neighborhood,
        scheduled_for: input.scheduledFor,
        is_time_flexible: input.isTimeFlexible,
        duration_minutes: input.durationMinutes,
        estimated_duration: input.estimatedDuration,
        photos: input.photos ?? [],
        created_with_senior_mode: input.createdWithSeniorMode ?? false,
        // Senior Help Mode's optional family contact. Columns exist since
        // migration 0003; omitting them here silently discarded the one piece
        // of data that flow asks a senior to enter.
        family_contact_name: input.familyContact?.name || null,
        family_contact_phone: input.familyContact?.phone || null,
        family_contact_email: input.familyContact?.email || null,
        notify_family_contact: input.familyContact?.notify ?? false,
      })
      .select(JOB_SELECT)
      .single();
    if (error) throw error;
    return mapJob(data);
  },

  async updateJob(id, patch: JobUpdateInput) {
    const { data, error } = await sb()
      .from('jobs')
      .update({
        title: patch.title,
        description: patch.description,
        pay: patch.pay,
        pay_type: patch.payType,
        scheduled_for: patch.scheduledFor,
        estimated_duration: patch.estimatedDuration,
        equipment_status: patch.equipmentStatus,
        equipment_details: patch.equipmentDetails,
        community_tags: patch.communityTags,
        safety_tier: patch.safetyTier,
      })
      .eq('id', id)
      .select(JOB_SELECT)
      .single();
    if (error) throw error;
    return mapJob(data);
  },

  async setJobStatus(id, status) {
    const { data, error } = await sb()
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select(JOB_SELECT)
      .single();
    if (error) throw error;
    return mapJob(data);
  },

  async deleteJob(id) {
    const { error } = await sb()
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async listApplicationsForJob(jobId) {
    const { data, error } = await sb()
      .from('applications')
      .select(`*, helper:profiles!applications_helper_id_fkey(${PROFILE_REF})`)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapApplication).sort(compareApplications);
  },

  async listMyApplications() {
    const me = await uid();
    const { data, error } = await sb()
      .from('applications')
      .select(`*, helper:profiles!applications_helper_id_fkey(${PROFILE_REF})`)
      .eq('helper_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapApplication);
  },

  async applyToJob(input: ApplyToJobInput) {
    const me = await uid();
    const { data, error } = await sb()
      .from('applications')
      .insert({
        job_id: input.jobId,
        helper_id: me,
        message: input.message,
        proposed_pay: input.proposedPay ?? null,
        availability: input.availability ?? null,
        status: 'pending',
      })
      .select(`*, helper:profiles!applications_helper_id_fkey(${PROFILE_REF})`)
      .single();
    if (error) throw error;
    return mapApplication(data);
  },

  async acceptApplication(jobId, applicationId) {
    // Atomic + authorized server-side (SECURITY DEFINER RPC, migration 0004):
    // one accepted helper, others not_selected, contact unlocked, both parties
    // notified — all or nothing.
    const { error } = await sb().rpc('accept_application', {
      p_job_id: jobId,
      p_application_id: applicationId,
    });
    if (error) throw error;
  },

  async getJobContact(jobId) {
    const { data, error } = await sb().rpc('get_job_contact', {
      p_job_id: jobId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      name: row.name,
      avatarUrl: row.avatar_url,
      neighborhood: row.neighborhood ?? '',
      phoneNumber: row.phone_number ?? undefined,
      preferredContactMethod: row.preferred_contact_method ?? undefined,
    };
  },

  async declineApplication(_jobId, applicationId) {
    const { error } = await sb()
      .from('applications')
      .update({ status: 'declined' })
      .eq('id', applicationId);
    if (error) throw error;
  },

  // ── Completion (mutual confirmation) ──
  //
  // All three go through SECURITY DEFINER RPCs (migration 0013). The helper
  // has no UPDATE grant on `jobs` at all — only the customer does — so a
  // direct table write here would fail for exactly the party that needs to
  // confirm. The RPCs also make the status change + notification atomic.
  async requestJobCompletion(jobId) {
    const { error } = await sb().rpc('request_job_completion', { p_job_id: jobId });
    if (error) throw error;
    return reloadJob(this, jobId);
  },

  async confirmJobCompletion(jobId) {
    const { error } = await sb().rpc('confirm_job_completion', { p_job_id: jobId });
    if (error) throw error;
    return reloadJob(this, jobId);
  },

  async disputeJobCompletion(jobId, reason) {
    const { error } = await sb().rpc('dispute_job_completion', {
      p_job_id: jobId,
      p_reason: reason,
    });
    if (error) throw error;
    return reloadJob(this, jobId);
  },

  // ── Invites ──
  async inviteHelper(input: InviteHelperInput) {
    const { data, error } = await sb().rpc('invite_helper_to_job', {
      p_job_id: input.jobId,
      p_helper_id: input.helperId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapInvite(row);
  },

  async listMyInvites() {
    const me = await uid();
    const { data, error } = await sb()
      .from('job_invites')
      .select('*, job:jobs(title)')
      .eq('helper_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInvite);
  },

  async listInvitesForJob(jobId) {
    const { data, error } = await sb()
      .from('job_invites')
      .select('*, job:jobs(title)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInvite);
  },

  async getProfile(id) {
    const { data, error } = await sb()
      .from('profiles')
      .select('*, verification_status(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const profile = mapProfile(data);

    // Private PII lives in profiles_private (owner-only RLS, migration 0004).
    // The row simply comes back empty for anyone else's id.
    const { data: priv } = await sb()
      .from('profiles_private')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    if (priv) {
      profile.phoneNumber = priv.phone_number ?? undefined;
      profile.preferredContactMethod = priv.preferred_contact_method ?? undefined;
      profile.parentName = priv.parent_name ?? undefined;
      profile.parentEmail = priv.parent_email ?? undefined;
      profile.schoolEmail = priv.school_email ?? undefined;
    }
    return profile;
  },

  async listRecommendedHelpers() {
    const { data, error } = await sb()
      .from('profiles')
      .select('*, verification_status(*)')
      .contains('roles', ['helper'])
      .order('reputation_score', { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []).map(mapProfile);
  },

  async listReviewsForUser(userId) {
    const { data, error } = await sb()
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReview);
  },

  async listReviewsForJob(jobId) {
    const { data, error } = await sb()
      .from('reviews')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReview);
  },

  async createReview(input: CreateReviewInput) {
    const me = await uid();
    // The columns are flat smallints in the schema, not a jsonb blob.
    const { data, error } = await sb()
      .from('reviews')
      .insert({
        job_id: input.jobId,
        reviewer_id: me,
        reviewee_id: input.revieweeId,
        reliability: input.ratings.reliability,
        quality: input.ratings.quality,
        communication: input.ratings.communication,
        professionalism: input.ratings.professionalism,
        comment: input.comment,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapReview(data);
  },

  // ── No-show strikes ──
  async reportNoShow(input: ReportNoShowInput) {
    // RPC, not a plain insert: it validates that both people were actually on
    // the job and blocks duplicate reports, which RLS alone can't express.
    const { data, error } = await sb().rpc('report_no_show', {
      p_job_id: input.jobId,
      p_reported_user_id: input.reportedUserId,
      p_note: input.note,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapNoShow(row);
  },

  async listNoShowEventsForUser(userId) {
    const { data, error } = await sb()
      .from('no_show_events')
      .select('*, job:jobs(title)')
      .eq('reported_user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapNoShow);
  },

  async listAllNoShowEvents() {
    const { data, error } = await sb()
      .from('no_show_events')
      .select('*, job:jobs(title)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapNoShow);
  },

  async resolveNoShowEvent(id, patch) {
    // Strike bookkeeping (increment/decrement + suspension threshold) is
    // server-owned — `profiles.strikes` is pinned against self-service writes
    // by the 0005 guard trigger, so an admin's UI action has to land here.
    const { data, error } = await sb().rpc('resolve_no_show_event', {
      p_event_id: id,
      p_status: patch.status,
      p_admin_notes: patch.adminNotes ?? null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return mapNoShow(row);
  },

  async updateProfile(patch) {
    const me = await uid();
    const { data, error } = await sb()
      .from('profiles')
      .update({
        name: patch.name,
        avatar_url: patch.avatarUrl,
        neighborhood: patch.neighborhood,
        bio: patch.bio,
        skills: patch.skills,
        preferred_categories: patch.preferredCategories,
        resume_summary: patch.resumeSummary,
      })
      .eq('id', me)
      .select('*, verification_status(*)')
      .single();
    if (error) throw error;

    // Private PII goes to profiles_private (owner-only RLS).
    //
    // Only send keys the caller actually supplied. Coalescing absent fields to
    // null would make any partial edit (say, just the bio) silently erase the
    // user's phone number and school email, since `patch` is a Partial.
    const priv: Record<string, unknown> = { user_id: me };
    if ('phoneNumber' in patch) priv.phone_number = patch.phoneNumber ?? null;
    if ('preferredContactMethod' in patch)
      priv.preferred_contact_method = patch.preferredContactMethod ?? null;
    if ('schoolEmail' in patch) priv.school_email = patch.schoolEmail ?? null;

    if (Object.keys(priv).length > 1) {
      const { error: privError } = await sb()
        .from('profiles_private')
        .upsert(priv, { onConflict: 'user_id' });
      if (privError) throw privError;
    }

    // Verification flags derived from what the user just supplied. The server
    // owns the attested badges (email/school/parent — see migration 0005), but
    // "has a photo"/"has a phone" are simple facts about this row.
    if (patch.verification) {
      const { error: verError } = await sb()
        .from('verification_status')
        .update({
          photo_added: patch.verification.photoAdded,
          phone_added: patch.verification.phoneAdded,
        })
        .eq('user_id', me);
      if (verError) throw verError;
    }

    const profile = mapProfile(data);
    if ('phoneNumber' in patch) profile.phoneNumber = patch.phoneNumber;
    if ('preferredContactMethod' in patch)
      profile.preferredContactMethod = patch.preferredContactMethod;
    if ('schoolEmail' in patch) profile.schoolEmail = patch.schoolEmail;
    if (patch.verification) {
      profile.verification = {
        ...profile.verification,
        photoAdded: patch.verification.photoAdded,
        phoneAdded: patch.verification.phoneAdded,
      };
    }
    return profile;
  },

  async listNotifications() {
    const me = await uid();
    const { data, error } = await sb()
      .from('notifications')
      .select('*')
      .eq('user_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapNotification);
  },

  async markNotificationRead(id) {
    const { error } = await sb().from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },

  async createReport(input: CreateReportInput) {
    const me = await uid();
    const { data, error } = await sb()
      .from('reports')
      .insert({
        reporter_id: me,
        reported_user_id: input.reportedUserId ?? null,
        job_id: input.jobId ?? null,
        category: input.category,
        description: input.description,
        status: 'open',
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapReport(data);
  },

  async listMyReports() {
    const me = await uid();
    const { data, error } = await sb()
      .from('reports')
      .select('*')
      .eq('reporter_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReport);
  },

  async listAllReports() {
    const { data, error } = await sb()
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapReport);
  },

  async updateReport(id, patch) {
    const { data, error } = await sb()
      .from('reports')
      .update({ status: patch.status, admin_notes: patch.adminNotes })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapReport(data);
  },

  async createSupportTicket(input: CreateSupportTicketInput) {
    const me = await uid();
    const { data, error } = await sb()
      .from('support_tickets')
      .insert({
        user_id: me,
        category: input.category,
        subject: input.subject,
        message: input.message,
        status: 'open',
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapTicket(data);
  },

  async listMySupportTickets() {
    const me = await uid();
    const { data, error } = await sb()
      .from('support_tickets')
      .select('*')
      .eq('user_id', me)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
  },

  async listAllSupportTickets() {
    const { data, error } = await sb()
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
  },

  async updateSupportTicket(id, patch) {
    const { data, error } = await sb()
      .from('support_tickets')
      .update({ status: patch.status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapTicket(data);
  },

  async listBlockedUserIds() {
    const me = await uid();
    const { data, error } = await sb()
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('user_id', me);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.blocked_user_id);
  },

  async blockUser(userId) {
    const me = await uid();
    const { error } = await sb()
      .from('blocked_users')
      .insert({ user_id: me, blocked_user_id: userId });
    if (error) throw error;
  },

  async unblockUser(userId) {
    const me = await uid();
    const { error } = await sb()
      .from('blocked_users')
      .delete()
      .eq('user_id', me)
      .eq('blocked_user_id', userId);
    if (error) throw error;
  },

  async getImpactStats(): Promise<ImpactStats> {
    // Reads the community_impact_stats view; falls back to zeros if unavailable.
    const { data } = await sb().from('community_impact_stats').select('*').maybeSingle();
    return {
      completedJobs: data?.completed_jobs ?? 0,
      seniorsHelped: data?.seniors_helped ?? 0,
      familiesHelped: data?.families_helped ?? 0,
      teenSafeJobsCompleted: data?.teen_safe_jobs_completed ?? 0,
      averageTrustScore: Math.round(data?.average_trust_score ?? 0),
      repeatCustomers: data?.repeat_customers ?? 0,
      activeTeenHelpers: data?.active_teen_helpers ?? 0,
      topCategories: [],
    };
  },
};
