import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';

import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary, ToastProvider } from '@/components/ui';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Keep the native splash up until fonts are ready; avoids a flash of the
  // system font on first paint. If loading *fails* (offline first launch, CDN
  // hiccup) we must still render — gating on `fontsLoaded` alone would leave
  // the user staring at a permanently blank screen. System fonts are a fine
  // fallback; a missing typeface is not worth a dead app.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ErrorBoundary>
              <StatusBar style="dark" />
              <RootNavigator />
            </ErrorBoundary>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
