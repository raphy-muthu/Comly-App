// ai-safety-review
// Scans a job post for unsafe requests, scam indicators, or inappropriate
// content and returns a safety tier suitable for the audience (teens included).
//
// POST { title: string, description: string }
// → { safe: boolean, tier: SafetyTier, flags: string[], note: string }
//
// `tier` MUST be one of the five values in the app's SafetyTier union (see
// src/types/domain.ts) — they are also Postgres enum values, so anything else
// fails the jobs insert outright. An earlier revision of this prompt asked for
// "adults_only", which exists in neither.

import { corsHeaders, json } from '../_shared/cors.ts';
import { chat } from '../_shared/gemini.ts';
import { isAuthenticatedUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Billed Gemini call — signed-in users only. The public anon key alone is
  // not sufficient; see _shared/auth.ts.
  if (!isAuthenticatedUser(req)) {
    return json({ error: 'Sign in required' }, 401);
  }

  try {
    const { title, description } = await req.json();

    const content = await chat({
      json: true,
      system:
        'You are a safety reviewer for a neighborhood marketplace where many ' +
        'helpers are teens. Flag scams, unsafe physical work (roofs, ladders, ' +
        'chemicals, electrical), inappropriate or adult-only requests. Respond ' +
        'ONLY with JSON: {"safe": boolean, "tier": "teen_safe"|"caution"|' +
        '"adult_supervision"|"eighteen_plus_only"|"blocked", ' +
        '"flags": string[], "note": string}. ' +
        'Tier meanings: teen_safe = fine for a minor unsupervised; ' +
        'caution = minor may do it but should take care; ' +
        'adult_supervision = minor needs guardian approval; ' +
        'eighteen_plus_only = no minors; blocked = not allowed at all.',
      user: `Title: ${title ?? ''}\nDescription: ${description ?? ''}`,
    });

    const parsed = JSON.parse(content);

    // Never let a hallucinated tier reach the database. Anything unrecognized
    // degrades to 'caution' — permissive enough not to block a legitimate post,
    // but it does not assert that a task is safe for a child.
    const TIERS = [
      'teen_safe',
      'caution',
      'adult_supervision',
      'eighteen_plus_only',
      'blocked',
    ];
    if (!TIERS.includes(parsed?.tier)) {
      parsed.tier = 'caution';
      parsed.safe = true;
      parsed.note = parsed?.note ?? 'Safety review was inconclusive.';
    }

    return json(parsed);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
