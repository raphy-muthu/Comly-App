/**
 * Welcome carousel — three swipeable slides introducing the marketplace, with a
 * persistent "Get Started / Log In" footer and a "Free to use, always" note.
 *
 * Illustrations are placeholders (tinted icon panels) per the project brief.
 */

import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { Button, Text } from '@/components/ui';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'Welcome'>;

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'people-outline',
    title: 'Find trusted local help',
    body: 'Post small jobs and connect with nearby neighbors.',
  },
  {
    icon: 'cash-outline',
    title: 'Earn money locally',
    body: 'Help neighbors with tasks and build your reputation.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Safe by design',
    body: 'Verified profiles and honest reviews keep your community trusted.',
  },
];

export function WelcomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.skipRow}>
        <Pressable hitSlop={8} onPress={() => navigation.navigate('SignUp')}>
          <Text variant="bodyMd" color="textSecondary">
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.illustration}>
              <Ionicons
                name={slide.icon}
                size={96}
                color={colors.primaryContainer}
              />
            </View>
            <Text variant="headlineLgMobile" color="primary" center style={styles.title}>
              {slide.title}
            </Text>
            <Text variant="bodyLg" color="textSecondary" center>
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color="textSecondary" center style={styles.freeNote}>
          Free to use, always
        </Text>
        <Button title="Get Started" onPress={() => navigation.navigate('SignUp')} />
        <Pressable
          hitSlop={8}
          onPress={() => navigation.navigate('Login')}
          style={styles.login}
        >
          <Text variant="labelMd" color="primary">
            Log In
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.base,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  illustration: {
    width: '100%',
    height: 240,
    borderRadius: radius.xl,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
  },
  dotActive: { backgroundColor: colors.primaryContainer, width: 24 },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.md,
  },
  freeNote: { marginBottom: spacing.sm },
  login: { alignSelf: 'center', paddingVertical: spacing.sm },
});
