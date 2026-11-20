import { mascotMood, type MoodInputs } from '../mood';

const base: MoodInputs = { paused: false, level: 0, recentNews: null, recentPurchase: false, leading: false };

describe('mascot mood', () => {
  it('is calm by default and asleep while paused, whatever else happens', () => {
    expect(mascotMood(base)).toBe('calm');
    expect(mascotMood({ ...base, paused: true, level: 3, recentPurchase: true })).toBe('asleep');
  });

  it('follows composure: uneasy, sweating, panicking', () => {
    expect(mascotMood({ ...base, level: 1 })).toBe('uneasy');
    expect(mascotMood({ ...base, level: 2 })).toBe('sweating');
    expect(mascotMood({ ...base, level: 3 })).toBe('panicking');
  });

  it('danger beats good news; good news and purchases beat the resting mood', () => {
    expect(mascotMood({ ...base, level: 2, recentNews: 'good' })).toBe('sweating');
    expect(mascotMood({ ...base, level: 1, recentNews: 'good' })).toBe('pleased');
    expect(mascotMood({ ...base, recentPurchase: true, leading: true })).toBe('pleased');
    expect(mascotMood({ ...base, recentNews: 'bad', leading: true })).toBe('uneasy');
  });

  it('is smug when leading the race and nothing else is going on', () => {
    expect(mascotMood({ ...base, leading: true })).toBe('smug');
  });
});
