/**
 * Stub for expo-secure-store so pure-logic tests can import modules that
 * reference it (via lib/secureStorage.ts) without the native Keychain/
 * Keystore runtime. In-memory map is enough — no test exercises persistence
 * across process boundaries.
 */

const store = new Map();

module.exports = {
  getItemAsync: async (key) => (store.has(key) ? store.get(key) : null),
  setItemAsync: async (key, value) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key) => {
    store.delete(key);
  },
};
