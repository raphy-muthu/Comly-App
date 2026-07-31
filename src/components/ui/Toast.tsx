/**
 * Toast — lightweight global feedback for mutations (success/error/info).
 *
 *   const toast = useToast();
 *   toast.success('Job posted!');
 *   toast.error(err.message);
 *
 * Wrap the app once in <ToastProvider>. One toast shows at a time and
 * auto-dismisses; tapping dismisses early.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Text } from './Text';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Bridge for non-React callers (e.g. the React Query cache's global onError).
 * Set by ToastProvider on mount; null before the provider exists.
 */
export const globalToast: { current: ToastApi | null } = { current: null };

const CONFIG: Record<
  ToastType,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  success: { icon: 'checkmark-circle', bg: colors.tertiary, fg: '#ffffff' },
  error: { icon: 'alert-circle', bg: colors.error, fg: '#ffffff' },
  info: { icon: 'information-circle', bg: colors.inverseSurface, fg: '#ffffff' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type, key: Date.now() });
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, 2800);
    },
    [anim, hide]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  };

  // Expose to non-React callers (query cache errors, etc.).
  useEffect(() => {
    globalToast.current = api;
    return () => {
      globalToast.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { top: insets.top + spacing.base },
            {
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={hide}
            style={[styles.toast, { backgroundColor: CONFIG[toast.type].bg }]}
          >
            <Ionicons
              name={CONFIG[toast.type].icon}
              size={20}
              color={CONFIG[toast.type].fg}
            />
            <Text
              variant="bodyMd"
              style={[styles.message, { color: CONFIG[toast.type].fg }]}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.marginMobile,
    right: spacing.marginMobile,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    maxWidth: 520,
    ...shadows.floating,
  },
  message: { flex: 1, marginLeft: spacing.base },
});
