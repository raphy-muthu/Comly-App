/**
 * Root navigator — picks the public (signed-out) flow or the authenticated app.
 *
 * On launch it restores any existing Supabase session before deciding, so a
 * returning user isn't bounced to the login screen while their stored tokens
 * are still valid.
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer, DefaultTheme, LinkingOptions } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';
import { PublicStack } from './PublicStack';
import { AppStack } from './AppStack';
import { LEGAL_ORIGIN } from '@/legal/content';
import { ReConsentGate } from '@/components/legal/ReConsentGate';

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

/**
 * URL mapping for the legal pages.
 *
 * These are the only routes that need stable, quotable URLs: the App Store and
 * Play Console listings point at them, and the sign-up consent line links to
 * them. Both screens are registered in BOTH stacks, so /terms resolves whether
 * or not anyone is signed in — a signed-out visitor following the link from a
 * store listing must land on the document, not on the login wall.
 *
 * `comly://terms` works as a deep link on device; the same paths are the real
 * browser URLs under Expo web. The hosted static copies under web/legal/ cover
 * the case where the web build isn't deployed.
 */
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [Linking.createURL('/'), LEGAL_ORIGIN],
  config: {
    screens: {
      Terms: 'terms',
      Privacy: 'privacy',
    },
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
    <NavigationContainer theme={navTheme} linking={linking}>
      {isAuthenticated ? <AppStack /> : <PublicStack />}
      {/* Inside the container so the gate can link to the Terms and Privacy
          screens, and above the stack so it covers whichever screen the user
          happens to be on. Renders nothing when consent is already current. */}
      {isAuthenticated && <ReConsentGate />}
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
