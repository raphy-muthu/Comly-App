/**
 * Extends app.json with values that have to come from the environment.
 *
 * Android's Google Maps SDK reads its key from the native manifest
 * (com.google.android.geo.API_KEY), not from JavaScript, and throws a native
 * crash the moment a MapView renders without it. MapPreview decides whether to
 * render the live map from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, so the manifest
 * key is set from the same variable: the two can't disagree.
 *
 * The key must have "Maps SDK for Android" enabled in Google Cloud, or the
 * map renders as blank tiles (no crash). Restrict it to the package name
 * com.comly.app and the Play app-signing SHA-1.
 */
module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    android: {
      ...config.android,
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
  };
};
