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

export function isAuthenticatedUser(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    // base64url → base64, then pad to a multiple of 4 for atob.
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(atob(b64));
    // A signed-in user's access token carries role="authenticated" and a `sub`
    // (their user id). The anon key carries role="anon" and no subject.
    return claims?.role === 'authenticated' && typeof claims?.sub === 'string';
  } catch {
    return false;
  }
}
