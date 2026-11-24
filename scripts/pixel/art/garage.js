/**
 * The Garage: sodium amber and rust on concrete, scrappy. A roll-up door, a bare bulb, a
 * concrete floor with an oil stain and moving boxes; interns at folding tables, rented GPU
 * rigs on the floor, a server rack, a pegboard of phones (the scraper farm) and, once a
 * compute hall is bought, the roll-up door opens onto it.
 */
const { Canvas, sprite } = require('../canvas');
const { block, line, ellipse, pool, paint } = require('./draw');
const P = require('./people');

// ---------------------------------------------------------------- sprites (grids)

/** Laptop lid seen from behind, with a sticker; the screen's glow leaks over the top edge (10 x 7). */
const laptopBack = sprite('laptop-back', [
  '.AAAAAAAA.',
  'kkkkkkkkkk',
  'kMhMMMMMmk',
  'kMMMMsMMmk',
  'kMMMMMMMmk',
  'kmmmmmmmmk',
  'kkkkkkkkkk',
]);

/** A GPU card standing on its edge, fans to the viewer; two frames for the fans (7 x 12). */
const gpuCard = sprite('gpu-card', [
  [
    'kkkkkkk',
    'kbaaabk',
    'knmmmnk',
    'kmmMmmk',
    'kmMkMmk',
    'kmmMmmk',
    'knmmmnk',
    'kmmMmmk',
    'kmMkMmk',
    'kmmMmmk',
    'knnnnnk',
    'kkkkkkk',
  ],
  [
    'kkkkkkk',
    'kbaaabk',
    'knmmmnk',
    'kmMmMmk',
    'kmmkmmk',
    'kmMmMmk',
    'knmmmnk',
    'kmMmMmk',
    'kmmkmmk',
    'kmMmMmk',
    'knnnnnk',
    'kkkkkkk',
  ],
]);

/** A phone clipped to the pegboard; two frames (scrolling feed) (5 x 8). */
const phone = sprite('phone', [
  ['kkkk', 'khAk', 'kAAk', 'khhk', 'kAhk', 'kmmk', 'kkkk'],
  ['kkkk', 'kAAk', 'khhk', 'kAhk', 'khAk', 'kmmk', 'kkkk'],
]);

/** The bare bulb on its cord, three frames of a slow swing (9 x 26). */
const bulb = sprite(
  'bulb',
  [0, 1, 2].map((f) => {
    const dx = [0, 1, -1][f];
    const rows = [];
    for (let y = 0; y < 26; y++) {
      const r = Array(9).fill('.');
      if (y < 19) {
        const x = 4 + Math.round((dx * y) / 19);
        r[x] = 'k';
      }
      rows.push(r);
    }
    const bx = 4 + dx;
    const put = (x, y, ch) => {
      if (rows[y] && x >= 0 && x < 9) rows[y][x] = ch;
    };
    // Socket, then the glass.
    put(bx - 1, 19, 'k');
    put(bx, 19, 'm');
    put(bx + 1, 19, 'k');
    put(bx - 1, 20, 'k');
    put(bx, 20, 'M');
    put(bx + 1, 20, 'k');
    for (const [x, y, ch] of [
      [-1, 21, 'A'], [0, 21, 'h'], [1, 21, 'A'],
      [-2, 22, 'A'], [-1, 22, 'h'], [0, 22, 'h'], [1, 22, 'A'], [2, 22, 'a'],
      [-2, 23, 'A'], [-1, 23, 'h'], [0, 23, 'A'], [1, 23, 'A'], [2, 23, 'a'],
      [-1, 24, 'A'], [0, 24, 'a'], [1, 24, 'a'],
    ]) put(bx + x, y, ch);
    return rows.map((r) => r.join(''));
  }),
);

/** Steam off a mug, three frames (5 x 7). */
const steam = sprite('steam', [
  ['..M..', '.M...', '.M...', '..M..', '...M.', '..M..', '.....'],
  ['.....', '..M..', '.M...', '.M...', '..M..', '...M.', '..M..'],
  ['...M.', '..M..', '..M..', '.M...', '.M...', '..M..', '.....'],
]);

/** A mug (5 x 5). */
const mug = sprite('mug', ['kkkk.', 'kShkk', 'kSs.k', 'kSskk', 'kkkk.']);

/** A pizza box, three-quarter view (12 x 5). */
const pizzaBox = sprite('pizza-box', ['kkkkkkkkkkkk', 'kAoooooooook', 'koooosSooook', 'kuuuuuuuuuuk', 'kkkkkkkkkkkk']);

