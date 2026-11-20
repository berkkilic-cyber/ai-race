#!/usr/bin/env node
/**
 * Builds the map geometry of the ai-lab pack: one simplified SVG path per region.
 *
 * Input:  world-atlas/countries-110m.json, src/content/packs/ai-lab/regions.json
 *         and the no-id country names in src/content/packs/ai-lab/map.json.
 * Output: src/content/packs/ai-lab/geometry.json
 *         { version, width, height, viewBox, regions: { [id]: { d, centroid, bbox, area } } }
 *
 * Countries are merged per region on the topology (so shared borders vanish),
 * simplified, projected with Natural Earth and written with one decimal.
 * Antarctica (polygons of the polar `far-south` region south of 60°S) is
 * flattened into a thin strip at the bottom so it does not dominate the map.
 *
 * Usage: node scripts/map/build-geometry.js [--check]
 *   --check  exit 1 if geometry.json is missing or out of date instead of writing it.
 */
const fs = require('node:fs');
const path = require('node:path');
const topojson = require('topojson-client');
const simplify = require('topojson-simplify');

const ROOT = path.join(__dirname, '..', '..');
const PACK_DIR = path.join(ROOT, 'src', 'content', 'packs', 'ai-lab');
const REGIONS_FILE = path.join(PACK_DIR, 'regions.json');
const MAP_FILE = path.join(PACK_DIR, 'map.json');
const OUT_FILE = path.join(PACK_DIR, 'geometry.json');
const ATLAS_FILE = require.resolve('world-atlas/countries-110m.json');

/** Output width in SVG units; height follows from the projection. */
const WIDTH = 1000;
/** Fraction of planar-area weights dropped by simplification (0..1). */
const SIMPLIFY_QUANTILE = 0.35;
/** Polygons whose mean latitude is south of this are squashed into the polar strip. */
const POLAR_LATITUDE = -60;
/** Height of the polar strip and the gap above it, in SVG units. */
const STRIP_HEIGHT = 14;
const STRIP_GAP = 10;
/** Region drawn as the polar strip. */
const POLAR_REGION = 'far-south';
/**
 * Marker positions [lon, lat] for regions whose largest polygon is not where
 * their people are (Greenland is the largest shape of the Nordics).
 */
const CENTROID_HINTS = {
  nordics: [16, 61],
};
/** Decimals kept in the output. */
const DIGITS = 1;

function round(n) {
  const f = 10 ** DIGITS;
  return Math.round(n * f) / f;
}

/** Projected rings of a polygon as arrays of [x, y]. */
function projectRings(polygon, project) {
  return polygon.map((ring) => ring.map((p) => project(p)).filter(Boolean));
}

function insideRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function edgeDistance(rings, x, y) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  }
  return best;
}

/**
 * Marker point inside a polygon: its centroid when that lies well inside,
 * otherwise the grid point farthest from the edges (concave shapes such as the Andes).
 */
function markerPoint(rings, centroid) {
  const xs = rings[0].map((p) => p[0]);
  const ys = rings[0].map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const N = 40;
  let best = centroid;
  let bestDist = -1;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = y0 + ((y1 - y0) * j) / N;
      if (!insideRings(rings, x, y)) continue;
      const d = edgeDistance(rings, x, y);
      if (d > bestDist) {
        bestDist = d;
        best = [x, y];
      }
    }
  }
  if (insideRings(rings, centroid[0], centroid[1]) && edgeDistance(rings, centroid[0], centroid[1]) >= bestDist * 0.5) return centroid;
  return best;
}

function meanLatitude(polygon) {
  const ring = polygon[0];
  let sum = 0;
  for (const p of ring) sum += p[1];
  return sum / ring.length;
}

