import { fmtCash, fmtCompact, fmtDay, fmtPct, fmtUsers, toPips } from '../format';

describe('format', () => {
  it('fmtCash shows millions, billions and trillions', () => {
    expect(fmtCash(850)).toBe('$850M');
    expect(fmtCash(1200)).toBe('$1.2B');
    expect(fmtCash(1000)).toBe('$1B');
    expect(fmtCash(25000)).toBe('$25B');
    expect(fmtCash(2.5e6)).toBe('$2.5T');
    expect(fmtCash(12.4)).toBe('$12M');
    expect(fmtCash(3.25)).toBe('$3.3M');
    expect(fmtCash(0.04)).toBe('$0.04M');
    expect(fmtCash(0)).toBe('$0M');
    expect(fmtCash(-40)).toBe('-$40M');
  });

  it('fmtCompact abbreviates large numbers', () => {
    expect(fmtCompact(950)).toBe('950');
    expect(fmtCompact(1234)).toBe('1.2K');
    expect(fmtCompact(3.4e6)).toBe('3.4M');
    expect(fmtCompact(250e9)).toBe('250B');
    expect(fmtCompact(12.34)).toBe('12');
    expect(fmtCompact(3.45)).toBe('3.5');
    expect(fmtCompact(-1500)).toBe('-1.5K');
  });

  it('fmtUsers takes millions', () => {
    expect(fmtUsers(0.5)).toBe('500K');
    expect(fmtUsers(12)).toBe('12M');
    expect(fmtUsers(1400)).toBe('1.4B');
  });

  it('fmtPct', () => {
    expect(fmtPct(0)).toBe('0%');
    expect(fmtPct(0.004)).toBe('0.4%');
    expect(fmtPct(0.123)).toBe('12%');
    expect(fmtPct(1)).toBe('100%');
  });

  it('fmtDay counts from day 1', () => {
    expect(fmtDay(0)).toBe('Day 1');
    expect(fmtDay(41)).toBe('Day 42');
  });

  it('toPips maps 0..1 to 1..5', () => {
    expect(toPips(0)).toBe(1);
    expect(toPips(0.5)).toBe(3);
    expect(toPips(1)).toBe(5);
  });
});
