/**
 * Keyword safety floor — the deterministic half of job classification.
 *
 * The AI review decides a job's tier, but a model can be wrong or talked out
 * of its instructions by a job description. These patterns are the floor it
 * can never go below. Applied in three places:
 *   • the client's final tier (services/ai.ts), combined with the model's,
 *   • the mock backend, for parity,
 *   • the enforce_safety_keyword_floor trigger (migration 0027), which is what
 *     actually holds in production — the client's choice is not trusted.
 *
 * Matching is on whole words (\b…\b). The original substring matching read
 * "tomorrow" as mowing, "begun" as a gun, and "price"/"office" as ice.
 *
 * Every pattern must be valid in both JavaScript and Postgres regexes: plain
 * letters, `?`, `|`, `(…)`, and `[…]` only. The migration wraps them in \y…\y
 * (Postgres's word boundary). src/__tests__/safetyKeywords.test.ts fails if
 * the two lists ever differ — change both together.
 */

import { SafetyTier } from '@/types/domain';

export const SAFETY_KEYWORDS: { tier: SafetyTier; patterns: string[] }[] = [
  {
    tier: 'blocked',
    patterns: [
      'roof(s|ing|er|ers)?',
      'electrical',
      'wiring',
      'heavy machinery',
      'chain ?saws?',
      'firearms?',
      'guns?',
    ],
  },
  {
    tier: 'eighteen_plus_only',
    patterns: [
      'ladders?',
      'gutters?',
      'chemicals?',
      'pressure wash(er|ers|ing)?',
      'power tools?',
      'driv(e|es|ing|er|ers)',
      'deliver(s|y|ies|ing|ed)?',
      'door[- ]to[- ]door',
      'canvass(ing)?',
    ],
  },
  {
    tier: 'sixteen_plus_only',
    patterns: [
      'mow(s|ed|er|ers|ing)?',
      'weed ?whack(er|ers|ing)?',
      'string trimmers?',
      'hedge trimm(er|ers|ing)',
    ],
  },
  {
    tier: 'adult_supervision',
    patterns: ['pools?', 'basements?', 'attics?'],
  },
  {
    tier: 'caution',
    patterns: ['snow', 'ice', 'icy', 'lift(s|ing)?', 'carry(ing)?', 'heavy', 'outdoors?'],
  },
];

// Most severe first, so the first match is the answer.
const COMPILED = SAFETY_KEYWORDS.map(({ tier, patterns }) => ({
  tier,
  regex: new RegExp(`\\b(?:${patterns.join('|')})\\b`, 'i'),
}));

/** The strictest tier any keyword in `text` calls for, and the word that matched. */
export function keywordTier(text: string): { tier: SafetyTier; term?: string } {
  for (const { tier, regex } of COMPILED) {
    const match = regex.exec(text);
    if (match) return { tier, term: match[0] };
  }
  return { tier: 'teen_safe' };
}
