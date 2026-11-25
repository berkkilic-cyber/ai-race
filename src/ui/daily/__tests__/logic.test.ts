import { aiLabDaily } from '@/content';
import { createGame } from '@/engine';

import { garageContent } from '../../garage/content';
import { bonusForSetup } from '../../meta/logic';
import { getPackEntry } from '../../packs';
import {
  abandonAttempt,
  addDays,
  canPlayScored,
  dailyFor,
  dailyGameSetup,
  dailyStatus,
  dateKeyOf,
  dayNumber,
  emptyRecord,
  finishAttempt,
  HISTORY_MAX,
  msUntilNextDaily,
  parseRecord,
  settleAttempt,
  startAttempt,
  streakOf,
  twistIndexFor,
  type DailyRecord,
  type DailyResult,
} from '../logic';

const { pack } = getPackEntry();

const result = (key: string, score = 100): DailyResult => ({ key, number: dayNumber(key, aiLabDaily.epoch), twist: 'x', ending: 'agi', trigger: 'agi', won: true, score, days: 200 });
function played(keys: string[]): DailyRecord {
  return keys.reduce((r, k) => finishAttempt(r, result(k)), emptyRecord());
}

describe('date to daily', () => {
  it('uses the UTC date and changes exactly at 00:00 UTC', () => {
    const before = Date.parse('2026-11-25T23:59:59.999Z');
    const after = Date.parse('2026-11-26T00:00:00.000Z');
    expect(dateKeyOf(before)).toBe('2026-11-25');
    expect(dateKeyOf(after)).toBe('2026-11-26');
    expect(dailyFor(dateKeyOf(before), pack, aiLabDaily).seed).not.toBe(dailyFor(dateKeyOf(after), pack, aiLabDaily).seed);
    expect(msUntilNextDaily(before)).toBe(1);
    expect(msUntilNextDaily(after)).toBe(86_400_000);
  });

  it('is deterministic: the same date gives the same challenge, every time', () => {
    const a = dailyFor('2026-11-25', pack, aiLabDaily);
    const b = dailyFor('2026-11-25', pack, aiLabDaily);
    expect(a).toEqual(b);
    // Pinned so a refactor that changes everyone's daily is noticed.
    expect({ seed: a.seed, founder: a.founderId, home: a.homeRegion, twist: a.twist.id, number: a.number }).toMatchSnapshot();
  });

  it('numbers dailies from the epoch and uses the default level and the sprint', () => {
    const d = dailyFor(aiLabDaily.epoch, pack, aiLabDaily);
    expect(d.number).toBe(1);
    expect(dailyFor(addDays(aiLabDaily.epoch, 24), pack, aiLabDaily).number).toBe(25);
    expect(d.difficulty).toBe(pack.defaultDifficulty);
    expect(d.runLength).toBe('sprint');
  });

  it('gives valid setups for a year of dailies (founder, home, rivals), and every twist comes up', () => {
    const twists = new Set<string>();
    let prev = '';
    for (let i = 0; i < 365; i++) {
      const d = dailyFor(addDays('2026-11-01', i), pack, aiLabDaily);
      twists.add(d.twist.id);
      expect(d.twist.id).not.toBe(prev);
      prev = d.twist.id;
      expect(aiLabDaily.homeRegions).toContain(d.homeRegion);
      if (d.twist.rivals) expect(d.rivalIds).toHaveLength(d.twist.rivals);
      const state = createGame(pack, dailyGameSetup(d, 'Daily Lab'));
      expect(state.labOrder).toHaveLength(1 + (d.rivalIds?.length ?? pack.rivals.length));
    }
    expect(twists.size).toBe(aiLabDaily.twists.length);
  });

  it('deals each twist once per block of days', () => {
    const n = aiLabDaily.twists.length;
    const block = Array.from({ length: n }, (_, i) => twistIndexFor(n + 1 + i, n));
    expect(new Set(block).size).toBe(n);
  });

  it('applies the twist only through GameSetup: the bonus on the player, rivals untouched', () => {
    const d = dailyFor('2026-11-25', pack, aiLabDaily);
    const withTwist = { ...d, twist: aiLabDaily.twists.find((t) => t.id === 'watchdog')! };
    const s = createGame(pack, dailyGameSetup(withTwist, 'Daily Lab'));
    const plain = createGame(pack, { ...dailyGameSetup(withTwist, 'Daily Lab'), bonus: undefined });
    expect(s.labs.player.cash).toBe(plain.labs.player.cash + 30);
    expect(s.labs.player.timedModifiers.map((m) => m.modifier.stat)).toContain('regulationGain');
    for (const id of s.labOrder.filter((x) => x !== 'player')) expect(s.labs[id]).toEqual(plain.labs[id]);
  });

  it('turns Lab Rep perks off in the daily (bonusForSetup)', () => {
    expect(bonusForSetup({ perksOn: true, daily: true }, 100, garageContent())).toEqual({ perkIds: [] });
    expect(bonusForSetup({ perksOn: true }, 100, garageContent()).perkIds.length).toBeGreaterThan(0);
  });
});

