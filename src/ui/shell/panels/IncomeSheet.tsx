import { StyleSheet, Text, View } from 'react-native';

import { explainIncome, fmtIncome, type IncomeKind } from '../../explain/income';
import { lineStyles, Note, SectionTitle, ValueLine } from '../../explain/Lines';
import { fmtPerDay } from '../../format';
import { t } from '../../i18n';
import { Icon } from '../../icons';
import { useGameStore, type GameStore } from '../../store/game';
import { colors, spacing, type, voice } from '../../theme';

interface IncomeView {
  total: string;
  positive: boolean;
  rows: { key: string; text: string; amount: string; good: boolean; icon: string }[];
  cost: { text: string; amount: string } | null;
  tips: { key: string; text: string; icon: string }[];
}

const selectors: Record<IncomeKind, (s: GameStore) => string> = {
  hype: (s) => select(s, 'hype'),
  cash: (s) => select(s, 'cash'),
};

function select(s: GameStore, kind: IncomeKind): string {
  const st = s.state;
  if (!st) return '';
  const e = explainIncome(st, s.pack, st.playerLabId, kind);
  const view: IncomeView = {
    total: fmtIncome(kind, e.total),
    positive: e.total >= 0,
    rows: e.rows.map((r) => ({ key: r.key, text: r.text, amount: fmtIncome(kind, r.amount), good: r.amount >= 0, icon: r.icon })),
    cost: e.biggestCost ? { text: e.biggestCost.text, amount: fmtIncome(kind, e.biggestCost.amount) } : null,
    tips: e.tips,
  };
  // Formatted figures in a string: the panel re-renders only when what it shows changes.
  return JSON.stringify(view);
}

/** Where today's Hype or Cash comes from, the biggest cost, and what to do for more. */
export function IncomeSheetBody({ kind }: { kind: IncomeKind }) {
  const json = useGameStore(selectors[kind]);
  if (!json) return null;
  const v = JSON.parse(json) as IncomeView;
  return (
    <View style={styles.body} testID={`income-sheet-${kind}`}>
      <View style={styles.hero}>
        <Icon name={kind} size={30} color={colors.text} accent={colors.player} />
        <View style={styles.flex}>
          <Text style={lineStyles.dim}>{t('ui.explain.income.total')}</Text>
          <Text style={[styles.big, { color: v.positive ? colors.goodText : colors.bad }]}>{fmtPerDay(v.total)}</Text>
        </View>
      </View>
      <View style={styles.rows}>
        {v.rows.map((r) => (
          <ValueLine key={r.key} icon={r.icon} text={r.text} value={r.amount} tone={r.good ? 'good' : 'bad'} />
        ))}
      </View>
      <SectionTitle>{t('ui.explain.income.biggestCost')}</SectionTitle>
      {v.cost ? <ValueLine icon="datacentre" text={v.cost.text} value={fmtPerDay(v.cost.amount)} tone="bad" accent={colors.bad} /> : <Text style={lineStyles.dim}>{t('ui.explain.income.noCost')}</Text>}
      {v.tips.length > 0 ? <SectionTitle>{t('ui.explain.income.tips')}</SectionTitle> : null}
      {v.tips.map((tip) => (
        <Note key={tip.key} testID={`income-tip-${tip.key}`}>
          <View style={styles.tip}>
            <Icon name={tip.icon} size={20} color={colors.text} accent={colors.player} />
            <Text style={[lineStyles.body, styles.flex]}>{tip.text}</Text>
          </View>
        </Note>
      ))}
      <Text style={lineStyles.dim}>{t(`ui.explain.income.spend.${kind}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.s },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  big: { ...voice.calmNumber, fontSize: type.l + 2 },
  rows: { gap: 2 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});