/** A fire extinguisher (5 x 12): for when the rigs get warm. */
const extinguisher = sprite('extinguisher', [
  '.kkk.',
  'kkmk.',
  '.kk.k',
  'kSsk.',
  'kSsbk',
  'kShsk',
  'kShsk',
  'kSssk',
  'kSssk',
  'kSsbk',
  'kSsbk',
  '.kkk.',
]);

/** A desk fan, three frames of blades (9 x 11). */
const deskFan = sprite('desk-fan', [
  ['..kkkkk..', '.kmMmmmk.', 'kmmMmmmmk', 'kMMMkmmmk', 'kmmmkMMMk', 'kmmmmMmmk', '.kmmmMmk.', '..kkkkk..', '....k....', '...kmk...', '..kkkkk..'],
  ['..kkkkk..', '.kmmmmMk.', 'kMmmmmMmk', 'kmMmkMmmk', 'kmmMkmMmk', 'kmMmmmmMk', '.kMmmmmk.', '..kkkkk..', '....k....', '...kmk...', '..kkkkk..'],
  ['..kkkkk..', '.kmmMmmk.', 'kmmmMmmmk', 'kmmmkmmmk', 'kMMMkMMMk', 'kmmmkmmmk', '.kmmMmmk.', '..kkkkk..', '....k....', '...kmk...', '..kkkkk..'],
]);

/** Later tiers as things on a shelf: a chip, a lightning bolt, a robot arm, a rocket, a star (7 x 7 each). */
const shelfItems = {
  chips: sprite('shelf-chips', ['.k.k.k.', 'kkkkkkk', '.kmmmk.', 'kkmAmkk', '.kmmmk.', 'kkkkkkk', '.k.k.k.']),
  power: sprite('shelf-power', ['...kkk.', '..kAAk.', '.kAAk..', 'kAAAAk.', '..kAk..', '.kAk...', '.kk....']),
  robotics: sprite('shelf-robotics', ['....kk.', '...kMMk', '..kMk..', '.kMk...', 'kkMkk..', 'kmmmk..', 'kkkkk..']),
  orbital: sprite('shelf-orbital', ['...k...', '..kMk..', '..kMk..', '..khk..', '.kMMMk.', 'kk.a.kk', '...A...']),
  universe: sprite('shelf-universe', ['...k...', '..kAk..', 'kkkAkkk', 'kAAhAAk', '.kAAAk.', '.kAkAk.', 'kk...kk']),
};

// ---------------------------------------------------------------- composed objects

/** An intern at a folding table with a laptop; frames = typing (22 x 22). */
function internDesk(frame, look = {}) {
  return paint(24, 25, (c) => {
    // Contact shadow on the floor.
    c.rect(1, 23, 22, 2, 'n');
    // Under the table: the intern's legs and shoes, then the table's X legs.
    c.rect(9, 18, 6, 3, 'n');
    c.rect(8, 21, 3, 2, 'k');
    c.rect(13, 21, 3, 2, 'k');
    line(c, 2, 18, 6, 23, 'k');
    line(c, 6, 18, 2, 23, 'k');
    line(c, 21, 18, 17, 23, 'k');
    line(c, 17, 18, 21, 23, 'k');
    c.stamp(P.internUpper, 6, 0, { map: look });
    block(c, 0, 12, 24, 3, 1, { top: 'm', front: 'n', hi: 'M' });
    c.stamp(laptopBack, 7, 7);
    c.stamp(P.hands, 4, 13, { frame, map: look.p ? { p: look.p } : null });
  });
}

/** A rented GPU rig: an open frame with three cards and a PSU; frames = fans (24 x 19). */
function gpuRig(frame) {
  return paint(24, 20, (c) => {
    c.rect(1, 18, 23, 2, 'n');
    // Frame: two posts, a top rail, a shelf.
    c.rect(0, 2, 24, 1, 'k');
    c.rect(0, 3, 24, 1, 'M');
    c.rect(0, 4, 24, 1, 'k');
    for (const x of [0, 23]) c.rect(x, 2, 1, 17, 'k');
    for (const x of [1, 22]) c.rect(x, 5, 1, 12, 'm');
    // Cards hang from the rail.
    for (let i = 0; i < 3; i++) c.stamp(gpuCard, 2 + i * 7, 4, { frame: (frame + i) % 2 });
    // Shelf with the PSU and a riser board.
    block(c, 0, 15, 24, 1, 1, { top: 'm', front: 'n' });
    c.rect(2, 13, 5, 2, 'n');
    c.rect(16, 14, 6, 1, 'b');
    // Cables.
    c.set(1, 0, 'k');
    c.set(1, 1, 'k');
    c.set(22, 1, 's');
  });
}

