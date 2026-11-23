import { BOOST_WAIT_S, pickPlacement, type OfferContext } from '../policy';
import { PLACEMENTS } from '../types';

const all = Object.fromEntries(PLACEMENTS.map((p) => [p, true]));
const calm: OfferContext = { available: all, offlineReport: false, shipDay: false, incident: false, frenzy: false, secondsToNextBuy: 0 };

describe('ad placement policy', () => {
  it('shows only the offline double while the away report is open', () => {
    expect(pickPlacement({ ...calm, offlineReport: true, incident: true, frenzy: true })).toBe('offlineDouble');
    expect(pickPlacement({ ...calm, offlineReport: true, available: { ...all, offlineDouble: false } })).toBeNull();
  });
  it('shows only the launch bonus on ship day', () => {
    expect(pickPlacement({ ...calm, shipDay: true, incident: true })).toBe('prestigeBonus');
    expect(pickPlacement({ ...calm, shipDay: true, available: { ...all, prestigeBonus: false } })).toBeNull();
  });
  it('then the incident fix, the frenzy extension, the crate', () => {
    expect(pickPlacement({ ...calm, incident: true, frenzy: true })).toBe('incidentFix');
    expect(pickPlacement({ ...calm, incident: true, frenzy: true, available: { ...all, incidentFix: false } })).toBe('frenzyExtend');
    expect(pickPlacement({ ...calm, frenzy: false })).toBe('crate');
  });
  it('offers the frenzy extension only during a frenzy and never an inapplicable offer', () => {
    expect(pickPlacement({ ...calm, available: { frenzyExtend: true } })).toBeNull();
    expect(pickPlacement({ ...calm, incident: true, available: { boost: true }, secondsToNextBuy: 0 })).toBeNull();
  });
  it('offers the boost only when the next purchase is far away', () => {
    const noCrate = { ...calm, available: { ...all, crate: false } };
    expect(pickPlacement({ ...noCrate, secondsToNextBuy: BOOST_WAIT_S - 1 })).toBeNull();
    expect(pickPlacement({ ...noCrate, secondsToNextBuy: BOOST_WAIT_S })).toBe('boost');
    expect(pickPlacement({ ...noCrate, secondsToNextBuy: Infinity })).toBe('boost');
  });
  it('the bonus multiplier comes right after the modal offers, only while a bonus offers it', () => {
    expect(pickPlacement({ ...calm, bonus: true, incident: true, frenzy: true })).toBe('bonusMultiply');
    expect(pickPlacement({ ...calm, bonus: true, shipDay: true })).toBe('prestigeBonus');
    expect(pickPlacement({ ...calm, bonus: false, available: { bonusMultiply: true } })).toBeNull();
    expect(pickPlacement({ ...calm, bonus: true, available: { ...all, bonusMultiply: false } })).toBe('crate');
  });
  it('shows nothing on the stage until the lab produces something', () => {
    expect(pickPlacement({ ...calm, settled: false, incident: true })).toBeNull();
    expect(pickPlacement({ ...calm, settled: false, offlineReport: true })).toBe('offlineDouble');
  });
  it('returns at most one placement for every combination', () => {
    for (let mask = 0; mask < 1 << 13; mask++) {
      const available = Object.fromEntries(PLACEMENTS.map((p, i) => [p, (mask >> i) & 1 ? true : false]));
      const ctx: OfferContext = { available, offlineReport: !!(mask & 128), shipDay: !!(mask & 256), incident: !!(mask & 512), frenzy: !!(mask & 1024), secondsToNextBuy: mask & 2048 ? 1000 : 0, bonus: !!(mask & 4096) };
      const pick = pickPlacement(ctx);
      if (pick) expect(available[pick]).toBe(true);
    }
  });
});
