/**
 * Spread routes: when a lab first reaches a region through a channel (news of kind 'entry'
 * with params channel and from), an arc is drawn from the source region with the channel's
 * icon travelling along it once, then a faint line stays for a while. Always for the
 * player; for rivals only when the arc ends where the player is, or it is a long crossing.
 */
import { create } from 'zustand';

import type { ContentPack, GameState, NewsItem } from '@/engine';

import { channelIcon, type MapLiveConfig } from './config';

export type RouteStyle = 'viral' | 'crossing' | 'plain';

export interface Route {
  id: number;
  labId: string;
  from: string;
  to: string;
  icon: string;
  style: RouteStyle;
  mine: boolean;
  /** Date.now() when it appeared. */
  born: number;
  /** True while the icon travels the arc. */
  flying: boolean;
}

/** The icon's trip along the arc. */
export const FLIGHT_MS = 1600;
/** How long the faint line stays after the trip. */
export const FAINT_MS = 24000;
export const MAX_ROUTES = 6;

/** The route an entry news item describes, if it should be drawn. Pure. */
export function routeFor(item: NewsItem, state: GameState, pack: ContentPack, config: MapLiveConfig): Omit<Route, 'id' | 'born' | 'flying'> | null {
  if (item.kind !== 'entry' || !item.params) return null;
  const channel = item.params.channel;
  const from = item.params.from;
  const to = item.regionId;
  const labId = item.labId ?? (typeof item.params.lab === 'string' ? item.params.lab : undefined);
  if (typeof channel !== 'string' || typeof from !== 'string' || !to || !labId || from === to) return null;
  const mine = labId === state.playerLabId;
  const def = (pack.channels ?? []).find((c) => c.id === channel);
  const viral = config.viral.includes(channel) || def?.kind === 'jump' || item.params.via !== undefined;
  const source = pack.regions.find((r) => r.id === from);
  const linkBarriers = source?.linkBarriers?.[to] ?? [];
  const crossing = !viral && (config.crossings.includes(channel) || linkBarriers.some((b) => config.crossings.includes(b)));
  if (!mine) {
    const playerThere = (state.labs[state.playerLabId]?.adoption[to] ?? 0) > 0;
    if (!playerThere && !crossing) return null;
  }
  return { labId, from, to, icon: channelIcon(config, channel), style: viral ? 'viral' : crossing ? 'crossing' : 'plain', mine };
}

/** Control point of the arc between two map points: above the chord, higher for long crossings. */
export function arcControl(a: readonly [number, number], b: readonly [number, number], style: RouteStyle): [number, number] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const h = len * (style === 'crossing' ? 0.38 : style === 'viral' ? 0.3 : 0.2);
  // The normal that points up the screen (map y grows downward).
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return [mx + nx * h, my + ny * h];
}

/** A point on a quadratic Bezier at t (a worklet: runners call it on the UI thread). */
export function bezier(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): [number, number] {
  'worklet';
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

/** Length of the quadratic Bezier (sampled). */
export function arcLength(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): number {
  let len = 0;
  let [px, py] = [x0, y0];
  for (let i = 1; i <= 24; i++) {
    const [x, y] = bezier(i / 24, x0, y0, cx, cy, x1, y1);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

interface RoutesStore {
  routes: Route[];
  /** Adds a route and returns its id. */
  add(route: Omit<Route, 'id' | 'born' | 'flying'>): number;
  /** The icon arrived. */
  land(id: number): void;
  remove(id: number): void;
  clear(): void;
}

let nextId = 1;

/** The routes on the map now (shared by the arc canvas inside the map and the travelling icons above it). */
export const useRoutesStore = create<RoutesStore>()((set) => ({
  routes: [],
  add: (route) => {
    const id = nextId++;
    set((s) => ({ routes: [...s.routes, { ...route, id, born: Date.now(), flying: true }].slice(-MAX_ROUTES) }));
    return id;
  },
  land: (id) => set((s) => ({ routes: s.routes.map((r) => (r.id === id && r.flying ? { ...r, flying: false } : r)) })),
  remove: (id) => set((s) => ({ routes: s.routes.filter((r) => r.id !== id) })),
  clear: () => set({ routes: [] }),
}));
