/**
 * Chunked SecureStore adapter.
 *
 * SecureStore caps each value at ~2KB; Supabase session blobs (access token +
 * refresh token + full user object) regularly exceed that, so values are
 * split across numbered keys. A bug here doesn't throw — it silently
 * corrupts or drops a user's session, so the round-trip and edge cases are
 * worth pinning explicitly.
 */

import { secureStorage } from '@/lib/secureStorage';

describe('secureStorage', () => {
  const key = 'sb-test-project-auth-token';

  afterEach(async () => {
    await secureStorage.removeItem(key);
  });

  it('returns null for a key that was never set', async () => {
    expect(await secureStorage.getItem('never-written')).toBeNull();
  });

  it('round-trips a value smaller than one chunk', async () => {
    await secureStorage.setItem(key, 'short-value');
    expect(await secureStorage.getItem(key)).toBe('short-value');
  });

  it('round-trips a value spanning multiple chunks', async () => {
    // Comfortably larger than the adapter's per-chunk size.
    const big = 'x'.repeat(5000) + 'END';
    await secureStorage.setItem(key, big);
    expect(await secureStorage.getItem(key)).toBe(big);
  });

  it('round-trips a realistic Supabase session payload', async () => {
    const session = JSON.stringify({
      access_token: 'eyJ' + 'a'.repeat(800),
      refresh_token: 'v1.' + 'b'.repeat(200),
      user: {
        id: 'e0d1c1f1-1bc4-416b-b4c1-3c580e533b0b',
        email: 'user@example.com',
        user_metadata: {
          name: 'Test User',
          neighborhood: 'Bryn Mawr',
          roles: ['customer'],
          age_group: 'adult',
        },
      },
    });
    await secureStorage.setItem(key, session);
    expect(await secureStorage.getItem(key)).toBe(session);
  });

  it('removes all chunks so nothing is left behind', async () => {
    await secureStorage.setItem(key, 'x'.repeat(5000));
    await secureStorage.removeItem(key);
    expect(await secureStorage.getItem(key)).toBeNull();
  });

  it('does not leak stale trailing chunks when a value shrinks', async () => {
    await secureStorage.setItem(key, 'x'.repeat(5000));
    await secureStorage.setItem(key, 'short');
    expect(await secureStorage.getItem(key)).toBe('short');
  });

  it('removeItem on a never-set key does not throw', async () => {
    await expect(secureStorage.removeItem('untouched-key')).resolves.toBeUndefined();
  });
});
