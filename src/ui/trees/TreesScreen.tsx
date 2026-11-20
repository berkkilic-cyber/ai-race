import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { canApply, getNodeCost, type NodeDef, type TreeId } from '@/engine';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { fmtCash, fmtCompact } from '../format';
import { failureText, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing, type } from '../theme';

const TREES: TreeId[] = ['capability', 'reach', 'shadow'];

/** Placeholder Trees tab: nodes grouped by tree, with a Buy button driven by the engine. */
export function TreesScreen() {
  const state = useGameStore((s) => s.state);
  const pack = useGameStore((s) => s.pack);
  const dispatch = useGameStore((s) => s.dispatch);
  if (!state) return null;
  const labId = state.playerLabId;
  const lab = state.labs[labId];
  const nameOf = (id: string) => {
    const node = pack.nodes.find((n) => n.id === id);
    return node ? t(node.nameKey) : id;
  };
  const byTree = (tree: TreeId): NodeDef[] =>
    pack.nodes.filter((n) => n.tree === tree).sort((a, b) => a.row - b.row || a.col - b.col);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {TREES.map((tree) => (
        <View key={tree} style={styles.tree}>
          <Text style={styles.treeTitle}>{t(`term.tree.${tree}`)}</Text>
          {byTree(tree).map((node) => {
            const owned = lab.ownedNodes.includes(node.id);
            const action = { type: 'buyNode', labId, nodeId: node.id } as const;
            const check = canApply(state, pack, action);
            const cost = getNodeCost(state, pack, labId, node.id);
            const price = [`${fmtCompact(cost.hype)} ${t('term.hype')}`, cost.cash > 0 ? fmtCash(cost.cash) : null].filter(Boolean).join(' + ');
            const missing = node.requires.filter((r) => !lab.ownedNodes.includes(r));
            return (
              <Card key={node.id} style={[styles.node, owned && styles.owned]} testID={`node-${node.id}`}>
                <View style={styles.nodeText}>
                  <Text style={styles.nodeName}>{t(node.nameKey)}</Text>
                  <Text style={styles.nodeDesc}>{t(node.descKey)}</Text>
                  {!owned && missing.length > 0 ? (
                    <Text style={styles.requires}>{t('ui.trees.requires', { nodes: missing.map(nameOf).join(', ') })}</Text>
                  ) : null}
                </View>
                {owned ? (
                  <Text style={styles.ownedLabel}>{t('ui.trees.owned')}</Text>
                ) : (
                  <Button
                    label={t('ui.trees.buy')}
                    variant={check.ok ? 'primary' : 'secondary'}
                    disabled={!check.ok}
                    sublabel={check.ok ? price : `${price}\n${failureText(check.reason)}`}
                    onPress={() => dispatch(action)}
                    compact
                    style={styles.buy}
                  />
                )}
              </Card>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.m, gap: spacing.xl },
  tree: { gap: spacing.s },
  treeTitle: { color: colors.text, fontSize: type.l, fontWeight: '800' },
  node: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m },
  owned: { borderColor: colors.player },
  nodeText: { flex: 1, gap: 2 },
  nodeName: { color: colors.text, fontSize: type.m, fontWeight: '700' },
  nodeDesc: { color: colors.dim, fontSize: type.s },
  requires: { color: colors.bad, fontSize: type.xs },
  ownedLabel: { color: colors.player, fontSize: type.s, fontWeight: '700' },
  buy: { width: 120 },
});
