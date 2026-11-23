import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { useGameStore } from '../store/game';
import { colors, layer, spacing, type, voice } from '../theme';
import { errorMessage, logError } from './log';

interface State {
  error: unknown;
  componentStack: string | null;
}

/** t() with a fallback, so the error screen still renders if strings are the problem. */
function safeT(key: string, fallback: string): string {
  try {
    const text = t(key);
    return text && text !== key ? text : fallback;
  } catch {
    return fallback;
  }
}

function ErrorScreen({ error, componentStack, onRestart }: { error: unknown; componentStack: string | null; onRestart: () => void }) {
  const insets = useInsets();
  return (
    <View
      style={[styles.root, { paddingTop: insets.top + spacing.l, paddingBottom: insets.bottom + spacing.l, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l }]}
      testID="error-screen"
    >
      <View style={styles.head}>
        <View style={styles.texts}>
          <Text style={styles.title}>{safeT('ui.error.title', 'Something broke')}</Text>
          <Text style={styles.body}>{safeT('ui.error.body', 'Restart to begin again.')}</Text>
        </View>
        <Button label={safeT('ui.error.restart', 'Restart')} onPress={onRestart} testID="error-restart" />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.message} selectable>
          {errorMessage(error)}
        </Text>
        {componentStack ? (
          <>
            <Text style={styles.label}>{safeT('ui.error.stack', 'Where it happened')}</Text>
            <Text style={styles.stack} selectable>
              {componentStack.trim()}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Root error boundary: a render error shows a plain screen with the message, the component
 * stack and Restart (drops the run and remounts the app), and is logged with the
 * [AI-RACE ERROR] tag. Native crashes cannot be caught here; see diagnostics/log.ts.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('Unknown render error') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? null;
    this.setState({ componentStack });
    logError('render error', error, componentStack ? `component stack:${componentStack}` : undefined);
  }

  restart = (): void => {
    try {
      useGameStore.getState().reset();
    } catch (error) {
      logError('restart', error);
    }
    this.setState({ error: null, componentStack: null });
  };

  render(): ReactNode {
    if (this.state.error) return <ErrorScreen error={this.state.error} componentStack={this.state.componentStack} onRestart={this.restart} />;
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, gap: spacing.m, zIndex: layer.error },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.l },
  texts: { flex: 1, gap: spacing.xs },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl },
  body: { color: colors.dim, fontSize: type.s },
  scroll: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  scrollContent: { paddingVertical: spacing.m, gap: spacing.s },
  message: { color: colors.bad, fontSize: type.s, fontWeight: '700' },
  label: { ...voice.calmLabel, color: colors.dim },
  stack: { color: colors.dim, fontSize: type.xs, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
