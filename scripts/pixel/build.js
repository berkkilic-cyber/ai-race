#!/usr/bin/env node
/**
 * Renders the Garage's pixel art: `npm run pixel`.
 *
 *   assets/garage/<stage>-room.png               the room, baked (walls, floor, fixed props)
 *   assets/garage/<stage>-<tier>-<n>.png         a tier's slot at count level n, frames side by side
 *   assets/garage/<stage>-shelf-<n>.png          the later tiers' shelf with n items
 *   assets/garage/<stage>-amb-<id>.png           an ambient loop (bulb, steam ...)
 *   each also as @2x and @3x, nearest-neighbour at whole factors of the display size
 *   src/ui/garage/art/manifest.ts                positions, sizes, frame counts, requires
 *   docs/screenshots/garage/pixel-contact-sheet.png   every sprite and scene at 4x, for review
 *
 * Deterministic: the same sources give the same bytes (the test checks the files on disk
 * match a fresh render). Env: CHECK=1 renders in memory and exits 1 if anything on disk
 * differs, without writing.
 */
/* global __dirname, Buffer */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { encodeIndexed, hexRgb } = require('./png');
const { Canvas, stageColours, PALETTES, ROLES } = require('./canvas');
const { SCENES, LEVELS, DP_PER_PIXEL, ROOM, SHELF_TIERS } = require('./scenes');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets', 'garage');
const MANIFEST = path.join(ROOT, 'src', 'ui', 'garage', 'art', 'manifest.ts');
const SHEET = path.join(ROOT, 'docs', 'screenshots', 'garage', 'pixel-contact-sheet.png');
const DENSITIES = [1, 2, 3];

/** Frames side by side in one canvas. */
function strip(frames) {
  const w = frames[0].w;
  const c = new Canvas(w * frames.length, frames[0].h);
  frames.forEach((f, i) => c.draw(f, i * w, 0));
  return c;
}

function hash(c) {
  return crypto.createHash('sha1').update(Buffer.from(c.px)).update(`${c.w}x${c.h}`).digest('hex');
}

/** Every file of one stage: { name -> canvas }, plus the manifest entry. */
function renderStage(scene) {
  const files = new Map();
  const seen = new Map();
  const add = (name, canvas) => {
    const h = hash(canvas);
    if (seen.has(h)) return seen.get(h);
    seen.set(h, name);
    files.set(name, canvas);
    return name;
  };
  const room = scene.room();
  const entry = { room: add(`${scene.id}-room`, room), tiers: {}, order: Object.keys(scene.tiers), ambient: [] };
  for (const [id, t] of Object.entries(scene.tiers)) {
    const levels = [null];
    for (let level = 1; level <= LEVELS.length; level++) {
      const frames = Array.from({ length: t.frames }, (_, f) => t.draw(level, f));
      const empty = frames.every((f) => !f.bounds());
      levels.push(empty ? null : add(`${scene.id}-${id}-${level}`, strip(frames)));
    }
    entry.tiers[id] = { x: t.slot.x, y: t.slot.y, w: t.slot.w, h: t.slot.h, of: t.slot.of ?? id, frames: t.frames, fps: t.fps, levels };
  }
  if (scene.shelf) {
    const { x, y, step } = scene.shelf;
    const items = scene.shelfItems;
    const w = step * SHELF_TIERS.length;
    const h = scene.shelf.h ?? 8;
    const levels = [null];
    for (let n = 1; n <= SHELF_TIERS.length; n++) {
      const c = new Canvas(w, h);
      for (let i = 0; i < n; i++) c.stamp(items[SHELF_TIERS[i]], i * step, h - items[SHELF_TIERS[i]].h);
      levels.push(add(`${scene.id}-shelf-${n}`, c));
    }
    entry.shelf = { x, y, w, h, levels };
  }
  if (scene.plinth) {
    const c = scene.plinth();
    entry.plinth = { w: c.w, h: c.h, top: scene.plinthTop ?? 2, src: add(`${scene.id}-plinth`, c) };
  }
  for (const a of scene.ambient) {
    const count = a.count ?? 3;
    const frames = Array.from({ length: count }, (_, f) => a.frames(f));
    entry.ambient.push({ id: a.id, x: a.x, y: a.y, w: frames[0].w, h: frames[0].h, frames: count, fps: a.fps, src: add(`${scene.id}-amb-${a.id}`, strip(frames)) });
  }
  return { files, entry, room };
}

