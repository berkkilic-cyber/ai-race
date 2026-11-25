/**
 * The Company Town: sunset orange and pink. The lab is a campus now: the back of the lobby
 * is one big window onto the town at dusk (a water tower, the lab's billboard with the
 * model's face, the skyline), a revolving door, a reception counter, glass server pillars
 * and GPU pods on a polished floor. The hall grows the campus outside the window; the
 * later tiers are things you can see: a reactor's cooling tower glowing on the horizon, a
 * rocket on its pad, a ringed planet rising, a robot arm pouring coffee at the counter and
 * a wafer on a pedestal in the lobby. No words anywhere: the billboard shows a face.
 *
 * Composition: the sky's top sits under the HUD and the offer slot; the door, the water
 * tower, the reactor and the campus stand below y 72 on the left, the billboard below 52.
 */
const { Canvas, sprite } = require('../canvas');
const { block, line, ellipse, paint } = require('./draw');
const P = require('./people');
const Props = require('./props');
const G = require('./garage');

const W = G.W;
const H = G.H;
const CEIL = G.CEIL;
const FLOOR = G.FLOOR;

/** The window: sky from WIN.top, the town's ground at WIN.ground, the sill at WIN.bottom. */
const WIN = { top: 30, ground: 92, bottom: 104 };
/** The reception counter. */
const COUNTER = { x: 18, y: 104, w: 46, d: 3, h: 15 };
/** The billboard on its posts. */
const BOARD = { x: 144, y: 52, w: 46, h: 17 };

// ---------------------------------------------------------------- sprites

/** The model's face for the billboard, two frames (open eyes, blink) (16 x 9). */
const boardFace = sprite('board-face', [
  ['................', '..aa........aa..', '..aa........aa..', '..aa........aa..', '................', '................', '.....aaaaaa.....', '......aaaa......', '................'],
  ['................', '................', '................', '..aa........aa..', '................', '................', '.....aaaaaa.....', '......aaaa......', '................'],
]);

/** The water tower's light, two frames (3 x 2). */
const towerLight = sprite('tower-light', [
  ['kak', '.k.'],
  ['knk', '.k.'],
]);

/** A glass server pillar: a tall slab with a lit core; frames move the light (12 x 40). */
function pillar(frame, lit = 1) {
  return paint(12, 40, (c) => {
    block(c, 0, 0, 12, 2, 36, { top: 'h', front: 'M', hi: 'h', shade: 'm' });
    c.rect(3, 5, 6, 30, 'k');
    for (let y = 6; y < 34; y++) {
      const on = lit && (y + frame * 4) % 12 < 6;
      c.set(4, y, on ? 'A' : 'b');
      c.set(5, y, on ? 'a' : 'n');
      c.set(6, y, (y + frame * 2) % 5 === 0 ? 'S' : 'n');
      c.set(7, y, on ? 's' : 'n');
    }
    c.rect(1, 38, 3, 2, 'k');
    c.rect(8, 38, 3, 2, 'k');
  });
}

/** A GPU pod: a white cabinet with two lit fans; frames turn them (24 x 23). */
function pod(frame) {
  return paint(24, 23, (c) => {
    c.rect(1, 21, 23, 2, 'n');
    block(c, 0, 0, 24, 3, 15, { top: 'h', front: 'S', hi: 'h', shade: 'M', edge: 'k' });
    for (let i = 0; i < 2; i++) {
      const x = 3 + i * 10;
      ellipse(c, x, 6, 8, 8, 'k');
      ellipse(c, x + 1, 7, 6, 6, 'b');
      const on = (frame + i) % 2;
      c.set(x + 3, 8, on ? 'A' : 'a');
      c.set(x + 4, 9, on ? 'a' : 'A');
      c.set(x + 3, 10, on ? 'A' : 'a');
      c.set(x + 2, 9, on ? 'a' : 'A');
    }
    c.hline(2, 16, 20, 'M');
    c.set(4, 17, 'G');
    c.set(6, 17, frame ? 'G' : 'm');
  });
}

