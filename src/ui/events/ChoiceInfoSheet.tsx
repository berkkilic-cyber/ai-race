import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ContentPack, EventChoiceDef, GameState } from '@/engine';

import { Sheet } from '../components/Sheet';
import { lineStyles, SectionTitle, TickLine, ToneLine } from '../explain/Lines';
import { t } from '../i18n';
import { colors, spacing, tabular, type, voice } from '../theme';
import { explainChoice } from './choiceInfo';
import { HintChip, RiskTag } from './HintChip';

export interface ChoiceInfoSheetProps {
  choice: EventChoiceDef | null;
  /** The state while the card is up (the run does not tick). */
  state: GameState;
  pack: ContentPack;
  onClose: () => void;
}

/**
 * A compact explanation of one event choice: what it requires (each requirement with a tick
 * or cross and where to get it), what it costs against what the player has, what it does,
 * what its arrows mean and whether it is a gamble. Calm voice: it is the lab thinking, not the news.
 */
export function ChoiceInfoSheet({ choice, state, pack, onClose }: ChoiceInfoSheetProps) {
  return (
    <Sheet visible={!!choice} onClose={onClose} title={choice ? t(choice.labelKey) : undefined} safeArea maxHeight="90%" testID="choice-info">
      {choice ? <ChoiceInfoBody choice={choice} state={state} pack={pack} /> : null}
    </Sheet>
  );
}

function ChoiceInfoBody({ choice, state, pack }: { choice: EventChoiceDef; state: GameState; pack: ContentPack }) {
  const info = useMemo(() => explainChoice(state, pack, choice), [state, pack, choice]);
  return (
    <View style={styles.body}>
      {/* The first thing in the way, unless it is already the (only) requirement listed below. */}
      {info.blocker && !info.requirements.some((r) => !r.met && r.text === info.blocker) ? (
        <View style={styles.blocked} testID="choice-info-blocker">
          <Text style={lineStyles.bad}>{info.blocker}</Text>
        </View>
      ) : null}

      <SectionTitle>{t('ui.events2.requires')}</SectionTitle>
      {info.requirements.length === 0 ? <Text style={lineStyles.dim}>{t('ui.events2.noRequirements')}</Text> : null}
      {info.requirements.map((r, i) => (
        <TickLine key={i} met={r.met} text={r.text} help={r.help} />
      ))}

      <SectionTitle>{t('ui.events2.cost')}</SectionTitle>
      {info.costs.length === 0 ? <Text style={lineStyles.dim}>{t('ui.events2.free')}</Text> : null}
      {info.costs.map((c) => (
        <View key={c.resource} style={styles.cost}>
          <Text style={[styles.costText, { color: c.short ? colors.bad : colors.text }]}>{c.text}</Text>
          <Text style={[lineStyles.dim, c.short && { color: colors.bad }]}>{t('ui.events2.have', { have: c.have })}</Text>
        </View>
      ))}

      <SectionTitle>{t('ui.events2.does')}</SectionTitle>
      {info.effects.length === 0 ? <Text style={lineStyles.dim}>{t('ui.events2.nothing')}</Text> : null}
      {info.effects.map((line, i) => (
        <ToneLine key={i} line={line} />
      ))}

      {info.hints.length > 0 ? <SectionTitle>{t('ui.events2.hints')}</SectionTitle> : null}
      {info.hints.map(({ hint, text }) => (
        <View key={`${hint.subject}-${hint.dir}`} style={styles.hint}>
          <View style={styles.chipBox}>
            <HintChip hint={hint} />
          </View>
          <Text style={[lineStyles.body, styles.flex]}>{text}</Text>
        </View>
      ))}

      <SectionTitle>{t('ui.events2.gamble')}</SectionTitle>
      {info.risk ? (
        <View style={styles.risk} testID="choice-info-risk">
          <View style={styles.hint}>
            <RiskTag />
            <Text style={[lineStyles.body, styles.flex]}>{info.risk.text}</Text>
          </View>
          {info.risk.effects.length > 0 ? <Text style={lineStyles.dim}>{t('ui.events2.ifBackfires')}</Text> : null}
          {info.risk.effects.map((line, i) => (
            <ToneLine key={i} line={line} />
          ))}
        </View>
      ) : (
        <Text style={lineStyles.dim}>{t('ui.events2.notGamble')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xs + 2 },
  flex: { flex: 1 },
  blocked: { borderLeftWidth: 3, borderColor: colors.bad, paddingLeft: spacing.s },
  cost: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s },
  costText: { ...voice.calmNumber, fontSize: type.m, ...tabular },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  // The chips are newsprint labels: give them their ink ground so they read the same as on the card.
  chipBox: { backgroundColor: colors.newsInk, padding: 3 },
  risk: { gap: spacing.xs },
});
