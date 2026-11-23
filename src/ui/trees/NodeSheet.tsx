import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { canApply, getComputeRequired, getNodeCost, type ActionFailure, type NodeDef } from '@/engine';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { describeNode } from '../explain/describe';
import { haveText, needText } from '../explain/model';
import { Icon } from '../icons';
import { useTutorialTarget } from '../tutorial/targets';
import { fmtCash, fmtCompact } from '../format';
import { failureText, t } from '../i18n';
import { cased } from '../locale/casing';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { TREE_ACCENT } from './accent';
import { CheckGlyph, CrossGlyph, LockGlyph } from './Glyphs';
import { nodeStatus, type NodeStatus } from './status';
import { useWide } from './useWide';
import { useTabStore } from '../shell/tabActive';
import { useTabModelStatus } from './useTabModelStatus';

export interface NodeSheetProps {
  nodeId: string | null;
  /** True right after this node was bought from the sheet. */
  justBought: boolean;
  onClose: () => void;
  onBuy: (nodeId: string) => void;
}

/** Bottom sheet for one node: what it does, cost, prerequisites and the Buy button. */
export function NodeSheet({ nodeId, justBought, onClose, onBuy }: NodeSheetProps) {
  const node = useTabStore((s) => (nodeId ? s.pack.nodes.find((n) => n.id === nodeId) : undefined));
  return (
    <Sheet visible={!!node} onClose={onClose} maxHeight="90%" testID="node-sheet">
      {node ? <NodeSheetBody key={node.id} node={node} justBought={justBought} onClose={onClose} onBuy={onBuy} /> : null}
    </Sheet>
  );
}

interface SheetView {
  status: NodeStatus;
  reason: ActionFailure | null;
  costHype: number;
  costCash: number;
  hype: number;
  cash: number;
  /** Comma-joined ids of prerequisites the player owns. */
  ownedReqs: string;
}

const NO_VIEW: SheetView = { status: 'locked', reason: 'gameEnded', costHype: 0, costCash: 0, hype: 0, cash: 0, ownedReqs: '' };

function useSheetView(node: NodeDef): SheetView {
  return useTabStore(
    useShallow((s) => {
      const state = s.state;
      if (!state) return NO_VIEW;
      const labId = state.playerLabId;
      const lab = state.labs[labId];
      const check = canApply(state, s.pack, { type: 'buyNode', labId, nodeId: node.id });
      const price = getNodeCost(state, s.pack, labId, node.id);
      return {
        status: nodeStatus(state, s.pack, node),
        reason: check.ok ? null : check.reason,
        costHype: price.hype,
        costCash: price.cash,
        // Whole units are enough for display; avoids re-rendering on every fractional tick.
        hype: Math.floor(lab.hype),
        cash: Math.floor(lab.cash),
        ownedReqs: node.requires.filter((r) => lab.ownedNodes.includes(r)).join(','),
      };
    }),
  );
}