/** An intern at a hot desk with a laptop; frames = typing (24 x 25). */
function internDesk(frame, look = {}) {
  return paint(24, 25, (c) => {
    c.rect(1, 23, 22, 2, 'n');
    c.stamp(P.internUpper, 6, 0, { map: look });
    block(c, 0, 12, 24, 3, 5, { top: 'h', front: 'M', hi: 'h', shade: 'm' });
    c.vline(3, 20, 3, 'k');
    c.vline(20, 20, 3, 'k');
    // Laptop from behind with a sticker, its glow over the top.
    c.rect(8, 6, 8, 1, 'A');
    c.rect(7, 7, 10, 6, 'k');
    c.rect(8, 8, 8, 4, 'M');
    c.set(12, 9, 's');
    c.stamp(P.hands, 4, 13, { frame, map: look.p ? { p: look.p } : null });
  });
}

// ---------------------------------------------------------------- the room

function room() {
  const c = new Canvas(W, H);
  // Ceiling with pendant lamps.
  c.rect(0, 0, W, CEIL, 'n');
  for (let x = 20; x < W; x += 44) {
    c.vline(x + 5, 0, 14, 'k');
    c.rect(x, 14, 11, 4, 'k');
    c.rect(x + 1, 15, 9, 2, 'A');
    c.hline(x + 2, 18, 7, 'a');
  }
  c.hline(0, CEIL - 2, W, 'k');
  c.hline(0, CEIL - 1, W, 'm');
  // The wall frame around the window.
  c.rect(0, CEIL, W, FLOOR - CEIL, 'W');
  // Sky at sunset: hard bands from mauve to pink to peach to orange at the horizon.
  const bands = [
    [WIN.top, 'm'],
    [44, 's'],
    [58, 'S'],
    [70, 'A'],
    [82, 'a'],
  ];
  bands.forEach(([y, role], i) => c.rect(0, y, W, (bands[i + 1]?.[0] ?? WIN.ground) - y, role));
  // Dithered seams between bands, one pixel, every other column (a hard step, not a gradient).
  for (const [y, role] of bands.slice(1)) for (let x = 0; x < W; x += 2) c.set(x, y - 1, role);
  // The sun on the horizon, behind the campus.
  ellipse(c, 98, 70, 24, 24, 'A');
  ellipse(c, 100, 72, 20, 20, 'h');
  for (const y of [80, 84, 88]) c.hline(98, y, 24, 'A');
  // Wisps of cloud.
  for (const [x, y, w] of [[34, 50, 22], [150, 46, 28], [120, 62, 16], [12, 64, 14], [176, 74, 20]]) {
    c.hline(x, y, w, 'h');
    c.hline(x + 3, y + 1, w - 6, 'S');
  }
  // The far skyline.
  const far = [[0, 8], [10, 12], [20, 7], [44, 10], [58, 14], [130, 9], [142, 16], [158, 11], [170, 15], [184, 9], [196, 13], [206, 10]];
  for (const [x, h] of far) c.rect(x, WIN.ground - h, 10, h, 'b');
  // The near town: blocks with lit windows.
  const near = [[0, 14, 12], [14, 10, 9], [34, 18, 10], [126, 12, 12], [146, 20, 12], [160, 14, 10], [178, 22, 9], [190, 12, 14], [204, 18, 12]];
  for (const [x, h, w] of near) {
    c.rect(x, WIN.ground - h, w, h, 'n');
    c.vline(x, WIN.ground - h, h, 'm');
    for (let y = WIN.ground - h + 2; y < WIN.ground - 1; y += 3) for (let xx = x + 2; xx < x + w - 1; xx += 2) if ((xx * 5 + y * 3) % 7 < 3) c.set(xx, y, 'A');
  }
  // The water tower.
  const tx = 46;
  for (const lx of [tx + 2, tx + 11]) line(c, lx, 84, lx + (lx < tx + 7 ? -2 : 2), WIN.ground, 'k');
  line(c, tx + 2, 86, tx + 11, 90, 'k');
  line(c, tx + 11, 86, tx + 2, 90, 'k');
  c.rect(tx, 74, 14, 11, 'k');
  c.rect(tx + 1, 75, 12, 9, 'm');
  c.vline(tx + 1, 75, 9, 'M');
  c.hline(tx + 1, 78, 12, 's');
  // Cone roof and a catwalk.
  for (let j = 0; j < 4; j++) c.hline(tx + 1 + j * 2 - 1, 73 - j, 14 - j * 4 + 2, 'k');
  for (let j = 0; j < 3; j++) c.hline(tx + 2 + j * 2, 73 - j, 10 - j * 4, j ? 'M' : 'h');
  c.hline(tx - 1, 84, 16, 'k');
  // The street: a dark band with a kerb.
  c.rect(0, WIN.ground, W, WIN.bottom - WIN.ground, 'n');
  c.hline(0, WIN.ground, W, 'm');
  for (let x = 2; x < W; x += 10) c.hline(x, 98, 5, 'M');
  // Window mullions and the transom.
  for (let x = 4; x < W; x += 36) {
    c.rect(x, WIN.top, 3, WIN.bottom - WIN.top, 'k');
    c.vline(x + 1, WIN.top, WIN.bottom - WIN.top, 'M');
  }
  c.rect(0, WIN.top - 3, W, 3, 'k');
  c.hline(0, WIN.top - 2, W, 'M');
  // Sill and skirting.
  c.rect(0, WIN.bottom, W, FLOOR - WIN.bottom, 'w');
  c.hline(0, WIN.bottom, W, 'M');
  c.hline(0, FLOOR - 1, W, 'k');
  // The billboard on its posts: the model's face (its eyes blink: an ambient loop) and stripes.
  const B = BOARD;
  c.rect(B.x + 8, B.y + B.h, 2, WIN.ground - B.y - B.h, 'k');
  c.rect(B.x + B.w - 10, B.y + B.h, 2, WIN.ground - B.y - B.h, 'k');
  c.rect(B.x, B.y, B.w, B.h, 'k');
  c.rect(B.x + 1, B.y + 1, B.w - 2, B.h - 2, 'h');
  c.rect(B.x + 2, B.y + 2, 20, B.h - 4, 'n');
  for (let i = 0; i < 3; i++) c.rect(B.x + 25, B.y + 4 + i * 4, 16 - i * 4, 2, i === 0 ? 'a' : 's');
  c.hline(B.x + 1, B.y + B.h - 2, B.w - 2, 'S');
  // The revolving door at the left: a glass drum with a lit inside.
  const dx = 24;
  c.rect(dx - 1, 70, 22, FLOOR - 70 - 1, 'k');
  c.rect(dx, 71, 20, 4, 'M');
  c.hline(dx, 71, 20, 'h');
  c.rect(dx + 1, 75, 18, FLOOR - 78, 'b');
  c.rect(dx + 2, 76, 16, FLOOR - 80, 'A');
  c.rect(dx + 9, 75, 2, FLOOR - 78, 'k');
  line(c, dx + 2, 96, dx + 9, 86, 'k');
  line(c, dx + 18, 96, dx + 11, 86, 'k');
  c.rect(dx + 3, 80, 2, 8, 'h');
  // Lobby floor: polished tiles in rows receding, the window's glow reflected.
  c.rect(0, FLOOR, W, H - FLOOR, 'f');
  const rows = [FLOOR, FLOOR + 7, FLOOR + 16, FLOOR + 28, FLOOR + 44, H];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let i = -7; i <= 7; i++) {
      const xa = Math.round(108 + i * (13 + r * 4));
      const xb = Math.round(108 + (i + 1) * (13 + r * 4));
      if ((i + r) % 2 === 0) c.rect(xa, rows[r], xb - xa, rows[r + 1] - rows[r], 'F');
    }
  }
  // The sunset's reflection: a band of light across the floor.
  for (const [y, x0, x1] of [[FLOOR + 3, 86, 134], [FLOOR + 8, 80, 140], [FLOOR + 14, 74, 146]]) c.hline(x0, y, x1 - x0, 'm');
  c.hline(0, FLOOR, W, 'k');
  // The reception counter: a curved desk in wood with a pink front.
  const K = COUNTER;
  block(c, K.x, K.y, K.w, K.d, K.h, { top: 'o', front: 's', hi: 'A', shade: 'b', edge: 'u' });
  c.hline(K.x + 1, K.y + K.d + 4, K.w - 2, 'S');
  c.hline(K.x + 1, K.y + K.d + K.h - 1, K.w - 2, 'b');
  // A bell and a small plant on the counter.
  c.rect(K.x + 4, K.y - 2, 4, 2, 'k');
  c.set(K.x + 5, K.y - 2, 'A');
  c.set(K.x + 6, K.y - 3, 'k');
  return c;
}

