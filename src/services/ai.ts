/**
 * AI service — job assistant, fair-pay suggestions, and safety review.
 *
 * In mock mode these return deterministic, plausible results so the AI-assisted
 * create-job flow works with no API key. In real mode, suggestPay/
 * improveDescription/safetyReview call Supabase Edge Functions backed by
 * Gemini (the key stays server-side, never shipped to the client) — see
 * realAI below. generateResumeSummary has no deployed edge function yet, so
 * it stays on the local heuristic even in real mode; see the comment on
 * realAI.generateResumeSummary.
 */

import { JobCategory, JOB_CATEGORIES, PayType, UserProfile } from '@/types/domain';
import type { SafetyTier } from '@/types/domain';
import { USE_MOCKS, hasSupabaseConfig } from '@/config/env';
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  wageGuidance,
} from '@/lib/wage';
import { getSupabase } from './supabaseClient';

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

/** Input for the "is this listing realistic?" check run on the AI preview step. */
export interface RealismInput {
  category: JobCategory;
  title: string;
  description: string;
  pay: number;
  payType: PayType;
  durationMinutes?: number;
  location?: string;
}

export interface RealismResult {
  /** False when at least one warning fired. Never blocks posting. */
  ok: boolean;
  /** Plain-language cautions, most important first. */
  warnings: string[];
  /** Effective hourly rate the pay/duration combination implies, if computable. */
  impliedHourlyRate: number | null;
}

/** Category → plausible whole-task duration band, in minutes. */
const DURATION_BANDS: Record<JobCategory, [number, number]> = {
  snow_removal: [30, 180],
  yard_work: [45, 300],
  lawn_care: [30, 180],
  leaf_cleanup: [45, 240],
  pool_cleaning: [30, 180],
  pet_care: [30, 480],
  dog_walking: [15, 90],
  tutoring: [30, 180],
  tech_help: [30, 180],
  moving_help: [60, 480],
  errands: [15, 120],
  cleaning: [45, 300],
  organization: [60, 300],
  plant_watering: [15, 60],
  car_washing: [30, 120],
  house_sitting: [60, 480],
  other: [15, 480],
};

/**
 * Deterministic realism check shared by both AI modes.
 *
 * Deliberately local rather than a model call: these are arithmetic facts
 * about the numbers the poster typed (an implied hourly rate, a duration
 * outside the plausible band for the category), so a model would add latency
 * and non-determinism without adding accuracy. `realAI` layers Gemini's
 * qualitative read on top of this, never in place of it.
 */
export function checkRealismLocally(input: RealismInput): RealismResult {
  const warnings: string[] = [];
  const [lo, hi] = DURATION_BANDS[input.category] ?? [15, 480];
  const minutes = input.durationMinutes;

  if (minutes !== undefined && minutes > 0) {
    if (minutes < MIN_DURATION_MINUTES) {
      warnings.push(
        `${minutes} minutes is shorter than Comly's ${MIN_DURATION_MINUTES}-minute minimum.`
      );
    } else if (minutes > MAX_DURATION_MINUTES) {
      warnings.push(
        `${Math.round(minutes / 60)} hours is longer than a single Comly job should run. Consider splitting it up.`
      );
    } else if (minutes < lo) {
      warnings.push(
        `${JOB_CATEGORIES[input.category].label} usually takes at least ${lo} minutes. A ${minutes}-minute estimate may leave your helper rushed.`
      );
    } else if (minutes > hi) {
      warnings.push(
        `${JOB_CATEGORIES[input.category].label} rarely takes more than ${Math.round(hi / 60)} hours. Double-check the estimate so helpers know what they're signing up for.`
      );
    }
  }

  const guidance = wageGuidance(
    input.pay,
    input.payType,
    input.durationMinutes,
    input.location
  );
  if (guidance.warning) warnings.push(guidance.warning);

  return {
    ok: warnings.length === 0,
    warnings,
    impliedHourlyRate: guidance.hourlyRate,
  };
}

