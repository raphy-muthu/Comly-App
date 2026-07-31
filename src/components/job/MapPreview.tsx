/**
 * MapPreview — approximate job location on a real map.
 *
 * Cross-platform notes:
 *  • iOS renders via Apple Maps (no key needed). Android's Google provider
 *    needs an API key or tiles are blank — so on Android we only render the
 *    live map when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 *  • The live map is wrapped in an ErrorBoundary: if the react-native-maps
 *    native module isn't present in the running client, we degrade to the
 *    styled fallback instead of crashing the Job Detail screen.
 *
 * Privacy: renders a coarse circle around offset coordinates, never an exact
 * pin.
 */

import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { ErrorBoundary, Text } from '@/components/ui';
import { env } from '@/config/env';

export interface MapPreviewProps {
  lat: number;
  lng: number;
  neighborhood: string;
}

function LiveMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapView
      style={styles.map}
      // Non-interactive preview; details stay coarse until acceptance.
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      pointerEvents="none"
      initialRegion={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
    >
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={420}
        strokeColor="rgba(0,109,68,0.6)"
        fillColor="rgba(0,109,68,0.15)"
      />
    </MapView>
  );
}

function Fallback({ neighborhood }: { neighborhood: string }) {
  const role = useRoleTheme();
  return (
    <View style={styles.fallback}>
      <Ionicons name="location" size={28} color={role.accent} />
      <Text variant="caption" color="textSecondary" style={styles.fallbackText}>
        {neighborhood} area
      </Text>
    </View>
  );
}

export function MapPreview({ lat, lng, neighborhood }: MapPreviewProps) {
  const hasCoords = lat !== 0 && lng !== 0;
  // Android needs a Google Maps key; iOS (Apple Maps) does not.
  const mapAvailable = Platform.OS === 'ios' || !!env.googleMapsApiKey;
  const showMap = hasCoords && mapAvailable;

  return (
    <View style={styles.wrap}>
      {showMap ? (
        <ErrorBoundary fallback={<Fallback neighborhood={neighborhood} />}>
          <LiveMap lat={lat} lng={lng} />
        </ErrorBoundary>
      ) : (
        <Fallback neighborhood={neighborhood} />
      )}

      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary" style={styles.badgeText}>
          Exact address hidden until accepted
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 140,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.base,
  },
  badgeText: { marginLeft: 4 },
});
