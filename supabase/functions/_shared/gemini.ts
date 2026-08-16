// Minimal Gemini Chat Completions helper for edge functions, via Google's
// OpenAI-compatible endpoint (https://ai.google.dev/gemini-api/docs/openai) —
// the same request/response shape as OpenAI's Chat Completions API, so this
// file is a drop-in swap for the previous OpenAI-backed version. The key is
// read from the GEMINI_API_KEY secret and never leaves the server.
//
// Callers (ai-job-assistant, ai-safety-review) are unaffected by this swap —
// they only ever call chat({ system, user, json }); nothing about the
// provider leaks past this file.

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export interface ChatOptions {
  system: string;
  user: string;
  /** Ask the model to return strict JSON. */
  json?: boolean;
  model?: string;
}

export async function chat({
  system,
  user,
  json = false,
  // 2.5 Flash is retired for new API keys and the whole 2.5 line is
  // scheduled for shutdown (Oct 2026) regardless; 3.6 Flash is the current
  // GA model — https://ai.google.dev/gemini-api/docs/latest-model
  model = 'gemini-3.6-flash',
}: ChatOptions): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
