// Minimal OpenAI Chat Completions helper for edge functions.
// The key is read from the OPENAI_API_KEY secret and never leaves the server.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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
  model = 'gpt-4o-mini',
}: ChatOptions): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch(OPENAI_URL, {
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
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
