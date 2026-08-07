/**
 * Encrypted session storage adapter for Supabase Auth.
 *
 * `expo-secure-store` backs each key with the device's hardware Keychain
 * (iOS) / Keystore (Android) instead of a plain unencrypted file, which is
 * what @react-native-async-storage/async-storage uses — the difference that
 * matters if a device is ever lost, stolen, or jailbroken/rooted.
 *
 * SecureStore caps each value at 2048 bytes. A Supabase session (access
 * token + refresh token + the full user object, including whatever we send
 * as signup metadata — name, neighborhood, roles, age_group) regularly
 * exceeds that, so values are split across numbered chunk keys rather than
 * assuming they'll fit.
 */

import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800; // headroom under the 2048-byte limit for multi-byte chars
const countKey = (key: string) => `${key}__chunks`;
const chunkKey = (key: string, i: number) => `${key}__${i}`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw === null) return null;

    const count = Number(countRaw);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // corrupted/partial write — treat as missing
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any previous (possibly larger) chunk set before writing new ones,
    // so a shrinking value doesn't leave stale trailing chunks behind.
    await secureStorage.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk))
    );
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    const count = countRaw ? Number(countRaw) : 0;
    await Promise.all([
      ...Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(chunkKey(key, i))
      ),
      SecureStore.deleteItemAsync(countKey(key)),
    ]);
  },
};
