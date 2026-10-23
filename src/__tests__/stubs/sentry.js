/**
 * Stub for @sentry/react-native, which needs the native runtime. The data
 * layer only reports missed writes through captureException.
 */

module.exports = {
  captureException: () => undefined,
};