// ---------------------------------------------------------------- the campus and the later tiers

/** The campus outside, growing with the hall: blocks, then a tower with the model's face lit on top (46 x 30). */
function campus(level, frame) {
  return paint(48, 32, (c) => {
    const ground = 31;
    const blocks = [
      [2, 10, 14, 1],
      [30, 12, 15, 2],
      [16, 16, 12, 3],
      [0, 20, 8, 4],
      [40, 22, 7, 4],
      [18, 30, 10, 5],
    ];
    for (const [x, h, w, from] of blocks) {
      if (level < from) continue;
      c.rect(x, ground - h, w, h + 1, 'k');
      c.rect(x + 1, ground - h + 1, w - 2, h, 'w');
      c.vline(x + 1, ground - h + 1, h, 'm');
      for (let y = ground - h + 3; y < ground - 1; y += 3) for (let xx = x + 3; xx < x + w - 2; xx += 2) c.set(xx, y, (xx + y + frame) % 4 === 0 ? 'h' : 'A');
    }
    if (level >= 6) {
      // The tower's crown: the model's face, lit.
      c.rect(19, 0, 8, 4, 'k');
      c.set(21, 1, 'a');
      c.set(24, 1, 'a');
      c.hline(21, 2, 4, frame ? 'a' : 'A');
    }
  });
}

