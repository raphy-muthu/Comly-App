/**
 * Input — filled text field with an always-visible label above.
 * Subtle tinted background that shifts to a sky-blue border on focus.
 */

import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  hint,
  error,
  optional,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && (
        <View style={styles.labelRow}>
          <Text variant="labelMd" color="textSecondary">
            {label}
          </Text>
          {optional && (
            <Text variant="caption" color="outline">
              Optional
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={colors.outline}
            style={styles.icon}
          />
        )}
        <TextInput
          placeholderTextColor={colors.outline}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>

      {(hint || error) && (
        <Text
          variant="caption"
          color={error ? 'danger' : 'outline'}
          style={styles.hint}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.base,
    borderWidth: 2,
    borderColor: colors.transparent,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  fieldFocused: { borderColor: colors.secondary },
  fieldError: { borderColor: colors.danger },
  icon: { marginRight: spacing.base },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.bodyMd,
  },
  hint: { marginTop: 6 },
});
