/**
 * Pure helpers for the moment bubbles: where a bubble sits, what a collect gained (measured
 * from the state before and after the dispatch) and what an expiry costs (read from the
 * moment's own onExpire effects in the pack, never worked out by the UI).
 */
import { getCompute, getUsers, type ContentPack, type Effect, type GameState, type MomentDef, type MomentState } from '@/engine';

import { fmtCash, fmtCompact, fmtUsers } from '../format';
import { t } from '../i18n';

/** Visual bubble diameter and touch target (points). */
export const BUBBLE = 40;
export const BUBBLE_HIT = 30;
/** How far above the region's marker point the bubble floats (clear of the data-centre racks below it). */
export const BUBBLE_RISE = 36;

/** Offsets (points) of the n-th bubble in one region from the marker point. */
const SLOTS: [number, number][] = [
  [0, -BUBBLE_RISE],
  [-44, -BUBBLE_RISE + 8],
  [44, -BUBBLE_RISE + 8],
  [0, -BUBBLE_RISE - 44],
];

export function bubbleOffset(slot: number): [number, number] {
  return SLOTS[slot % SLOTS.length];
}

/**
 * A slot per moment: the first free slot in its region, keeping the slots of bubbles already
 * shown (so a bubble never jumps when another appears or leaves).
 */
export function assignSlots(moments: readonly Pick<MomentState, 'uid' | 'regionId'>[], prev: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const used = new Map<string, Set<number>>();
  const take = (region: string, slot: number) => {
    let set = used.get(region);
    if (!set) used.set(region, (set = new Set()));
    set.add(slot);
  };
  for (const m of moments) {
    const s = prev.get(m.uid);
    if (s !== undefined) {
      out.set(m.uid, s);
      take(m.regionId, s);
    }
  }
  for (const m of moments) {
    if (out.has(m.uid)) continue;
    const set = used.get(m.regionId);
    let slot = 0;
    while (set?.has(slot)) slot++;
    out.set(m.uid, slot);
    take(m.regionId, slot);
  }
  return out;
}

export interface Snapshot {
  hype: number;
  cash: number;
  compute: number;
  users: number;
  regulation: number;
  backlash: number;
  agi: number;
}

/** The player's figures a moment can change. */
export function snapshot(state: GameState, pack: ContentPack): Snapshot {
  const lab = state.labs[state.playerLabId];
  return {
    hype: lab.hype,
    cash: lab.cash,
    compute: getCompute(state, pack, lab.id),
    users: getUsers(state, pack, lab.id),
    regulation: lab.regulation,
    backlash: lab.backlash,
    agi: lab.agiProgress,
  };
}

export interface DeltaLine {
  text: string;
  /** True when the change is good for the player. */
  good: boolean;
}

const sign = (n: number) => (n > 0 ? '+' : '−');
const one = (n: number) => String(Math.round(Math.abs(n) * 10) / 10);

/** Changes between two snapshots worth showing, biggest news first. */
export function deltaLines(before: Snapshot, after: Snapshot): DeltaLine[] {
  const out: DeltaLine[] = [];
  const d = (k: keyof Snapshot) => after[k] - before[k];
  const cash = d('cash');
  if (Math.abs(cash) >= 0.05) out.push({ text: `${sign(cash)}${fmtCash(Math.abs(cash))}`, good: cash > 0 });
  const hype = d('hype');
  if (Math.abs(hype) >= 0.05) out.push({ text: `${sign(hype)}${fmtCompact(Math.abs(hype))} ${t('term.hype')}`, good: hype > 0 });
  const compute = d('compute');
  if (Math.abs(compute) >= 0.05) out.push({ text: `${sign(compute)}${one(compute)} ${t('term.compute')}`, good: compute > 0 });
  const users = d('users');
  if (Math.abs(users) >= 0.0005) out.push({ text: `${sign(users)}${fmtUsers(Math.abs(users))} ${t('term.users')}`, good: users > 0 });
  for (const meter of ['regulation', 'backlash'] as const) {
    const m = d(meter);
    if (Math.abs(m) >= 0.05) out.push({ text: `${sign(m)}${one(m)} ${t(`term.${meter}`)}`, good: m < 0 });
  }
  const agi = d('agi');
  if (Math.abs(agi) >= 0.05) out.push({ text: t('ui.moments.progress', { amount: `${sign(agi)}${one(agi)}` }), good: agi > 0 });
  return out;
}

/** One line per self-targeted effect of an expiring moment, in plain words. */
export function effectLines(effects: readonly Effect[] | undefined): DeltaLine[] {
  const out: DeltaLine[] = [];
  for (const e of effects ?? []) {
    if ('target' in e && e.target && e.target !== 'self') continue;
    switch (e.type) {
      case 'meter':
        out.push({ text: `${sign(e.amount)}${one(e.amount)} ${t(`term.${e.meter}`)}`, good: e.amount < 0 });
        break;
      case 'resourcePercent':
        out.push({ text: `${sign(e.percent)}${one(e.percent)}% ${t(`term.${e.resource}`)}`, good: e.percent > 0 });
        break;
      case 'resource':
        out.push({ text: `${sign(e.amount)}${e.resource === 'cash' ? fmtCash(Math.abs(e.amount)) : `${fmtCompact(Math.abs(e.amount))} ${t(`term.${e.resource}`)}`}`, good: e.amount > 0 });
        break;
      case 'agiProgress':
        out.push({ text: t('ui.moments.progress', { amount: `${sign(e.amount)}${one(e.amount)}` }), good: e.amount > 0 });
        break;
      case 'compute':
        out.push({ text: `${sign(e.amount)}${one(e.amount)} ${t('term.compute')}`, good: e.amount > 0 });
        break;
      case 'adoption':
        out.push({ text: e.factor < 1 ? t('ui.moments.usersLost', { users: t('term.users') }) : t('ui.moments.usersGained', { users: t('term.users') }), good: e.factor >= 1 });
        break;
      case 'dataCentre':
        out.push({ text: t(e.action === 'destroy' ? 'ui.moments.siteLost' : 'ui.moments.siteOffline', { dataCentre: t('term.dataCentre') }), good: false });
        break;
      case 'ban':
        out.push({ text: t('ui.moments.banned'), good: false });
        break;
      default:
        break;
    }
  }
  return out;
}

/** What a collect shows: measured gains, or for a contained threat the penalty avoided. */
export function collectLines(def: MomentDef | undefined, before: Snapshot, after: Snapshot): { lines: DeltaLine[]; avoided: boolean } {
  const lines = deltaLines(before, after);
  if (def?.kind === 'threat') {
    const avoided = effectLines(def.onExpire).map((l) => ({ text: l.text, good: true }));
    return { lines: lines.length > 0 ? lines : avoided, avoided: lines.length === 0 && avoided.length > 0 };
  }
  return { lines, avoided: false };
}

/** 0..1 of a moment's lifetime used at a (possibly fractional) tick. */
export function lifetimeAt(m: Pick<MomentState, 'spawnTick' | 'expiresTick'>, tick: number): number {
  const life = m.expiresTick - m.spawnTick;
  if (!(life > 0)) return 1;
  return Math.min(1, Math.max(0, (tick - m.spawnTick) / life));
}