/** A server rack: units with LEDs; frames chase the LEDs (16 x 40). */
function serverRack(frame, units = 7) {
  return paint(16, 40, (c) => {
    block(c, 0, 0, 16, 2, 36, { top: 'M', front: 'n', hi: 'm', shade: 'k' });
    for (let u = 0; u < units; u++) {
      const y = 5 + u * 5;
      c.rect(2, y, 12, 4, 'm');
      c.hline(2, y, 12, 'M');
      c.hline(2, y + 3, 12, 'n');
      c.rect(3, y + 1, 5, 1, 'n');
      c.rect(3, y + 2, 5, 1, 'k');
      const lit = (u + frame) % 3 === 0;
      c.set(10, y + 1, lit ? 'G' : 'n');
      c.set(12, y + 1, (u + frame) % 3 === 1 ? 'a' : 'b');
      c.set(10, y + 2, 'k');
    }
    // Feet.
    c.rect(1, 38, 2, 2, 'k');
    c.rect(13, 38, 2, 2, 'k');
  });
}

/** The pegboard with `count` phones (0..12) on it, frames flicker the feeds (30 x 26). */
function pegboard(frame, count) {
  return paint(30, 22, (c) => {
    c.rect(0, 0, 30, 22, 'k');
    c.rect(1, 1, 28, 20, 'u');
    c.hline(1, 1, 28, 'o');
    c.vline(1, 1, 20, 'o');
    for (let y = 4; y < 21; y += 3) for (let x = 4; x < 28; x += 3) c.set(x, y, 'n');
    for (let i = 0; i < count; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 3 + col * 5;
      const y = 3 + row * 9;
      c.stamp(phone, x, y, { frame: (frame + i * 7) % 2 });
      // Charging cables hang to the bottom edge.
      for (let yy = y + 7; yy < 21; yy++) if (!c.get(x + 1, yy) || c.get(x + 1, yy) !== 1) c.set(x + 1 + (yy % 2), yy, 'k');
    }
  });
}

/** Cardboard box in three-quarter view with tape. */
function box(c, x, y, w, d, h) {
  block(c, x, y, w, d, h, { top: 'o', front: 'u', hi: 'A', shade: 'k' });
  c.rect(x + Math.floor(w / 2) - 1, y + 1, 2, d, 'M');
  c.rect(x + Math.floor(w / 2) - 1, y + 1 + d, 2, 2, 'm');
}

// ---------------------------------------------------------------- the room

const W = 216;
const H = 170;
const CEIL = 26;
const FLOOR = 110;

/** The roll-up door: frame, slats, handle, little windows. Opening `open` 0..1 (0 = shut). */
function rollUpDoor(c, x, y, w, h, open, hallFrame = 0) {
  // Frame.
  c.rect(x - 2, y - 3, w + 4, h + 3, 'k');
  c.rect(x - 1, y - 2, w + 2, 2, 'n');
  const shut = Math.round((h - 1) * (1 - open));
  // Behind the door when it is open: the hall, aisles of racks in the accent glow.
  if (open > 0) {
    c.rect(x, y, w, h, 'k');
    // Floor of the hall, lit by the open door.
    c.rect(x, y + h - 6, w, 6, 'n');
    c.hline(x, y + h - 6, w, 'b');
    for (let i = 0; i < 4; i++) {
      const rx = x + 2 + i * 11;
      if (rx + 8 > x + w) break;
      c.rect(rx, y + 6, 8, h - 12, 'n');
      c.vline(rx, y + 6, h - 12, 'm');
      for (let j = 0; j < 6; j++) {
        const ly = y + 9 + j * 4;
        if (ly > y + h - 8) break;
        c.set(rx + 2, ly, (i + j + hallFrame) % 3 === 0 ? 'G' : 'b');
        c.set(rx + 5, ly, (i + j + hallFrame) % 2 === 0 ? 'A' : 'b');
      }
    }
  }
  // The slats that are still down.
  for (let j = 0; j < shut; j++) {
    const yy = y + j;
    const groove = j % 4 === 3;
    c.hline(x, yy, w, groove ? 'n' : j % 4 === 0 ? 'M' : 'm');
  }
  if (shut > 0) {
    // Light from the top left on the slats, shade at the right.
    c.vline(x, y, shut, 'M');
    c.vline(x + w - 1, y, shut, 'n');
    // Bottom bar and handle.
    c.hline(x, y + shut - 1, w, 'k');
    const hy = y + shut - 4;
    if (hy > y) c.rect(x + Math.floor(w / 2) - 3, hy, 6, 1, 'k');
    // Little windows in the second slat row, when that row is still visible.
    if (open === 0) for (let i = 0; i < 4; i++) {
      const wx = x + 5 + i * Math.floor((w - 10) / 4);
      c.rect(wx, y + 9, 6, 2, 'k');
      c.set(wx + 1, y + 9, 'm');
    }
  }
}

