// delete-account
//
// Deletes the calling user's account. Required by App Store Review Guideline
// 5.1.1(v): an app that lets you create an account must let you delete it from
// inside the app, not by emailing support.
//
//   POST  (no body)  → deletes the caller's account, returns { ok: true }
//
// Only ever acts on the caller. There is no user id in the request body on
// purpose — the id comes from the verified JWT, so this endpoint cannot be
// pointed at somebody else's account no matter what is sent to it.
//
// Order matters. Storage objects are removed first, because once the auth user
// is gone we no longer have a reliable handle on which files were theirs. The
// auth user is deleted last, and the existing foreign keys cascade from there
// (see migration 0022 for the two that were changed to `set null` so that
// other people's reviews and no-show records survive).

import { corsHeaders, json } from '../_shared/cors.ts';
import { isAuthenticatedUser, userIdFromRequest } from '../_shared/auth.ts';

const AVATAR_BUCKET = 'avatars';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function admin(path: string, init: RequestInit): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Remove the caller's avatar files. Best effort: a leftover image is a storage
 * cost, not a privacy breach of the kind that should abort the deletion the
 * user asked for. Failures are reported in the response rather than thrown.
 */
async function removeAvatars(userId: string): Promise<string | null> {
  try {
    const listRes = await admin(`/storage/v1/object/list/${AVATAR_BUCKET}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: `${userId}/`, limit: 100 }),
    });
    if (!listRes.ok) return `list failed (${listRes.status})`;

    const objects = (await listRes.json()) as Array<{ name?: string }>;
    if (!Array.isArray(objects) || objects.length === 0) return null;

    // The list endpoint returns names relative to the prefix.
    const paths = objects
      .map((o) => o?.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
      .map((n) => `${userId}/${n}`);
    if (paths.length === 0) return null;

    const delRes = await admin(`/storage/v1/object/${AVATAR_BUCKET}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: paths }),
    });
    return delRes.ok ? null : `delete failed (${delRes.status})`;
  } catch (err) {
    return `storage error: ${String(err)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Same in-code check the other functions use rather than trusting the
  // gateway: the public anon key satisfies the gateway but is not a signed-in
  // user, and this endpoint destroys data.
  if (!isAuthenticatedUser(req)) return json({ error: 'Sign in required' }, 401);

  const userId = userIdFromRequest(req);
  if (!userId) return json({ error: 'Sign in required' }, 401);

  try {
    const storageWarning = await removeAvatars(userId);

    const delRes = await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    if (!delRes.ok) {
      const detail = await delRes.text();
      console.error(`account deletion failed for ${userId}: ${delRes.status} ${detail}`);
      return json({ error: 'Could not delete the account. Please try again.' }, 502);
    }

    return json({ ok: true, storageWarning });
  } catch (err) {
    console.error(`account deletion error for ${userId}: ${String(err)}`);
    return json({ error: 'Could not delete the account. Please try again.' }, 500);
  }
});
