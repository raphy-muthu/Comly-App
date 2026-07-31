/**
 * Screen — safe-area-aware page wrapper with the app background.
 * Use `scroll` for content that overflows; pass `edges` to control which safe
 * area insets are applied (e.g. omit 'bottom' when a tab bar is present).
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
  edges = ['top', 'left', 'right'],
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
