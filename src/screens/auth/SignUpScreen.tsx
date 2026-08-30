/**
 * Sign Up — creates a real Supabase Auth account.
 *
 * Role and date of birth are captured here because both are server-owned
 * afterwards: migration 0013 derives `age_bracket` and `age_group` from the
 * date of birth and then pins all three against later edits, and the signup
 * metadata is what the handle_new_user trigger uses to provision the profile.
 *
 * The age check below is a courtesy, not the gate. The same rule runs again in
 * the database, which refuses the account outright rather than trusting
 * anything this screen sends.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  DateTimeField,
  Input,
  Screen,
  Text,
  useToast,
} from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { OAuthProvider, signInWithProvider } from '@/services/auth';
import { bracketFromDateOfBirth, MIN_SIGNUP_AGE, Role } from '@/types/domain';
import { money, minimumWageFor } from '@/lib/wage';
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

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Oldest selectable birth date — bounds the picker without excluding anyone. */
const EARLIEST_BIRTH_DATE = new Date(1900, 0, 1);

/** Supabase expects an ISO calendar date; toISOString would shift by timezone. */
function toIsoDate(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function SignUpScreen({ navigation }: Props) {
  const [role, setRole] = useState<Role>('customer');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
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

  // Null covers both "too young" and "unparseable", which is why the check is
  // on the derived bracket rather than on the raw date.
  const ageBracket =
    dateOfBirth === null ? null : bracketFromDateOfBirth(toIsoDate(dateOfBirth), new Date());
  const ageError =
    touched && dateOfBirth !== null && ageBracket === null
      ? `You must be at least ${MIN_SIGNUP_AGE} years old to use Comly.`
      : undefined;

  const complete =
    name.trim().length > 1 &&
    neighborhood.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= MIN_PASSWORD &&
    ageBracket !== null;

  // Recomputed on every render from whatever the user has typed so far — the
  // neighborhood field doubles as the location signal for the wage guideline.
  const wageFloor = minimumWageFor(neighborhood);

  const authenticate = async () => {
    setTouched(true);
    if (!complete || busy) {
      if (dateOfBirth === null) {
        toast.info('Please enter your date of birth to continue.');
      } else if (ageBracket === null) {
        toast.error(`You must be at least ${MIN_SIGNUP_AGE} years old to use Comly.`);
      }
      return;
    }

    // Pending flags reset in `finally` — an unexpected rejection must not leave
    // the button spinning with no way to retry.
    setSubmitting(true);
    try {
      const result = await signUp({
        email,
        password,
        name,
        neighborhood,
        role,
        dateOfBirth: toIsoDate(dateOfBirth as Date),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.needsEmailConfirmation) {
        toast.success('Account created — check your email to confirm, then log in.');
        navigation.navigate('Login');
      }
      // Otherwise the session is live and the root navigator swaps stacks.
    } catch (err) {
      console.warn('[Comly] Sign-up failed:', err);
      toast.error('Something went wrong creating your account. Please try again.');
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
      const adopted = await adoptSession();
      if (!adopted.ok) toast.error(adopted.message);
    } catch (err) {
      console.warn('[Comly] OAuth sign-in failed:', err);
      toast.error('Something went wrong signing in. Please try again.');
    } finally {
      setOauthPending(null);
    }
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
        MY DATE OF BIRTH
      </Text>
      <View style={styles.dobRow}>
        <DateTimeField
          label="Date of birth"
          mode="date"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          placeholder="Select your date of birth"
          minimumDate={EARLIEST_BIRTH_DATE}
          maximumDate={new Date()}
        />
      </View>
      {!!ageError && (
        <Text variant="caption" color="danger" style={styles.ageError}>
          {ageError}
        </Text>
      )}
      <Text variant="caption" color="textSecondary" style={styles.ageNote}>
        This can't be changed later — it determines which jobs are safe to show
        you. You must be at least {MIN_SIGNUP_AGE}. Helpers under 18 need a
        parent or guardian's approval for some tasks.
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
      <Card padded style={styles.wageCard}>
        <View style={styles.wageRow}>
          <Ionicons name="cash-outline" size={18} color={colors.tertiary} />
          <Text variant="caption" color="textSecondary" style={styles.wageText}>
            {role === 'helper'
              ? `Fair-pay guideline: aim for at least ${money(wageFloor.amount)}/hr — the ${wageFloor.label}. You can always counter-offer on a job.`
              : `Fair-pay guideline: pay your helper at least ${money(wageFloor.amount)}/hr — the ${wageFloor.label}. Comly shows this next to every pay field.`}
            {' '}Neighbors agree and settle pay themselves; Comly never handles the money.
          </Text>
        </View>
      </Card>

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
  dobRow: { flexDirection: 'row', marginBottom: spacing.sm },
  ageError: { color: colors.error, marginBottom: spacing.base },
  roleCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.brandSoft,
  },
  roleLabel: { textAlign: 'center' },
  ageNote: { marginTop: -spacing.sm, marginBottom: spacing.md },
  input: { marginBottom: spacing.sm },
  wageCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  wageRow: { flexDirection: 'row', gap: spacing.base },
  wageText: { flex: 1 },
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
