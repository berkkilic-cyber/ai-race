/**
 * The Garage: sodium amber and rust on concrete, scrappy. A roll-up door, a bare bulb, a
 * concrete floor with an oil stain and moving boxes; interns at folding tables, rented GPU
 * rigs on the floor, a server rack, a pegboard of phones (the scraper farm) and, once a
 * compute hall is bought, the roll-up door opens onto it.
 */
const { Canvas, sprite } = require('../canvas');
const { block, line, ellipse, pool, paint } = require('./draw');
const P = require('./people');
const Props = require('./props');

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
    'knMMMnk',
    'kMkmkMk',
    'kMmkmMk',
    'kMkmkMk',
    'knMMMnk',
    'knnnnnk',
    'knMMMnk',
    'kMkmkMk',
    'kMmkmMk',
    'kMkmkMk',
    'knMMMnk',
    'kkkkkkk',
  ],
  [
    'kkkkkkk',
    'kbaaabk',
    'knMMMnk',
    'kMmkmMk',
    'kMkkkMk',
    'kMmkmMk',
    'knMMMnk',
    'knnnnnk',
    'knMMMnk',
    'kMmkmMk',
    'kMkkkMk',
    'kMmkmMk',
    'knMMMnk',
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

/** A fire extinguisher on the floor, big enough to read (9 x 19): for when the rigs get warm. */
const bigExtinguisher = sprite('extinguisher-big', [
  '..kkkk...',
  '.kkmMkkk.',
  '...kk..k.',
  '..kkkk..k',
  '.kShssk.k',
  'kSShsssk.',
  'kSShsssbk',
  'kSShsssbk',
  'kShhhhhbk',
  'kSkkkkkbk',
  'kSkhhhkbk',
  'kSkkkkkbk',
  'kSShsssbk',
  'kSShsssbk',
  'kSShsssbk',
  'kSSsssbbk',
  'kkkkkkkkk',
  '.kmmmmmk.',
  '..kkkkk..',
]);

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
  return paint(24, 22, (c) => {
    c.rect(1, 20, 23, 2, 'n');
    // Frame: two posts, a top rail.
    c.rect(0, 0, 24, 3, 'k');
    c.hline(1, 1, 22, 'M');
    for (const x of [0, 23]) c.rect(x, 0, 1, 20, 'k');
    for (const x of [1, 22]) c.rect(x, 3, 1, 14, 'm');
    // Cards hang from the rail, fans to the viewer.
    for (let i = 0; i < 3; i++) c.stamp(gpuCard, 2 + i * 7, 2, { frame: (frame + i) % 2 });
    // Shelf with the riser board, and a cable off the top.
    block(c, 0, 16, 24, 1, 1, { top: 'M', front: 'n' });
    c.rect(3, 17, 6, 1, 'b');
    c.set(22, 0, 's');
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
  return paint(30, 21, (c) => {
    c.rect(0, 0, 30, 21, 'k');
    c.rect(1, 1, 28, 19, 'u');
    c.hline(1, 1, 28, 'o');
    c.vline(1, 1, 19, 'o');
    for (let y = 4; y < 20; y += 3) for (let x = 4; x < 28; x += 3) c.set(x, y, 'n');
    for (let i = 0; i < count; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 3 + col * 5;
      const y = 2 + row * 9;
      c.stamp(phone, x, y, { frame: (frame + i * 7) % 2 });
      // Charging cables hang to the bottom edge.
      for (let yy = y + 7; yy < 20; yy++) if (!c.get(x + 1, yy) || c.get(x + 1, yy) !== 1) c.set(x + 1 + (yy % 2), yy, 'k');
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

/**
 * The garage, empty. Composition: the top band (ceiling joists, a pipe, the bulb's cord)
 * sits under the HUD plate and the offer slot, so everything that matters is lower: the
 * roll-up door and the boxes on the left wall below y 72, the pegboard on the wall behind
 * the model, the trophy shelf and the racks on the right wall below y 54.
 */
function room() {
  const c = new Canvas(W, H);
  // Ceiling with joists.
  c.rect(0, 0, W, CEIL, 'n');
  for (let x = 6; x < W; x += 28) c.rect(x, 0, 4, CEIL - 2, 'k');
  c.hline(0, CEIL - 2, W, 'k');
  c.hline(0, CEIL - 1, W, 'm');
  // Block wall, running bond: the joints show everywhere, brighter where the bulb lights it.
  c.rect(0, CEIL, W, FLOOR - CEIL, 'w');
  pool(c, 135, 74, [{ rx: 70, ry: 46, from: 'w', to: 'W' }]);
  for (let y = CEIL + 6, row = 0; y < FLOOR - 2; y += 7, row++) {
    for (let x = 0; x < W; x++) c.set(x, y, c.get(x, y) === c.get(135, 74) ? 'w' : 'n');
    for (let x = row % 2 ? 7 : 0; x < W; x += 14) for (let yy = y - 6; yy < y; yy++) c.set(x, yy, c.get(x, yy) === c.get(135, 74) ? 'w' : 'n');
  }
  // A water pipe along the top of the wall, with brackets.
  c.rect(0, 32, W, 3, 'k');
  c.hline(0, 33, W, 'M');
  for (let x = 12; x < W; x += 34) c.rect(x, 31, 2, 5, 'k');
  // Kerb along the bottom of the wall.
  c.rect(0, FLOOR - 3, W, 3, 'm');
  c.hline(0, FLOOR - 3, W, 'M');
  c.hline(0, FLOOR - 1, W, 'n');
  // Concrete floor with slab joints receding to the back wall.
  c.rect(0, FLOOR, W, H - FLOOR, 'f');
  for (const y of [FLOOR + 9, FLOOR + 22, FLOOR + 40]) c.hline(0, y, W, 'n');
  for (let i = -4; i <= 4; i++) line(c, 108 + i * 30, FLOOR, 108 + i * 52, H - 1, 'n');
  pool(c, 120, 132, [
    { rx: 84, ry: 24, from: 'f', to: 'F' },
  ]);
  // Oil stain, off to the right of the model.
  ellipse(c, 150, 162, 18, 5, 'n');
  ellipse(c, 155, 163, 8, 3, 'k');
  // Roll-up door on the left of the back wall, low enough to clear the HUD.
  rollUpDoor(c, 24, 75, 42, FLOOR - 75 - 3, 0);
  // Moving boxes stacked between the door and the model, a mug on top.
  box(c, 68, 92, 15, 3, 12);
  box(c, 70, 80, 11, 3, 8);
  c.stamp(mug, 73, 75);
  // The bulb's cord from the ceiling (the swinging bulb is an ambient loop).
  c.vline(135, CEIL, 12, 'k');
  // A shelf on the right wall for whatever the lab buys later.
  c.rect(141, 66, 52, 2, 'o');
  c.hline(141, 66, 52, 'h');
  c.hline(141, 68, 52, 'k');
  for (const x of [144, 189]) {
    c.vline(x, 69, 3, 'k');
    c.set(x + 1, 69, 'k');
  }
  // Shadow where the floor meets the wall.
  c.hline(0, FLOOR, W, 'n');
  // An old tyre stack and a broom at the right: scrap, until the racks move in.
  for (let i = 0; i < 3; i++) {
    const ty = FLOOR - 7 - i * 6;
    c.rect(174, ty, 18, 7, 'k');
    c.rect(175, ty + 1, 16, 5, 'n');
    c.hline(176, ty + 1, 14, 'm');
    c.rect(180, ty + 2, 8, 3, 'k');
  }
  line(c, 160, 74, 166, FLOOR - 4, 'u');
  line(c, 161, 74, 167, FLOOR - 4, 'o');
  c.rect(163, FLOOR - 5, 8, 3, 'M');
  for (let x = 163; x < 171; x += 2) c.set(x, FLOOR - 2, 'M');
  return c;
}

const looks = [
  {},
  { s: 'a', S: 'A', b: 'b', n: 'u' },
  { s: 'm', S: 'M', b: 'n', n: 'k' },
  { s: 'b', S: 'a', b: 's', n: 'o' },
];

/** The garage's plinth: two wooden pallets, stencilled. */
function garagePlinth() {
  return Props.plinth({ top: 'o', front: 'u', hi: 'h', shade: 'k', edge: 'A' }, (c, b) => {
    // Plank seams on the top, slats and blocks on the front.
    for (let x = b.x + 7; x < b.x + b.w - 2; x += 8) c.vline(x, b.y, b.depth, 'u');
    c.hline(b.x, b.front + 3, b.w, 'k');
    for (const x of [b.x + 3, b.x + b.w / 2 - 3, b.x + b.w - 9]) {
      c.rect(x, b.front + 4, 6, b.height - 4, 'o');
      c.hline(x, b.front + 4, 6, 'h');
    }
  });
}

/** The garage scene for scripts/pixel/scenes.js. */
function scene({ tier, spriteCanvas }) {
  return {
    id: 'garage',
    room,
    plinth: garagePlinth,
    plinthTop: Props.PLINTH_TOP,
    tiers: {
      hall: tier({ x: 18, y: 69, w: 54, h: 42 }, 2, 1.5, (c, level, frame) => {
        const open = [0, 0.3, 0.5, 0.7, 0.85, 1, 1][level];
        rollUpDoor(c, 6, 6, 42, FLOOR - 75 - 3, open, frame);
      }),
      closet: tier({ x: 140, y: 70, w: 52, h: 40 }, 3, 2, (c, level, frame) => {
        const racks = [0, 1, 1, 2, 3, 3, 3][level];
        const units = level === 1 ? 3 : 7;
        for (let i = 0; i < racks; i++) c.draw(serverRack((frame + i) % 3, units), 36 - i * 17, 0);
        // Level 5 and up: cables looped over the tops.
        if (level >= 5) {
          for (let x = 4; x < 51; x++) c.set(x, 1 + (x % 9 < 5 ? 0 : 1), 'k');
          for (const x of [9, 26, 43]) for (let y = 2; y < 12; y++) c.set(x + (y % 3 === 0 ? 1 : 0), y, 'k');
        }
      }),
      scraper: tier({ x: 92, y: 72, w: 32, h: 21 }, 2, 1, (c, level, frame) => {
        c.draw(pegboard(frame, [0, 2, 4, 6, 8, 10, 10][level]), 1, 0);
      }),
      gpu: tier({ x: 142, y: 110, w: 52, h: 50 }, 2, 4, (c, level, frame) => {
        const spots = [
          [26, 2],
          [1, 4],
          [27, 27],
          [0, 28],
        ];
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) c.draw(gpuRig((frame + i) % 2), spots[i][0], spots[i][1]);
      }),
      // Level 5 of the GPU rigs also stands a fire extinguisher by the wall.
      gpuExtra: tier({ x: 131, y: 92, w: 9, h: 19, of: 'gpu' }, 1, 0, (c, level) => {
        if (level >= 5) c.stamp(bigExtinguisher, 0, 0);
      }),
      intern: tier({ x: 20, y: 86, w: 62, h: 84 }, 2, 3, (c, level, frame) => {
        const spots = [
          [2, 26],
          [30, 27],
          [2, 54],
          [30, 55],
        ];
        // Level 5: one more coming in at the door with a mug; level 6: the front-right one has been here all night.
        if (level >= 5) c.stamp(P.internStanding, 20, 4, { map: looks[2] });
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) {
          if (i === 1 && level >= 6) {
            c.draw(Props.asleepAtDesk({ top: 'm', front: 'n', hi: 'M' }, looks[1]), spots[i][0], spots[i][1] - 3);
            c.stamp(Props.sleepZ, spots[i][0] + 13, spots[i][1] - 18, { frame });
          } else c.draw(internDesk((frame + i) % 2, looks[i]), spots[i][0], spots[i][1]);
        }
      }),
    },
    ambient: [
      { id: 'bulb', x: 131, y: 37, fps: 1.2, frames: (f) => spriteCanvas(bulb, f) },
      { id: 'steam', x: 73, y: 68, fps: 2.5, frames: (f) => spriteCanvas(steam, f), count: 3 },
    ],
    shelf: { x: 143, y: 55, step: 10, h: 11 },
    shelfItems: Props.trophies,
    sheetSprites: () => [
      ...[0, 1].map((f) => internDesk(f)),
      ...[0, 1].map((f) => gpuRig(f)),
      ...[0, 1, 2].map((f) => serverRack(f)),
      pegboard(0, 8),
      Props.asleepAtDesk({ top: 'm', front: 'n', hi: 'M' }, looks[1]),
      garagePlinth(),
      ...[bulb, steam, mug, bigExtinguisher, Props.sleepZ, ...Object.values(Props.trophies)].flatMap((s) => s.frames.map((_, f) => spriteCanvas(s, f))),
    ],
  };
}

module.exports = {
  scene,
  W,
  H,
  CEIL,
  FLOOR,
  sprites: { laptopBack, gpuCard, phone, bulb, steam, mug, bigExtinguisher },
  internDesk,
  gpuRig,
  serverRack,
  pegboard,
  rollUpDoor,
  box,
  room,
};
