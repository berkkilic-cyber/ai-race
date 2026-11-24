/**
 * Drawing helpers shared by the stages: three-quarter blocks (a lit top face over a flat
 * front face, one-pixel ink outline), lines and light pools. Light comes from the top
 * left: top faces are the lightest, the left edge of a front face catches a highlight and
 * the right edge falls into shade.
 */
const { Canvas } = require('../canvas');

/**
 * A three-quarter block: top face `d` rows deep over a front face `h` rows tall, inside
 * an ink outline. (x, y) is the outline's top-left corner; the whole block is w wide and
 * d + h + 2 tall (+1 for the outline's bottom row is included).
 * mat: { top, front, hi?, shade?, edge? } as role letters.
 */
function block(c, x, y, w, d, h, mat) {
  const total = d + h + 2;
  c.rect(x, y, w, total, 'k');
  c.rect(x + 1, y + 1, w - 2, d, mat.top);
  c.rect(x + 1, y + 1 + d, w - 2, h, mat.front);
  if (mat.edge) c.hline(x + 1, y + 1 + d, w - 2, mat.edge);
  if (mat.hi) {
    c.hline(x + 1, y + 1, w - 2, mat.hi);
    c.vline(x + 1, y + 1 + d + (mat.edge ? 1 : 0), h - (mat.edge ? 1 : 0), mat.hi);
  }
  if (mat.shade) c.vline(x + w - 2, y + 1 + d + (mat.edge ? 1 : 0), h - (mat.edge ? 1 : 0), mat.shade);
  // Round the outline's corners by one pixel: blocks read softer and less like UI boxes.
  return { x, y, w, h: total };
}

/** Bresenham line. */
function line(c, x0, y0, x1, y1, role) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.set(x0, y0, role);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Whether (i, j) is inside an ellipse centred in a w x h box. */
function inEllipse(i, j, w, h) {
  const rx = w / 2;
  const ry = h / 2;
  const dx = (i + 0.5 - rx) / rx;
  const dy = (j + 0.5 - ry) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Filled ellipse in a w x h box. */
function ellipse(c, x, y, w, h, role) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inEllipse(i, j, w, h)) c.set(x + i, y + j, role);
}

/**
 * A stepped light pool: rings of an ellipse where `from` becomes `to` (no gradients: two
 * or three hard steps).
 */
function pool(c, cx, cy, steps) {
  for (const { rx, ry, from, to } of steps) {
    c.recolour(Math.round(cx - rx), Math.round(cy - ry), Math.round(rx * 2), Math.round(ry * 2), from, to, (i, j) => inEllipse(i, j, Math.round(rx * 2), Math.round(ry * 2)));
  }
}

/** A new canvas with a drawing function applied: handy for composing a sprite in code. */
function paint(w, h, fn) {
  const c = new Canvas(w, h);
  fn(c);
  return c;
}

/** A canvas as a sprite (one frame), so composed pieces can be stamped and listed on the contact sheet. */
function asSprite(name, canvases) {
  const list = Array.isArray(canvases) ? canvases : [canvases];
  return { name, w: list[0].w, h: list[0].h, frames: list.map((c) => c.px) };
}

/** Adds a one-pixel ink outline around every non-empty pixel that touches empty space. */
function outline(c, role = 'k') {
  const src = new Uint8Array(c.px);
  const at = (i, j) => (i < 0 || j < 0 || i >= c.w || j >= c.h ? 0 : src[j * c.w + i]);
  for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
    if (at(i, j)) continue;
    if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) c.set(i, j, role);
  }
}

module.exports = { block, line, ellipse, inEllipse, pool, paint, asSprite, outline };
