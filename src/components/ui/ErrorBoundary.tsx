/**
 * ErrorBoundary — catches render-time crashes so one broken subtree (or a
 * missing native module, e.g. maps in a client that doesn't bundle it) can't
 * take down the whole app.
 *
 *   • Wrap the app root for a friendly full-screen recovery UI.
 *   • Wrap risky leaves with a custom `fallback` for silent degradation.
 */

import { Component, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Omit for the default full-screen recovery card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Central crash log point — swap for Sentry/Crashlytics in production.
    console.error('[Comly] Render error caught by boundary:', error);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
        </View>
        <Text variant="headlineMd" center style={styles.title}>
          Something went wrong
        </Text>
        <Text variant="bodyMd" color="textSecondary" center style={styles.message}>
          That's on us, not you. Try again — if it keeps happening, restart the
          app.
        </Text>
        <Button title="Try Again" fullWidth={false} size="md" onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.base },
  message: { marginBottom: spacing.md },
});
