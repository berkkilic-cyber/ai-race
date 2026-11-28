import { ADMOB_IDS, SAMPLE_PUBLISHER, liveAds, rewardedUnitId } from '../admobIds';

describe('AdMob ids', () => {
  it('serves test ads unless the build is a store build', () => {
    expect(liveAds()).toBe(false);
    expect(rewardedUnitId('ios')).toContain(SAMPLE_PUBLISHER);
    expect(rewardedUnitId('android', false)).toContain(SAMPLE_PUBLISHER);
  });

  it('uses the real unit in a store build', () => {
    expect(rewardedUnitId('ios', true)).toBe(ADMOB_IDS.ios.rewarded);
    expect(ADMOB_IDS.ios.rewarded.startsWith(SAMPLE_PUBLISHER)).toBe(false);
    expect(ADMOB_IDS.ios.rewarded).toMatch(/^ca-app-pub-\d{16}\/\d+$/);
  });
});
