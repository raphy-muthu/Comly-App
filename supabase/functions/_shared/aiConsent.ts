// Has the caller allowed Comly to send their text to Gemini?
//
// App Store guideline 5.1.2(i) requires explicit permission before personal
// data is shared with third-party AI. The app asks once (AiConsentSheet) and
// stores the answer through set_ai_consent() (migration 0035). The app already
// skips AI calls without it; this is the server half, so an old build or a
// hand-made request can't reach Gemini for someone who said no or was never
// asked.
//
// Reads ai_consents with the caller's own token, so RLS limits the lookup to
// their row. Fails closed: any error, or no row at all, counts as "no".
//
// Takes the caller's id and token rather than the Request (callers pass
// userIdFromRequest(req) and bearerToken(req) from auth.ts), so this file has
// no imports and stays loadable under Jest.

function envOrUndefined(key: string): string | undefined {
  // Deno in the edge runtime; absent under Jest, where deps are injected.
  const d = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(key);
}

export async function hasAiConsent(
  userId: string | null,
  token: string,
  deps: { supabaseUrl?: string; anonKey?: string; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  const supabaseUrl = deps.supabaseUrl ?? envOrUndefined('SUPABASE_URL');
  const anonKey = deps.anonKey ?? envOrUndefined('SUPABASE_ANON_KEY');
  if (!userId || !token || !supabaseUrl || !anonKey) return false;

  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      `${supabaseUrl}/rest/v1/ai_consents?select=granted&user_id=eq.${encodeURIComponent(userId)}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0]?.granted === true;
  } catch {
    return false;
  }
}
