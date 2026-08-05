/**
 * Sign Up — creates a real Supabase Auth account.
 *
 * Role and age group are captured here because both are server-owned
 * afterwards: migration 0005 pins `age_group` so it can't be edited later
 * (it gates which safety tiers a helper may apply to), and the signup
 * metadata is what the handle_new_user trigger uses to provision the
 * profile row.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button, Card, Input, Screen, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { OAuthProvider, signInWithProvider } from '@/services/auth';
import { AgeGroup, Role } from '@/types/domain';
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

const AGE_OPTIONS: { value: AgeGroup; label: string; hint: string }[] = [
  { value: 'teen', label: 'Under 18', hint: 'Extra safety protections apply' },
  { value: 'adult', label: '18 or older', hint: '' },
];

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpScreen({ navigation }: Props) {
  const [role, setRole] = useState<Role>('customer');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);
  const [touched, setTouched] = useState(false);

  const signUp = useAuthStore((s) => s.signUp);
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const toast = useToast();

  const busy = submitting || oauthPending !== null;

  const emailError =
    touched && email.trim() && !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : undefined;
  const passwordError =
    touched && password && password.length < MIN_PASSWORD
      ? `At least ${MIN_PASSWORD} characters.`
      : undefined;

  const complete =
    name.trim().length > 1 &&
    neighborhood.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= MIN_PASSWORD &&
    ageGroup !== null;

  const authenticate = async () => {
    setTouched(true);
    if (!complete || busy) {
      if (!ageGroup) toast.info('Please tell us your age group to continue.');
      return;
    }

    setSubmitting(true);
    const result = await signUp({
      email,
      password,
      name,
      neighborhood,
      role,
      ageGroup: ageGroup as AgeGroup,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (result.needsEmailConfirmation) {
      toast.success('Account created — check your email to confirm, then log in.');
      navigation.navigate('Login');
    }
    // Otherwise the session is live and the root navigator swaps stacks.
  };

  const oauth = async (provider: OAuthProvider) => {
    setOauthPending(provider);
    const result = await signInWithProvider(provider);
    if (!result.ok) {
      setOauthPending(null);
      toast.error(result.message);
      return;
    }
    const adopted = await adoptSession();
    setOauthPending(null);
    if (!adopted.ok) toast.error(adopted.message);
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
              disabled={busy}
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

      <Text variant="labelMd" color="textSecondary" style={styles.sectionLabel}>
        MY AGE GROUP
      </Text>
      <View style={styles.roles}>
        {AGE_OPTIONS.map((opt) => {
          const selected = ageGroup === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={styles.roleWrap}
              onPress={() => setAgeGroup(opt.value)}
              disabled={busy}
            >
              <Card
                style={StyleSheet.flatten([
                  styles.ageCard,
                  selected && styles.roleCardSelected,
                ])}
                padded
              >
                <Text
                  variant="bodyLg"
                  color={selected ? 'primary' : 'textPrimary'}
                  style={styles.roleLabel}
                >
                  {opt.label}
                </Text>
                {!!opt.hint && (
                  <Text variant="caption" color="textSecondary" center>
                    {opt.hint}
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" color="textSecondary" style={styles.ageNote}>
        This can't be changed later — it determines which jobs are safe to show
        you. Helpers under 18 need a parent or guardian's approval for some
        tasks.
      </Text>

      <Input
        label="Full name"
        placeholder="Alex Rivera"
        autoComplete="name"
        textContentType="name"
        value={name}
        onChangeText={setName}
        editable={!busy}
        containerStyle={styles.input}
      />
      <Input
        label="Neighborhood"
        placeholder="e.g. Bryn Mawr"
        icon="location-outline"
        value={neighborhood}
        onChangeText={setNeighborhood}
        editable={!busy}
        hint="Used to show jobs near you. Your exact address is never shown."
        containerStyle={styles.input}
      />
      <Input
        label="Email"
        placeholder="you@neighborhood.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        onBlur={() => setTouched(true)}
        error={emailError}
        editable={!busy}
        containerStyle={styles.input}
      />
      <Input
        label="Password"
        placeholder="Create a password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        onBlur={() => setTouched(true)}
        error={passwordError}
        hint={passwordError ? undefined : `At least ${MIN_PASSWORD} characters.`}
        editable={!busy}
        containerStyle={styles.input}
      />

      <Button
        title="Create Account"
        onPress={authenticate}
        loading={submitting}
        disabled={busy}
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
        style={styles.social}
      />

      <Pressable
        onPress={() => navigation.navigate('Login')}
        style={styles.loginRow}
        hitSlop={8}
        disabled={busy}
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
  ageCard: { alignItems: 'center', gap: 2, minHeight: 76, justifyContent: 'center' },
  roleCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.brandSoft,
  },
  roleLabel: { textAlign: 'center' },
  ageNote: { marginTop: -spacing.sm, marginBottom: spacing.md },
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
