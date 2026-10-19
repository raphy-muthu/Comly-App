/**
 * Screen — safe-area-aware page wrapper with the app background.
 * Use `scroll` for content that overflows; pass `edges` to control which safe
 * area insets are applied. All four edges by default.
 */

import { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
  background?: keyof typeof colors;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  // 'bottom' included: on Android the app draws behind the navigation bar
  // (edge-to-edge), so a stack screen's last content could sit under it. The
  // native SafeAreaView only pads where the view actually overlaps a system
  // inset, so screens above the tab bar get nothing extra.
  edges = ['top', 'left', 'right', 'bottom'],
  style,
  contentContainerStyle,
  scrollProps,
  background = 'background',
}: ScreenProps) {
  const bg = { backgroundColor: colors[background] };

  return (
    <SafeAreaView style={[styles.safe, bg, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            padded && styles.padded,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padded && styles.padded, contentContainerStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
});