/** A reactor's cooling tower on the horizon with its glow and steam (20 x 24). */
function reactor(level, frame) {
  return paint(20, 24, (c) => {
    // Glow behind it.
    if (level >= 3) ellipse(c, 0, 8, 20, 16, 'A');
    // The hyperboloid tower.
    for (let y = 8; y < 24; y++) {
      const t = (y - 8) / 15;
      const half = Math.round(6 - 2.6 * Math.sin(t * Math.PI * 0.9));
      c.hline(10 - half - 1, y, half * 2 + 2, 'k');
      c.hline(10 - half, y, half * 2, 'M');
      c.set(10 - half, y, 'h');
      c.set(10 + half - 1, y, 'm');
    }
    c.hline(4, 8, 12, 'k');
    // Steam rising, two frames.
    const puffs = frame ? [[6, 4, 6], [9, 0, 5]] : [[7, 3, 6], [6, 0, 5]];
    for (const [x, y, w] of puffs) {
      c.hline(x, y + 1, w, 'h');
      c.hline(x + 1, y, w - 2, 'h');
      c.hline(x + 1, y + 2, w - 2, 'S');
    }
  });
}

/** A rocket on its pad, flame and smoke at the top level (11 x 32). */
function rocket(level, frame) {
  return paint(11, 32, (c) => {
    // The gantry tower beside it.
    c.vline(9, 6, 22, 'k');
    for (let y = 8; y < 28; y += 4) c.set(8, y, 'k');
    // The rocket.
    c.rect(3, 4, 5, 20, 'k');
    c.rect(4, 5, 3, 18, 'h');
    c.vline(6, 5, 18, 'M');
    c.set(5, 3, 'k');
    c.set(5, 2, 'k');
    c.hline(4, 8, 3, 'a');
    c.rect(1, 18, 2, 6, 'k');
    c.rect(8, 18, 1, 6, 'k');
    c.set(2, 19, 'a');
    // Pad.
    c.rect(0, 24, 11, 3, 'k');
    c.hline(1, 25, 9, 'M');
    if (level >= 5) {
      c.rect(4, 27, 3, 2 + frame, 'A');
      c.set(5, 27, 'h');
      c.hline(0, 30, 11, 'S');
      c.hline(1, 31, 9, 'h');
    }
  });
}

/** A ringed planet rising (20 x 12). */
function planet(level) {
  return paint(20, 12, (c) => {
    ellipse(c, 5, 0, 11, 11, 'k');
    ellipse(c, 6, 1, 9, 9, level >= 4 ? 'S' : 'M');
    ellipse(c, 6, 1, 5, 5, 'h');
    for (let x = 0; x < 20; x++) {
      const y = Math.round(7 - (x - 10) * 0.25);
      if (x < 6 || x > 14 || y > 5) {
        c.set(x, y, 'k');
        c.set(x, y - 1, 'A');
      }
    }
  });
}

