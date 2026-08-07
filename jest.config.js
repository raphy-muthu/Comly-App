/**
 * Jest config for Comly's pure-logic unit tests (domain rules, formatters,
 * AI mock behavior, mock backend business rules).
 *
 * Deliberately NOT jest-expo: these tests avoid React Native imports entirely,
 * so they run in a plain node environment in ~1s. The babel transform is
 * inlined here (no babel.config.js) so Metro's default babel-preset-expo
 * pipeline for the app itself is unaffected.
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // env.ts imports expo-constants (a native module); stub it for node.
    '^expo-constants$': '<rootDir>/src/__tests__/stubs/expo-constants.js',
    // auth.ts imports these for the OAuth redirect flow; both ship as ESM and
    // need a native runtime, neither of which the node test env provides.
    '^expo-linking$': '<rootDir>/src/__tests__/stubs/expo-native.js',
    '^expo-web-browser$': '<rootDir>/src/__tests__/stubs/expo-native.js',
    // supabaseClient.ts imports secureStorage.ts, which imports this.
    '^expo-secure-store$': '<rootDir>/src/__tests__/stubs/expo-secure-store.js',
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
};
