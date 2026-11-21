import { Platform } from 'react-native';

import type { GameState, LabState, MomentKind, NewsItem } from '@/engine';

import { useGameStore } from '../store/game';

/**
 * Web debug pages only (`?debug=1`): `window.__mapLive` lets the screenshot and touch
 * scripts put live-map things on screen deterministically. Each call writes a modified copy
 * of the run into the store, exactly as a tick would; nothing here runs in a normal build.
 */
export interface MapLiveDebug {
  /** Puts a moment of this kind on the map for the player; returns its uid. */
  spawnMoment(kind: MomentKind, opts?: { defId?: string; regionId?: string; life?: number }): string | null;
  /** A news item of kind 'launch' for a lab (default: the strongest rival), at a tier (default: its tier + 1). */
  launch(labId?: string, tier?: number): void;
  /** A news item of kind 'entry' through a channel (default: the player crossing an ocean link). */
  entry(opts?: { labId?: string; from?: string; to?: string; channel?: string }): { from: string; to: string } | null;
  /** Gives the player data centres at these levels (in its regions, home first); `offline` takes the last one offline. */
  dataCentres(levels: number[], offline?: boolean): void;
  /** Gives the player nodes (e.g. robotics, lobbying), without paying. */
  giveNodes(ids: string[]): void;
  /** Spreads the player into the `count` regions nearest its home (adoption `share`), for a lived-in map. */
  spread(count: number, share?: number): void;
  /** Raises the player's bonus compute (a GPU crate flies in). */
  addCompute(amount: number): void;
  /** Screen points of the player's live bubbles, by uid, relative to the page. */
  bubbles(): Record<string, { x: number; y: number }>;
}

let counter = 0;

function write(fn: (state: GameState) => GameState | null): void {
  const { state } = useGameStore.getState();
  if (!state) return;
  const next = fn(state);
  if (next) useGameStore.setState({ state: next });
}

function withPlayer(state: GameState, change: (lab: LabState) => LabState): GameState {
  const lab = state.labs[state.playerLabId];
  return { ...state, labs: { ...state.labs, [lab.id]: change(lab) } };
}

function presentRegions(state: GameState): string[] {
  const lab = state.labs[state.playerLabId];
  const ids = Object.keys(lab.adoption).filter((id) => (lab.adoption[id] ?? 0) > 0);
  return [lab.homeRegion, ...ids.filter((id) => id !== lab.homeRegion).sort((a, b) => (lab.adoption[b] ?? 0) - (lab.adoption[a] ?? 0))];
}

function pushNews(state: GameState, item: NewsItem): GameState {
  return { ...state, news: [...state.news, item] };
}

