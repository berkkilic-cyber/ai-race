import { Platform } from 'react-native';

import { advance, createGarage, evenStaff, launchTraining, nextStage, type GarageState, type OfferId } from '@/idle';

import { requestRewardedAd } from '../ads';
import { t } from '../i18n';
import { freezeClock, skewClock, garageNow } from './clock';
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
  /** Replaces the save with a sample: 'fresh', 'mid', 'late', 'ship', or a stage's sample: 'office', 'datacentre', 'town', 'latent'. */
  scene(name: SceneName): void;
  /** Jumps to stage `n` (keeps the rest of the save). */
  stage(n: number): void;
  /** Grants tokens (this generation and all time). */
  grant(n: number): void;
  /** Stops the Garage's clock (true) or lets it run again (false): a screenshot of a busy lab stays put. */
  freeze(on: boolean): void;
  /** Sets how many of each generator the lab owns (others unchanged), to see the room fill up. */
  owned(counts: Record<string, number>): void;
  /** A training run with its three candidates, ready to pick. */
  training(): void;
  /** A lab happening now ('pizza', 'overheat' …). */
  happening(id?: string): void;
  /** Opens ship day (the save must be able to ship; use scene('ship')). */
  shipDay(): void;
  /** The bonus multiplier offer, as if a bonus had just been tapped (`source` golden or happening). */
  bonusOffer(source?: 'golden' | 'happening'): void;
  state(): GarageState | null;
}

function patch(change: (s: GarageState) => GarageState): void {
  const st = useGarageStore.getState();
  if (!st.state) return;
  st.replace(change(advance(st.state, st.content, garageNow())));
}

type SceneName = 'fresh' | 'mid' | 'late' | 'ship' | 'office' | 'datacentre' | 'town' | 'latent';

