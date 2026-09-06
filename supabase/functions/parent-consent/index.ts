// parent-consent
//
// Guardian approval for a minor, by emailed one-time link. The guardian never
// creates a Comly account — the token in the link is the credential.
//
//   POST  { parentEmail }            → sends the guardian an approval link
//   GET   ?token=<raw token>         → approves, returns an HTML page
//
// ─── DEPLOYMENT: this function must be deployed with --no-verify-jwt ─────────
//
//   supabase functions deploy parent-consent --no-verify-jwt
//
// The GET is followed by a guardian clicking a link in their email client.
// That is a plain browser navigation with no Authorization header, so the
// gateway's default JWT check would reject it before this code ever runs, and
// the entire flow would be dead on arrival.
//
// Turning the gateway check off does NOT make the POST side public: it calls
// isAuthenticatedUser() explicitly below, the same in-code check the AI
// functions already rely on rather than trusting the gateway (see
// _shared/auth.ts — the public anon key satisfies the gateway but is not a
// signed-in user). The GET is *intentionally* unauthenticated; possession of
// an unguessable, single-use, expiring token is the authorization.

import { corsHeaders, json } from '../_shared/cors.ts';
import { isAuthenticatedUser, userIdFromRequest } from '../_shared/auth.ts';

const TOKEN_TTL_DAYS = 7;

/** Hex sha256 — must match Postgres `encode(digest(token,'sha256'),'hex')`. */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 256 bits of CSPRNG, hex encoded. */
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#f7f7fb;color:#16141f;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;
        box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px -12px rgba(0,0,0,.12)}
  h1{font-size:20px;margin:0 0 12px}
  p{font-size:15px;line-height:1.55;color:#5a5666;margin:0}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** Minimal REST call against PostgREST/RPC using the service role. */
async function db(path: string, init: RequestInit): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server credentials are not configured');
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Guardian follows the emailed link ────────────────────────────────────
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    try {
      const res = await db('/rest/v1/rpc/approve_parent_consent', {
        method: 'POST',
        body: JSON.stringify({ p_token: token }),
      });
      const approved = res.ok && (await res.json()) === true;

      // One generic failure for unknown / used / expired — the RPC deliberately
      // does not distinguish them, and neither should this page.
      return approved
        ? page(
            'Approval confirmed',
            'Thank you. Your approval has been recorded, and the helper can now ' +
              'accept jobs that ask for guardian approval. You can close this page.'
          )
        : page(
            'This link is no longer valid',
            'It may have already been used, or it may have expired. Ask the ' +
              'helper to send a new request from their Comly profile.',
            400
          );
    } catch {
      return page(
        'Something went wrong',
        'We could not process this approval right now. Please try the link again shortly.',
        500
      );
    }
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Minor requests approval ──────────────────────────────────────────────
  if (!isAuthenticatedUser(req)) {
    return json({ error: 'Sign in required' }, 401);
  }
  const userId = userIdFromRequest(req);
  if (!userId) return json({ error: 'Sign in required' }, 401);

  try {
    const { parentEmail } = await req.json();
    const email = typeof parentEmail === 'string' ? parentEmail.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Enter a valid email address for your parent or guardian.' }, 400);
    }

    // Only a minor needs guardian approval, and the bracket is server-derived
    // (migration 0013), so this cannot be spoofed by the caller.
    const profRes = await db(
      `/rest/v1/profiles?id=eq.${userId}&select=name,age_bracket,age_group`,
      { method: 'GET' }
    );
    const [profile] = await profRes.json();
    if (!profile) return json({ error: 'Profile not found' }, 404);

    // Mirrors effectiveAgeBracket() in src/types/domain.ts. age_bracket is null
    // on accounts created before 0013 added it, and a legacy adult must resolve
    // to 'adult' here for the same reason it does everywhere else — otherwise
    // an adult on an old account can send themselves a guardian request.
    const bracket =
      profile.age_bracket ?? (profile.age_group === 'adult' ? 'adult' : 'under_14');
    if (bracket === 'adult') {
      return json({ error: 'Guardian approval is only needed for helpers under 18.' }, 400);
    }

    const token = newToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();

    // Goes through the RPC rather than a direct insert: creating a request
    // also moves profiles.parent_approval_status to 'pending' (a pinned column
    // needing the privileged-write flag), revokes any older pending request so
    // only the newest link stays live, and enforces the send cooldown.
    const insertRes = await db('/rest/v1/rpc/create_parent_consent_request', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: userId,
        p_parent_email: email,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
      }),
    });
    if (!insertRes.ok) {
      // The cooldown raises check_violation; surface that as its own message
      // rather than a generic failure, since it's the one case the user can
      // simply resolve by waiting.
      const detail = await insertRes.text();
      if (detail.includes('before sending another approval request')) {
        return json(
          { error: 'Please wait a moment before sending another approval request.' },
          429
        );
      }
      return json({ error: 'Could not create the approval request.' }, 500);
    }

    // ── Send it ──────────────────────────────────────────────────────────
    // Nothing in this project sent email before this function. Without the
    // key the request row exists but no mail goes out, so this reports a
    // real failure rather than a success the guardian never receives.
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromAddress = Deno.env.get('CONSENT_FROM_EMAIL') ?? 'Comly <onboarding@resend.dev>';
    if (!resendKey) {
      return json(
        { error: 'Email delivery is not configured yet, so the approval request could not be sent.' },
        503
      );
    }

    const link = `${Deno.env.get('SUPABASE_URL')}/functions/v1/parent-consent?token=${token}`;
    const helperName = typeof profile.name === 'string' && profile.name ? profile.name : 'A helper';

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: `${helperName} is asking for your approval on Comly`,
        html:
          `<p><strong>${helperName}</strong> has listed you as their parent or guardian on Comly, ` +
          `a neighborhood app where teens do small local jobs like yard work and pet sitting.</p>` +
          `<p>Approving lets them accept jobs that specifically ask for guardian approval. ` +
          `Jobs marked 18+ stay unavailable to them either way.</p>` +
          `<p><a href="${link}">Approve ${helperName}</a></p>` +
          `<p style="color:#666;font-size:13px">This link works once and expires in ${TOKEN_TTL_DAYS} days. ` +
          `If you weren't expecting this, you can ignore it — nothing changes unless you follow the link.</p>`,
      }),
    });

    if (!mailRes.ok) {
      return json({ error: 'Could not send the approval email. Please try again.' }, 502);
    }

    return json({ ok: true, sentTo: email, expiresAt });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
