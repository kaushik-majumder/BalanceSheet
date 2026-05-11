import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '../../constants/theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Surface to console so adb logcat shows it; do not crash.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.root}>
          <Text style={styles.title}>Something broke on this screen</Text>
          <Text style={styles.msg}>{String(this.state.error?.message ?? this.state.error)}</Text>
          <Text style={styles.stack}>{this.state.error?.stack?.slice(0, 800)}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.error,
    fontSize: theme.font.lg,
    fontWeight: '700',
  },
  msg: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sm,
    fontFamily: 'monospace',
  },
  stack: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