function sample(name: SceneName): GarageState {
  const { content } = useGarageStore.getState();
  const now = garageNow();
  const base = createGarage(content, now, 11);
  const quiet = { ...base, nextGoldenAt: now + 10 * 60_000, nextIncidentAt: now + 10 * 60_000, nextHappeningAt: now + 10 * 60_000 };
  const stageIndex = (id: string) => Math.max(0, content.stages?.findIndex((st) => st.id === id) ?? 0);
  const kept = (state: GarageState, runs: number): GarageState => {
    let st = state;
    for (let i = 0; i < runs; i++) {
      st = launchTraining({ ...st, training: { ...st.training, charges: Math.max(1, st.training.charges) } }, content, st.now).state;
      const c = st.training.candidates;
      if (c) st = { ...st, models: [...st.models, c[i % c.length]], training: { ...st.training, candidates: null } };
    }
    return st;
  };
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
  if (name === 'office')
    return kept(
      {
        ...quiet,
        stage: stageIndex('office'),
        tokens: 2.6e6,
        genLifetime: 9.4e6,
        generators: { intern: 41, gpu: 30, closet: 18, scraper: 7, hall: 1 },
        upgrades: ['intern-a', 'intern-b', 'gpu-a', 'gpu-b', 'tap-1', 'tap-2', 'tap-rate-1', 'sticky-notes', 'closet-a', 'scraper-a'],
        stats: { ...base.stats, taps: 3100, bestCombo: 80, tokensAllTime: 9.4e6, playMs: 11 * 60_000 },
        training: { charges: 2, nextChargeAt: now + 140_000, candidates: null },
        news,
        uidSeq: 200,
      },
      1,
    );
  if (name === 'datacentre')
    return kept(
      {
        ...quiet,
        stage: stageIndex('datacentre'),
        generation: 2,
        hype: 18,
        labRep: 2,
        tokens: 4.1e9,
        genLifetime: 2.2e10,
        generators: { intern: 90, gpu: 80, closet: 66, scraper: 51, hall: 30, chips: 12, power: 3 },
        upgrades: content.upgrades.filter((u) => u.requires.every((r) => r.type !== 'generation' || r.min <= 2)).slice(0, 34).map((u) => u.id),
        stats: { ...base.stats, taps: 15_000, bestCombo: 120, tokensAllTime: 8e10, modelsShipped: 2, playMs: 50 * 60_000 },
        training: { charges: 1, nextChargeAt: now + 95_000, candidates: null },
        staff: { research: 3, product: 6, safety: 3 },
        news,
        uidSeq: 200,
      },
      2,
    );
  if (name === 'town' || name === 'latent') {
    const gen = name === 'town' ? 5 : 8;
    return kept(
      {
        ...quiet,
        stage: stageIndex(name),
        generation: gen,
        hype: name === 'town' ? 240 : 21_000,
        labRep: gen,
        tokens: name === 'town' ? 7.4e15 : 3.3e21,
        genLifetime: name === 'town' ? 2.2e16 : 9e21,
        generators:
          name === 'town'
            ? { intern: 150, gpu: 140, closet: 120, scraper: 110, hall: 95, chips: 80, power: 61, robotics: 33 }
            : { intern: 260, gpu: 230, closet: 210, scraper: 190, hall: 170, chips: 150, power: 120, robotics: 90, orbital: 50, universe: 4 },
        upgrades: content.upgrades.filter((u) => u.requires.every((r) => r.type !== 'generation' || r.min <= gen)).slice(0, 50).map((u) => u.id),
        stats: { ...base.stats, taps: 41_000, bestCombo: 166, tokensAllTime: name === 'town' ? 9.1e16 : 2e22, modelsShipped: gen, goldenCaught: 31, incidentsFixed: 12, playMs: 3 * 3_600_000 },
        training: { charges: 3, nextChargeAt: 0, candidates: null },
        staff: { research: 4, product: 5, safety: 3 },
        autoBuy: name === 'latent',
        nextAutoBuyAt: now + 4000,
        news,
        uidSeq: 200,
      },
      name === 'town' ? 3 : 4,
    );
  }
  return {
    ...quiet,
    staff: evenStaff(content.staff?.total ?? 0),
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
    scene: (name) => {
      // A sample sits in the stage its progress has earned (no "the lab moved" card).
      let st = sample(name);
      const { content } = useGarageStore.getState();
      for (let next = nextStage(st, content); next && next.progress >= 1; next = nextStage(st, content)) st = { ...st, stage: next.index };
      useGarageStore.getState().replace(st);
    },
    stage: (n) => patch((s) => ({ ...s, stage: Math.max(0, Math.min((useGarageStore.getState().content.stages?.length ?? 1) - 1, n)) })),
    grant: (n) => patch((s) => ({ ...s, tokens: s.tokens + n, genLifetime: s.genLifetime + n, stats: { ...s.stats, tokensAllTime: s.stats.tokensAllTime + n } })),
    freeze: (on) => freezeClock(on),
    owned: (counts) =>
      patch((s) => {
        const generators = { ...s.generators };
        for (const [id, n] of Object.entries(counts)) if (Number.isFinite(n) && n >= 0) generators[id] = Math.floor(n);
        return { ...s, generators };
      }),
    training: () =>
      patch((s) => {
        const { content } = useGarageStore.getState();
        const ready = { ...s, training: { ...s.training, charges: Math.max(1, s.training.charges), candidates: null } };
        return launchTraining(ready, content, s.now).state;
      }),
    happening: (id) =>
      patch((s) => {
        const { content } = useGarageStore.getState();
        const defs = content.happenings?.defs ?? [];
        const def = defs.find((d) => d.id === id) ?? defs[0];
        if (!def) return s;
        return { ...s, happening: { uid: s.uidSeq + 1, id: def.id, spawnedAt: s.now, expiresAt: s.now + 60_000, x: 0.5, y: 0.5 }, nextHappeningAt: s.now + 120_000, uidSeq: s.uidSeq + 1 };
      }),
    shipDay: () => useGarageStore.getState().openShipDay(),
    bonusOffer: (source = 'golden') =>
      patch((s) => ({ ...s, bonusOffer: { reward: 5000, until: s.now + 60_000, source, id: source === 'golden' ? 'angel' : 'pizza', x: 0.62, y: 0.45 } })),
    state: () => useGarageStore.getState().state,
  };
  (window as unknown as { __garage: GarageDebug }).__garage = api;
}
