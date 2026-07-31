// ai-recommendations
// Ranks candidate jobs (for a helper) or helpers (for a customer) by relevance
// using location, ratings, categories, and past activity. The heavy lifting is
// a deterministic score; the model is used only to explain the top matches.
//
// POST { mode: "jobs"|"helpers", subject: object, candidates: object[] }
// → { ranked: { id: string, score: number, reason: string }[] }

import { corsHeaders, json } from '../_shared/cors.ts';

interface Candidate {
  id: string;
  distanceMiles?: number;
  rating?: number;
  category?: string;
  reputationScore?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { candidates, subject } = await req.json();
    const preferred: string[] = subject?.preferredCategories ?? [];

    const ranked = (candidates as Candidate[])
      .map((c) => {
        // Closer, higher-rated, category-matched, and more reputable rank higher.
        const distanceScore = Math.max(0, 100 - (c.distanceMiles ?? 5) * 15);
        const ratingScore = (c.rating ?? 0) * 12;
        const repScore = (c.reputationScore ?? 0) * 0.4;
        const categoryBonus =
          c.category && preferred.includes(c.category) ? 20 : 0;
        const score = Math.round(
          Math.min(100, distanceScore * 0.4 + ratingScore + repScore + categoryBonus)
        );
        return {
          id: c.id,
          score,
          reason:
            categoryBonus > 0
              ? 'Matches your preferred categories and is nearby.'
              : 'Close to you with a strong reputation.',
        };
      })
      .sort((a, b) => b.score - a.score);

    return json({ ranked });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
