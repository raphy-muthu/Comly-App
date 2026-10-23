/**
 * hasAiConsent() — the edge functions' check that the caller allowed AI
 * processing (guideline 5.1.2(i)). It must fail closed: only an explicit
 * granted = true row lets a Gemini call through.
 */

import { hasAiConsent as check } from '../../supabase/functions/_shared/aiConsent';
import { bearerToken, userIdFromRequest } from '../../supabase/functions/_shared/auth';

// The same call the edge functions make.
const hasAiConsent = (r: Request, opts: Parameters<typeof check>[2]) =>
  check(userIdFromRequest(r), bearerToken(r), opts);

const USER = '0b6f8c1e-2d3a-4e5f-8a9b-1c2d3e4f5a6b';

// A token whose payload is { role, sub }; signatures are verified upstream.
const token = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

const req = (authorization?: string) =>
  ({
    headers: {
      get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null),
    },
  }) as unknown as Request;

function deps(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  return {
    calls,
    opts: {
      supabaseUrl: 'https://proj.supabase.co',
      anonKey: 'anon-key',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return respond();
      }) as unknown as typeof fetch,
    },
  };
}

const signedIn = () => `Bearer ${token({ role: 'authenticated', sub: USER })}`;
const rows = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('hasAiConsent', () => {
  it('allows a caller who granted permission, looking up only their row with their token', async () => {
    const d = deps(() => rows([{ granted: true }]));
    await expect(hasAiConsent(req(signedIn()), d.opts)).resolves.toBe(true);
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0].url).toContain(`user_id=eq.${USER}`);
    expect((d.calls[0].init.headers as Record<string, string>).Authorization).toBe(signedIn());
  });

  it('refuses a caller who said no', async () => {
    const d = deps(() => rows([{ granted: false }]));
    await expect(hasAiConsent(req(signedIn()), d.opts)).resolves.toBe(false);
  });

  it('refuses a caller who was never asked', async () => {
    const d = deps(() => rows([]));
    await expect(hasAiConsent(req(signedIn()), d.opts)).resolves.toBe(false);
  });

  it('fails closed when the lookup errors', async () => {
    await expect(hasAiConsent(req(signedIn()), deps(() => rows({}, 500)).opts)).resolves.toBe(false);
    await expect(
      hasAiConsent(req(signedIn()), deps(() => Promise.reject(new Error('network'))).opts)
    ).resolves.toBe(false);
  });

  it('never looks anything up for an anonymous caller', async () => {
    const d = deps(() => rows([{ granted: true }]));
    await expect(
      hasAiConsent(req(`Bearer ${token({ role: 'anon' })}`), d.opts)
    ).resolves.toBe(false);
    await expect(hasAiConsent(req(), d.opts)).resolves.toBe(false);
    expect(d.calls).toHaveLength(0);
  });
});
