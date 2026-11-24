/**
 * A pixel canvas of palette roles. Each pixel holds a role letter's index (0 = empty), so a
 * drawing can be rendered in any stage's palette.
 *
 * Sprites are authored as grids: one string per row, one character per pixel, '.' for
 * empty, otherwise a role letter (see src/ui/garage/art/palettes.json). A sprite may carry
 * a `legend` that maps extra characters to roles, and several frames of the same size.
 */
const PALETTES = require('../../src/ui/garage/art/palettes.json');

const ROLES = PALETTES.roles;
const INDEX = Object.fromEntries(ROLES.map((r, i) => [r, i + 1]));

/** Role letter -> index (1..), '.' or ' ' -> 0. Throws on an unknown character. */
function roleIndex(ch, legend, where) {
  if (ch === '.' || ch === ' ') return 0;
  const role = legend && legend[ch] !== undefined ? legend[ch] : ch;
  if (role === '.') return 0;
  const i = INDEX[role];
  if (!i) throw new Error(`unknown pixel '${ch}' in ${where}`);
  return i;
}

/**
 * Defines a sprite from frames of rows.
 * @param {string} name
 * @param {string[][] | string[]} frames  one grid, or a list of grids of the same size
 * @param {Record<string, string>} [legend]
 */
function sprite(name, frames, legend) {
  const list = typeof frames[0] === 'string' ? [frames] : frames;
  const h = list[0].length;
  const w = Math.max(...list[0].map((r) => r.length));
  for (const [fi, rows] of list.entries()) {
    if (rows.length !== h) throw new Error(`${name} frame ${fi}: ${rows.length} rows, expected ${h}`);
    rows.forEach((r, y) => {
      if (r.length !== w) throw new Error(`${name} frame ${fi} row ${y}: ${r.length} wide, expected ${w}`);
    });
  }
  const data = list.map((rows, fi) => {
    const px = new Uint8Array(w * h);
    rows.forEach((r, y) => {
      for (let x = 0; x < w; x++) px[y * w + x] = roleIndex(r[x], legend, `${name} frame ${fi} (${x},${y})`);
    });
    return px;
  });
  return { name, w, h, frames: data };
}

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }

  set(x, y, role) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = typeof role === 'number' ? role : roleIndex(role, null, 'set');
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  /** Filled rectangle [x, x + w) x [y, y + h). */
  rect(x, y, w, h, role) {
    const r = roleIndex(role, null, 'rect');
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, r);
  }

  hline(x, y, w, role) {
    this.rect(x, y, w, 1, role);
  }

  vline(x, y, h, role) {
    this.rect(x, y, 1, h, role);
  }

  /** A one-pixel frame around [x, x + w) x [y, y + h). */
  box(x, y, w, h, role) {
    this.hline(x, y, w, role);
    this.hline(x, y + h - 1, w, role);
    this.vline(x, y, h, role);
    this.vline(x + w - 1, y, h, role);
  }

  /**
   * Draws a sprite frame with its top-left at (x, y). `map` swaps roles (for example a
   * shirt colour), `flip` mirrors it left to right.
   */
  stamp(spr, x, y, { frame = 0, map = null, flip = false } = {}) {
    const src = spr.frames[frame % spr.frames.length];
    const remap = map ? Object.fromEntries(Object.entries(map).map(([a, b]) => [INDEX[a], INDEX[b]])) : null;
    for (let j = 0; j < spr.h; j++) {
      for (let i = 0; i < spr.w; i++) {
        let v = src[j * spr.w + (flip ? spr.w - 1 - i : i)];
        if (!v) continue;
        if (remap && remap[v]) v = remap[v];
        this.set(x + i, y + j, v);
      }
    }
  }

  /** Draws another canvas onto this one (empty pixels skipped). */
  draw(other, x, y) {
    for (let j = 0; j < other.h; j++) for (let i = 0; i < other.w; i++) {
      const v = other.px[j * other.w + i];
      if (v) this.set(x + i, y + j, v);
    }
  }

  /** Replaces one role by another inside a rectangle (a light pool, a shadow). */
  recolour(x, y, w, h, from, to, mask) {
    const a = INDEX[from];
    const b = INDEX[to];
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (mask && !mask(i - x, j - y)) continue;
      if (this.get(i, j) === a) this.set(i, j, b);
    }
  }

  /** The smallest box around the non-empty pixels. */
  bounds() {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (!this.px[j * this.w + i]) continue;
      if (i < x0) x0 = i;
      if (j < y0) y0 = j;
      if (i > x1) x1 = i;
      if (j > y1) y1 = j;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  crop(x, y, w, h) {
    const c = new Canvas(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.px[j * w + i] = this.get(x + i, y + j);
    return c;
  }
}

/** The colours of a stage as a PNG palette: entry 0 transparent, then the roles in order. */
function stageColours(stage) {
  const p = PALETTES.stages[stage];
  if (!p) throw new Error(`no palette for ${stage}`);
  return ['#000000', ...ROLES.map((r) => p.colours[r])];
}

module.exports = { Canvas, sprite, stageColours, ROLES, INDEX, PALETTES };
