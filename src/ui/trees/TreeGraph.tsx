import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import { getNodeCost, type TreeId } from '@/engine';

import { t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing } from '../theme';
import { TREE_ACCENT } from './accent';
import { layoutTree, type TreeEdge } from './layout';
import { NodeTile } from './NodeTile';
import { nodeStatus, treeNodes, type NodeStatus } from './status';

export interface TreeGraphProps {
  tree: TreeId;
  /** Node currently highlighted after a purchase, with a key that changes per purchase. */
  flash: { nodeId: string; key: number } | null;
  onSelect: (nodeId: string) => void;
  /** Landscape: rows run left to right and the tree fits the height. */
  horizontal: boolean;
  /** Node whose detail panel is open; in landscape the tree scrolls so it stays visible beside the panel. */
  selected: string | null;
  /** Width covered on the right by the open detail panel (landscape). */
  insetRight: number;
}

interface NodeView {
  status: NodeStatus;
  hype: number;
  cash: number;
}

/** Packs one node's view into a string so the store selector stays shallow-comparable. */
function encode(v: NodeView): string {
  return `${v.status}|${v.hype}|${v.cash}`;
}

function decode(s: string): NodeView {
  const [status, hype, cash] = s.split('|');
  return { status: status as NodeStatus, hype: Number(hype), cash: Number(cash) };
}

type EdgeTone = 'lit' | 'ready' | 'dim';

function edgeTone(edge: TreeEdge, statusOf: (id: string) => NodeStatus | undefined): EdgeTone {
  const to = statusOf(edge.to);
  if (to === 'owned') return 'lit';
  return statusOf(edge.from) === 'owned' ? 'ready' : 'dim';
}

const EDGE_ORDER: Record<EdgeTone, number> = { dim: 0, ready: 1, lit: 2 };
/** Dash pattern as numbers: react-native-svg parses arrays the same on every platform. */
const DASH_READY = [4, 4];

function TreeGraphImpl({ tree, flash, onSelect, horizontal, selected, insetRight }: TreeGraphProps) {
  const pack = useGameStore((s) => s.pack);
  const nodes = useMemo(() => treeNodes(pack, tree), [pack, tree]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(() => {
    if (size.width <= 0) return null;
    return horizontal ? layoutTree(nodes, size.width, { orientation: 'horizontal', height: size.height }) : layoutTree(nodes, size.width);
  }, [nodes, size, horizontal]);
  const hScroll = useRef<ScrollViewInstance>(null);
  const scrollX = useRef(0);

  // One primitive per node: re-renders only when a status or price changes, not on every tick.
  const encoded = useGameStore(
    useShallow((s) => {
      const state = s.state;
      if (!state) return [] as string[];
      return nodes.map((node) => {
        const price = getNodeCost(state, s.pack, state.playerLabId, node.id);
        return encode({ status: nodeStatus(state, s.pack, node), hype: price.hype, cash: price.cash });
      });
    }),
  );

  const views = useMemo(() => {
    const map: Record<string, NodeView> = {};
    nodes.forEach((n, i) => {
      const e = encoded[i];
      if (e) map[n.id] = decode(e);
    });
    return map;
  }, [nodes, encoded]);

  const accent = TREE_ACCENT[tree];
  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.floor(e.nativeEvent.layout.width);
    const height = Math.floor(e.nativeEvent.layout.height);
    setSize((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
  };

  // Landscape: keep the selected tile visible to the left of the detail panel.
  useEffect(() => {
    if (!horizontal || !layout || !selected || insetRight <= 0) return;
    const rect = layout.tiles[selected];
    if (!rect) return;
    const visibleRight = scrollX.current + size.width - insetRight - spacing.m;
    if (rect.x + rect.w > visibleRight) hScroll.current?.scrollTo({ x: rect.x + rect.w - (size.width - insetRight - spacing.m), animated: true });
    else if (rect.x < scrollX.current) hScroll.current?.scrollTo({ x: Math.max(0, rect.x - spacing.m), animated: true });
  }, [horizontal, layout, selected, insetRight, size.width]);

  const edges = useMemo(() => {
    if (!layout) return [];
    return layout.edges.map((edge) => ({ edge, tone: edgeTone(edge, (id) => views[id]?.status) })).sort((a, b) => EDGE_ORDER[a.tone] - EDGE_ORDER[b.tone]);
  }, [layout, views]);

  const canvas = layout ? (
    <View style={{ width: layout.width, height: layout.height }} testID={`tree-${tree}`}>
      <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {edges.map(({ edge, tone }) => (
          <Path
            key={`${edge.from}>${edge.to}`}
            d={edge.d}
            fill="none"
            stroke={tone === 'dim' ? colors.border : accent}
            strokeOpacity={tone === 'ready' ? 0.45 : 1}
            strokeWidth={tone === 'lit' ? 2.5 : 1.5}
            strokeDasharray={tone === 'ready' ? DASH_READY : undefined}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      {nodes.map((node) => {
        const view = views[node.id];
        const rect = layout.tiles[node.id];
        if (!view || !rect) return null;
        return (
          <NodeTile
            key={node.id}
            nodeId={node.id}
            name={t(node.nameKey)}
            status={view.status}
            costHype={view.hype}
            costCash={view.cash}
            accent={accent}
            rect={rect}
            flashKey={flash?.nodeId === node.id ? flash.key : 0}
            onPress={onSelect}
          />
        );
      })}
    </View>
  ) : null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {layout ? (
        horizontal ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fill}>
            <ScrollView
              ref={hScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: insetRight }}
              onScroll={(e) => {
                scrollX.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={32}
            >
              {canvas}
            </ScrollView>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {canvas}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

export const TreeGraph = memo(TreeGraphImpl);

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  fill: { flexGrow: 1 },
});
