/**
 * What the Race tab shows, read from the engine (getStandings, getWinProgress, canApply,
 * getAcquirePrice) and formatted. No rule is computed here.
 */
import {
  canApply,
  defaultBalance,
  getAcquirePrice,
  getStandings,
  getWinProgress,
  type ContentPack,
  type GameState,
  type StandingRow,
} from '@/engine';

import { fmtCash, fmtCompact, fmtPct, fmtUsers } from '../format';
import { labName, readableLabColor, regionName, t } from '../i18n';
import { trendOf, type ShareSample, type Trend } from './trend';

export type RaceSort = 'share' | 'you';

export interface RaceRow {
  labId: string;
  name: string;
  color: string;
  textColor: string;
  isPlayer: boolean;
  home: string;
  /** 0..1 */
  share: number;
  shareText: string;
  usersText: string;
  /** 0..1 */
  agi: number;
  agiText: string;
  tierText: string;
  /** "owns 5" when the owned tier is higher than the one running. */
  ownedText: string | null;
  dcText: string;
  statusText: string;
  statusTone: 'good' | 'bad' | 'dim';
  out: boolean;
  trend: Trend;
}

export interface WinBar {
  id: 'agi' | 'dependence' | 'monopoly';
  title: string;
  /** 0..1, the player's progress. */
  value: number;
  /** 0..1, the best rival's progress on the same track (AGI only). */
  rival?: number;
  rivalColor?: string;
  caption: string;
}

export interface RaceView {
  wins: WinBar[];
  rows: RaceRow[];
}

export function statusOf(row: StandingRow): { text: string; tone: RaceRow['statusTone']; out: boolean } {
  if (row.status === 'pending') return { text: t('ui.race.status.pending'), tone: 'dim', out: false };
  if (row.status === 'eliminated') {
    if (row.eliminatedReason === 'acquired') return { text: t('ui.race.status.acquired'), tone: 'dim', out: true };
    if (row.eliminatedReason === 'revolt') return { text: t('ui.race.status.revolt'), tone: 'dim', out: true };
    return { text: t('ui.race.status.eliminated'), tone: 'dim', out: true };
  }
  if (row.bannedRegions > 0) return { text: t('ui.race.status.banned', { count: row.bannedRegions }), tone: 'bad', out: false };
  return { text: t('ui.race.status.active'), tone: 'good', out: false };
}

/** Standings order (world share), or the player first and the rest by world share. */
export function sortRows<T extends { isPlayer: boolean }>(rows: readonly T[], sort: RaceSort): T[] {
  if (sort === 'share') return [...rows];
  return [...rows.filter((r) => r.isPlayer), ...rows.filter((r) => !r.isPlayer)];
}

export function raceView(state: GameState, pack: ContentPack, samples: readonly ShareSample[]): RaceView {
  const playerId = state.playerLabId;
  const standings = getStandings(state, pack);
  const rows: RaceRow[] = standings.map((row) => {
    const lab = state.labs[row.labId];
    const status = statusOf(row);
    return {
      labId: row.labId,
      name: labName(lab),
      color: readableLabColor(lab),
      textColor: readableLabColor(lab, 'text'),
      isPlayer: row.labId === playerId,
      home: regionName(row.homeRegion),
      share: row.worldShare,
      shareText: fmtPct(row.worldShare),
      usersText: fmtUsers(row.users),
      agi: row.agi,
      agiText: `${Math.floor(row.agi * 100)}%`,
      tierText: t('ui.race.tier', { tier: row.tier }),
      ownedText: row.ownedTier > row.tier ? t('ui.race.owns', { tier: row.ownedTier }) : null,
      dcText: `${row.dataCentres} · ${fmtCompact(row.compute)}`,
      statusText: status.text,
      statusTone: status.tone,
      out: status.out,
      trend: row.status === 'active' ? trendOf(samples, row.labId, row.worldShare, state.tick) : 'flat',
    };
  });

  const progress = getWinProgress(state, pack, playerId);
  const target = pack.balance.dependenceShare ?? defaultBalance.dependenceShare;
  const me = standings.find((r) => r.labId === playerId);
  // The best rival on the AGI track: the active rival furthest along.
  const best = standings.filter((r) => r.labId !== playerId && r.status === 'active').sort((a, b) => b.agi - a.agi)[0];
  const you = `${Math.floor(progress.agi * 100)}%`;
  const wins: WinBar[] = [
    {
      id: 'agi',
      title: t('ui.race.win.agi'),
      value: progress.agi,
      ...(best ? { rival: best.agi, rivalColor: readableLabColor(state.labs[best.labId]) } : {}),
      caption: best ? t('ui.race.win.agiCaption', { you, them: `${Math.floor(best.agi * 100)}%` }) : t('ui.race.win.agiCaptionNone', { you }),
    },
    {
      id: 'dependence',
      title: t('ui.race.win.dependence'),
      value: progress.dependence,
      caption: t('ui.race.win.dependenceCaption', { target: fmtPct(target), share: fmtPct(me?.worldShare ?? 0) }),
    },
    {
      id: 'monopoly',
      title: t('ui.race.win.monopoly'),
      value: progress.monopoly.total > 0 ? (progress.monopoly.total - progress.monopoly.remaining) / progress.monopoly.total : 0,
      caption: t('ui.race.win.monopolyCaption', { remaining: progress.monopoly.remaining, total: progress.monopoly.total }),
    },
  ];
  return { wins, rows };
}

