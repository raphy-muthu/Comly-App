/**
 * Stub for Expo native modules (expo-linking, expo-web-browser) so pure-logic
 * tests can import modules that reference them without pulling in the ESM
 * native runtime. Only the surface the tests touch needs to exist.
 */

module.exports = {
  createURL: (path) => `comly://${String(path).replace(/^\/+/, '')}`,
  parse: () => ({ queryParams: {} }),
  openAuthSessionAsync: async () => ({ type: 'cancel' }),
};