/** A robot at the counter: a boxy head with lit eyes and an antenna, arms on the desk; frames blink (16 x 20). */
function robot(level, frame) {
  return paint(16, 20, (c) => {
    // Antenna.
    c.vline(8, 0, 3, 'k');
    c.rect(7, 0, 3, 2, 'k');
    c.set(8, 0, frame ? 'a' : 'A');
    // Head.
    c.rect(2, 3, 13, 9, 'k');
    c.rect(3, 4, 11, 7, 'M');
    c.hline(3, 4, 11, 'h');
    c.vline(13, 5, 6, 'm');
    c.rect(4, 6, 9, 3, 'k');
    c.rect(5, 7, 2, 1, frame ? 'k' : 'a');
    c.rect(10, 7, 2, 1, frame ? 'k' : 'a');
    if (!frame) {
      c.set(5, 6, 'A');
      c.set(10, 6, 'A');
    }
    // Neck and shoulders, behind the counter.
    c.rect(7, 12, 3, 1, 'k');
    c.rect(1, 13, 15, 7, 'k');
    c.rect(2, 14, 13, 6, 'm');
    c.hline(2, 14, 13, 'M');
    c.rect(7, 15, 3, 2, level >= 4 ? 'a' : 'b');
  });
}

/** A wafer on a pedestal in the lobby (14 x 26). */
function waferStand(level) {
  return paint(14, 26, (c) => {
    ellipse(c, 0, 0, 14, 14, 'k');
    ellipse(c, 1, 1, 12, 12, 'M');
    for (let y = 3; y < 12; y += 2) for (let x = 3; x < 12; x += 2) if (c.get(x, y) && c.get(x + 1, y + 1)) c.set(x, y, (x + y) % 4 ? 'S' : 'a');
    c.set(3, 3, 'h');
    c.set(4, 3, 'h');
    c.set(3, 4, 'h');
    c.rect(5, 13, 4, 2, 'k');
    block(c, 2, 15, 10, 2, 6, { top: 'h', front: 'S', hi: 'h', shade: 'M' });
    if (level >= 4) c.hline(3, 20, 8, 'a');
    c.rect(1, 25, 12, 1, 'n');
  });
}

/** Phones on display in the counter's front, lighting up with the scraper count (40 x 8). */
function phoneRow(frame, count) {
  return paint(42, 8, (c) => {
    for (let i = 0; i < count; i++) {
      const x = 1 + i * 4;
      c.rect(x, 1, 4, 7, 'k');
      const f = (frame + i * 3) % 2;
      c.rect(x + 1, 2, 2, 4, f ? 'A' : 'S');
      c.set(x + 1, f ? 3 : 4, 'h');
    }
  });
}

// ---------------------------------------------------------------- scene

const looks = [
  { s: 'a', S: 'A', b: 'b', n: 'u' },
  { s: 'S', S: 'h', b: 's', n: 'k' },
  { s: 'm', S: 'M', b: 'n', n: 'o' },
  { s: 'b', S: 'a', b: 'n', n: 'k' },
];

const DESK = { top: 'h', front: 'M', hi: 'h', shade: 'm' };

/** The town's plinth: polished marble with a brass plaque: the model is enshrined now. */
function plinthTown() {
  return Props.plinth({ top: 'h', front: 'M', hi: 'h', shade: 'm', edge: 'S' }, (c, b) => {
    c.rect(b.x + b.w / 2 - 7, b.front + 2, 14, 4, 'k');
    c.rect(b.x + b.w / 2 - 6, b.front + 3, 12, 2, 'a');
    c.hline(b.x + b.w / 2 - 6, b.front + 3, 12, 'A');
    line(c, b.x + 4, b.front + 1, b.x + 9, b.front + 6, 'S');
  });
}

