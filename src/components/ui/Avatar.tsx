/**
 * Avatar — circular profile image with an initials fallback.
 * Placeholder-friendly: when no URL is provided we render initials on a tinted
 * circle so the UI looks complete without real assets.
 *
 * Hidden from screen readers: every avatar in the app sits beside the
 * person's name, so announcing it would only add "image" or a stray pair of
 * initials ("A R") before the name VoiceOver is about to read anyway.
 */

import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { radius } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { Text } from './Text';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

const DECORATIVE = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  const role = useRoleTheme();
  const dimension = { width: size, height: size, borderRadius: radius.full };

  if (uri) {
    return (
      <Image
        {...DECORATIVE}
        source={{ uri }}
        style={dimension}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View {...DECORATIVE} style={[styles.fallback, dimension, { backgroundColor: role.accentSoft }]}>
      <Text
        variant="labelMd"
        style={{
          color: role.accent,
          fontSize: size * 0.38,
          // lineHeight must track the overridden fontSize or glyphs clip
          lineHeight: size * 0.46,
          textAlign: 'center',
          textTransform: 'uppercase',
          includeFontPadding: false,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
