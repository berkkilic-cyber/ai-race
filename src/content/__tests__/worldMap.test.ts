/**
 * Region <-> world-atlas consistency. The map screen merges the shapes of each
 * region's countries, so every country in countries-110m must belong to exactly
 * one region, and land borders must show up as region neighbours.
 */
import { neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlasJson from 'world-atlas/countries-110m.json';

import { aiLabNoIdCountries, aiLabPack } from '..';

type CountryProps = { name: string };
const atlas = atlasJson as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
const geometries = atlas.objects.countries.geometries;
const nameOf = (i: number) => (geometries[i].properties as CountryProps).name;

const regionOfCode = new Map<string, string>();
for (const r of aiLabPack.regions) for (const c of r.countries) regionOfCode.set(c, r.id);

const regionOfGeometry = (i: number): string | undefined => {
  const g = geometries[i];
  return g.id !== undefined ? regionOfCode.get(String(g.id)) : aiLabNoIdCountries[nameOf(i)];
};

describe('world map coverage', () => {
  it('assigns every atlas country to exactly one region', () => {
    const unassigned = geometries
      .map((g, i) => (regionOfGeometry(i) ? null : `${g.id ?? '(no id)'} ${nameOf(i)}`))
      .filter(Boolean);
    expect(unassigned).toEqual([]);
    const allCodes = aiLabPack.regions.flatMap((r) => r.countries);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  it('uses only country codes that exist in the atlas', () => {
    const atlasCodes = new Set(geometries.filter((g) => g.id !== undefined).map((g) => String(g.id)));
    const unknown = aiLabPack.regions.flatMap((r) => r.countries.filter((c) => !atlasCodes.has(c)));
    expect(unknown).toEqual([]);
  });

  it('handles the atlas shapes without an id by name', () => {
    const noId = geometries.flatMap((g, i) => (g.id === undefined ? [nameOf(i)] : []));
    expect(Object.keys(aiLabNoIdCountries).sort()).toEqual([...noId].sort());
    const regionIds = new Set(aiLabPack.regions.map((r) => r.id));
    for (const regionId of Object.values(aiLabNoIdCountries)) expect(regionIds).toContain(regionId);
  });

  it('lists every land border between regions as a neighbour link', () => {
    const byId = new Map(aiLabPack.regions.map((r) => [r.id, r]));
    const missing: string[] = [];
    neighbors(geometries).forEach((list, i) => {
      const a = regionOfGeometry(i)!;
      for (const j of list) {
        const b = regionOfGeometry(j)!;
        if (a !== b && !byId.get(a)!.neighbors.includes(b)) missing.push(`${a}-${b}`);
      }
    });
    expect(missing).toEqual([]);
  });

  it('does not link North America to Europe', () => {
    const tagOf = (id: string) => aiLabPack.regions.find((r) => r.id === id)!.tags;
    for (const r of aiLabPack.regions.filter((x) => x.tags.includes('north-america'))) {
      for (const nb of r.neighbors) {
        const europeOnly = tagOf(nb).includes('europe') && !tagOf(nb).includes('asia');
        expect({ link: `${r.id}-${nb}`, europeOnly }).toEqual({ link: `${r.id}-${nb}`, europeOnly: false });
      }
    }
  });
});
