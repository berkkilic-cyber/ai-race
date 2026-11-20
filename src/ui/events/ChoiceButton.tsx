import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventChoiceDef } from '@/engine';

import { fmtCash, fmtCompact } from '../format';
import { t } from '../i18n';
import { colors, radius, spacing, touch, type } from '../theme';
import { effectHints } from './hints';
import { HintChip, RiskTag } from './HintChip';

/** "40 Hype + $80M", or null when the choice is free. */
export function choiceCostText(choice: EventChoiceDef): string | null {
  const parts: string[] = [];
  if (choice.cost?.hype) parts.push(`${fmtCompact(choice.cost.hype)} ${t('term.hype')}`);
  if (choice.cost?.cash) parts.push(fmtCash(choice.cost.cash));
  return parts.length ? parts.join(' + ') : null;
}

export interface ChoiceButtonProps {
  choice: EventChoiceDef;
  /** Null when the choice can be taken, otherwise the reason it cannot. */
  disabledReason: string | null;
  onChoose: (choiceId: string) => void;
}

/** One large choice: label, cost, hint chips, Risky tag; disabled choices stay visible with the reason. */
export const ChoiceButton = memo(function ChoiceButton({ choice, disabledReason, onChoose }: ChoiceButtonProps) {
  const hints = useMemo(() => effectHints(choice.effects), [choice.effects]);
  const cost = choiceCostText(choice);
  const disabled = disabledReason !== null;
  const label = t(choice.labelKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}. ${disabledReason}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChoose(choice.id)}
      testID={`event-choice-${choice.id}`}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={[styles.label, disabled && styles.dimText]}>{label}</Text>
        {cost ? (
          <View style={[styles.cost, disabled && styles.costDisabled]}>
            <Text style={[styles.costText, disabled && styles.dimText]} numberOfLines={1}>
              {cost}
            </Text>
          </View>
        ) : null}
      </View>
      {hints.length > 0 || choice.risk ? (
        <View style={styles.chips}>
          {hints.map((hint) => (
            <HintChip key={`${hint.subject}-${hint.dir}`} hint={hint} muted={disabled} />
          ))}
          {choice.risk ? <RiskTag muted={disabled} /> : null}
        </View>
      ) : null}
      {disabled ? (
        <Text style={styles.reason} numberOfLines={2}>
          {disabledReason}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    minHeight: touch + 12,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    gap: spacing.s,
  },
  pressed: { borderColor: colors.player, backgroundColor: colors.bg },
  disabled: { backgroundColor: colors.surface, borderStyle: 'dashed' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
  label: { flex: 1, color: colors.text, fontSize: type.m, fontWeight: '700', lineHeight: 20 },
  dimText: { color: colors.dim },
  cost: { backgroundColor: colors.player, borderRadius: radius.pill, paddingHorizontal: spacing.s, paddingVertical: 2, marginTop: 1 },
  costDisabled: { backgroundColor: colors.raised },
  costText: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reason: { color: colors.bad, fontSize: type.xs, fontWeight: '600' },
});
