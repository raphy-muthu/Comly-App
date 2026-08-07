/**
 * Log In — email/password against Supabase Auth, plus social sign-in.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing } from '@/theme';
import { Button, IconButton, Input, Screen, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  OAuthProvider,
  sendPasswordReset,
  signInWithProvider,
} from '@/services/auth';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const toast = useToast();

  const busy = submitting || oauthPending !== null;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  // Every handler below resets its pending flag in `finally`. Without it an
  // unexpected rejection leaves the button spinning forever with no way back.
  const authenticate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      // On success the root navigator swaps to the app stack on its own —
      // there is nothing to navigate to here.
      if (!result.ok) toast.error(result.message);
    } catch (err) {
      console.warn('[Comly] Sign-in failed:', err);
      toast.error('Something went wrong signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const oauth = async (provider: OAuthProvider) => {
    setOauthPending(provider);
    try {
      const result = await signInWithProvider(provider);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // The browser flow established a session; load the profile behind it.
      const adopted = await adoptSession();
      if (!adopted.ok) toast.error(adopted.message);
    } catch (err) {
      console.warn('[Comly] OAuth sign-in failed:', err);
      toast.error('Something went wrong signing in. Please try again.');
    } finally {
      setOauthPending(null);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      toast.info('Enter your email address first, then tap “Forgot password?”.');
      return;
    }
    try {
      const result = await sendPasswordReset(email);
      if (result.ok) {
        toast.success('Password reset link sent — check your inbox.');
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      console.warn('[Comly] Password reset failed:', err);
      toast.error('Could not send the reset link. Please try again.');
    }
  };

  return (
    <Screen scroll>
      <IconButton
        icon="arrow-back"
        // After any sign-out, PublicStack remounts with Login as its root
        // screen (hasOnboarded stays true, so Splash/Welcome are skipped) —
        // there is nothing to pop to. Falling back to Welcome keeps the
        // button meaning "leave this screen" instead of silently doing
        // nothing.
        onPress={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome')
        }
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
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        containerStyle={styles.input}
      />
      <Input
        label="Password"
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        onSubmitEditing={authenticate}
        returnKeyType="go"
        containerStyle={styles.input}
      />

      <Pressable hitSlop={8} style={styles.forgot} onPress={forgotPassword}>
        <Text variant="labelMd" color="textLink">
          Forgot password?
        </Text>
      </Pressable>

      <Button
        title="Log In"
        onPress={authenticate}
        loading={submitting}
        disabled={!canSubmit}
        style={styles.cta}
      />

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
        disabled={busy}
        style={styles.social}
      />
      <Button
        title="Continue with Apple"
        variant="secondary"
        icon="logo-apple"
        onPress={() => oauth('apple')}
        loading={oauthPending === 'apple'}
        disabled={busy}
      />

      <Pressable
        onPress={() => navigation.navigate('SignUp')}
        style={styles.signupRow}
        hitSlop={8}
        disabled={busy}
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
