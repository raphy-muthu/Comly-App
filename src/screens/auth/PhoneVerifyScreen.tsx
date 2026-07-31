/**
 * Phone Verification — enter a number, then a 6-digit code. Two-step UI; mock
 * mode accepts any input and signs the user in.
 */

import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button, IconButton, Input, Screen, Text } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { PublicStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<PublicStackParamList, 'PhoneVerify'>;

const CODE_LENGTH = 6;

export function PhoneVerifyScreen({ navigation }: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const codeRef = useRef<TextInput>(null);

  const signIn = useAuthStore((s) => s.signIn);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const sendCode = () => {
    setStep('code');
    setTimeout(() => codeRef.current?.focus(), 250);
  };

  const verify = () => {
    completeOnboarding();
    signIn();
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
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            containerStyle={styles.input}
          />
          <Button
            title="Send Code"
            onPress={sendCode}
            disabled={phone.trim().length < 7}
          />
        </>
      ) : (
        <>
          <Text variant="headlineLgMobile" style={styles.title}>
            Enter the code
          </Text>
          <Text variant="bodyMd" color="textSecondary" style={styles.subtitle}>
            Sent to {phone || 'your phone'}. (Mock mode: enter any 6 digits.)
          </Text>

          {/* Hidden field drives the boxes below. */}
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            style={styles.hiddenInput}
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
            disabled={code.length < CODE_LENGTH}
            style={styles.cta}
          />
          <Button title="Resend code" variant="ghost" onPress={() => setCode('')} />
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