/** Draws a scene at given levels onto a room-sized canvas (for the contact sheet). */
function compose(scene, rendered, levels, frame = 0) {
  const c = new Canvas(ROOM.w, ROOM.h);
  c.draw(rendered.room, 0, 0);
  for (const id of rendered.entry.order) {
    const lv = levels[scene.tiers[id].slot.of ?? id] ?? 0;
    if (!lv) continue;
    const t = scene.tiers[id];
    c.draw(t.draw(Math.min(lv, LEVELS.length), frame % t.frames), t.slot.x, t.slot.y);
  }
  if (scene.shelf && levels.shelf) {
    const { x, y, step } = scene.shelf;
    for (let i = 0; i < levels.shelf; i++) {
      const it = scene.shelfItems[SHELF_TIERS[i]];
      c.stamp(it, x + i * step, y + (scene.shelf.h ?? 8) - it.h);
    }
  }
  for (const a of scene.ambient) c.draw(a.frames(frame % (a.count ?? 3)), a.x, a.y);
  if (scene.plinth) {
    const p = scene.plinth();
    c.draw(p, Math.round(ROOM.w / 2 - p.w / 2), PLINTH_BOX.y);
  }
  return c;
}

// ------------------------------------------------------------------ contact sheet (RGB)

class Rgb {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.px = new Uint32Array(w * h).fill(bg);
  }
  put(canvas, colours, x0, y0, scale) {
    const rgb = colours.map((c) => {
      const [r, g, b] = hexRgb(c);
      return (r << 16) | (g << 8) | b;
    });
    for (let j = 0; j < canvas.h; j++) for (let i = 0; i < canvas.w; i++) {
      const v = canvas.px[j * canvas.w + i];
      if (!v) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const x = x0 + i * scale + dx;
        const y = y0 + j * scale + dy;
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = rgb[v];
      }
    }
  }
  frame(x, y, w, h, colour) {
    for (let i = x; i < x + w; i++) {
      this.dot(i, y, colour);
      this.dot(i, y + h - 1, colour);
    }
    for (let j = y; j < y + h; j++) {
      this.dot(x, j, colour);
      this.dot(x + w - 1, j, colour);
    }
  }
  dot(x, y, colour) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = colour;
  }
  encode() {
    const colours = [...new Set(this.px)].sort((a, b) => a - b);
    if (colours.length > 255) throw new Error(`contact sheet has ${colours.length} colours`);
    const index = new Map(colours.map((c, i) => [c, i + 1]));
    const pixels = new Uint8Array(this.w * this.h);
    for (let i = 0; i < pixels.length; i++) pixels[i] = index.get(this.px[i]);
    const hex = ['#000000', ...colours.map((c) => '#' + c.toString(16).padStart(6, '0'))];
    return encodeIndexed(this.w, this.h, pixels, hex, 1);
  }
}

const SHEET_BG = 0x111214;
const GUIDE = 0xff3df5;
const GUIDE2 = 0x3dd9ff;

