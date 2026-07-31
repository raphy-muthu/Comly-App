// ai-safety-review
// Scans a job post for unsafe requests, scam indicators, or inappropriate
// content and returns a safety tier suitable for the audience (teens included).
//
// POST { title: string, description: string }
// → { safe: boolean, tier: "teen_safe"|"adult_supervision"|"adults_only",
//     flags: string[], note: string }

import { corsHeaders, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openai.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, description } = await req.json();

    const content = await chat({
      json: true,
      system:
        'You are a safety reviewer for a neighborhood marketplace where many ' +
        'helpers are teens. Flag scams, unsafe physical work (roofs, ladders, ' +
        'chemicals, electrical), inappropriate or adult-only requests. Respond ' +
        'ONLY with JSON: {"safe": boolean, "tier": "teen_safe"|' +
        '"adult_supervision"|"adults_only", "flags": string[], "note": string}.',
      user: `Title: ${title ?? ''}\nDescription: ${description ?? ''}`,
    });

    return json(JSON.parse(content));
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
