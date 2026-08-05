/**
 * Root navigator — picks the public (signed-out) flow or the authenticated app.
 *
 * On launch it restores any existing Supabase session before deciding, so a
 * returning user isn't bounced to the login screen while their stored tokens
 * are still valid.
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';
import { PublicStack } from './PublicStack';
import { AppStack } from './AppStack';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.textPrimary,
    primary: colors.primary,
    border: colors.divider,
  },
};

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Rendering PublicStack first and swapping once the session resolves would
  // flash the welcome screen at every returning user.
  if (isBootstrapping) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppStack /> : <PublicStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
