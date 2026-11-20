#!/usr/bin/env node
/**
 * Derives region `neighbors` for the ai-lab pack from map geometry.
 *
 * 1. Land links: two regions are neighbours when any of their member countries
 *    share a border in world-atlas/countries-110m.json (topojson neighbours).
 * 2. Sea links: added by hand below so islands and continents connect.
 *    North America and Europe are deliberately NOT linked.
 *
 * Usage: node scripts/content/build-neighbors.js [--check]
 *   --check  exit 1 if regions.json is out of date instead of rewriting it.
 */
const fs = require('node:fs');
const path = require('node:path');
const topojson = require('topojson-client');
const atlas = require('world-atlas/countries-110m.json');

const PACK_DIR = path.join(__dirname, '..', '..', 'src', 'content', 'packs', 'ai-lab');
const REGIONS_FILE = path.join(PACK_DIR, 'regions.json');
const MAP_FILE = path.join(PACK_DIR, 'map.json');

/** Hand-made sea links (straits, short crossings, island chains). */
const SEA_LINKS = [
  ['uk-ireland', 'france'],
  ['uk-ireland', 'benelux'],
  ['uk-ireland', 'nordics'],
  ['nordics', 'eastern-europe'],
  ['nordics', 'benelux'],
  ['iberia', 'north-africa'],
  ['italy', 'north-africa'],
  ['italy', 'balkans'],
  ['balkans', 'middle-east'],
  ['balkans', 'north-africa'],
  ['middle-east', 'east-africa'],
  ['middle-east', 'pakistan'],
  ['japan', 'korea'],
  ['japan', 'china'],
  ['japan', 'russia'],
  ['japan', 'taiwan'],
  ['taiwan', 'china'],
  ['taiwan', 'southeast-asia'],
  ['bengal-himalaya', 'southeast-asia'],
  ['indonesia', 'australia'],
  ['australia', 'pacific'],
  ['australia', 'far-south'],
  ['pacific', 'far-south'],
  ['southern-cone', 'far-south'],
  ['southern-africa', 'far-south'],
  ['southern-africa', 'east-africa'],
  ['usa', 'central-america'],
  ['usa', 'russia'],
];

function landNeighbors(regions, noIdCountries) {
  const geoms = atlas.objects.countries.geometries;
  const regionOf = new Map();
  for (const r of regions) for (const c of r.countries) regionOf.set(c, r.id);
  const regionOfGeom = geoms.map((g) =>
    g.id !== undefined ? regionOf.get(String(g.id)) : noIdCountries[g.properties.name],
  );
  const adj = topojson.neighbors(geoms);
  const links = new Map(regions.map((r) => [r.id, new Set()]));
  adj.forEach((list, i) => {
    const a = regionOfGeom[i];
    for (const j of list) {
      const b = regionOfGeom[j];
      if (a && b && a !== b) {
        links.get(a).add(b);
        links.get(b).add(a);
      }
    }
  });
  return links;
}

function main() {
  const regions = JSON.parse(fs.readFileSync(REGIONS_FILE, 'utf8'));
  const { noIdCountries } = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const links = landNeighbors(regions, noIdCountries);
  for (const [a, b] of SEA_LINKS) {
    if (!links.has(a) || !links.has(b)) throw new Error(`Unknown region in sea link ${a}-${b}`);
    links.get(a).add(b);
    links.get(b).add(a);
  }
  const order = regions.map((r) => r.id);
  let changed = false;
  for (const r of regions) {
    const next = [...links.get(r.id)].sort((x, y) => order.indexOf(x) - order.indexOf(y));
    if (JSON.stringify(next) !== JSON.stringify(r.neighbors)) changed = true;
    r.neighbors = next;
  }
  if (process.argv.includes('--check')) {
    if (changed) {
      console.error('regions.json neighbours are out of date; run node scripts/content/build-neighbors.js');
      process.exit(1);
    }
    console.log('regions.json neighbours are up to date');
    return;
  }
  fs.writeFileSync(REGIONS_FILE, JSON.stringify(regions, null, 2) + '\n');
  for (const r of regions) console.log(`${r.id}: ${r.neighbors.join(', ')}`);
}

main();