/** The parts of the room that are covered or cut off in the game, drawn as guides on one copy. */
function guides(rgb, x0, y0, s) {
  // Visible area at 844x390 (stage 349x290) and 926x428 (stage 387x334), the HUD plate and the offer slot.
  const cx = ROOM.w / 2;
  for (const [sw, sh, colour] of [
    [349, 290, GUIDE],
    [387, 334, GUIDE2],
  ]) {
    const vw = sw / DP_PER_PIXEL;
    const vh = sh / DP_PER_PIXEL;
    const vx = Math.round((ROOM.w * DP_PER_PIXEL - sw) / 2) / DP_PER_PIXEL;
    const vy = ROOM.h - vh;
    rgb.frame(Math.round(x0 + vx * s), Math.round(y0 + vy * s), Math.round(vw * s), Math.round(vh * s), colour);
    const hud = HUD_PLATE;
    rgb.frame(Math.round(x0 + (vx + hud.x) * s), Math.round(y0 + (vy + hud.y) * s), Math.round(hud.w * s), Math.round(hud.h * s), colour);
    const offer = OFFER_SLOT;
    rgb.frame(Math.round(x0 + (vx + vw - offer.right - offer.w) * s), Math.round(y0 + (vy + offer.y) * s), Math.round(offer.w * s), Math.round(offer.h * s), colour);
  }
  // The model (its body, 46 art pixels square) and the plinth under it.
  const m = MODEL_BOX;
  rgb.frame(Math.round(x0 + m.x * s), Math.round(y0 + m.y * s), Math.round(m.w * s), Math.round(m.h * s), GUIDE);
  const p = PLINTH_BOX;
  rgb.frame(Math.round(x0 + p.x * s), Math.round(y0 + p.y * s), Math.round(p.w * s), Math.round(p.h * s), GUIDE2);
}

/** In art pixels from the stage's top left: the HUD plate (204 x 90 dp, 8 dp in) and the widest offer (bonus multiplier, about 170 x 48 dp). */
const HUD_PLATE = { x: 4, y: 1, w: 102, h: 46 };
const OFFER_SLOT = { right: 4, y: 1, w: 86, h: 26 };
/** The model's body and its plinth, in room pixels (the same at both phone sizes: the room and the model are bottom-anchored). */
const MODEL_BOX = { x: 86, y: 94, w: 44, h: 44 };
const PLINTH_BOX = { x: 82, y: 134, w: 52, h: 20 };

