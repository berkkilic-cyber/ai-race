/** Pure geometry for drawing a tree: tile rectangles from each node's row/col, and connector paths. */
import type { NodeDef } from '@/engine';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreeEdge {
  from: string;
  to: string;
  d: string;
}

export interface TreeLayout {
  width: number;
  height: number;
  tiles: Record<string, TileRect>;
  edges: TreeEdge[];
}

/**
 * vertical: node rows run top to bottom, cols left to right (portrait).
 * horizontal: node rows run left to right, cols top to bottom (landscape).
 */
export type TreeOrientation = 'vertical' | 'horizontal';

export interface LayoutOptions {
  orientation?: TreeOrientation;
  /** Horizontal only: the height to fit; tiles shrink down to `minTileHeight` to fit it. */
  height?: number;
  /** Lanes across the tree direction (at least the highest col). Default 3. */
  cols?: number;
  tileHeight?: number;
  minTileHeight?: number;
  /** Horizontal only: tile width bounds. */
  minTileWidth?: number;
  maxTileWidth?: number;
  colGap?: number;
  rowGap?: number;
  padX?: number;
  padY?: number;
}

const V = { cols: 3, tileHeight: 70, colGap: 14, rowGap: 34, padX: 10, padY: 14 } as const;
const H = { cols: 3, tileHeight: 70, minTileHeight: 56, minTileWidth: 108, maxTileWidth: 160, colGap: 10, rowGap: 30, padX: 12, padY: 10 } as const;

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function span(nodes: readonly NodeDef[]) {
  return {
    minRow: Math.min(...nodes.map((n) => n.row)),
    maxRow: Math.max(...nodes.map((n) => n.row)),
    maxCol: Math.max(...nodes.map((n) => n.col)),
  };
}

function withEdges(nodes: readonly NodeDef[], tiles: Record<string, TileRect>, path: (a: TileRect, b: TileRect) => string) {
  const edges: TreeEdge[] = [];
  for (const n of nodes) {
    for (const req of n.requires) {
      const from = tiles[req];
      const to = tiles[n.id];
      if (from && to) edges.push({ from: req, to: n.id, d: path(from, to) });
    }
  }
  return edges;
}

/** Lays out the nodes of one tree. Vertical fits `width` (height grows); horizontal fits `height` where it can (width grows). */
export function layoutTree(nodes: readonly NodeDef[], width: number, options: LayoutOptions = {}): TreeLayout {
  if (nodes.length === 0) return { width, height: 0, tiles: {}, edges: [] };
  return options.orientation === 'horizontal' ? layoutHorizontal(nodes, width, options) : layoutVertical(nodes, width, options);
}

function layoutVertical(nodes: readonly NodeDef[], width: number, options: LayoutOptions): TreeLayout {
  const o = { ...V, ...options };
  const { minRow, maxRow, maxCol } = span(nodes);
  const cols = Math.max(o.cols, maxCol);
  const tileW = Math.max(40, (width - 2 * o.padX - (cols - 1) * o.colGap) / cols);
  const rowStep = o.tileHeight + o.rowGap;
  const tiles: Record<string, TileRect> = {};
  for (const n of nodes) {
    tiles[n.id] = { x: o.padX + (n.col - 1) * (tileW + o.colGap), y: o.padY + (n.row - minRow) * rowStep, w: tileW, h: o.tileHeight };
  }
  const height = 2 * o.padY + (maxRow - minRow) * rowStep + o.tileHeight;
  return { width, height, tiles, edges: withEdges(nodes, tiles, (a, b) => edgePath(a, b, o.colGap, o.rowGap)) };
}

function layoutHorizontal(nodes: readonly NodeDef[], width: number, options: LayoutOptions): TreeLayout {
  const o = { ...H, ...options };
  const { minRow, maxRow, maxCol } = span(nodes);
  const lanes = Math.max(o.cols, maxCol);
  const steps = maxRow - minRow + 1;
  const fitH = o.height === undefined ? o.tileHeight : (o.height - 2 * o.padY - (lanes - 1) * o.colGap) / lanes;
  const tileH = Math.max(o.minTileHeight, Math.min(o.tileHeight, fitH));
  const fitW = (width - 2 * o.padX - (steps - 1) * o.rowGap) / steps;
  const tileW = Math.max(o.minTileWidth, Math.min(o.maxTileWidth, fitW));
  const used = 2 * o.padX + steps * tileW + (steps - 1) * o.rowGap;
  const offsetX = used < width ? (width - used) / 2 : 0;
  const usedH = 2 * o.padY + lanes * tileH + (lanes - 1) * o.colGap;
  const offsetY = o.height !== undefined && usedH < o.height ? (o.height - usedH) / 2 : 0;
  const tiles: Record<string, TileRect> = {};
  for (const n of nodes) {
    tiles[n.id] = {
      x: offsetX + o.padX + (n.row - minRow) * (tileW + o.rowGap),
      y: offsetY + o.padY + (n.col - 1) * (tileH + o.colGap),
      w: tileW,
      h: tileH,
    };
  }
  return {
    width: Math.max(width, used),
    height: Math.max(o.height ?? 0, usedH),
    tiles,
    edges: withEdges(nodes, tiles, (a, b) => edgePathHorizontal(a, b, o.colGap, o.rowGap)),
  };
}

/**
 * Vertical connector from the bottom of `from` to the top of `to`. Adjacent rows
 * get a smooth curve; longer spans run down the gap between columns so they
 * never pass behind another tile.
 */
export function edgePath(from: TileRect, to: TileRect, colGap: number, rowGap: number): string {
  const sx = from.x + from.w / 2;
  const sy = from.y + from.h;
  const tx = to.x + to.w / 2;
  const ty = to.y;
  if (ty - sy <= rowGap + 0.5) {
    const my = (sy + ty) / 2;
    return `M${round(sx)} ${round(sy)} C${round(sx)} ${round(my)} ${round(tx)} ${round(my)} ${round(tx)} ${round(ty)}`;
  }
  const y1 = sy + rowGap / 2;
  const y2 = ty - rowGap / 2;
  const channelX = tx >= sx ? from.x + from.w + colGap / 2 : from.x - colGap / 2;
  return `M${round(sx)} ${round(sy)} L${round(sx)} ${round(y1)} L${round(channelX)} ${round(y1)} L${round(channelX)} ${round(y2)} L${round(tx)} ${round(y2)} L${round(tx)} ${round(ty)}`;
}

/** Horizontal connector from the right of `from` to the left of `to`; long spans run along the gap between lanes. */
export function edgePathHorizontal(from: TileRect, to: TileRect, laneGap: number, stepGap: number): string {
  const sx = from.x + from.w;
  const sy = from.y + from.h / 2;
  const tx = to.x;
  const ty = to.y + to.h / 2;
  if (tx - sx <= stepGap + 0.5) {
    const mx = (sx + tx) / 2;
    return `M${round(sx)} ${round(sy)} C${round(mx)} ${round(sy)} ${round(mx)} ${round(ty)} ${round(tx)} ${round(ty)}`;
  }
  const x1 = sx + stepGap / 2;
  const x2 = tx - stepGap / 2;
  const channelY = ty >= sy ? from.y + from.h + laneGap / 2 : from.y - laneGap / 2;
  return `M${round(sx)} ${round(sy)} L${round(x1)} ${round(sy)} L${round(x1)} ${round(channelY)} L${round(x2)} ${round(channelY)} L${round(x2)} ${round(ty)} L${round(tx)} ${round(ty)}`;
}
