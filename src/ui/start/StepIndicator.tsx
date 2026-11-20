import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';

export interface StepIndicatorProps {
  /** Caption of each step. */
  labels: readonly string[];
  /** 0-based current step. */
  step: number;
  /** Jump back to an earlier step. */
  onStep: (step: number) => void;
  /** Slim single-row version for the wide footer (no "Step n of m" line). */
  compact?: boolean;
}

/** Three labelled bars; done and current steps are filled, done ones can be tapped to go back. */
export function StepIndicator({ labels, step, onStep, compact }: StepIndicatorProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: labels.length, now: step + 1 }}>
      {compact ? null : <Text style={styles.count}>{t('ui.start.stepOf', { step: step + 1, total: labels.length })}</Text>}
      <View style={styles.row}>
        {labels.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <Pressable
              key={label}
              style={styles.item}
              disabled={i >= step}
              onPress={() => onStep(i)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: i >= step, selected: i === step }}
              testID={`start-step-${i}`}
            >
              <View style={[styles.bar, state !== 'todo' && styles.barOn]} />
              <Text style={[styles.label, state === 'current' && styles.labelCurrent, state === 'done' && styles.labelDone]} numberOfLines={1}>
                {compact ? t('ui.start.stepNumbered', { step: i + 1, label }) : label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  compact: { flex: 1, maxWidth: 420, alignSelf: 'center' },
  count: { color: colors.dim, fontSize: type.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: spacing.s },
  item: { flex: 1, gap: spacing.xs, paddingVertical: spacing.xs },
  bar: { height: 4, borderRadius: radius.pill, backgroundColor: colors.raised },
  barOn: { backgroundColor: colors.player },
  label: { color: colors.dim, fontSize: type.s },
  labelCurrent: { color: colors.text, fontWeight: '700' },
  labelDone: { color: colors.player },
});
