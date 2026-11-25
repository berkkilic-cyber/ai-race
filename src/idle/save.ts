/**
 * Versioned saves. `serialize` writes `{ v, state }` as JSON; `deserialize` reads any
 * known version, migrates it step by step to the current one and repairs what it cannot
 * trust (unknown ids dropped, numbers made finite and non-negative, missing fields from a
 * fresh save). A save it cannot read at all gives a fresh save and `error`.
 */
import { GARAGE_VERSION, createGarage, emptyStats } from './garage';
import { evenStaff, labRequirementMet } from './lab';
import { modelSlots, traitDef } from './labRates';
import { amount, finite } from './num';
import type { GarageContent, GarageNews, GarageState, ModelCandidate, OfferId, ParadigmState, RaceLinkState, StaffSplit } from './types';
import { OFFER_IDS, STAFF_LANES } from './types';

export interface LoadResult {
  state: GarageState;
  /** The version the save was written in, when it was migrated. */
  migratedFrom?: number;
  error?: string;
}

export function serialize(state: GarageState): string {
  return JSON.stringify({ v: GARAGE_VERSION, state });
}

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Version 1 was the first prototype's flat format: `{ version: 1, tokens, lifetime, owned,
 * upgrades: { id: true }, models, hype, lastSeen, taps }`. Version 2 is GarageState.
 */
export function migrateV1(raw: Raw): Raw {
  const upgrades = isObj(raw.upgrades) ? Object.keys(raw.upgrades).filter((k) => (raw.upgrades as Raw)[k] === true) : [];
  return {
    version: 2,
    tokens: raw.tokens,
    genLifetime: raw.lifetime,
    generators: raw.owned,
    upgrades,
    generation: raw.models,
    hype: raw.hype,
    labRep: raw.models,
    now: raw.lastSeen,
    stats: { taps: raw.taps, modelsShipped: raw.models, tokensAllTime: raw.lifetime },
  };
}

/**
 * Version 2 had no lab: no stage, training, models, staff, happenings or automation. The
 * new fields are filled by `sanitize` (the stage is worked out from the save's progress,
 * staff split evenly, one training run ready if the lab is already past the Garage).
 */
export function migrateV2(raw: Raw): Raw {
  return { ...raw, version: 3, stage: undefined, training: undefined, models: [], staff: undefined, shipChoice: null, autoBuy: false, migratedLab: true };
}

/**
 * Version 3 had no Paradigm layer, no away-storage fields and twelve named models. Nothing to
 * move: the layer starts empty (absent), and a save past Model 12 keeps its generation (the
 * models that were "Model 13" … are now named; their ship thresholds are the new ladder's).
 */
export function migrateV3(raw: Raw): Raw {
  return { ...raw, version: 4, paradigm: undefined };
}

const MIGRATIONS: Record<number, (raw: Raw) => Raw> = { 1: migrateV1, 2: migrateV2, 3: migrateV3 };

function sanitizeModel(v: unknown, content: GarageContent): ModelCandidate | null {
  const cfg = content.training;
  if (!cfg || !isObj(v)) return null;
  if (typeof v.rarity !== 'string' || !cfg.rarities.some((r) => r.id === v.rarity)) return null;
  const trait = (x: unknown) => (isObj(x) && typeof x.trait === 'string' && traitDef(content, x.trait) && typeof x.value === 'number' && Number.isFinite(x.value) ? { trait: x.trait, value: x.value } : null);
  const boons = Array.isArray(v.boons) ? v.boons.map(trait).filter((x): x is { trait: string; value: number } => x !== null).slice(0, 6) : [];
  if (boons.length === 0) return null;
  const drawback = trait(v.drawback);
  const idx = (x: unknown, n: number) => (n > 0 ? Math.floor(num(x)) % n : 0);
  return {
    uid: Math.floor(num(v.uid, 1)),
    prefix: idx(v.prefix, cfg.prefixKeys.length),
    suffix: idx(v.suffix, cfg.suffixKeys.length),
    version: Math.min(99, num(v.version, 1)) || 1,
    rarity: v.rarity,
    desc: Math.floor(num(v.desc)),
    boons,
    ...(drawback ? { drawback } : {}),
  };
}

function num(v: unknown, fallback = 0): number {
  return amount(finite(v, fallback));
}

function time(v: unknown, fallback: number): number {
  return finite(v, fallback);
}

/** Repairs a version-2 object against the content; anything unusable comes from `fresh`. */
export function sanitize(raw: Raw, content: GarageContent, fresh: GarageState): GarageState {
  const genIds = new Set(content.generators.map((g) => g.id));
  const upIds = new Set(content.upgrades.map((u) => u.id));
  const achIds = new Set(content.achievements.map((a) => a.id));
  const generators: Record<string, number> = {};
  if (isObj(raw.generators)) {
    for (const [k, v] of Object.entries(raw.generators)) if (genIds.has(k)) generators[k] = Math.floor(num(v));
  }
  const strList = (v: unknown, allowed: Set<string>) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.has(x)))] : []);
  const stats = { ...emptyStats() };
  if (isObj(raw.stats)) for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = num(raw.stats[k], 0);
  const offers = {} as Record<OfferId, number[]>;
  for (const id of OFFER_IDS) {
    const list = isObj(raw.offers) ? raw.offers[id] : undefined;
    offers[id] = Array.isArray(list) ? list.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).slice(-50) : [];
  }
  const now = time(raw.now, fresh.now);
  const g = isObj(raw.golden) ? raw.golden : null;
  const golden =
    g && content.golden.defs.some((d) => d.id === g.id)
      ? { uid: Math.floor(num(g.uid, 1)), id: String(g.id), spawnedAt: time(g.spawnedAt, now), expiresAt: time(g.expiresAt, now), x: Math.min(1, num(g.x, 0.5)), y: Math.min(1, num(g.y, 0.5)) }
      : null;
  const i = isObj(raw.incident) ? raw.incident : null;
  const incident =
    i && content.incidents.defs.some((d) => d.id === i.id) && genIds.has(String(i.generator))
      ? { uid: Math.floor(num(i.uid, 1)), id: String(i.id), generator: String(i.generator), startedAt: time(i.startedAt, now), until: time(i.until, now), taps: Math.floor(num(i.taps)) }
      : null;
  const frenzy = isObj(raw.frenzy) && Number.isFinite(raw.frenzy.until) ? { mult: num(raw.frenzy.mult, 1) || 1, tapMult: num(raw.frenzy.tapMult, 1) || 1, until: time(raw.frenzy.until, 0) } : null;
  const news = Array.isArray(raw.news) ? (raw.news.filter((n) => isObj(n) && typeof n.key === 'string') as unknown as GarageNews[]).slice(-content.news.keep) : [];
  const offline = isObj(raw.offline) ? { awayMs: num(raw.offline.awayMs), creditedMs: num(raw.offline.creditedMs), tokens: num(raw.offline.tokens), doubled: raw.offline.doubled === true, ...(raw.offline.capped === true ? { capped: true } : {}), ...(typeof raw.offline.capMs === 'number' && raw.offline.capMs > 0 ? { capMs: num(raw.offline.capMs) } : {}) } : null;
  const choiceIds = new Set((content.shipDay?.choices ?? []).map((c) => c.id));
  const lastShip = isObj(raw.lastShip)
    ? { generation: num(raw.lastShip.generation), hypeGained: num(raw.lastShip.hypeGained), at: time(raw.lastShip.at, now), ...(typeof raw.lastShip.choice === 'string' && choiceIds.has(raw.lastShip.choice) ? { choice: raw.lastShip.choice } : {}) }
    : null;
  const stageMax = Math.max(0, (content.stages?.length ?? 1) - 1);
  const h = isObj(raw.happening) ? raw.happening : null;
  const happening =
    h && content.happenings?.defs.some((d) => d.id === h.id)
      ? { uid: Math.floor(num(h.uid, 1)), id: String(h.id), spawnedAt: time(h.spawnedAt, now), expiresAt: time(h.expiresAt, now), x: Math.min(1, num(h.x, 0.5)), y: Math.min(1, num(h.y, 0.5)) }
      : null;
  const tr = isObj(raw.training) ? raw.training : {};
  const queueMax = content.training?.queueMax ?? 0;
  const candidates = Array.isArray(tr.candidates) ? tr.candidates.map((c) => sanitizeModel(c, content)).filter((c): c is ModelCandidate => c !== null) : [];
  const staffTotal = content.staff?.total ?? 0;
  let staff: StaffSplit = evenStaff(staffTotal);
  if (isObj(raw.staff)) {
    const st = raw.staff;
    const split = { research: Math.floor(num(st.research)), product: Math.floor(num(st.product)), safety: Math.floor(num(st.safety)) };
    if (STAFF_LANES.reduce((sum, l) => sum + split[l], 0) === staffTotal) staff = split;
  }
  const state: GarageState = {
    version: GARAGE_VERSION,
    rng: Number.isInteger(raw.rng) && raw.rng !== 0 ? (raw.rng as number) : fresh.rng,
    createdAt: time(raw.createdAt, now),
    now,
    tokens: num(raw.tokens),
    genLifetime: num(raw.genLifetime),
    generators,
    upgrades: strList(raw.upgrades, upIds),
    generation: Math.floor(num(raw.generation)),
    hype: num(raw.hype),
    labRep: num(raw.labRep),
    combo: { count: 0, lastAt: 0 },
    frenzy,
    boostUntil: time(raw.boostUntil, 0),
    golden,
    nextGoldenAt: time(raw.nextGoldenAt, now + content.golden.firstAfterMs),
    incident,
    nextIncidentAt: time(raw.nextIncidentAt, now + content.incidents.firstAfterMs),
    nextHeadlineAt: time(raw.nextHeadlineAt, now),
    news,
    offers,
    offline,
    achievements: strList(raw.achievements, achIds),
    stats,
    lastShip,
    uidSeq: Math.max(1, Math.floor(num(raw.uidSeq, 1))),
    stage: Math.min(stageMax, Math.floor(num(raw.stage))),
    happening,
    nextHappeningAt: time(raw.nextHappeningAt, now + (content.happenings?.firstAfterMs ?? 0)),
    training: { charges: Math.min(queueMax + 10, Math.floor(num(tr.charges))), nextChargeAt: time(tr.nextChargeAt, 0), candidates: candidates.length ? candidates : null },
    models: [],
    staff,
    shipChoice: typeof raw.shipChoice === 'string' && choiceIds.has(raw.shipChoice) ? raw.shipChoice : null,
    autoBuy: raw.autoBuy === true,
    nextAutoBuyAt: time(raw.nextAutoBuyAt, 0),
    bonusOffer: null,
    ...(raw.paidStorage === true ? { paidStorage: true } : {}),
  };
  const race = sanitizeRace(raw.race, now);
  if (race) state.race = race;
  const paradigm = sanitizeParadigm(raw.paradigm, content);
  if (paradigm) state.paradigm = paradigm;
  // Stages are earned by progress that never resets: a save is at least where its progress puts it.
  const stages = content.stages ?? [];
  while (state.stage + 1 < stages.length && stages[state.stage + 1].requires.every((r) => labRequirementMet(state, r))) state.stage += 1;
  state.models = (Array.isArray(raw.models) ? raw.models.map((m) => sanitizeModel(m, content)).filter((m): m is ModelCandidate => m !== null) : []).slice(0, modelSlots(state, content));
  const uids = [...state.models, ...candidates].map((m) => m.uid);
  if (uids.length) state.uidSeq = Math.max(state.uidSeq, ...uids.map((u) => u + 1));
  if (raw.migratedLab === true && content.training && stages.slice(0, state.stage + 1).some((st) => st.mechanic === 'training')) state.training = { charges: 1, nextChargeAt: now + content.training.cooldownMs, candidates: null };
  return state;
}

/** The Paradigm layer of a save (undefined when it has none, it is unusable, or the content has no layer). */
function sanitizeParadigm(value: unknown, content: GarageContent): ParadigmState | undefined {
  if (!isObj(value) || !content.paradigm) return undefined;
  const ids = new Set(content.paradigm.nodes.map((n) => n.id));
  const nodes = Array.isArray(value.nodes) ? [...new Set(value.nodes.filter((x): x is string => typeof x === 'string' && ids.has(x)))] : [];
  return {
    count: Math.floor(num(value.count)),
    points: Math.floor(num(value.points)),
    earned: Math.floor(num(value.earned)),
    nodes,
    autoShip: value.autoShip === true,
    bestGeneration: Math.floor(num(value.bestGeneration)),
  };
}

/** The race link of a save (undefined when it has none or it is unusable). */
function sanitizeRace(value: unknown, now: number): RaceLinkState | undefined {
  if (!isObj(value)) return undefined;
  const r = value;
  const l = isObj(r.last) ? r.last : null;
  const seeds = Array.isArray(r.seeds)
    ? r.seeds.filter((e): e is Raw => isObj(e) && typeof e.seed === 'number' && Number.isFinite(e.seed)).map((e) => ({ seed: e.seed as number, plays: Math.max(1, Math.floor(num(e.plays, 1))) })).slice(-200)
    : [];
  return {
    repProgress: Math.min(0.999, num(r.repProgress)),
    repFromRaces: num(r.repFromRaces),
    races: Math.floor(num(r.races)),
    boostFrom: Math.max(0, time(r.boostFrom, 0)),
    boostUntil: Math.max(0, time(r.boostUntil, 0)),
    last: l ? { rep: num(l.rep), boostMs: num(l.boostMs), won: l.won === true, repeat: l.repeat === true, at: time(l.at, now), seen: l.seen === true } : null,
    seeds,
  };
}

/** Reads a save written by any version. `now` is used for a fresh save when the text is unusable. */
export function deserialize(text: string | null | undefined, content: GarageContent, now: number): LoadResult {
  const fresh = createGarage(content, now);
  if (!text) return { state: fresh };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: fresh, error: 'unreadable' };
  }
  if (!isObj(parsed)) return { state: fresh, error: 'unreadable' };
  // v2+: { v, state }; v1 had no wrapper and carried `version: 1`.
  let version = typeof parsed.v === 'number' ? parsed.v : typeof parsed.version === 'number' ? parsed.version : 0;
  let raw: Raw | null = typeof parsed.v === 'number' ? (isObj(parsed.state) ? parsed.state : null) : parsed;
  if (!raw || version < 1) return { state: fresh, error: 'unknownVersion' };
  if (version > GARAGE_VERSION) return { state: fresh, error: 'newerVersion' };
  const from = version;
  while (version < GARAGE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { state: fresh, error: 'noMigration' };
    raw = step(raw);
    version += 1;
  }
  const state = sanitize(raw, content, fresh);
  return from !== GARAGE_VERSION ? { state, migratedFrom: from } : { state };
}
