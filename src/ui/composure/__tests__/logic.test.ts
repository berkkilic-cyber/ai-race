import { composureOf, dangerKey, levelFor, TICKER_SPEED } from '../logic';

describe('composure', () => {
  it('levels: < 40 calm, 40-64 uneasy, 65-84 tense, >= 85 critical', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(39.9)).toBe(0);
    expect(levelFor(40)).toBe(1);
    expect(levelFor(64.9)).toBe(1);
    expect(levelFor(65)).toBe(2);
    expect(levelFor(84.9)).toBe(2);
    expect(levelFor(85)).toBe(3);
    expect(levelFor(100)).toBe(3);
  });

  it('takes the highest meter and names it as the driver', () => {
    expect(composureOf({ regulation: 10, backlash: 70, rival: 30 })).toEqual({ level: 2, driver: 'backlash', value: 70 });
    expect(composureOf({ regulation: 20, backlash: 5, rival: 90 })).toEqual({ level: 3, driver: 'rival', value: 90 });
    expect(composureOf({ regulation: 41, backlash: 0, rival: 0 })).toEqual({ level: 1, driver: 'regulation', value: 41 });
  });

  it('breaks ties in the order regulation, backlash, rival', () => {
    expect(composureOf({ regulation: 50, backlash: 50, rival: 50 }).driver).toBe('regulation');
    expect(composureOf({ regulation: 10, backlash: 50, rival: 50 }).driver).toBe('backlash');
  });

  it('a forced level (debug) wins over the meters but keeps the driver', () => {
    expect(composureOf({ regulation: 0, backlash: 12, rival: 0 }, 3)).toEqual({ level: 3, driver: 'backlash', value: 12 });
  });

  it('ticker speeds up with each level and danger keys follow the term namespace', () => {
    expect([0, 1, 2, 3].map((l) => TICKER_SPEED[l as 0])).toEqual([1, 1.3, 1.7, 2.2]);
    expect(dangerKey('regulation')).toBe('term.danger.regulation');
  });
});
