/**
 * verifiedUserId() — the caller's identity as confirmed by Supabase Auth.
 *
 * parent-consent is deployed with --no-verify-jwt (a guardian's email link
 * carries no token), so the gateway never checks signatures there. Decoding
 * the JWT payload alone let anyone forge `sub` = any minor's id and approve
 * them. These tests pin that the id only comes from the Auth server's answer.
 */

import { verifiedUserId } from '../../supabase/functions/_shared/auth';

const REAL_ID = '0b6f8c1e-2d3a-4e5f-8a9b-1c2d3e4f5a6b';
const deps = (respond: (url: string, init: RequestInit) => Response) => {
  const calls: { url: string; init: RequestInit }[] = [];
  return {
    calls,
    opts: {
      supabaseUrl: 'https://proj.supabase.co',
      anonKey: 'anon-key',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return respond(url, init);
      }) as unknown as typeof fetch,
    },
  };
};

const req = (authorization?: string) =>
  ({
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? authorization ?? null : null) },
  }) as unknown as Request;

// An unsigned token whose payload claims to be REAL_ID — what decodeClaims()
// used to accept at face value.
const forged = `x.${Buffer.from(JSON.stringify({ sub: REAL_ID, role: 'authenticated' })).toString('base64url')}.x`;

describe('verifiedUserId', () => {
  it('returns null without a bearer token, without calling Auth', async () => {
    const d = deps(() => new Response('{}', { status: 200 }));
    expect(await verifiedUserId(req(), d.opts)).toBeNull();
    expect(d.calls).toHaveLength(0);
  });

  it('rejects a forged token that Supabase Auth does not accept', async () => {
    const d = deps(() => new Response('{"msg":"invalid JWT"}', { status: 401 }));
    expect(await verifiedUserId(req(`Bearer ${forged}`), d.opts)).toBeNull();
  });

  it('asks Supabase Auth to validate the exact token presented', async () => {
    const d = deps(() => new Response(JSON.stringify({ id: REAL_ID }), { status: 200 }));
    expect(await verifiedUserId(req('Bearer real.jwt.token'), d.opts)).toBe(REAL_ID);
    expect(d.calls[0].url).toBe('https://proj.supabase.co/auth/v1/user');
    const headers = d.calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer real.jwt.token');
    expect(headers.apikey).toBe('anon-key');
  });

  it('refuses an id that is not a UUID, so it can never be spliced into a query', async () => {
    const d = deps(() => new Response(JSON.stringify({ id: 'x&select=*' }), { status: 200 }));
    expect(await verifiedUserId(req('Bearer real.jwt.token'), d.opts)).toBeNull();
  });

  it('fails closed when the Auth server is unreachable', async () => {
    const d = deps(() => {
      throw new Error('network down');
    });
    expect(await verifiedUserId(req('Bearer real.jwt.token'), d.opts)).toBeNull();
  });
});
