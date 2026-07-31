/**
 * Sign Up — role selection ("I need help" / "I want to help"), email signup,
 * and social/phone options. In mock mode any submit signs in the demo user with
 * the chosen starting role (which can be switched later from the profile).
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button, Card, Input, Screen, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { OAuthProvider, signInWithProvider } from '@/services/auth';
import { Role } from '@/types/domain';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'SignUp'>;

const ROLE_OPTIONS: {
  role: Role;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { role: 'customer', label: 'I need help', icon: 'hand-left-outline' },
  { role: 'helper', label: 'I want to help', icon: 'construct-outline' },
];

export function SignUpScreen({ navigation }: Props) {
  const [role, setRole] = useState<Role>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const toast = useToast();

  const authenticate = () => {
    completeOnboarding();
    signIn();
    setActiveRole(role);
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
      <Text variant="headlineLgMobile" style={styles.title}>
        Create your account
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
        Join your neighborhood in a minute.
      </Text>

      <Text variant="labelMd" color="textSecondary" style={styles.sectionLabel}>
        I'M HERE TO…
      </Text>
      <View style={styles.roles}>
        {ROLE_OPTIONS.map((opt) => {
          const selected = role === opt.role;
          return (
            <Pressable
              key={opt.role}
              style={styles.roleWrap}
              onPress={() => setRole(opt.role)}
            >
              <Card
                style={StyleSheet.flatten([
                  styles.roleCard,
                  selected && styles.roleCardSelected,
                ])}
                padded
                elevation={selected ? 'floating' : 'card'}
              >
                <Ionicons
                  name={opt.icon}
                  size={28}
                  color={selected ? colors.primary : colors.outline}
                />
                <Text
                  variant="labelMd"
                  color={selected ? 'primary' : 'textSecondary'}
                  style={styles.roleLabel}
                >
                  {opt.label}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

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
        placeholder="Create a password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        containerStyle={styles.input}
      />

      <Button title="Create Account" onPress={authenticate} style={styles.cta} />

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
        style={styles.social}
      />
      <Button
        title="Continue with Phone"
        variant="ghost"
        icon="call-outline"
        onPress={() => navigation.navigate('PhoneVerify')}
      />

      <Pressable
        onPress={() => navigation.navigate('Login')}
        style={styles.loginRow}
        hitSlop={8}
      >
        <Text variant="bodyMd" color="textSecondary">
          Already have an account?{' '}
          <Text variant="bodyMd" color="primary">
            Log In
          </Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.md },
  subtitle: { marginBottom: spacing.md },
  sectionLabel: { marginBottom: spacing.sm },
  roles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleWrap: { flex: 1 },
  roleCard: { alignItems: 'center', gap: spacing.sm },
  roleCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.successSoft,
  },
  roleLabel: { textAlign: 'center' },
  input: { marginBottom: spacing.sm },
  cta: { marginTop: spacing.base },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  orText: { width: 24, textAlign: 'center' },
  social: { marginBottom: spacing.sm },
  loginRow: { alignSelf: 'center', marginTop: spacing.md },
});
