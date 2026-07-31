/**
 * Splash — brand gradient with the Comly mark and tagline. Auto-advances to the
 * welcome carousel after a short beat (also tappable to skip the wait).
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, gradients, radius, spacing } from '@/theme';
import { BrandLogo, Text } from '@/components/ui';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Welcome'), 1900);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <Pressable style={styles.flex} onPress={() => navigation.replace('Welcome')}>
      <LinearGradient
        colors={gradients.brandDeep}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.flex}
      >
        <View style={styles.center}>
          <BrandLogo size={104} style={styles.logoMark} />
          <Text variant="displayLg" color="onPrimary" style={styles.brand}>
            Comly
          </Text>
          <Text variant="bodyLg" style={styles.tagline}>
            Local help. Trusted neighbors.
          </Text>
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoMark: { marginBottom: spacing.lg },
  brand: { marginBottom: spacing.sm },
  tagline: { color: 'rgba(255,255,255,0.9)' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: colors.white, width: 24 },
});
