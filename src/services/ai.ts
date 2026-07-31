/**
 * AI service — job assistant, fair-pay suggestions, and safety review.
 *
 * In mock mode these return deterministic, plausible results so the AI-assisted
 * create-job flow works with no API key. Phase 8 swaps in a real implementation
 * that calls a Supabase Edge Function backed by OpenAI (the key stays
 * server-side and is never shipped to the client).
 */

import { JobCategory, JOB_CATEGORIES, UserProfile } from '@/types/domain';
import type { SafetyTier } from '@/types/domain';
import { USE_MOCKS } from '@/config/env';

export interface PaySuggestion {
  min: number;
  max: number;
  recommended: number;
  rationale: string;
}

export interface SafetyResult {
  safe: boolean;
  tier: SafetyTier;
  note: string;
}

export interface AIService {
  suggestPay(category: JobCategory, title: string): Promise<PaySuggestion>;
  improveDescription(text: string, category: JobCategory): Promise<string>;
  safetyReview(title: string, description: string): Promise<SafetyResult>;
  /** Resume-style experience summary built from a helper's track record. */
  generateResumeSummary(
    profile: Pick<
      UserProfile,
      'jobsCount' | 'rating' | 'skills' | 'preferredCategories'
    >
  ): Promise<string>;
}

const delay = <T>(v: T, ms = 600): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

// Rough local averages keyed by category (mock "market data").
const PAY_BANDS: Record<JobCategory, [number, number]> = {
  snow_removal: [35, 45],
  yard_work: [35, 55],
  lawn_care: [40, 60],
  leaf_cleanup: [30, 50],
  pool_cleaning: [45, 70],
  pet_care: [18, 30],
  dog_walking: [15, 25],
  tutoring: [25, 40],
  tech_help: [30, 50],
  moving_help: [40, 70],
  errands: [15, 25],
  cleaning: [30, 60],
  organization: [25, 45],
  plant_watering: [12, 20],
  car_washing: [20, 35],
  house_sitting: [40, 60],
  other: [20, 40],
};

// Keyword → safety tier signals (most severe wins).
const BLOCKED_TERMS = ['roof', 'electrical', 'wiring', 'heavy machinery', 'chainsaw', 'firearm', 'gun'];
const EIGHTEEN_TERMS = ['ladder', 'gutter', 'chemical', 'pressure washer', 'power tool'];
const SUPERVISION_TERMS = ['pool', 'chemical', 'basement', 'attic'];
const CAUTION_TERMS = ['snow', 'ice', 'lift', 'carry', 'heavy', 'outdoor', 'mow'];

const mockAI: AIService = {
  async suggestPay(category, _title) {
    const [min, max] = PAY_BANDS[category] ?? [20, 40];
    const recommended = Math.round((min + max) / 2);
    return delay({
      min,
      max,
      recommended,
      rationale: `Based on task type, estimated time, and the local average for ${category.replace(/_/g, ' ')}.`,
    });
  },

  async improveDescription(text, category) {
    const trimmed = text.trim();
    const base =
      trimmed.length > 0
        ? trimmed
        : `Looking for reliable help with ${category.replace(/_/g, ' ')}.`;
    return delay(
      `${base} Please bring any needed supplies. I'm a friendly neighbor and flexible on timing — thanks for helping out!`
    );
  },

  async safetyReview(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const has = (terms: string[]) => terms.find((t) => text.includes(t));

    const blocked = has(BLOCKED_TERMS);
    if (blocked) {
      return delay({
        safe: false,
        tier: 'blocked' as SafetyTier,
        note: `Mentions "${blocked}", which is not allowed on Comly for safety reasons.`,
      });
    }
    const eighteen = has(EIGHTEEN_TERMS);
    if (eighteen) {
      return delay({
        safe: false,
        tier: 'eighteen_plus_only' as SafetyTier,
        note: `Mentions "${eighteen}" — helpers under 18 cannot apply to this task.`,
      });
    }
    const supervision = has(SUPERVISION_TERMS);
    if (supervision) {
      return delay({
        safe: true,
        tier: 'adult_supervision' as SafetyTier,
        note: 'Comly recommends adult supervision; teen helpers need parent approval.',
      });
    }
    const caution = has(CAUTION_TERMS);
    return delay({
      safe: true,
      tier: (caution ? 'caution' : 'teen_safe') as SafetyTier,
      note: caution
        ? 'May involve weather or light physical work. Helpers should only accept jobs they can safely complete.'
        : 'This task looks safe for teen helpers.',
    });
  },

  async generateResumeSummary(profile) {
    const softSkills = profile.skills.length
      ? profile.skills.slice(0, 4).map((s) => s.toLowerCase()).join(', ')
      : 'reliability, communication, and time management';
    const categories = profile.preferredCategories.length
      ? profile.preferredCategories
          .slice(0, 4)
          .map((c) => JOB_CATEGORIES[c].label.toLowerCase())
          .join(', ')
      : 'neighborhood services';
    return delay(
      `Completed ${profile.jobsCount} neighborhood service jobs with a ` +
        `${profile.rating.toFixed(1)}-star rating, demonstrating ${softSkills}. ` +
        `Experience includes ${categories}.`,
      800
    );
  },
};

// Real implementation arrives in Phase 8; fall back to mock for now.
function resolveAI(): AIService {
  if (USE_MOCKS) return mockAI;
  // TODO(phase-8): return an edge-function-backed AIService.
  return mockAI;
}

export const ai: AIService = resolveAI();
