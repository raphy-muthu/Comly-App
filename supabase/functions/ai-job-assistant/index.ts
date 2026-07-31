// ai-job-assistant
// Generates a polished job title, description, suggested pay range, and an
// estimated duration from a short free-text prompt.
//
// POST { prompt: string, category?: string, neighborhood?: string }
// → { title, description, suggestedPayMin, suggestedPayMax, estimatedDuration }

import { corsHeaders, json } from '../_shared/cors.ts';
import { chat } from '../_shared/openai.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prompt, category, neighborhood } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return json({ error: 'prompt is required' }, 400);
    }

    const content = await chat({
      json: true,
      system:
        'You help neighbors write clear, friendly local job posts for a ' +
        'community marketplace. Keep it concise and safe. Respond ONLY with ' +
        'JSON: {"title": string, "description": string, "suggestedPayMin": ' +
        'number, "suggestedPayMax": number, "estimatedDuration": string}.',
      user: `Task: ${prompt}\nCategory: ${category ?? 'unknown'}\nArea: ${
        neighborhood ?? 'unknown'
      }`,
    });

    return json(JSON.parse(content));
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