describe('one scored attempt per day', () => {
  const day = dailyFor('2026-11-25', pack, aiLabDaily);

  it('counts from the start: no second scored try that day', () => {
    let r = emptyRecord();
    expect(canPlayScored(r, day.key)).toBe(true);
    r = startAttempt(r, day);
    expect(canPlayScored(r, day.key)).toBe(false);
    expect(startAttempt(r, day)).toBe(r);
    expect(dailyStatus(r, day.key)).toEqual({ kind: 'inProgress' });
    r = finishAttempt(r, result(day.key, 4210));
    expect(canPlayScored(r, day.key)).toBe(false);
    expect(dailyStatus(r, day.key)).toMatchObject({ kind: 'done', result: { score: 4210 } });
    // A second ending for the same day (practice, a replayed setup) never overwrites the result.
    expect(finishAttempt(r, result(day.key, 9999))).toBe(r);
    // The next day is open again.
    expect(canPlayScored(r, addDays(day.key, 1))).toBe(true);
  });

  it('an abandoned attempt counts as played, with no score', () => {
    let r = startAttempt(emptyRecord(), day);
    r = abandonAttempt(r);
    expect(r.started).toBeNull();
    expect(dailyStatus(r, day.key)).toMatchObject({ kind: 'done', result: { ending: null, score: 0 } });
    expect(streakOf(r, day.key).current).toBe(1);
  });

  it('settles a started attempt that can no longer be continued, keeps one that can', () => {
    const r = startAttempt(emptyRecord(), day);
    expect(settleAttempt(r, day.key)).toBe(r);
    expect(settleAttempt(r, null).history).toHaveLength(1);
  });
});

describe('streak', () => {
  it('counts consecutive days, stays while today is still open, resets after a missed day', () => {
    const r = played(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(streakOf(r, '2026-11-22')).toEqual({ current: 3, best: 3 });
    expect(streakOf(r, '2026-11-23')).toEqual({ current: 3, best: 3 });
    expect(streakOf(r, '2026-11-24')).toEqual({ current: 0, best: 3 });
  });

  it('starts again at one after a gap and keeps the best', () => {
    const r = played(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-10', '2026-11-11']);
    expect(streakOf(r, '2026-11-11')).toEqual({ current: 2, best: 4 });
  });

  it('keeps counting past the 30-day history', () => {
    const keys = Array.from({ length: 45 }, (_, i) => addDays('2026-11-01', i));
    const r = played(keys);
    expect(r.history).toHaveLength(HISTORY_MAX);
    expect(streakOf(r, keys[44]).current).toBe(45);
  });

  it('a day finished after midnight still counts for the day it started', () => {
    const r = played(['2026-11-20', '2026-11-21']);
    expect(streakOf(r, '2026-11-22').current).toBe(2);
  });

  it('survives storage and rejects garbage', () => {
    const r = played(['2026-11-20', '2026-11-21']);
    expect(parseRecord(JSON.stringify(r))).toEqual(r);
    expect(parseRecord('nope')).toEqual(emptyRecord());
    expect(parseRecord(JSON.stringify({ v: 99 }))).toEqual(emptyRecord());
  });
});