const handle: MapLiveDebug = {
  spawnMoment(kind, opts = {}) {
    let uid: string | null = null;
    write((state) => {
      const pack = useGameStore.getState().pack;
      const def = pack.moments.find((d) => (opts.defId ? d.id === opts.defId : d.kind === kind));
      if (!def) return null;
      const taken = new Set(state.moments.filter((m) => m.labId === state.playerLabId).map((m) => m.regionId));
      const regionId = opts.regionId ?? [...presentRegions(state), ...pack.regions.map((r) => r.id)].find((id) => !taken.has(id));
      if (!regionId) return null;
      uid = `dbg${++counter}-${def.id}`;
      const life = opts.life ?? def.lifetimeTicks;
      return { ...state, moments: [...state.moments, { uid, defId: def.id, labId: state.playerLabId, regionId, spawnTick: state.tick, expiresTick: state.tick + life }] };
    });
    return uid;
  },
  launch(labId, tier) {
    write((state) => {
      const pack = useGameStore.getState().pack;
      const id = labId ?? state.labOrder.filter((l) => l !== state.playerLabId && state.labs[l].active)[0] ?? state.playerLabId;
      const lab = state.labs[id];
      const owned = pack.nodes.filter((n) => (n.capabilityLevel ?? 0) > 0 && lab.ownedNodes.includes(n.id)).reduce((m, n) => Math.max(m, n.capabilityLevel ?? 0), 0);
      const t = tier ?? owned + 1;
      const node = pack.nodes.find((n) => n.capabilityLevel === t) ?? pack.nodes.find((n) => (n.capabilityLevel ?? 0) > 0);
      if (!node) return null;
      const mine = id === state.playerLabId;
      return pushNews(state, {
        tick: state.tick,
        kind: 'launch',
        nodeId: node.id,
        tier: t,
        textKey: mine ? 'engine.news.launch.player' : 'engine.news.launch.rival',
        tone: mine ? 'good' : 'bad',
        params: { lab: id, model: node.nameKey, tier: t },
        regionId: lab.homeRegion,
        labId: id,
      });
    });
  },
  entry(opts = {}) {
    let out: { from: string; to: string } | null = null;
    write((state) => {
      const pack = useGameStore.getState().pack;
      const labId = opts.labId ?? state.playerLabId;
      const channel = opts.channel ?? 'ocean';
      let from = opts.from;
      let to = opts.to;
      if (!from || !to) {
        const lab = state.labs[labId];
        for (const r of pack.regions) {
          if (!((lab.adoption[r.id] ?? 0) > 0)) continue;
          const links = Object.entries(r.linkBarriers ?? {}).filter(([, b]) => channel === 'viral' || b.includes(channel));
          const target = (channel === 'viral' ? r.neighbors.map((n) => [n, []] as const) : links).find(([n]) => !((lab.adoption[n] ?? 0) > 0));
          if (target) {
            from = r.id;
            to = target[0];
            break;
          }
        }
      }
      if (!from || !to) return null;
      out = { from, to };
      return pushNews(state, {
        tick: state.tick,
        kind: 'entry',
        textKey: 'engine.news.entry.channel',
        tone: labId === state.playerLabId ? 'good' : 'neutral',
        params: { lab: labId, region: to, from, channel },
        regionId: to,
        labId,
      });
    });
    return out;
  },
  dataCentres(levels, offline = false) {
    write((state) =>
      withPlayer(state, (lab) => {
        const regions = presentRegions(state);
        const sites = levels.map((level, i) => ({
          id: `dbg-dc${++counter}`,
          regionId: regions[i % regions.length],
          level,
          ...(offline && i === levels.length - 1 ? { disabledUntilTick: state.tick + 1000 } : {}),
        }));
        return { ...lab, dataCentres: [...lab.dataCentres, ...sites] };
      }),
    );
  },
  giveNodes(ids) {
    write((state) => withPlayer(state, (lab) => ({ ...lab, ownedNodes: [...lab.ownedNodes, ...ids.filter((id) => !lab.ownedNodes.includes(id))] })));
  },
  spread(count, share = 0.25) {
    write((state) => {
      const pack = useGameStore.getState().pack;
      const lab = state.labs[state.playerLabId];
      const seen = new Set([lab.homeRegion]);
      const order = [lab.homeRegion];
      for (let i = 0; i < order.length && order.length < count + 1; i++) {
        for (const n of pack.regions.find((r) => r.id === order[i])?.neighbors ?? []) {
          if (!seen.has(n) && order.length < count + 1) {
            seen.add(n);
            order.push(n);
          }
        }
      }
      return withPlayer(state, (l) => {
        const adoption = { ...l.adoption };
        order.forEach((id, i) => (adoption[id] = Math.max(adoption[id] ?? 0, share * (1 - i / (order.length + 1)))));
        return { ...l, adoption };
      });
    });
  },
  addCompute(amount) {
    write((state) => withPlayer(state, (lab) => ({ ...lab, computeBonus: lab.computeBonus + amount })));
  },
  bubbles() {
    const out: Record<string, { x: number; y: number }> = {};
    if (typeof document === 'undefined') return out;
    document.querySelectorAll('[data-testid^="moment-boost-"], [data-testid^="moment-threat-"]').forEach((el) => {
      const id = (el.getAttribute('data-testid') ?? '').replace(/^moment-(boost|threat)-/, '');
      const b = el.getBoundingClientRect();
      out[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    return out;
  },
};

/** Installs `window.__mapLive` on web debug pages (those where the shell's `window.__game` handle exists). */
export function installMapLiveDebug(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const w = window as unknown as { __game?: unknown; __mapLive?: MapLiveDebug };
  if (w.__game) w.__mapLive = handle;
}
