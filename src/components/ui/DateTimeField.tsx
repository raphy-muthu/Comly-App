/**
 * DateTimeField — labeled button that opens a native date or time picker.
 * Wraps @react-native-community/datetimepicker with sensible iOS/Android UX and
 * a "no past dates" minimum for date mode.
 */

import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
}

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  const display =
    value == null
      ? placeholder ?? (mode === 'date' ? 'Select date' : 'Select time')
      : mode === 'date'
        ? value.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : value.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });

  return (
    <View style={styles.wrap}>
      <Text variant="labelMd" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      {/* Toggle: on iOS the inline spinner stays open, so tapping the field
          again is how it closes — without this the picker was un-dismissable. */}
      <Pressable style={styles.field} onPress={() => setOpen((o) => !o)}>
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={18}
          color={colors.outline}
        />
        <Text
          variant="bodyMd"
          color={value ? 'textPrimary' : 'outline'}
          style={styles.value}
        >
          {display}
        </Text>
      </Pressable>

      {open && (
        <DateTimePicker
          mode={mode}
          value={value ?? new Date()}
          minimumDate={mode === 'date' ? minimumDate ?? new Date() : undefined}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            // Android closes on selection; iOS stays open until tapped away.
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { marginBottom: spacing.base },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.base,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    gap: spacing.base,
  },
  value: { flex: 1 },
});
