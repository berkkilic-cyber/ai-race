import { StyleSheet, View } from 'react-native';

import { computeUpgrades, haveText, modelFacts, needText, ownsMoreThanRuns } from '../../explain/model';
import { lineStyles, Note, SectionTitle } from '../../explain/Lines';
import { fmtCash, fmtCompact } from '../../format';
import { t } from '../../i18n';
import { Icon } from '../../icons';
import { Text } from '../../locale/Text';
import { useGameStore, type GameStore } from '../../store/game';
import { colors, radius, shape, spacing, tabular, type, voice } from '../../theme';

interface ModelView {
  running: number;
  owned: number;
  compute: string;
  required: string;
  tiers: { tier: number; nodeId: string; name: string; required: string; short: boolean; owned: boolean; running: boolean }[];
  sources: { nodeId: string; text: string }[];
}

function selectView(s: GameStore): string {
  const st = s.state;
  if (!st) return '';
  const facts = modelFacts(st, s.pack, st.playerLabId);
  const view: ModelView = {
    running: facts.running,
    owned: facts.owned,
    compute: haveText(facts.compute),
    required: needText(facts.required),
    tiers: facts.tiers.map((row) => {
      const node = s.pack.nodes.find((n) => n.id === row.nodeId);
      return { ...row, required: needText(row.required), short: row.required > facts.compute, name: node ? t(node.nameKey) : row.nodeId };
    }),
    sources: computeUpgrades(st, s.pack, st.playerLabId)
      .filter((c) => c.open)
      .slice(0, 3)
      .map((c) => {
        const node = s.pack.nodes.find((n) => n.id === c.nodeId);
        const price = c.cash > 0 ? `${fmtCompact(c.hype)} ${t('term.hype')} + ${fmtCash(c.cash)}` : `${fmtCompact(c.hype)} ${t('term.hype')}`;
        return { nodeId: c.nodeId, text: t('ui.explain.model.fromUpgrade', { node: node ? t(node.nameKey) : c.nodeId, tree: node ? t(`term.tree.${node.tree}`) : '', price }) };
      }),
  };
  // A string, so the panel re-renders only when something it shows changes.
  return JSON.stringify(view);
}

/** What model the player runs, what they own, and the compute each tier needs, with where to get more. */
export function ModelSheetBody() {
  const json = useGameStore(selectView);
  if (!json) return null;
  const v = JSON.parse(json) as ModelView;
  const stuck = ownsMoreThanRuns(v);
  const next = v.tiers.find((row) => !row.owned);
  const first = v.tiers[0];
  return (
    <View style={styles.body} testID="model-sheet">
      <View style={styles.hero}>
        <Icon name="tier" size={22} color={colors.text} accent={colors.player} />
        <Text style={styles.big}>{t('ui.strip.tier', { tier: v.running })}</Text>
        <Text style={[lineStyles.dim, styles.flex]}>{t('ui.explain.model.youHave', { compute: v.compute })}</Text>
      </View>
      {stuck ? (
        <Note tone="bad" testID="model-stuck">
          <Text style={lineStyles.bad}>{t('ui.explain.model.stuck', { owned: v.owned, required: v.required, compute: v.compute })}</Text>
          <Text style={lineStyles.body}>{t('ui.explain.model.stuckWhy', { owned: v.owned, running: v.running })}</Text>
        </Note>
      ) : v.owned === 0 && first ? (
        <Note>
          <Text style={lineStyles.body}>{t('ui.explain.model.none', { node: first.name })}</Text>
        </Note>
      ) : (
        <Note>
          <Text style={lineStyles.body}>{t('ui.explain.model.running', { tier: v.running })}</Text>
          <Text style={lineStyles.body}>{next ? t('ui.explain.model.next', { node: next.name, tier: next.tier, required: next.required, compute: v.compute }) : t('ui.explain.model.top')}</Text>
        </Note>
      )}

      <SectionTitle>{t('ui.explain.model.tiers')}</SectionTitle>
      <View style={styles.table}>
        {v.tiers.map((row) => {
          const short = row.short;
          const state = row.running ? 'stateRunning' : row.owned ? 'stateIdle' : 'stateNot';
          return (
            <View key={row.nodeId} style={[styles.tierRow, row.running && styles.tierRunning]} testID={`model-tier-${row.tier}`}>
              <Icon name={row.nodeId} size={20} color={row.owned ? colors.text : colors.dim} accent={row.running ? colors.player : colors.dim} />
              <View style={styles.flex}>
                <Text style={[styles.tierName, !row.owned && { color: colors.dim }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.tierState, row.owned && !row.running && { color: colors.bad }]}>{t(`ui.explain.model.${state}`)}</Text>
              </View>
              <View style={styles.need}>
                <Icon name="compute" size={12} color={short ? colors.bad : colors.dim} />
                <Text style={[styles.needText, short && { color: colors.bad }]}>{t('ui.explain.model.needs', { compute: row.required })}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <SectionTitle>{t('ui.explain.model.computeFrom')}</SectionTitle>
      <View style={styles.source}>
        <Icon name="datacentre" size={18} color={colors.text} accent={colors.player} />
        <Text style={[lineStyles.body, styles.flex]}>{t('ui.explain.model.fromDataCentres')}</Text>
      </View>
      {v.sources.map((src) => (
        <View key={src.nodeId} style={styles.source}>
          <Icon name={src.nodeId} size={18} color={colors.text} accent={colors.info} />
          <Text style={[lineStyles.body, styles.flex]}>{src.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.s },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  big: { ...voice.calmHeading, color: colors.playerText, fontSize: type.l },
  table: { gap: 2 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.transparent },
  tierRunning: { borderColor: colors.player },
  tierName: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  tierState: { ...voice.body, color: colors.dim, fontSize: type.xs },
  need: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  needText: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});