/** The garage, empty: walls, floor, the door (shut), the bulb's light, boxes, an oil stain, a shelf. */
function room() {
  const c = new Canvas(W, H);
  // Ceiling with joists.
  c.rect(0, 0, W, CEIL, 'n');
  for (let x = 6; x < W; x += 28) c.rect(x, 0, 4, CEIL - 2, 'k');
  c.hline(0, CEIL - 2, W, 'k');
  c.hline(0, CEIL - 1, W, 'm');
  // Block wall, running bond.
  c.rect(0, CEIL, W, FLOOR - CEIL, 'w');
  // Light from the bulb on the wall: one hard step; the blocks show only where it is lit.
  pool(c, 132, 58, [{ rx: 62, ry: 44, from: 'w', to: 'W' }]);
  for (let y = CEIL + 6, row = 0; y < FLOOR - 2; y += 7, row++) {
    for (let x = 0; x < W; x++) if (c.get(x, y) === c.get(132, 58)) c.set(x, y, 'w');
    for (let x = row % 2 ? 7 : 0; x < W; x += 14) for (let yy = y - 6; yy < y; yy++) if (c.get(x, yy) === c.get(132, 58)) c.set(x, yy, 'w');
  }
  // Kerb along the bottom of the wall.
  c.rect(0, FLOOR - 3, W, 3, 'm');
  c.hline(0, FLOOR - 3, W, 'M');
  c.hline(0, FLOOR - 1, W, 'n');
  // Concrete floor with slab joints receding to the back wall.
  c.rect(0, FLOOR, W, H - FLOOR, 'f');
  for (const y of [FLOOR + 9, FLOOR + 22, FLOOR + 40]) c.hline(0, y, W, 'n');
  for (let i = -4; i <= 4; i++) line(c, 108 + i * 30, FLOOR, 108 + i * 52, H - 1, 'n');
  pool(c, 132, 128, [{ rx: 76, ry: 20, from: 'f', to: 'F' }]);
  // Oil stain.
  ellipse(c, 128, 145, 20, 6, 'n');
  ellipse(c, 133, 146, 9, 3, 'k');
  c.set(131, 146, 'm');
  // Roll-up door on the left of the back wall.
  rollUpDoor(c, 25, 66, 42, FLOOR - 66 - 3, 0);
  // Moving boxes stacked against the wall between the door and the model.
  box(c, 70, 90, 14, 3, 14);
  box(c, 71, 76, 12, 3, 11);
  c.stamp(mug, 74, 71);
  // A shelf on the right wall for whatever the lab buys later.
  c.rect(144, 42, 48, 2, 'o');
  c.hline(144, 42, 48, 'A');
  c.hline(144, 44, 48, 'k');
  for (const x of [146, 188]) c.vline(x, 45, 2, 'k');
  // Shadow where the floor meets the wall.
  c.hline(0, FLOOR, W, 'n');
  // An old tyre stack and a broom at the right: scrap, until the racks move in.
  for (let i = 0; i < 3; i++) {
    const ty = FLOOR - 6 - i * 5;
    c.rect(176, ty, 16, 6, 'k');
    c.rect(177, ty + 1, 14, 4, 'n');
    c.hline(178, ty + 1, 12, 'm');
    c.rect(181, ty + 2, 6, 2, 'k');
  }
  line(c, 166, 70, 171, FLOOR - 4, 'u');
  line(c, 167, 70, 172, FLOOR - 4, 'o');
  c.rect(169, FLOOR - 5, 7, 3, 'M');
  for (let x = 169; x < 176; x += 2) c.set(x, FLOOR - 2, 'M');
  // A poster of a rocket over the boxes: the plan.
  c.rect(92, 64, 14, 18, 'k');
  c.rect(93, 65, 12, 16, 'h');
  c.stamp(shelfItems.orbital, 95, 68);
  c.hline(94, 78, 10, 'M');
  c.set(93, 65, 'M');
  return c;
}

module.exports = {
  W,
  H,
  CEIL,
  FLOOR,
  sprites: { laptopBack, gpuCard, phone, bulb, steam, mug, pizzaBox, extinguisher, deskFan, ...Object.fromEntries(Object.entries(shelfItems).map(([k, v]) => [`shelf-${k}`, v])) },
  shelfItems,
  internDesk,
  gpuRig,
  serverRack,
  pegboard,
  rollUpDoor,
  box,
  room,
};
