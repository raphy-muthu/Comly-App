// ai-job-assistant
// Generates a polished job title, description, suggested pay range, and an
// estimated duration from a short free-text prompt.
//
// POST { prompt: string, category?: string, neighborhood?: string, payType?: "fixed"|"hourly",
//        pay?: number, durationMinutes?: number, checkRealism?: boolean,
//        applicationMessage?: boolean }
// → { title, description, suggestedPayMin, suggestedPayMax, estimatedDuration,
//     realismWarning?, applicationMessage? }
//
// Two opt-in extras ride on this same function rather than getting their own
// deployment: `checkRealism` asks for a one-sentence caution about the pay /
// duration the poster actually typed, and `applicationMessage` drafts a
// helper's intro message. Both are additive — clients that don't ask for them
// get the same response shape as before.
//
// suggestedPayMin/Max mean different things depending on payType: a whole-job
// flat fee, or a per-hour rate. The prompt used to never say which, so the
// model (and the fixed-vs-hourly toggle on the client) silently disagreed —
// a $40 suggestion rendered identically whether the poster meant "$40 total"
// or "$40/hr". Defaults to "fixed" only because that's this app's default
// selection, not because it's a safe guess when actually unspecified.

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
    const {
      prompt,
      category,
      neighborhood,
      payType,
      pay,
      durationMinutes,
      checkRealism,
      applicationMessage,
    } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return json({ error: 'prompt is required' }, 400);
    }
    const resolvedPayType = payType === 'hourly' ? 'hourly' : 'fixed';

    // Helper's intro message — a different task with a different output shape,
    // so it short-circuits before the job-drafting prompt below.
    if (applicationMessage) {
      const msg = await chat({
        json: true,
        system:
          'You draft short, friendly first messages from a neighborhood helper ' +
          'to someone who posted a local job. 2-3 sentences, warm and specific, ' +
          'no emoji, never invent credentials or promise a price. Respond ONLY ' +
          'with JSON: {"applicationMessage": string}.',
        user: `${prompt}
Category: ${category ?? 'unknown'}
Area: ${
          neighborhood ?? 'unknown'
        }`,
      });
      return json(JSON.parse(msg));
    }

    const content = await chat({
      json: true,
      system:
        'You help neighbors write clear, friendly local job posts for a ' +
        'community marketplace. Keep it concise and safe. Respond ONLY with ' +
        'JSON: {"title": string, "description": string, "suggestedPayMin": ' +
        'number, "suggestedPayMax": number, "estimatedDuration": string}. ' +
        (resolvedPayType === 'hourly'
          ? 'suggestedPayMin/suggestedPayMax are a fair PER-HOUR rate in ' +
            'dollars for this kind of neighborhood task — not a total job ' +
            'price. Typical hourly rates for informal local help run ' +
            'roughly $12-30/hr depending on the task; do not suggest a ' +
            'whole-job flat fee here.'
          : 'suggestedPayMin/suggestedPayMax are a fair FLAT fee in dollars ' +
            'for the whole task — not an hourly rate.'),
      user: `Task: ${prompt}\nCategory: ${category ?? 'unknown'}\nArea: ${
        neighborhood ?? 'unknown'
      }\nPay type: ${resolvedPayType}`,
    });

    const result = JSON.parse(content);

    // Realism pass: a separate, cheap call so a failure here can't corrupt the
    // main draft the poster is waiting on.
    if (checkRealism) {
      try {
        const realism = await chat({
          json: true,
          system:
            'You review neighborhood job listings for realistic expectations. ' +
            'Given the task, the pay, and the estimated duration, say whether ' +
            'the combination looks unrealistic (far too little time for the ' +
            'work, or pay far below what the time is worth). Respond ONLY with ' +
            'JSON: {"realismWarning": string}. Use an empty string when the ' +
            'listing looks reasonable. Never mention laws or legal advice — ' +
            'one plain sentence a neighbor would find helpful.',
          user:
            `Task: ${prompt}
Category: ${category ?? 'unknown'}
` +
            `Pay: ${pay ?? 'unspecified'} (${resolvedPayType})
` +
            `Estimated duration: ${durationMinutes ?? 'unspecified'} minutes`,
        });
        const parsed = JSON.parse(realism);
        if (typeof parsed?.realismWarning === 'string') {
          result.realismWarning = parsed.realismWarning;
        }
      } catch (_realismErr) {
        // The client keeps its own deterministic check; silence is fine.
      }
    }

    return json(result);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