export interface ApplicationMessageInput {
  jobTitle: string;
  category: JobCategory;
  jobDescription: string;
  neighborhood: string;
  helperName: string;
  helperSkills: string[];
  helperJobsCount: number;
  equipmentProvided: boolean;
}

export interface AIService {
  /**
   * `payType` matters, not just cosmetic: a whole-job price and an hourly
   * rate for the same task are not related by simple division (a 30-minute
   * snow-shovel job is a fair $40 flat but not a fair $80/hr), so this
   * returns a genuinely different number depending on which the poster
   * picked — previously it returned the same range either way.
   */
  suggestPay(
    category: JobCategory,
    title: string,
    payType: PayType
  ): Promise<PaySuggestion>;
  improveDescription(text: string, category: JobCategory): Promise<string>;
  safetyReview(title: string, description: string): Promise<SafetyResult>;
  /**
   * Sanity-checks the poster's own numbers (duration vs category, pay vs the
   * local minimum-wage floor) before the listing goes live. Advisory only.
   */
  checkRealism(input: RealismInput): Promise<RealismResult>;
  /**
   * Drafts the helper's "short message to customer" on the apply screen. The
   * helper always edits it before submitting — this fills the field, it never
   * sends anything.
   */
  suggestApplicationMessage(input: ApplicationMessageInput): Promise<string>;
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

// Rough local averages for a WHOLE task paid as a flat fee.
const FIXED_PAY_BANDS: Record<JobCategory, [number, number]> = {
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

// Per-HOUR rates. Deliberately a separate table, not the fixed band divided
// by an assumed duration: this app doesn't know the job's length at the
// point pay is suggested for every flow, and a per-hour neighborhood/teen
// rate isn't "whole-job price / hours" anyway — a 20-minute dog walk is
// reasonably $15-20 flat, but that is not evidence the same person's fair
// hourly rate is $45-60/hr.
const HOURLY_PAY_BANDS: Record<JobCategory, [number, number]> = {
  snow_removal: [18, 25],
  yard_work: [15, 22],
  lawn_care: [15, 22],
  leaf_cleanup: [15, 20],
  pool_cleaning: [18, 28],
  pet_care: [12, 18],
  dog_walking: [12, 18],
  tutoring: [18, 30],
  tech_help: [18, 30],
  moving_help: [18, 25],
  errands: [12, 18],
  cleaning: [15, 22],
  organization: [15, 20],
  plant_watering: [12, 15],
  car_washing: [15, 20],
  house_sitting: [12, 18],
  other: [12, 20],
};

const payBandsFor = (payType: PayType) =>
  payType === 'hourly' ? HOURLY_PAY_BANDS : FIXED_PAY_BANDS;

// Keyword → safety tier signals (most severe wins).
const BLOCKED_TERMS = ['roof', 'electrical', 'wiring', 'heavy machinery', 'chainsaw', 'firearm', 'gun'];
const EIGHTEEN_TERMS = ['ladder', 'gutter', 'chemical', 'pressure washer', 'power tool'];
const SUPERVISION_TERMS = ['pool', 'chemical', 'basement', 'attic'];
const CAUTION_TERMS = ['snow', 'ice', 'lift', 'carry', 'heavy', 'outdoor', 'mow'];

const mockAI: AIService = {
  async suggestPay(category, _title, payType) {
    const [min, max] = payBandsFor(payType)[category] ?? [20, 40];
    const recommended = Math.round((min + max) / 2);
    return delay({
      min,
      max,
      recommended,
      rationale:
        payType === 'hourly'
          ? `Typical hourly rate neighbors pay for ${category.replace(/_/g, ' ')} in your area.`
          : `Based on task type, estimated time, and the local average for ${category.replace(/_/g, ' ')}.`,
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

  async checkRealism(input) {
    return delay(checkRealismLocally(input), 400);
  },

  async suggestApplicationMessage(input) {
    const skill = input.helperSkills[0]?.toLowerCase();
    const category = JOB_CATEGORIES[input.category].label.toLowerCase();
    const experience =
      input.helperJobsCount > 0
        ? `I've completed ${input.helperJobsCount} ${
            input.helperJobsCount === 1 ? 'job' : 'jobs'
          } on Comly`
        : `I'm new to Comly and eager to build a good track record`;
    const equipment = input.equipmentProvided
      ? 'Thanks for providing the equipment'
      : 'I can bring my own equipment';
    const strength = skill ? ` and neighbors say I'm ${skill.toLowerCase()}` : '';
    return delay(
      `Hi! I'm ${input.helperName} and I live in ${input.neighborhood}. ` +
        `I'd love to help with "${input.jobTitle}". ${experience}${strength}, ` +
        `including ${category}. ${equipment}. Let me know what time works best for you!`,
      600
    );
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

/**
 * Shape returned by the ai-job-assistant edge function. It answers one
 * combined "draft this job" question — suggestPay and improveDescription
 * both call it and each pick out the one field they actually need, rather
 * than there being a separate edge function per client method.
 */
interface JobAssistantResult {
  title: string;
  description: string;
  suggestedPayMin: number;
  suggestedPayMax: number;
  estimatedDuration: string;
}

async function invokeJobAssistant(
  prompt: string,
  category: JobCategory,
  neighborhood?: string,
  payType?: PayType
): Promise<JobAssistantResult> {
  const { data, error } = await getSupabase().functions.invoke('ai-job-assistant', {
    body: { prompt, category, neighborhood, payType },
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Empty AI response');
  return data as JobAssistantResult;
}

/**
 * Coerces a model-supplied number and rejects anything implausible.
 *
 * Models routinely emit JSON numbers as strings ("40" not 40), which is not an
 * error anywhere in the chain — it just silently poisons arithmetic. `"40" +
 * "65"` concatenates to `"4065"`, so a naive midpoint turned a $52 suggestion
 * into $2033. Nothing throws on that path, so the try/catch fallback below
 * never engages; the bad number flows straight into the pay field. Hence an
 * explicit gate rather than trusting the declared TypeScript type, which
 * describes only what the model was *asked* for.
 */
export function asPay(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  // Comly is neighborhood odd-jobs; anything outside this band is a model
  // artifact, not a real rate.
  if (n <= 0 || n > 1000) return null;
  return Math.round(n);
}

/**
 * Real, Gemini-backed implementation. Each method falls back to the local
 * heuristic on failure (network error, Gemini outage, malformed response)
 * rather than throwing — a flaky AI call should never block someone from
 * posting or applying to a job. CreateJobScreen's own catch handler around
 * safetyReview is a second layer of defense underneath this, not made
 * redundant by it: this fallback only covers the AI call itself failing
 * gracefully, in case something further up the chain still throws.
 */
const realAI: AIService = {
  async suggestPay(category, title, payType) {
    try {
      const result = await invokeJobAssistant(
        title || `${category} help`,
        category,
        undefined,
        payType
      );
      const min = asPay(result.suggestedPayMin);
      const max = asPay(result.suggestedPayMax);
      if (min === null || max === null || min > max) {
        throw new Error(
          `Implausible pay range from model: ${result.suggestedPayMin}–${result.suggestedPayMax}`
        );
      }
      return {
        min,
        max,
        recommended: Math.round((min + max) / 2),
        rationale:
          payType === 'hourly'
            ? `AI estimate of a fair hourly rate for ${category.replace(/_/g, ' ')} in your area.`
            : `AI estimate based on task type and local rates for ${category.replace(/_/g, ' ')}.`,
      };
    } catch (err) {
      console.warn('[Comly] ai-job-assistant (pay) failed, using local estimate:', err);
      return mockAI.suggestPay(category, title, payType);
    }
  },

  async improveDescription(text, category) {
    try {
      const prompt = text.trim() || `Looking for help with ${category.replace(/_/g, ' ')}.`;
      const result = await invokeJobAssistant(prompt, category);
      return result.description;
    } catch (err) {
      console.warn('[Comly] ai-job-assistant (description) failed, using local text:', err);
      return mockAI.improveDescription(text, category);
    }
  },

  async safetyReview(title, description) {
    try {
      const { data, error } = await getSupabase().functions.invoke('ai-safety-review', {
        body: { title, description },
      });
      if (error) throw error;
      // The edge function already coerces unknown tiers, but this is the app's
      // child-safety gate — it must not inherit a bad value from a server
      // response it happens to trust. An unrecognized tier reaching the UI also
      // crashes SafetyBadge outright, which destructures SAFETY_TIERS[tier].
      const VALID: SafetyTier[] = [
        'teen_safe',
        'caution',
        'adult_supervision',
        'eighteen_plus_only',
        'blocked',
      ];
      if (!data || !VALID.includes(data.tier)) {
        throw new Error(`Unrecognized safety tier from model: ${data?.tier}`);
      }
      return {
        safe: !!data.safe,
        tier: data.tier as SafetyTier,
        note: data.note ?? '',
      };
    } catch (err) {
      console.warn('[Comly] ai-safety-review failed, using local keyword check:', err);
      return mockAI.safetyReview(title, description);
    }
  },

  async checkRealism(input) {
    // The arithmetic half is authoritative and always runs. Gemini is asked
    // only for the qualitative read it can actually add ("$20 for a full day
    // of moving furniture reads as unrealistic"), and a failure there just
    // means the local warnings stand on their own.
    const local = checkRealismLocally(input);
    try {
      const { data, error } = await getSupabase().functions.invoke(
        'ai-job-assistant',
        {
          body: {
            prompt: `${input.title}. ${input.description}`,
            category: input.category,
            neighborhood: input.location,
            payType: input.payType,
            pay: input.pay,
            durationMinutes: input.durationMinutes,
            checkRealism: true,
          },
        }
      );
      if (error) throw error;
      const note =
        typeof data?.realismWarning === 'string' ? data.realismWarning.trim() : '';
      if (note && !local.warnings.includes(note)) {
        return { ...local, ok: false, warnings: [...local.warnings, note] };
      }
      return local;
    } catch (err) {
      console.warn('[Comly] ai-job-assistant (realism) failed, using local check:', err);
      return local;
    }
  },

  async suggestApplicationMessage(input) {
    try {
      const { data, error } = await getSupabase().functions.invoke(
        'ai-job-assistant',
        {
          body: {
            prompt:
              `Write a short, friendly 2-3 sentence message from a neighborhood helper ` +
              `named ${input.helperName} applying to help with "${input.jobTitle}" ` +
              `(${JOB_CATEGORIES[input.category].label}) in ${input.neighborhood}.`,
            category: input.category,
            neighborhood: input.neighborhood,
            applicationMessage: true,
          },
        }
      );
      if (error) throw error;
      const text =
        typeof data?.applicationMessage === 'string'
          ? data.applicationMessage.trim()
          : typeof data?.description === 'string'
            ? data.description.trim()
            : '';
      if (!text) throw new Error('Empty application-message response');
      return text;
    } catch (err) {
      console.warn('[Comly] ai-job-assistant (apply message) failed, using local draft:', err);
      return mockAI.suggestApplicationMessage(input);
    }
  },

  // No edge function exists for this yet — building one for a single string
  // field used only on the helper profile screen isn't worth a third
  // deployed function today. Stays on the local heuristic even in real mode
  // until that's actually built.
  generateResumeSummary: mockAI.generateResumeSummary,
};

function resolveAI(): AIService {
  if (USE_MOCKS) return mockAI;
  if (!hasSupabaseConfig) {
    console.warn(
      '[Comly] Supabase is not configured; AI falls back to the local heuristic. ' +
        'Set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY and EXPO_PUBLIC_USE_MOCKS=false.'
    );
    return mockAI;
  }
  return realAI;
}

export const ai: AIService = resolveAI();
