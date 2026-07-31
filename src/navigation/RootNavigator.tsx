/**
 * Root navigator — picks the public (signed-out) flow or the authenticated app.
 */

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

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppStack /> : <PublicStack />}
    </NavigationContainer>
  );
}
