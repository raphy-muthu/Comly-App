/**
 * Public stack shown when signed out: splash + onboarding carousel + auth.
 * Returning users (already onboarded) skip the splash and land on Login.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';
import { PublicStackParamList } from './types';
import { SplashScreen } from '@/screens/onboarding/SplashScreen';
import { WelcomeScreen } from '@/screens/onboarding/WelcomeScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { PhoneVerifyScreen } from '@/screens/auth/PhoneVerifyScreen';

const Stack = createNativeStackNavigator<PublicStackParamList>();

export function PublicStack() {
  const hasOnboarded = useAuthStore((s) => s.hasOnboarded);

  return (
    <Stack.Navigator
      initialRouteName={hasOnboarded ? 'Login' : 'Splash'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PhoneVerify" component={PhoneVerifyScreen} />
    </Stack.Navigator>
  );
}
