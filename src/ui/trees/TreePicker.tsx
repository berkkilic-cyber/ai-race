import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import type { TreeId } from '@/engine';

import { t } from '../i18n';
import { Text } from '../locale/Text';
import { useTutorialTarget } from '../tutorial/targets';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { TREE_ACCENT } from './accent';
import { TREES } from './status';
import { useBuyableByTree } from './useBuyableNodeCount';
import { useTabStore } from '../shell/tabActive';

export interface TreePickerProps {
  selected: TreeId;
  onSelect: (tree: TreeId) => void;
  /** One-line segments for a short header row (landscape). */
  compact?: boolean;
  /** Extra content at the end of the row, e.g. the Hype balance. */
  right?: ReactNode;
}

/** Owned and total node counts per tree, in TREES order: [owned0, total0, owned1, total1, ...]. */
function useTreeCounts(): number[] {
  return useTabStore(
    useShallow((s) => {
      const owned = s.state ? s.state.labs[s.state.playerLabId].ownedNodes : [];
      const out: number[] = [];
      for (const tree of TREES) {
        let total = 0;
        let mine = 0;
        for (const n of s.pack.nodes) {
          if (n.tree !== tree) continue;
          total++;
          if (owned.includes(n.id)) mine++;
        }
        out.push(mine, total);
      }
      return out;
    }),
  );
}

/** Segmented control for the three trees, each with owned/total and a dot when something there is buyable. */
function TreePickerImpl({ selected, onSelect, compact, right }: TreePickerProps) {
  const counts = useTreeCounts();
  const buyable = useBuyableByTree();
  const tutorialRef = useTutorialTarget('tree.picker');
  return (
    <View style={[styles.row, compact && styles.rowCompact]} ref={tutorialRef}>
      {TREES.map((tree, i) => {
        const active = tree === selected;
        const accent = TREE_ACCENT[tree];
        const owned = counts[i * 2] ?? 0;
        const total = counts[i * 2 + 1] ?? 0;
        const name = t(`term.tree.${tree}`);
        return (
          <Pressable
            key={tree}
            onPress={() => onSelect(tree)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t('ui.trees.pickerLabel', { tree: name, owned, total })}
            testID={`tree-tab-${tree}`}
            style={[styles.segment, compact && styles.segmentCompact, active && { borderColor: accent, backgroundColor: colors.raised }]}
          >
            <View style={[styles.bar, { backgroundColor: accent, opacity: active ? 1 : 0.35 }]} />
            <Text style={[styles.name, active && { color: accent }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.count, compact && styles.countCompact, active && styles.countActive]}>{t('ui.trees.count', { owned, total })}</Text>
            {buyable[tree] > 0 ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
          </Pressable>
        );
      })}
      {right}
    </View>
  );
}

export const TreePicker = memo(TreePickerImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.s, paddingHorizontal: spacing.m, paddingTop: spacing.m, paddingBottom: spacing.xs },
  rowCompact: { paddingTop: spacing.s, paddingBottom: 0 },
  segmentCompact: { minHeight: touch, flexDirection: 'row', gap: spacing.s, paddingVertical: 0 },
  countCompact: { fontSize: type.s },
  segment: {
    flex: 1,
    minHeight: touch + 8,
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    backgroundColor: colors.surface,
    ...flatShadow(2),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: shape.panel === 'clip' ? 5 : 3 },
  name: { ...(shape.panel === 'plain' ? { fontWeight: '700' as const } : voice.calmHeading), color: colors.dim, fontSize: shape.panel === 'clip' ? type.l : type.s },
  count: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  countActive: { color: colors.text },
  dot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },
});
