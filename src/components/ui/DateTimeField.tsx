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
  /**
   * Time mode only: the calendar day the time will land on. When that day is
   * today, the picker floors at the current clock time — without it "3 PM" is
   * selectable at 6 PM and produces a listing scheduled in the past.
   */
  onDate?: Date | null;
  /** Inline validation message rendered under the field. */
  error?: string;
}

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
  onDate,
  error,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  const isToday =
    !!onDate && new Date(onDate).toDateString() === new Date().toDateString();
  const resolvedMinimum =
    mode === 'date' ? minimumDate ?? new Date() : isToday ? new Date() : undefined;

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
      <Pressable
        style={[styles.field, !!error && styles.fieldError]}
        onPress={() => setOpen((o) => !o)}
      >
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
          minimumDate={resolvedMinimum}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            // Android closes on selection; iOS stays open until tapped away.
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && selected) onChange(selected);
          }}
        />
      )}

      {!!error && (
        <Text variant="caption" color="danger" style={styles.error}>
          {error}
        </Text>
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
  fieldError: { borderWidth: 1, borderColor: colors.error },
  error: { marginTop: 4 },
});