function NodeSheetBody({ node, justBought, onClose, onBuy }: { node: NodeDef; justBought: boolean; onClose: () => void; onBuy: (id: string) => void }) {
  const tutorialRef = useTutorialTarget(`node.buy:${node.id}`);
  const pack = useTabStore((s) => s.pack);
  const view = useSheetView(node);
  const model = useTabModelStatus();
  const lines = useMemo(() => describeNode(node, { channels: pack.channels, computeFor: (tier) => getComputeRequired(pack, tier) }), [node, pack]);
  // Model nodes: the compute this tier needs to run, against what the player has.
  const tier = node.capabilityLevel;
  const need = tier !== undefined ? getComputeRequired(pack, tier) : 0;
  const cantRun = tier !== undefined && need > model.compute;
  // The first model never asks: everyone has to buy it, and the tutorial walks through it before any data centre exists.
  const askFirst = cantRun && (tier ?? 0) > 1;
  const [confirming, setConfirming] = useState(false);
  const accent = TREE_ACCENT[node.tree];
  const owned = view.status === 'owned';
  const ownedReqs = view.ownedReqs ? view.ownedReqs.split(',') : [];
  const hypeShort = view.hype < view.costHype;
  const cashShort = view.costCash > 0 && view.cash < view.costCash;
  // Landscape side panel is short: cost and Buy go right under the name so they never need scrolling.
  const wide = useWide();

  // While confirming, the confirmation carries the numbers: the cost and compute rows step aside so its buttons stay in view.
  const costView = !owned && !confirming ? (
    <View style={styles.costRow}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{cased(styles.sectionTitle, t('ui.trees.cost'))}</Text>
        <Text style={styles.cost}>
          <Text style={{ color: hypeShort ? colors.bad : colors.text }}>{`${fmtCompact(view.costHype)} ${t('term.hype')}`}</Text>
          {view.costCash > 0 ? <Text style={{ color: cashShort ? colors.bad : colors.text }}>{` + ${fmtCash(view.costCash)}`}</Text> : null}
        </Text>
      </View>
      <Text style={styles.have}>
        {t('ui.trees.youHave', {
          amount: view.costCash > 0 ? `${fmtCompact(view.hype)} ${t('term.hype')} · ${fmtCash(view.cash)}` : `${fmtCompact(view.hype)} ${t('term.hype')}`,
        })}
      </Text>
    </View>
  ) : null;

  const action = owned ? (
    <View style={[styles.ownedBanner, { backgroundColor: justBought ? accent : colors.raised, borderColor: accent }]} testID="node-sheet-owned">
      <CheckGlyph color={justBought ? colors.onPlayer : accent} size={18} />
      <Text style={[styles.ownedText, { color: justBought ? colors.onPlayer : accent }]}>
        {justBought ? t('ui.trees.bought') : t('ui.trees.state.owned')}
      </Text>
    </View>
  ) : confirming && view.reason === null ? (
    // Buying a model the player cannot run yet: say so plainly first.
    <View style={styles.confirm} testID="node-buy-confirm">
      <Text style={styles.confirmTitle}>{t('ui.trees2.confirmTitle')}</Text>
      <Text style={styles.confirmBody}>
        {t('ui.trees2.confirmBody', { node: t(node.nameKey), compute: needText(need), have: haveText(model.compute), running: model.running })}
      </Text>
      <View style={styles.confirmRow}>
        <Button label={t('ui.trees2.cancel')} variant="secondary" onPress={() => setConfirming(false)} style={styles.flex} testID="node-buy-cancel" />
        <Button
          label={t('ui.trees2.buyAnyway')}
          variant="primary"
          onPress={() => {
            setConfirming(false);
            onBuy(node.id);
          }}
          style={styles.flex}
          testID="node-buy-anyway"
        />
      </View>
    </View>
  ) : (
    <View ref={tutorialRef}>
      <Button
        label={t('ui.trees.buy')}
        variant="primary"
        disabled={view.reason !== null}
        sublabel={view.reason !== null ? failureText(view.reason) : undefined}
        onPress={() => (askFirst ? setConfirming(true) : onBuy(node.id))}
        testID="node-buy"
      />
    </View>
  );

  const runRow =
    tier !== undefined ? (
      <View style={[styles.runRow, { borderColor: cantRun ? colors.bad : colors.border }]} testID="node-compute" accessibilityLabel={t('ui.trees2.computeA11y', { compute: needText(need), have: haveText(model.compute) })}>
        <Icon name="compute" size={18} color={cantRun ? colors.bad : colors.text} accent={cantRun ? colors.bad : colors.info} />
        <View style={styles.flex}>
          <Text style={[styles.runText, { color: cantRun ? colors.bad : colors.text }]}>{t('ui.trees2.runRow', { compute: needText(need) })}</Text>
          <Text style={[styles.have, cantRun && { color: colors.bad }]}>
            {cantRun ? t('ui.trees2.runShort', { have: haveText(model.compute), more: needText(need - model.compute) }) : t('ui.trees2.runHave', { have: haveText(model.compute) })}
          </Text>
        </View>
      </View>
    ) : null;

  const purchase = (
    <View style={wide ? styles.purchaseWide : styles.purchase}>
      {costView}
      {action}
    </View>
  );

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <View style={[styles.chip, { borderColor: accent }]}>
          <View style={[styles.chipDot, { backgroundColor: accent }]} />
          <Text style={[styles.chipText, { color: accent }]}>{t(`term.tree.${node.tree}`)}</Text>
        </View>
        <StatusChip status={view.status} accent={accent} />
        <View style={styles.flex} />
        {/* The side panel has its own close button in its title row. */}
        {wide ? null : <Button label={t('ui.trees.close')} variant="ghost" compact onPress={onClose} testID="node-sheet-close" />}
      </View>

      <View style={styles.titleRow}>
        <View style={[styles.iconBox, { borderColor: accent }]}>
          <Icon name={node.id} size={40} color={colors.text} accent={accent} testID="node-sheet-icon" />
        </View>
        <Text style={[styles.name, styles.flex]}>{t(node.nameKey)}</Text>
      </View>
      {/* Wide: the Buy button comes before the compute row so it is never below the panel's fold
          (the tutorial's buy step points at it before the panel has been scrolled). */}
      {wide ? purchase : null}
      {confirming ? null : runRow}
      <Text style={styles.desc}>{t(node.descKey)}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{cased(styles.sectionTitle, t('ui.trees.effects'))}</Text>
        {lines.length === 0 ? <Text style={styles.desc}>{t('ui.trees.noEffects')}</Text> : null}
        {lines.map((line, i) => (
          <View key={i} style={styles.lineRow}>
            <View style={[styles.lineDot, { backgroundColor: line.tone === 'good' ? colors.good : colors.bad }]} />
            <Text style={[styles.lineText, { color: line.tone === 'good' ? colors.goodText : colors.bad }]}>{line.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{cased(styles.sectionTitle, t('ui.trees.prereqs'))}</Text>
        {node.requires.length === 0 ? <Text style={styles.desc}>{t('ui.trees.noPrereqs')}</Text> : null}
        {node.requires.map((id) => {
          const have = ownedReqs.includes(id);
          const req = pack.nodes.find((n) => n.id === id);
          return (
            <View key={id} style={styles.lineRow}>
              {have ? <CheckGlyph color={colors.good} /> : <CrossGlyph color={colors.bad} />}
              <Text style={[styles.lineText, { color: have ? colors.text : colors.bad }]}>{req ? t(req.nameKey) : id}</Text>
            </View>
          );
        })}
      </View>

      {wide ? null : purchase}
    </View>
  );
}

function StatusChip({ status, accent }: { status: NodeStatus; accent: string }) {
  const color = status === 'owned' || status === 'buyable' ? accent : status === 'expensive' ? colors.bad : colors.dim;
  return (
    <View style={[styles.chip, { borderColor: colors.border }]}>
      {status === 'locked' ? <LockGlyph color={colors.dim} size={11} /> : null}
      <Text style={[styles.chipText, { color }]}>{t(`ui.trees.state.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.m },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  flex: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: type.xs, fontWeight: '700' },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.l + 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  iconBox: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: shape.hairline, borderRadius: radius.s, backgroundColor: colors.raised },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, borderWidth: shape.hairline, borderRadius: radius.s, paddingHorizontal: spacing.s, paddingVertical: 6 },
  runText: { ...voice.bodyStrong, fontSize: type.s },
  confirm: { gap: spacing.s, borderWidth: shape.outline, borderColor: colors.bad, borderRadius: radius.s, padding: spacing.m, backgroundColor: colors.raised },
  confirmTitle: { ...voice.calmHeading, color: colors.bad, fontSize: type.m },
  confirmBody: { ...voice.body, color: colors.text, fontSize: type.s, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: spacing.s },
  desc: { color: colors.dim, fontSize: type.s },
  section: { gap: spacing.xs },
  sectionTitle: { color: colors.dim, fontSize: type.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  lineDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  lineText: { flex: 1, fontSize: type.s, fontWeight: '600' },
  costRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.s },
  cost: { fontSize: type.m, fontWeight: '800', ...tabular },
  have: { color: colors.dim, fontSize: type.xs, ...tabular },
  purchase: { gap: spacing.m },
  purchaseWide: { gap: spacing.s, paddingBottom: spacing.xs },
  ownedBanner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    borderRadius: radius.s,
    borderWidth: 1,
  },
  ownedText: { fontSize: type.m, fontWeight: '800' },
});
