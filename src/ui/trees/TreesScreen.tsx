import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TreeId } from '@/engine';

import { AmbientGate } from '../motion/ambient';
import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { HypeBalance } from './HypeBalance';
import { lightHaptic } from './haptics';
import { ModelNudge } from './ModelNudge';
import { NodeSheet } from './NodeSheet';
import { TreeGraph } from './TreeGraph';
import { TreePicker } from './TreePicker';
import { SIDE_PANEL_WIDTH, useWide } from './useWide';
import { useTabStore } from '../shell/tabActive';

/** How long the sheet shows the owned state after a purchase before closing. */
export const BOUGHT_CLOSE_MS = 900;

/**
 * Trees tab: tree picker, the selected tree as a node graph, and a detail sheet per node.
 * Landscape (wide): one short header row with the picker and Hype, the tree drawn left to right.
 */
export function TreesScreen() {
  const hasRun = useTabStore((s) => s.state !== null);
  const dispatch = useTabStore((s) => s.dispatch);
  const wide = useWide();
  const focused = useIsFocused();
  const [tree, setTree] = useState<TreeId>('capability');
  const [selected, setSelected] = useState<string | null>(null);
  const [justBought, setJustBought] = useState(false);
  const [flash, setFlash] = useState<{ nodeId: string; key: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const select = useCallback(
    (nodeId: string) => {
      clearTimer();
      setJustBought(false);
      setSelected(nodeId);
    },
    [clearTimer],
  );

  const close = useCallback(() => {
    clearTimer();
    setJustBought(false);
    setSelected(null);
  }, [clearTimer]);

  const pickTree = useCallback(
    (next: TreeId) => {
      close();
      setTree(next);
    },
    [close],
  );

  // After a purchase the sheet shows the owned state for a moment, then closes and the tile in the graph lights up.
  const buy = useCallback(
    (nodeId: string) => {
      const state = useGameStore.getState().state;
      if (!state) return;
      const result = dispatch({ type: 'buyNode', labId: state.playerLabId, nodeId });
      if (!result.ok) return;
      lightHaptic();
      setJustBought(true);
      clearTimer();
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setJustBought(false);
        setSelected(null);
        setFlash({ nodeId, key: Date.now() });
      }, BOUGHT_CLOSE_MS);
    },
    [dispatch, clearTimer],
  );

  if (!hasRun) return null;
  return (
    // Buyable-node glows stop while another tab is showing.
    <AmbientGate active={focused}>
      <View style={styles.root}>
        <TreePicker selected={tree} onSelect={pickTree} compact={wide} right={wide ? <HypeBalance /> : null} />
        <ModelNudge />
        <TreeGraph
          tree={tree}
          flash={flash}
          onSelect={select}
          horizontal={wide}
          selected={selected}
          insetRight={wide && selected ? SIDE_PANEL_WIDTH : 0}
        />
        <NodeSheet nodeId={selected} justBought={justBought} onClose={close} onBuy={buy} />
      </View>
    </AmbientGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent },
});
