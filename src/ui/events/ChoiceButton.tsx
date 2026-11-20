import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventChoiceDef } from '@/engine';

import { fmtCash, fmtCompact } from '../format';
import { t } from '../i18n';
import { colors, spacing, touch, voice } from '../theme';
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

/**
 * One large choice as a strong ink button: condensed label, price tag, hint chips, Risky
 * stamp. It depresses into its shadow when pressed. Disabled choices stay visible on a
 * dashed newsprint outline with the reason.
 */
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
    backgroundColor: colors.newsInk,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s + 2,
    gap: spacing.s,
    marginRight: 3,
    marginBottom: 3,
    shadowColor: colors.newsRed,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 0, height: 0 } },
  disabled: { backgroundColor: colors.newsWash, borderWidth: 1, borderColor: colors.newsDim, borderStyle: 'dashed', shadowOpacity: 0 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
  label: { ...voice.loudKicker, flex: 1, color: colors.newsPaper, fontSize: 18, lineHeight: 20, letterSpacing: 0.4 },
  dimText: { color: colors.newsDim },
  cost: { backgroundColor: colors.newsPaper, paddingHorizontal: 6, paddingVertical: 1, marginTop: 1 },
  costDisabled: { backgroundColor: colors.newsPaper },
  costText: { ...voice.loudKicker, color: colors.newsInk, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  reason: { ...voice.loudKicker, color: colors.newsRed, fontSize: 12, letterSpacing: 0.6 },
});
