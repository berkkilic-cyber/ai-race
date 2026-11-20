import {
  getCapabilityLevel,
  getCompute,
  getComputeRequired,
  getComputeShortfall,
  getIncome,
  getIncomeBreakdown,
  getOwnedCapabilityLevel,
  getStandings,
  getWinProgress,
  step,
} from '@/engine';
import { computeForCapability } from '../derived';
import { defaultBalance } from '../balance';
import { editLab, newGame, PLAYER, stepN } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const pack = testPack;
const sum = (lines: { amount: number }[]) => lines.reduce((a, l) => a + l.amount, 0);

describe('tier selectors', () => {
  it('owned tier ignores compute; effective tier is capped; shortfall is what is missing', () => {
    const s = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1', 'c2', 'c3'];
      lab.dataCentres = [];
      lab.computeBonus = 12;
    });
    expect(getOwnedCapabilityLevel(s, pack, PLAYER)).toBe(3);
    expect(getCapabilityLevel(s, pack, PLAYER)).toBe(1);
    expect(getComputeRequired(pack, 3)).toBeCloseTo(computeForCapability(3, defaultBalance));
    expect(getComputeRequired(pack, 0)).toBe(0);
    expect(getComputeShortfall(s, pack, PLAYER)).toBeCloseTo(getComputeRequired(pack, 3) - getCompute(s, pack, PLAYER));
  });

  it('shortfall is 0 with enough compute or no model', () => {
    const rich = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1'];
      lab.computeBonus = 1000;
    });
    expect(getComputeShortfall(rich, pack, PLAYER)).toBe(0);
    const none = editLab(newGame(pack), PLAYER, (lab) => (lab.ownedNodes = []));
    expect(getComputeShortfall(none, pack, PLAYER)).toBe(0);
  });
});

describe('getWinProgress', () => {
  it('reports AGI, share over the dependence threshold and rivals left', () => {
    const s = editLab(newGame(pack), PLAYER, (lab) => {
      lab.agiProgress = 40;
      lab.adoption = { north: 1, east: 1 };
    });
    const progress = getWinProgress(s, pack, PLAYER);
    expect(progress.agi).toBeCloseTo(0.4);
    // north + east = 1400 of 2700 millions, over a 0.5 threshold, capped at 1.
    expect(progress.dependence).toBe(1);
    expect(progress.monopoly).toEqual({ remaining: 2, total: 2 });
    const bought = editLab(s, 'alpha', (lab) => {
      lab.active = false;
      lab.eliminated = { reason: 'acquired', tick: 0, byLabId: PLAYER };
    });
    expect(getWinProgress(bought, pack, PLAYER).monopoly).toEqual({ remaining: 1, total: 2 });
  });
});

describe('getStandings', () => {
  it('has one row per lab sorted by world share, with status and tiers', () => {
    const s = stepN(newGame(pack), pack, 5);
    const rows = getStandings(s, pack);
    expect(rows.map((r) => r.labId).sort()).toEqual([...s.labOrder].sort());
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].worldShare).toBeGreaterThanOrEqual(rows[i].worldShare);
    const beta = rows.find((r) => r.labId === 'beta')!;
    expect(beta.status).toBe('pending');
    const player = rows.find((r) => r.labId === PLAYER)!;
    expect(player).toMatchObject({ status: 'active', homeRegion: 'north', bannedRegions: 0 });
    expect(player.tier).toBe(getCapabilityLevel(s, pack, PLAYER));
    expect(player.ownedTier).toBe(getOwnedCapabilityLevel(s, pack, PLAYER));
  });

  it('counts banned regions and marks eliminated labs', () => {
    const s = editLab(editLab(newGame(pack), PLAYER, (lab) => (lab.bans = { west: -1, east: 999999 })), 'alpha', (lab) => {
      lab.active = false;
      lab.eliminated = { reason: 'revolt', tick: 0 };
    });
    const rows = getStandings(s, pack);
    expect(rows.find((r) => r.labId === PLAYER)!.bannedRegions).toBe(2);
    expect(rows.find((r) => r.labId === 'alpha')).toMatchObject({ status: 'eliminated', eliminatedReason: 'revolt' });
  });
});

describe('getIncomeBreakdown', () => {
  it('lines add up to the totals and match getIncome for cash', () => {
    let s = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1', 'r1'];
      lab.dataCentres = [
        { id: 'dc-1', regionId: 'north', level: 2 },
        { id: 'dc-2', regionId: 'west', level: 1, disabledUntilTick: 999 },
      ];
    });
    s = step(s, pack);
    const b = getIncomeBreakdown(s, pack, PLAYER);
    expect(sum(b.cash.lines)).toBeCloseTo(b.cash.total);
    expect(sum(b.hype.lines)).toBeCloseTo(b.hype.total);
    expect(b.cash.total).toBeCloseTo(getIncome(s, pack, PLAYER).cash);
    const upkeep = b.cash.lines.filter((l) => l.source === 'upkeep');
    expect(upkeep).toHaveLength(1);
    expect(upkeep[0]).toMatchObject({ dataCentreId: 'dc-1', regionId: 'north' });
    expect(upkeep[0].amount).toBeLessThan(0);
    // r1 multiplies cash income by 1.2: the modifiers line carries the extra.
    const perUser = b.cash.lines.find((l) => l.source === 'perUser')!.amount;
    expect(b.cash.lines.find((l) => l.source === 'modifiers')!.amount).toBeCloseTo(perUser * 0.2);
  });

  it('counts last tick new users for Hype', () => {
    const s = step(newGame(pack), pack);
    const users = s.labs[PLAYER].newUsersLastTick ?? 0;
    expect(users).toBeGreaterThan(0);
    const line = getIncomeBreakdown(s, pack, PLAYER).hype.lines.find((l) => l.source === 'newUsers')!;
    expect(line.amount).toBeCloseTo(defaultBalance.hypePerNewUser * users);
  });
});
