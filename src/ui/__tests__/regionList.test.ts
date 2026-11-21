import { createGame } from '@/engine';

import { setI18nContext } from '../i18n';
import { regionGroups } from '../map/regionList';
import { getPackEntry } from '../packs';

const { pack } = getPackEntry();

describe('Regions list groups', () => {
  const home = pack.regions.find((r) => r.neighbors.length > 0)!.id;
  const state = createGame(pack, { playerName: 'Lab', founderId: pack.founders[0].id, homeRegion: home, seed: 5 });
  setI18nContext(pack, state.labs);

  it('lists every region exactly once: home first in "yours", neighbours next, the rest after', () => {
    const g = regionGroups(state, pack);
    const all = [...g.mine, ...g.next, ...g.rest].map((r) => r.id);
    expect(new Set(all).size).toBe(pack.regions.length);
    expect(all).toHaveLength(pack.regions.length);
    expect(g.mine[0].id).toBe(home);
    expect(g.mine[0].home).toBe(true);
    const neighbours = pack.regions.find((r) => r.id === home)!.neighbors;
    for (const row of g.next) expect(pack.regions.some((r) => g.mine.some((m) => m.id === r.id) && r.neighbors.includes(row.id))).toBe(true);
    for (const n of neighbours) if (!g.mine.some((m) => m.id === n)) expect(g.next.some((r) => r.id === n) || g.rest.find((r) => r.id === n)?.banned).toBe(true);
  });

  it('shows the share and data centres of the player', () => {
    const g = regionGroups(state, pack);
    const me = state.labs[state.playerLabId];
    expect(g.mine[0].share).toBe(me.adoption[home] ?? 0);
    expect(g.mine[0].sites).toBe(me.dataCentres.filter((d) => d.regionId === home).length);
  });

  it('filters by name, accents and case ignored', () => {
    const name = 'can';
    const g = regionGroups(state, pack, name.toUpperCase());
    const ids = [...g.mine, ...g.next, ...g.rest].map((r) => r.id);
    expect(ids.length).toBeLessThan(pack.regions.length);
    expect(regionGroups(state, pack, 'zzzz-no-region').rest).toEqual([]);
  });
});