async function build() {
  const d3 = await import('d3-geo');
  const atlas = JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8'));
  const regions = JSON.parse(fs.readFileSync(REGIONS_FILE, 'utf8'));
  const { noIdCountries } = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

  // Simplify on the topology so neighbouring regions keep sharing their borders.
  const pre = simplify.presimplify(atlas, simplify.planarTriangleArea);
  const topology = simplify.simplify(pre, simplify.quantile(pre, SIMPLIFY_QUANTILE));
  const geoms = topology.objects.countries.geometries;

  const regionOfCountry = new Map();
  for (const r of regions) for (const c of r.countries) regionOfCountry.set(c, r.id);
  const geomsByRegion = new Map(regions.map((r) => [r.id, []]));
  for (const g of geoms) {
    const id = g.id !== undefined ? regionOfCountry.get(String(g.id)) : noIdCountries[g.properties.name];
    if (id) geomsByRegion.get(id).push(g);
  }

  const merged = new Map();
  for (const r of regions) {
    const list = geomsByRegion.get(r.id);
    if (list.length === 0) throw new Error(`Region ${r.id} has no country shapes`);
    merged.set(r.id, topojson.merge(topology, list));
  }

  // Split the polar polygons off so they can be flattened separately.
  const polar = { type: 'MultiPolygon', coordinates: [] };
  const polarRest = { type: 'MultiPolygon', coordinates: [] };
  for (const poly of merged.get(POLAR_REGION).coordinates) {
    (meanLatitude(poly) < POLAR_LATITUDE ? polar : polarRest).coordinates.push(poly);
  }

  // Fit the projection to everything except the polar polygons.
  const land = {
    type: 'FeatureCollection',
    features: regions.map((r) => ({
      type: 'Feature',
      properties: {},
      geometry: r.id === POLAR_REGION ? polarRest : merged.get(r.id),
    })),
  };
  const projection = d3.geoNaturalEarth1().fitWidth(WIDTH, land);
  const plain = d3.geoPath(projection);
  const [[, landTop], [, landBottom]] = plain.bounds(land);

  // Polar strip: map the polar polygons' projected y range onto a thin band below the land.
  const [[, polarTop], [, polarBottom]] = plain.bounds(polar);
  const stripTop = landBottom + STRIP_GAP;
  const squashY = (y) => stripTop + ((y - polarTop) / (polarBottom - polarTop)) * STRIP_HEIGHT;
  const squash = d3.geoTransform({
    point(x, y) {
      this.stream.point(x, squashY(y));
    },
  });

  const shift = -landTop + 4;
  const height = Math.ceil(stripTop + STRIP_HEIGHT + 4 + shift);
  const move = d3.geoTransform({
    point(x, y) {
      this.stream.point(x, y + shift);
    },
  });
  const mainPath = d3.geoPath({ stream: (s) => projection.stream(move.stream(s)) }).digits(DIGITS);
  const polarOut = d3.geoPath({ stream: (s) => projection.stream(squash.stream(move.stream(s))) }).digits(DIGITS);

  const out = {};
  for (const r of regions) {
    const geom = merged.get(r.id);
    let d;
    let bounds;
    let centroid;
    let area;
    if (r.id === POLAR_REGION) {
      d = [mainPath(polarRest) || '', polarOut(polar) || ''].join('');
      const b1 = polarOut.bounds(polar);
      const b2 = polarRest.coordinates.length ? mainPath.bounds(polarRest) : b1;
      bounds = [
        [Math.min(b1[0][0], b2[0][0]), Math.min(b1[0][1], b2[0][1])],
        [Math.max(b1[1][0], b2[1][0]), Math.max(b1[1][1], b2[1][1])],
      ];
      centroid = [(b1[0][0] + b1[1][0]) / 2, (b1[0][1] + b1[1][1]) / 2];
      area = polarOut.area(polar) + (polarRest.coordinates.length ? mainPath.area(polarRest) : 0);
    } else {
      d = mainPath(geom);
      bounds = mainPath.bounds(geom);
      area = mainPath.area(geom);
      // Centroid of the largest polygon, so markers sit on the main landmass.
      let best = null;
      let bestArea = -1;
      for (const poly of geom.coordinates) {
        const p = { type: 'Polygon', coordinates: poly };
        const a = mainPath.area(p);
        if (a > bestArea) {
          bestArea = a;
          best = p;
        }
      }
      const project = (p) => {
        const xy = projection(p);
        return xy ? [xy[0], xy[1] + shift] : null;
      };
      const hint = CENTROID_HINTS[r.id];
      if (hint) {
        const [x, y] = projection(hint);
        centroid = [x, y + shift];
      } else {
        centroid = markerPoint(projectRings(best.coordinates, project), mainPath.centroid(best));
      }
    }
    out[r.id] = {
      d,
      centroid: centroid.map(round),
      bbox: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]].map(round),
      area: round(area),
    };
  }

  return {
    version: 1,
    width: WIDTH,
    height,
    viewBox: [0, 0, WIDTH, height],
    regions: out,
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const geometry = await build();
  const text = `${JSON.stringify(geometry, null, 1)}\n`;
  if (check) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== text) {
      console.error('geometry.json is out of date. Run: npm run build:map');
      process.exit(1);
    }
    console.log('geometry.json is up to date.');
    return;
  }
  fs.writeFileSync(OUT_FILE, text);
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB, ${Object.keys(geometry.regions).length} regions)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
