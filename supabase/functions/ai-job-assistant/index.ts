// ai-job-assistant
// Generates a polished job title, description, suggested pay range, and an
// estimated duration from a short free-text prompt.
//
// POST { prompt: string, category?: string, neighborhood?: string, payType?: "fixed"|"hourly" }
// → { title, description, suggestedPayMin, suggestedPayMax, estimatedDuration }
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
    const { prompt, category, neighborhood, payType } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return json({ error: 'prompt is required' }, 400);
    }
    const resolvedPayType = payType === 'hourly' ? 'hourly' : 'fixed';

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

    return json(JSON.parse(content));
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