function contactSheet(stages, spriteList) {
  const S = 4;
  const pad = 24;
  const cols = 2;
  const sceneW = ROOM.w * S;
  const sceneH = ROOM.h * S;
  const variants = ['empty', 'early', 'mid', 'full', 'guides'];
  const rows = stages.length * Math.ceil(variants.length / cols);
  // Sprites: laid out in a flowing row block at the top.
  const spriteBlock = [];
  let x = pad;
  let y = pad;
  let rowH = 0;
  const maxW = cols * (sceneW + pad) + pad;
  for (const s of spriteList) {
    const w = s.canvas.w * S;
    const h = s.canvas.h * S;
    if (x + w + pad > maxW) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    spriteBlock.push({ ...s, x, y });
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  const spritesH = y + rowH + pad;
  const rgb = new Rgb(maxW, spritesH + rows * (sceneH + pad) + pad, SHEET_BG);
  for (const s of spriteBlock) rgb.put(s.canvas, stageColours(s.stage), s.x, s.y, S);
  let r = 0;
  for (const st of stages) {
    variants.forEach((v, i) => {
      const cx = pad + (i % cols) * (sceneW + pad);
      const cy = spritesH + (r + Math.floor(i / cols)) * (sceneH + pad);
      const levels = v === 'guides' ? 'full' : v;
      rgb.put(st.variants[levels], stageColours(st.id), cx, cy, S);
      if (v === 'guides') guides(rgb, cx, cy, S);
    });
    r += Math.ceil(variants.length / cols);
  }
  return rgb.encode();
}

const VARIANT_LEVELS = {
  empty: {},
  early: { intern: 2, gpu: 1, closet: 1, scraper: 1 },
  mid: { intern: 4, gpu: 3, closet: 3, scraper: 2, hall: 1, chips: 1, power: 1, shelf: 2 },
  full: { intern: 6, gpu: 6, closet: 6, scraper: 6, hall: 6, chips: 6, power: 6, robotics: 6, orbital: 6, universe: 6, shelf: 5 },
};

// ------------------------------------------------------------------ manifest

function manifest(entries) {
  const req = (name) => `require('../../../../assets/garage/${name}.png')`;
  const lines = [];
  lines.push('// Generated by `npm run pixel` (scripts/pixel/build.js). Do not edit: change the sprites and run it again.');
  lines.push("import type { ImageSourcePropType } from 'react-native';");
  lines.push('');
  lines.push('/** A layer of the room: where it sits (art pixels), its size, frames side by side and their speed. */');
  lines.push('export interface ArtLayer {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n  frames: number;\n  fps: number;\n}');
  lines.push('export interface ArtTier extends ArtLayer {\n  /** The generator whose count picks the level (a tier can have a second layer elsewhere). */\n  of: string;\n  /** Index = count level (0 = nothing shown). */\n  levels: (ImageSourcePropType | null)[];\n}');
  lines.push('export interface ArtAmbient extends ArtLayer {\n  id: string;\n  src: ImageSourcePropType;\n}');
  lines.push('export interface ArtScene {\n  room: ImageSourcePropType;\n  /** Back to front. */\n  order: string[];\n  tiers: Record<string, ArtTier>;\n  shelf: { x: number; y: number; w: number; h: number; levels: (ImageSourcePropType | null)[] } | null;\n  ambient: ArtAmbient[];\n  /** What the model stands on: drawn under it in the tap target, its feet `top` art pixels below the image\'s top edge. */\n  plinth: { w: number; h: number; top: number; src: ImageSourcePropType } | null;\n}');
  lines.push('');
  lines.push(`/** The room in art pixels. */\nexport const ROOM_W = ${ROOM.w};\nexport const ROOM_H = ${ROOM.h};`);
  lines.push(`/** Where the back wall starts and ends (art pixels from the top), to fill a stage wider or taller than the room. */\nexport const ROOM_BANDS = { ceiling: ${ROOM.ceiling}, floor: ${ROOM.floor} };`);
  lines.push(`/** dp per art pixel. */\nexport const DP_PER_PIXEL = ${DP_PER_PIXEL};`);
  lines.push(`/** Owning at least LEVELS[i] of a tier shows level i + 1. */\nexport const LEVELS = ${JSON.stringify(LEVELS)};`);
  lines.push(`/** Later tiers on the shelf, in order. */\nexport const SHELF_TIERS = ${JSON.stringify(SHELF_TIERS)};`);
  lines.push('');
  lines.push('export const PIXEL_SCENES: Record<string, ArtScene> = {');
  for (const [id, e] of entries) {
    lines.push(`  ${id}: {`);
    lines.push(`    room: ${req(e.room)},`);
    lines.push(`    order: ${JSON.stringify(e.order)},`);
    lines.push('    tiers: {');
    for (const tid of e.order) {
      const t = e.tiers[tid];
      lines.push(`      ${tid}: { of: '${t.of}', x: ${t.x}, y: ${t.y}, w: ${t.w}, h: ${t.h}, frames: ${t.frames}, fps: ${t.fps}, levels: [${t.levels.map((l) => (l ? req(l) : 'null')).join(', ')}] },`);
    }
    lines.push('    },');
    lines.push(e.shelf ? `    shelf: { x: ${e.shelf.x}, y: ${e.shelf.y}, w: ${e.shelf.w}, h: ${e.shelf.h}, levels: [${e.shelf.levels.map((l) => (l ? req(l) : 'null')).join(', ')}] },` : '    shelf: null,');
    lines.push('    ambient: [');
    for (const a of e.ambient) lines.push(`      { id: '${a.id}', x: ${a.x}, y: ${a.y}, w: ${a.w}, h: ${a.h}, frames: ${a.frames}, fps: ${a.fps}, src: ${req(a.src)} },`);
    lines.push('    ],');
    lines.push(e.plinth ? `    plinth: { w: ${e.plinth.w}, h: ${e.plinth.h}, top: ${e.plinth.top}, src: ${req(e.plinth.src)} },` : '    plinth: null,');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('/** Every image file the scenes use (base names, without density suffix). */');
  const all = [];
  for (const [, e] of entries) {
    all.push(e.room);
    for (const t of Object.values(e.tiers)) for (const l of t.levels) if (l) all.push(l);
    if (e.shelf) for (const l of e.shelf.levels) if (l) all.push(l);
    for (const a of e.ambient) all.push(a.src);
    if (e.plinth) all.push(e.plinth.src);
  }
  lines.push(`export const ART_FILES = ${JSON.stringify([...new Set(all)])};`);
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------------------------ main

/** Renders everything in memory: { path -> Buffer }. */
function renderAll() {
  const out = new Map();
  const entries = [];
  const sheetStages = [];
  const spriteList = [];
  for (const scene of SCENES) {
    const r = renderStage(scene);
    const colours = stageColours(scene.id);
    for (const [name, canvas] of r.files) {
      DENSITIES.forEach((d) => {
        const suffix = d === 1 ? '' : `@${d}x`;
        out.set(path.join(ASSETS, `${name}${suffix}.png`), encodeIndexed(canvas.w, canvas.h, canvas.px, colours, DP_PER_PIXEL * d));
      });
    }
    entries.push([scene.id, r.entry]);
    const variants = {};
    for (const [v, lv] of Object.entries(VARIANT_LEVELS)) variants[v] = compose(scene, r, lv);
    sheetStages.push({ id: scene.id, variants });
    for (const s of scene.sheetSprites ? scene.sheetSprites() : []) spriteList.push({ stage: scene.id, canvas: s });
  }
  out.set(MANIFEST, Buffer.from(manifest(entries)));
  out.set(SHEET, contactSheet(sheetStages, spriteList));
  return out;
}

/** PREVIEW=<stage>: only that stage's scenes (and its sprites) at 4x in /tmp, nothing else written. */
function preview(id) {
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) throw new Error(`no scene ${id}`);
  const r = renderStage(scene);
  const variants = {};
  for (const [v, lv] of Object.entries(VARIANT_LEVELS)) variants[v] = compose(scene, r, lv);
  const sprites = (scene.sheetSprites ? scene.sheetSprites() : []).map((canvas) => ({ stage: id, canvas }));
  const file = path.join(require('node:os').tmpdir(), `pixel-preview-${id}.png`);
  fs.writeFileSync(file, contactSheet([{ id, variants }], process.env.SPRITES ? sprites : []));
  console.log(`preview: ${file}`);
}

function main() {
  if (process.env.PREVIEW) return preview(process.env.PREVIEW);
  const out = renderAll();
  if (process.env.CHECK) {
    let bad = 0;
    for (const [file, buf] of out) {
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) {
        console.log(`differs: ${path.relative(ROOT, file)}`);
        bad++;
      }
    }
    process.exit(bad ? 1 : 0);
  }
  fs.mkdirSync(ASSETS, { recursive: true });
  // Remove stale art first (a renamed sprite must not leave its old file behind).
  for (const f of fs.readdirSync(ASSETS)) if (f.endsWith('.png') && !out.has(path.join(ASSETS, f))) fs.unlinkSync(path.join(ASSETS, f));
  let bytes = 0;
  for (const [file, buf] of out) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    if (file.startsWith(ASSETS)) bytes += buf.length;
  }
  console.log(`pixel: ${[...out.keys()].filter((f) => f.startsWith(ASSETS)).length} files in assets/garage, ${(bytes / 1024).toFixed(0)} KB; manifest and contact sheet written`);
}

module.exports = { renderAll, ASSETS, MANIFEST, SHEET, PALETTES, ROLES };

if (require.main === module) main();