export interface RivalDetail {
  labId: string;
  name: string;
  color: string;
  home: string;
  statusText: string;
  /** The rival's top regions by adoption: "Brazil 34%". */
  strongIn: string[];
  ahead: string[];
  behind: string[];
  buyout: { ok: true; price: string; text: string } | { ok: false; text: string };
}

/** Regions shown under "Where it is strong". */
const TOP_REGIONS = 4;

export function rivalDetail(state: GameState, pack: ContentPack, labId: string): RivalDetail | null {
  const lab = state.labs[labId];
  if (!lab || labId === state.playerLabId) return null;
  const standings = getStandings(state, pack);
  const row = standings.find((r) => r.labId === labId);
  const me = standings.find((r) => r.labId === state.playerLabId);
  if (!row || !me) return null;
  const strongIn = Object.entries(lab.adoption)
    .filter(([, a]) => a > 0.001)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_REGIONS)
    .map(([regionId, a]) => `${regionName(regionId)} ${fmtPct(a)}`);
  const compare: { key: string; them: number; you: number; them_: string; you_: string }[] = [
    { key: 'agi', them: row.agi, you: me.agi, them_: `${Math.floor(row.agi * 100)}%`, you_: `${Math.floor(me.agi * 100)}%` },
    { key: 'share', them: row.worldShare, you: me.worldShare, them_: fmtPct(row.worldShare), you_: fmtPct(me.worldShare) },
    { key: 'model', them: row.tier, you: me.tier, them_: String(row.tier), you_: String(me.tier) },
    { key: 'compute', them: row.compute, you: me.compute, them_: fmtCompact(row.compute), you_: fmtCompact(me.compute) },
  ];
  const line = (c: (typeof compare)[number]) => t(`ui.race.detail.${c.key}`, { them: c.them_, you: c.you_ });
  const ahead = compare.filter((c) => c.them > c.you).map(line);
  const behind = compare.filter((c) => c.them < c.you).map(line);

  const name = labName(lab);
  const check = canApply(state, pack, { type: 'acquireRival', labId: state.playerLabId, targetLabId: labId });
  let buyout: RivalDetail['buyout'];
  if (row.status === 'pending') buyout = { ok: false, text: t('ui.race.detail.pending', { lab: labId }) };
  else if (row.status === 'eliminated') buyout = { ok: false, text: t(row.eliminatedReason === 'acquired' && lab.eliminated?.byLabId === state.playerLabId ? 'ui.race.detail.bought' : 'ui.race.detail.inactive', { lab: labId }) };
  else {
    const price = fmtCash(getAcquirePrice(state, pack, state.playerLabId, labId));
    if (check.ok) buyout = { ok: true, price, text: t('ui.race.detail.buyReady', { lab: labId, price }) };
    else if (check.reason === 'missingRequirement') {
      // The upgrades that grant the buyout flag, as the place to get it.
      const node = pack.nodes.find((n) => (n.grantsFlags ?? []).includes('canAcquire'));
      buyout = { ok: false, text: node ? t('ui.race.detail.needFlag', { node: t(node.nameKey), tree: t(`term.tree.${node.tree}`) }) : t('ui.failure.missingRequirement') };
    } else if (check.reason === 'notEnoughCash') buyout = { ok: false, text: t('ui.race.detail.needCash', { price, cash: fmtCash(state.labs[state.playerLabId].cash) }) };
    else buyout = { ok: false, text: t(`ui.failure.${check.reason}`, { hype: t('term.hype'), cash: t('term.cash') }) };
  }
  return { labId, name, color: readableLabColor(lab), home: regionName(lab.homeRegion), statusText: statusOf(row).text, strongIn, ahead, behind, buyout };
}
