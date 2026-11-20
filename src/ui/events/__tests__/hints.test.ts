import type { Effect, Stat } from '@/engine';

import { getPackEntry } from '../../packs';
import { effectHint, effectHints, hintForTarget, type EffectHint } from '../hints';

const up = (subject: EffectHint['subject'], good: boolean): EffectHint => ({ subject, dir: 'up', good });
const down = (subject: EffectHint['subject'], good: boolean): EffectHint => ({ subject, dir: 'down', good });
const HOME = { kind: 'home' } as const;

describe('hintForTarget: every effect type', () => {
  const cases: [string, Effect, EffectHint | null][] = [
    ['resource +hype', { type: 'resource', resource: 'hype', amount: 5 }, up('hype', true)],
    ['resource -cash', { type: 'resource', resource: 'cash', amount: -50 }, down('cash', false)],
    ['resource 0', { type: 'resource', resource: 'cash', amount: 0 }, null],
    ['resourcePercent +cash', { type: 'resourcePercent', resource: 'cash', percent: 10 }, up('cash', true)],
    ['resourcePercent -hype', { type: 'resourcePercent', resource: 'hype', percent: -20 }, down('hype', false)],
    ['meter +regulation', { type: 'meter', meter: 'regulation', amount: 4 }, up('regulation', false)],
    ['meter -backlash', { type: 'meter', meter: 'backlash', amount: -3 }, down('backlash', true)],
    ['agiProgress +', { type: 'agiProgress', amount: 2 }, up('agi', true)],
    ['agiProgress -', { type: 'agiProgress', amount: -2 }, down('agi', false)],
    ['adoption x1.2', { type: 'adoption', scope: HOME, factor: 1.2 }, up('users', true)],
    ['adoption x0.5', { type: 'adoption', scope: { kind: 'top', count: 2 }, factor: 0.5 }, down('users', false)],
    ['adoption x1', { type: 'adoption', scope: { kind: 'all' }, factor: 1 }, null],
    ['ban', { type: 'ban', scope: { kind: 'random', count: 1 }, durationTicks: 100 }, up('bans', false)],
    ['unban', { type: 'unban', scope: { kind: 'tag', tag: 'eu' } }, down('bans', true)],
    ['dataCentre disable', { type: 'dataCentre', action: 'disable', scope: HOME, durationTicks: 50 }, down('dataCentres', false)],
    ['dataCentre destroy', { type: 'dataCentre', action: 'destroy', scope: { kind: 'region', id: 'x' } }, down('dataCentres', false)],
    ['compute +', { type: 'compute', amount: 4 }, up('compute', true)],
    ['compute -', { type: 'compute', amount: -2 }, down('compute', false)],
    ['setFlag', { type: 'setFlag', flag: 'x' }, null],
    ['news', { type: 'news', textKey: 'x', tone: 'bad' }, null],
  ];
  it.each(cases)('%s', (_name, effect, expected) => {
    expect(hintForTarget(effect)).toEqual(expected);
  });
});

describe('hintForTarget: timed modifiers', () => {
  const mod = (stat: Stat, op: 'add' | 'mul', value: number): Effect => ({ type: 'timedModifier', modifier: { stat, op, value }, durationTicks: 100 });
  const cases: [Stat, 'add' | 'mul', number, EffectHint | null][] = [
    ['spreadRate', 'mul', 1.3, up('users', true)],
    ['seedChance', 'mul', 0.5, down('users', false)],
    ['cashIncome', 'mul', 1.2, up('cash', true)],
    ['hypeIncome', 'add', -0.1, down('hype', false)],
    ['computeCapacity', 'mul', 1.1, up('compute', true)],
    ['agiRate', 'mul', 1.5, up('agi', true)],
    ['regulationGain', 'mul', 0.5, down('regulation', true)],
    ['backlashGain', 'mul', 1.5, up('backlash', false)],
    ['riskChance', 'mul', 2, up('risk', false)],
    ['dataCentreCost', 'mul', 0.8, down('costs', true)],
    ['dataCentreUpkeep', 'mul', 1.2, up('costs', false)],
    ['launchCost', 'mul', 1.2, up('costs', false)],
    ['nodeCost', 'mul', 0.9, down('costs', true)],
    ['acquireCost', 'add', 0.2, up('costs', false)],
    ['banDuration', 'mul', 0.5, down('bans', true)],
    ['agiRate', 'mul', 1, null],
    ['agiRate', 'add', 0, null],
  ];
  it.each(cases)('%s %s %p', (stat, op, value, expected) => {
    expect(hintForTarget(mod(stat, op, value))).toEqual(expected);
  });
});

describe('effectHint: targets', () => {
  it('keeps self effects (explicit or default) as they are', () => {
    expect(effectHint({ type: 'meter', meter: 'backlash', amount: 5, target: 'self' })).toEqual(up('backlash', false));
    expect(effectHint({ type: 'meter', meter: 'backlash', amount: 5 })).toEqual(up('backlash', false));
  });

  it.each(['rivals', 'leadRival', 'randomRival'] as const)('turns %s effects into a Rivals chip from the player point of view', (target) => {
    // Hurting rivals is good for the player.
    expect(effectHint({ type: 'meter', meter: 'regulation', amount: 8, target })).toEqual(down('rivals', true));
    expect(effectHint({ type: 'agiProgress', amount: -3, target })).toEqual(down('rivals', true));
    // Helping rivals is bad.
    expect(effectHint({ type: 'resource', resource: 'cash', amount: 100, target })).toEqual(up('rivals', false));
    expect(effectHint({ type: 'ban', scope: HOME, durationTicks: 10, target })).toEqual(down('rivals', true));
  });

  it('ignores effects with nothing to show, whatever the target', () => {
    expect(effectHint({ type: 'compute', amount: 0, target: 'rivals' })).toBeNull();
  });
});

describe('effectHints', () => {
  it('keeps effect order and drops duplicates of the same subject and direction', () => {
    const hints = effectHints([
      { type: 'resource', resource: 'hype', amount: 5 },
      { type: 'timedModifier', modifier: { stat: 'hypeIncome', op: 'mul', value: 1.2 }, durationTicks: 50 },
      { type: 'meter', meter: 'backlash', amount: 2 },
      { type: 'meter', meter: 'regulation', amount: 3, target: 'rivals' },
      { type: 'agiProgress', amount: -1, target: 'leadRival' },
      { type: 'setFlag', flag: 'f' },
      { type: 'resource', resource: 'hype', amount: -2 },
    ]);
    expect(hints).toEqual([up('hype', true), up('backlash', false), down('rivals', true), down('hype', false)]);
  });

  it('gives every choice in the pack a valid list', () => {
    const { pack } = getPackEntry();
    for (const event of pack.events) {
      for (const choice of event.choices) {
        for (const hint of effectHints(choice.effects)) {
          expect(['up', 'down']).toContain(hint.dir);
          expect(typeof hint.good).toBe('boolean');
        }
      }
    }
  });
});
