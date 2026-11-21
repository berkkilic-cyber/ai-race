import { Platform } from 'react-native';

import { advance, createGarage, type GarageState, type OfferId } from '@/idle';

import { requestRewardedAd } from '../ads';
import { t } from '../i18n';
import { skewClock, garageNow } from './clock';
import { useGarageStore } from './store';

/**
 * Debug helpers for screenshots and manual checks, on web with `/garage?debug=1`:
 * `window.__garage` sets tokens, fast-forwards the clock (an offline return), forces a
 * golden moment or an incident, opens each ad placement and loads sample scenes.
 */
export interface GarageDebug {
  store: typeof useGarageStore;
  setTokens(n: number): void;
  /** Moves the clock forward; more than a minute is an offline return. */
  fastForward(ms: number): void;
  golden(id?: string): void;
  incident(id?: string, generator?: string): void;
  frenzy(seconds?: number): void;
  /** Opens a placement's ad as its button would (the mock shows its test ad). */
  ad(placement: OfferId): Promise<string>;
  /** Replaces the save with a sample: 'fresh', 'mid', 'late', 'ship'. */
  scene(name: 'fresh' | 'mid' | 'late' | 'ship'): void;
  state(): GarageState | null;
}

function patch(change: (s: GarageState) => GarageState): void {
  const st = useGarageStore.getState();
  if (!st.state) return;
  st.replace(change(advance(st.state, st.content, garageNow())));
}

function sample(name: 'fresh' | 'mid' | 'late' | 'ship'): GarageState {
  const { content } = useGarageStore.getState();
  const now = garageNow();
  const base = createGarage(content, now, 11);
  const quiet = { ...base, nextGoldenAt: now + 10 * 60_000, nextIncidentAt: now + 10 * 60_000 };
  const news = content.news.headlines.slice(0, 5).map((h, i) => ({ uid: 100 + i, key: h.key, kind: 'headline' as const, at: now - (5 - i) * 20_000 }));
  if (name === 'fresh') return { ...quiet, news: news.slice(0, 1) };
  if (name === 'mid')
    return {
      ...quiet,
      tokens: 48_200,
      genLifetime: 412_000,
      generators: { intern: 32, gpu: 21, closet: 14, scraper: 6 },
      upgrades: ['intern-a', 'intern-b', 'gpu-a', 'tap-1', 'tap-2', 'tap-rate-1', 'sticky-notes', 'closet-a'],
      stats: { ...base.stats, taps: 1820, bestCombo: 64, tokensAllTime: 412_000, goldenCaught: 2, playMs: 9 * 60_000 },
      achievements: ['first-tap', 'taps-1k', 'combo-50', 'golden-1'],
      news,
      uidSeq: 200,
    };
  if (name === 'ship')
    return {
      ...quiet,
      tokens: 3.1e8,
      genLifetime: 1.42e9,
      generators: { intern: 80, gpu: 62, closet: 48, scraper: 35, hall: 22 },
      upgrades: content.upgrades.filter((u) => u.requires.every((r) => r.type !== 'generation')).slice(0, 26).map((u) => u.id),
      stats: { ...base.stats, taps: 6400, bestCombo: 120, tokensAllTime: 1.42e9, goldenCaught: 5, playMs: 17 * 60_000 },
      achievements: ['first-tap', 'taps-1k', 'combo-50', 'golden-1', 'tokens-1m', 'tokens-1b'],
      news,
      uidSeq: 200,
    };
  return {
    ...quiet,
    tokens: 7.4e15,
    genLifetime: 2.2e16,
    generation: 5,
    hype: 212,
    labRep: 5,
    generators: { intern: 150, gpu: 140, closet: 120, scraper: 110, hall: 95, chips: 80, power: 61, robotics: 33 },
    upgrades: content.upgrades.filter((u) => !/(orbital|universe)/.test(u.id)).slice(0, 44).map((u) => u.id),
    stats: { ...base.stats, taps: 41_000, bestCombo: 166, tokensAllTime: 9.1e16, modelsShipped: 5, goldenCaught: 31, incidentsFixed: 12, offlineTokens: 3.3e15, playMs: 3 * 3_600_000 },
    achievements: ['first-tap', 'taps-1k', 'taps-10k', 'combo-50', 'combo-150', 'golden-1', 'golden-25', 'fix-10', 'tokens-1m', 'tokens-1b', 'tokens-1t', 'tokens-1qa', 'ship-1', 'ship-3', 'secret-42'],
    news,
    uidSeq: 200,
  };
}

let installed = false;

export function installGarageDebug(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1/.test(window.location?.search ?? '')) return;
  installed = true;
  const api: GarageDebug = {
    store: useGarageStore,
    setTokens: (n) => patch((s) => ({ ...s, tokens: n, genLifetime: Math.max(s.genLifetime, n) })),
    fastForward(ms) {
      useGarageStore.getState().save(true);
      skewClock(ms);
      useGarageStore.getState().tick();
    },
    golden: (id) =>
      patch((s) => {
        const { content } = useGarageStore.getState();
        const def = content.golden.defs.find((d) => d.id === id) ?? content.golden.defs[0];
        return { ...s, golden: { uid: s.uidSeq + 1, id: def.id, spawnedAt: s.now, expiresAt: s.now + content.golden.lifetimeMs * 3, x: 0.78, y: 0.42 }, uidSeq: s.uidSeq + 1 };
      }),
    incident: (id, generator) =>
      patch((s) => {
        const { content } = useGarageStore.getState();
        const def = content.incidents.defs.find((d) => d.id === id) ?? content.incidents.defs[0];
        const tier = generator ?? content.generators.filter((g) => (s.generators[g.id] ?? 0) > 0).pop()?.id ?? content.generators[0].id;
        return { ...s, incident: { uid: s.uidSeq + 1, id: def.id, generator: tier, startedAt: s.now, until: s.now + def.durationMs, taps: 1 }, uidSeq: s.uidSeq + 1 };
      }),
    frenzy: (seconds = 30) => patch((s) => ({ ...s, frenzy: { mult: 7, tapMult: 1, until: s.now + seconds * 1000 } })),
    ad: (placement) => requestRewardedAd(placement, t(`ui.ads.name.${placement}`)),
    scene: (name) => useGarageStore.getState().replace(sample(name)),
    state: () => useGarageStore.getState().state,
  };
  (window as unknown as { __garage: GarageDebug }).__garage = api;
}
