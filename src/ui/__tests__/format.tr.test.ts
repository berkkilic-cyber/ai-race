import { formatAmount, formatDuration } from '@/idle';

import { fmtAmount, fmtCash, fmtCompact, fmtDuration, fmtFixed, fmtHours, fmtInt, fmtNum, fmtPct, fmtUsers, pctText } from '../format';
import { setCurrentLocale } from '../locale/current';
import { fmtMult, fmtPct as garagePct } from '../garage/text';
import { statValue } from '../garage/labText';

/** No-break space, as format.ts writes it between a number and its unit. */
const _ = ' ';

describe('format in Turkish (docs/GLOSSARY.tr.md, Numbers)', () => {
  beforeEach(() => setCurrentLocale('tr'));
  afterEach(() => setCurrentLocale('en'));

  it('cash: decimal comma, Mn / Mr / Tn, dollar sign after the amount', () => {
    expect(fmtCash(850)).toBe(`850${_}Mn${_}$`);
    expect(fmtCash(1200)).toBe(`1,2${_}Mr${_}$`);
    expect(fmtCash(1000)).toBe(`1${_}Mr${_}$`);
    expect(fmtCash(25000)).toBe(`25${_}Mr${_}$`);
    expect(fmtCash(2.5e6)).toBe(`2,5${_}Tn${_}$`);
    expect(fmtCash(3.25)).toBe(`3,3${_}Mn${_}$`);
    expect(fmtCash(0.04)).toBe(`0,04${_}Mn${_}$`);
    expect(fmtCash(-40)).toBe(`-40${_}Mn${_}$`);
  });

  it('compact numbers and users: B (bin), Mn, Mr, Tn', () => {
    expect(fmtCompact(950)).toBe('950');
    expect(fmtCompact(1234)).toBe(`1,2${_}B`);
    expect(fmtCompact(3.4e6)).toBe(`3,4${_}Mn`);
    expect(fmtCompact(250e9)).toBe(`250${_}Mr`);
    expect(fmtCompact(1.5e12)).toBe(`1,5${_}Tn`);
    expect(fmtCompact(3.45)).toBe('3,5');
    expect(fmtCompact(-1500)).toBe(`-1,5${_}B`);
    expect(fmtUsers(0.5)).toBe(`500${_}B`);
    expect(fmtUsers(1400)).toBe(`1,4${_}Mr`);
  });

  it('whole numbers group thousands with a dot', () => {
    expect(fmtInt(2526)).toBe('2.526');
    expect(fmtInt(1234567)).toBe('1.234.567');
    expect(fmtInt(-1000)).toBe('-1.000');
    expect(fmtInt(999)).toBe('999');
  });

  it('percent sign comes first', () => {
    expect(fmtPct(0.43)).toBe('%43');
    expect(fmtPct(0.004)).toBe('%0,4');
    expect(fmtPct(0)).toBe('%0');
    expect(fmtPct(-0.05)).toBe('-%5');
    expect(pctText(43)).toBe('%43');
    expect(pctText('12.5')).toBe('%12,5');
    expect(pctText(-20)).toBe('-%20');
  });

  it('plain decimals, hours and durations', () => {
    expect(fmtNum(1.5)).toBe('1,5');
    expect(fmtNum(1.35, 2)).toBe('1,35');
    expect(fmtNum(2)).toBe('2');
    expect(fmtFixed(82, 1)).toBe('82,0');
    expect(fmtHours(0.5)).toBe(`0,5${_}sa`);
    expect(fmtDuration(12_000)).toBe(`12${_}sn`);
    expect(fmtDuration(245_000)).toBe(`4${_}dk 05${_}sn`);
    expect(fmtDuration(3 * 3600_000 + 12 * 60_000)).toBe(`3${_}sa 12${_}dk`);
    expect(fmtDuration(2 * 86400_000 + 4 * 3600_000)).toBe(`2${_}gün 4${_}sa`);
    expect(fmtDuration(NaN)).toBe(`0${_}sn`);
  });

  it('idle amounts: Turkish units up to Tn, idle letters beyond, scientific with a comma', () => {
    expect(fmtAmount(950)).toBe('950');
    expect(fmtAmount(2.5)).toBe('2,5');
    expect(fmtAmount(12345)).toBe(`12,3${_}B`);
    expect(fmtAmount(4.2e6)).toBe(`4,2${_}Mn`);
    expect(fmtAmount(4.2e9)).toBe(`4,2${_}Mr`);
    expect(fmtAmount(4.2e12)).toBe(`4,2${_}Tn`);
    expect(fmtAmount(1.5e15)).toBe(`1,5${_}Qa`);
    expect(fmtAmount(1.23e72)).toBe('1,23e72');
    expect(fmtAmount(Infinity)).toBe('∞');
  });

  it('Garage helpers follow the locale', () => {
    expect(fmtMult(1.5)).toBe('1,5');
    expect(garagePct(0.025)).toBe('%2,5');
    expect(statValue('production', 0.06)).toBe('+%6');
    expect(statValue('incident', -0.2)).toBe('−%20');
    expect(statValue('offlineCap', 0.5)).toBe(`+0,5${_}sa`);
  });
});

describe('format in English is unchanged by the Turkish rules', () => {
  it('idle wrappers return the idle formatter output as is', () => {
    for (const n of [0, 2.5, 950, 12345, 4.2e9, 1.5e15, 1.23e72]) expect(fmtAmount(n)).toBe(formatAmount(n));
    for (const ms of [0, 12_000, 245_000, 3 * 3600_000, 2 * 86400_000]) expect(fmtDuration(ms)).toBe(formatDuration(ms));
  });

  it('percent, decimals and Garage helpers', () => {
    expect(pctText(43)).toBe('43%');
    expect(pctText('-0.4')).toBe('-0.4%');
    expect(fmtNum(1.5)).toBe('1.5');
    expect(fmtFixed(82, 1)).toBe('82.0');
    expect(fmtHours(0.5)).toBe('0.5 h');
    expect(fmtMult(1.5)).toBe('1.5');
    expect(garagePct(0.025)).toBe('2.5%');
    expect(statValue('production', 0.06)).toBe('+6%');
    expect(statValue('offlineCap', 0.5)).toBe('+0.5 h');
  });
});
