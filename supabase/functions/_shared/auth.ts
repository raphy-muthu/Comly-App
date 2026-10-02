// Caller authentication for edge functions.
//
// Supabase's gateway (verify_jwt, on by default) rejects a missing or
// malformed/unsigned token before our code runs — but it accepts the project's
// *anon* key as a perfectly valid JWT. The anon key is public by design: it is
// compiled into every copy of the mobile app and is trivially extractable from
// the binary. So "the gateway let it through" only proves the caller has a
// public value, not that they are a signed-in user.
//
// That distinction is free for the read-only endpoints, but the AI functions
// bill a real Gemini quota on every invocation. Without this check, anyone who
// pulls the anon key out of the app has an unmetered LLM proxy on our account.
//
// The signature is already verified upstream, so decoding the payload here is
// sufficient — we are reading claims, not establishing trust in them.

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') ?? '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

function decodeClaims(req: Request): Record<string, unknown> | null {
  const token = bearerToken(req);
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    // base64url → base64, then pad to a multiple of 4 for atob.
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function isAuthenticatedUser(req: Request): boolean {
  const claims = decodeClaims(req);
  // A signed-in user's access token carries role="authenticated" and a `sub`
  // (their user id). The anon key carries role="anon" and no subject.
  return claims?.role === 'authenticated' && typeof claims?.sub === 'string';
}

/**
 * The caller's own user id, or null if the request isn't from a signed-in
 * user. Only meaningful after isAuthenticatedUser() — a function that acts on
 * "whoever is calling" needs the subject, not just a yes/no.
 */
export function userIdFromRequest(req: Request): string | null {
  const claims = decodeClaims(req);
  if (claims?.role !== 'authenticated') return null;
  return typeof claims?.sub === 'string' ? claims.sub : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function envOrUndefined(key: string): string | undefined {
  // Deno in the edge runtime; absent under Jest, where deps are injected.
  const d = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(key);
}

/**
 * The caller's user id, as confirmed by Supabase Auth itself.
 *
 * Everything above trusts that the gateway already verified the JWT's
 * signature. That is false for a function deployed with --no-verify-jwt
 * (parent-consent): there, an unsigned token claiming any `sub` sails through
 * decodeClaims(). This asks the Auth server to validate the token instead —
 * it rejects anything not signed with the project's key, expired, or revoked
 * — and fails closed on any error. Use it wherever the gateway check is off.
 */
export async function verifiedUserId(
  req: Request,
  deps: { supabaseUrl?: string; anonKey?: string; fetchImpl?: typeof fetch } = {}
): Promise<string | null> {
  const token = bearerToken(req);
  const supabaseUrl = deps.supabaseUrl ?? envOrUndefined('SUPABASE_URL');
  const anonKey = deps.anonKey ?? envOrUndefined('SUPABASE_ANON_KEY');
  if (!token || !supabaseUrl || !anonKey) return null;

  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    // The id is later spliced into PostgREST URLs; accept only a real UUID.
    return typeof user?.id === 'string' && UUID.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}