function scene({ tier, spriteCanvas }) {
  return {
    id: 'town',
    room,
    plinth: plinthTown,
    plinthTop: Props.PLINTH_TOP,
    tiers: {
      hall: tier({ x: 82, y: WIN.ground - 31, w: 48, h: 32 }, 2, 0.7, (c, level, frame) => c.draw(campus(level, frame), 0, 0)),
      power: tier({ x: 62, y: WIN.ground - 23, w: 20, h: 24 }, 2, 0.6, (c, level, frame) => c.draw(reactor(level, frame), 0, 0)),
      orbital: tier({ x: 129, y: WIN.ground - 26, w: 11, h: 32 }, 2, 3, (c, level, frame) => c.draw(rocket(level, frame), 0, 0)),
      universe: tier({ x: 120, y: 50, w: 20, h: 12 }, 1, 0, (c, level) => c.draw(planet(level), 0, 0)),
      closet: tier({ x: 140, y: 70, w: 52, h: 40 }, 3, 2, (c, level, frame) => {
        const n = [0, 1, 2, 3, 4, 4, 4][level];
        for (let i = 0; i < n; i++) c.draw(pillar((frame + i) % 3, 1), 39 - i * 13, 0);
        if (level >= 6) for (let x = 0; x < 52; x += 3) c.set(x, 39, 'a');
      }),
      gpu: tier({ x: 141, y: 111, w: 53, h: 51 }, 2, 4, (c, level, frame) => {
        const spots = [
          [27, 2],
          [1, 4],
          [28, 27],
          [0, 28],
        ];
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) c.draw(pod((frame + i) % 2), spots[i][0], spots[i][1]);
        if (level >= 5) for (const y of [25, 50]) for (let x = 2; x < 52; x += 2) if (!c.get(x, y)) c.set(x, y, level >= 6 ? 'a' : 'b');
      }),
      robotics: tier({ x: 46, y: 84, w: 16, h: 20 }, 2, 0.4, (c, level, frame) => c.draw(robot(level, frame), 0, 0)),
      scraper: tier({ x: 20, y: 111, w: 42, h: 8 }, 2, 1, (c, level, frame) => c.draw(phoneRow(frame, [0, 2, 4, 6, 8, 10, 10][level]), 0, 0)),
      chips: tier({ x: 68, y: 139, w: 14, h: 26 }, 1, 0, (c, level) => c.draw(waferStand(level), 0, 0)),
      intern: tier({ x: 18, y: 88, w: 62, h: 77 }, 2, 3, (c, level, frame) => {
        // Behind the counter: a receptionist (1), a second one (5); hot desks in front (2, 3); a visitor waiting
        // in the lobby (4); and at 6 the second hot desk has been here all night.
        const behind = (x, look, f) => {
          c.stamp(P.internUpper, x, 2, { map: look });
          c.stamp(P.hands, x - 2, 15, { frame: f, map: null });
        };
        if (level >= 1) behind(12, looks[0], frame);
        if (level >= 5) behind(0, looks[3], (frame + 1) % 2);
        const desks = [
          [2, 44],
          [26, 45],
        ];
        if (level >= 2) c.draw(internDesk(frame, looks[1]), desks[0][0], desks[0][1]);
        if (level >= 3) {
          if (level >= 6) {
            c.draw(Props.asleepAtDesk(DESK, looks[2], 5).crop(0, 0, 24, 30), desks[1][0], desks[1][1] - 3);
            c.stamp(Props.sleepZ, desks[1][0] + 11, desks[1][1] - 15, { frame });
          } else c.draw(internDesk((frame + 1) % 2, looks[2]), desks[1][0], desks[1][1]);
        }
        if (level >= 4) c.stamp(P.internStanding, 52, 24, { map: looks[1] });
      }),
    },
    ambient: [
      { id: 'face', x: BOARD.x + 4, y: BOARD.y + 4, fps: 0.7, count: 2, frames: (f) => spriteCanvas(boardFace, f) },
      { id: 'light', x: 52, y: 67, fps: 0.9, count: 2, frames: (f) => spriteCanvas(towerLight, f) },
    ],
    shelf: null,
    sheetSprites: () => [
      ...[0, 1].map((f) => internDesk(f, looks[0])),
      ...[0, 1].map((f) => pod(f)),
      ...[0, 1, 2].map((f) => pillar(f)),
      campus(6, 0),
      reactor(6, 0),
      rocket(6, 0),
      planet(6),
      robot(6, 0),
      waferStand(6),
      phoneRow(0, 10),
      plinthTown(),
      spriteCanvas(boardFace, 0),
    ],
  };
}

module.exports = { scene };
