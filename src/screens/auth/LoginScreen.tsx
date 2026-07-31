/**
 * Log In — email/password plus social options. Mock mode signs in the demo user.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing } from '@/theme';
import { Button, IconButton, Input, Screen, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { OAuthProvider, signInWithProvider } from '@/services/auth';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const toast = useToast();

  const authenticate = () => {
    completeOnboarding();
    signIn();
  };

  const oauth = async (provider: OAuthProvider) => {
    setOauthPending(provider);
    const result = await signInWithProvider(provider);
    setOauthPending(null);
    if (result.ok) authenticate();
    else toast.error(result.message);
  };

  return (
    <Screen scroll>
      <IconButton
        icon="arrow-back"
        onPress={() => navigation.goBack()}
        style={styles.back}
      />

      <Text variant="headlineLgMobile" style={styles.title}>
        Welcome back
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
        Log in to pick up where you left off.
      </Text>

      <Input
        label="Email"
        placeholder="you@neighborhood.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        containerStyle={styles.input}
      />
      <Input
        label="Password"
        placeholder="Your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        containerStyle={styles.input}
      />

      <Pressable
        hitSlop={8}
        style={styles.forgot}
        onPress={() =>
          toast.info(
            'Demo mode: any email and password work. Password reset arrives with live accounts.'
          )
        }
      >
        <Text variant="labelMd" color="textLink">
          Forgot password?
        </Text>
      </Pressable>

      <Button title="Log In" onPress={authenticate} style={styles.cta} />

      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text variant="caption" color="outline" style={styles.orText}>
          OR
        </Text>
        <View style={styles.line} />
      </View>

      <Button
        title="Continue with Google"
        variant="secondary"
        icon="logo-google"
        onPress={() => oauth('google')}
        loading={oauthPending === 'google'}
        disabled={oauthPending !== null}
        style={styles.social}
      />
      <Button
        title="Continue with Apple"
        variant="secondary"
        icon="logo-apple"
        onPress={() => oauth('apple')}
        loading={oauthPending === 'apple'}
        disabled={oauthPending !== null}
      />

      <Pressable
        onPress={() => navigation.navigate('SignUp')}
        style={styles.signupRow}
        hitSlop={8}
      >
        <Text variant="bodyMd" color="textSecondary">
          New to Comly?{' '}
          <Text variant="bodyMd" color="primary">
            Create an account
          </Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -8, marginTop: spacing.base },
  title: { marginTop: spacing.md },
  subtitle: { marginBottom: spacing.md },
  input: { marginBottom: spacing.sm },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.md },
  cta: { marginTop: spacing.base },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  orText: { width: 24, textAlign: 'center' },
  social: { marginBottom: spacing.sm },
  signupRow: { alignSelf: 'center', marginTop: spacing.md },
});
