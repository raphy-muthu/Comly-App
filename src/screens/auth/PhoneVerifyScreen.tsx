/**
 * Phone Verification — enter a number, receive a real SMS one-time code from
 * Supabase Auth, then verify it.
 *
 * Needs an SMS provider configured in the Supabase dashboard; without one the
 * send step fails with a clear message pointing the user at email sign-in.
 */

import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button, IconButton, Input, Screen, Text, useToast } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { sendPhoneCode, verifyPhoneCode } from '@/services/auth';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'PhoneVerify'>;

const CODE_LENGTH = 6;

export function PhoneVerifyScreen({ navigation }: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const adoptSession = useAuthStore((s) => s.adoptSession);
  const toast = useToast();

  // Both handlers reset their pending flag in `finally` — an unexpected
  // rejection must not leave the button spinning with no way to retry.
  const sendCode = async () => {
    if (sending) return;
    setSending(true);
    try {
      const result = await sendPhoneCode(phone);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setStep('code');
      setCode('');
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (err) {
      console.warn('[Comly] Sending the code failed:', err);
      toast.error('Could not send the code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const result = await verifyPhoneCode(phone, code);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      // Verified: a session now exists, so load the profile behind it.
      const adopted = await adoptSession();
      if (!adopted.ok) toast.error(adopted.message);
      // On success the root navigator swaps to the app stack.
    } catch (err) {
      console.warn('[Comly] Code verification failed:', err);
      toast.error('Could not verify the code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen scroll>
      <IconButton
        icon="arrow-back"
        onPress={() =>
          step === 'code' ? setStep('phone') : navigation.goBack()
        }
        style={styles.back}
      />

      {step === 'phone' ? (
        <>
          <Text variant="headlineLgMobile" style={styles.title}>
            What's your number?
          </Text>
          <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
            We'll text a 6-digit code to verify it's you.
          </Text>
          <Input
            label="Phone number"
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            editable={!sending}
            hint="Standard message and data rates may apply."
            containerStyle={styles.input}
          />
          <Button
            title="Send Code"
            onPress={sendCode}
            loading={sending}
            disabled={phone.replace(/\D/g, '').length < 10 || sending}
          />
        </>
      ) : (
        <>
          <Text variant="headlineLgMobile" style={styles.title}>
            Enter the code
          </Text>
          <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
            Sent to {phone || 'your phone'}.
          </Text>

          {/* Hidden field drives the boxes below. */}
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={styles.hiddenInput}
            editable={!verifying}
            autoFocus
          />
          <View style={styles.codeRow}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.codeBox, code.length === i && styles.codeBoxActive]}
              >
                <Text variant="headlineMd">{code[i] ?? ''}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Verify"
            onPress={verify}
            loading={verifying}
            disabled={code.length < CODE_LENGTH || verifying}
            style={styles.cta}
          />
          <Button
            title="Resend code"
            variant="ghost"
            onPress={sendCode}
            disabled={sending || verifying}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -8, marginTop: spacing.base },
  title: { marginTop: spacing.md },
  subtitle: { marginBottom: spacing.md },
  input: { marginBottom: spacing.md },
  cta: { marginBottom: spacing.sm },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.inputBackground,
    borderWidth: 2,
    borderColor: colors.transparent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: { borderColor: colors.secondary },
});
