/**
 * The Data Centre: cold teal and ice on near-black, green status lights. A raised floor of
 * perforated tiles, cable trays overhead, a cold aisle receding behind the model (the
 * compute hall: its racks light up as it grows), a cooling unit with slow fans, a glass
 * control booth where the interns now sit, rack cabinets on the right wall and GPU pods on
 * the floor. The later tiers are things in the room: a framed wafer in the booth, a power
 * riser, a robot arm on a gantry over the racks, a satellite dish on a stand, and stars
 * where the end of the aisle used to be.
 *
 * Composition: the top band (trays, ducts) sits under the HUD and the offer slot; the
 * booth, the cooling unit and the aisle start below y 72, the right wall's things below 52.
 */
const { Canvas, sprite } = require('../canvas');
const { block, line, ellipse, paint, outline } = require('./draw');
const P = require('./people');
const Props = require('./props');
const G = require('./garage');

const W = G.W;
const H = G.H;
const CEIL = G.CEIL;
const FLOOR = G.FLOOR;

// ---------------------------------------------------------------- geometry

/** The cold aisle's opening and its far end. */
const AISLE = { x0: 90, x1: 131, top: 54, fx0: 104, fx1: 117, ftop: 70, fbot: 90 };
/** The cooling unit on the wall left of the aisle. */
const CRAC = { x: 70, y: 66, w: 20, h: 44 };
/** The glass booth on the left of the floor. */
const BOOTH = { x: 17, y: 74, w: 54, roof: 7, bottom: 162 };

const lerp = (a, b, t) => a + (b - a) * t;

/** The side racks of the aisle at column x: top and bottom edges (perspective). */
function aisleSide(x) {
  const left = x < (AISLE.fx0 + AISLE.fx1) / 2;
  const t = left ? (x - AISLE.x0) / (AISLE.fx0 - AISLE.x0) : (AISLE.x1 - 1 - x) / (AISLE.x1 - 1 - AISLE.fx1);
  return { t, top: Math.round(lerp(AISLE.top + 2, AISLE.ftop, t)), bottom: Math.round(lerp(FLOOR - 1, AISLE.fbot, t)) };
}

/** Rack columns along each side of the aisle (x of each rack's divider), near to far. */
const AISLE_RACKS = [
  [92, 96, 99, 101, 103],
  [129, 125, 122, 120, 118],
];

// ---------------------------------------------------------------- sprites

/** A cooling fan behind its grille, three frames turning slowly (14 x 14). */
function fan(frame) {
  return paint(14, 14, (c) => {
    ellipse(c, 0, 0, 14, 14, 'k');
    ellipse(c, 1, 1, 12, 12, 'n');
    const a0 = (frame * Math.PI) / 6;
    for (let b = 0; b < 3; b++) {
      const a = a0 + (b * 2 * Math.PI) / 3;
      for (let r = 2; r < 6; r++) {
        c.set(7 + Math.cos(a) * r - 0.5, 7 + Math.sin(a) * r - 0.5, 'M');
        c.set(7 + Math.cos(a + 0.35) * r - 0.5, 7 + Math.sin(a + 0.35) * r - 0.5, 'm');
      }
    }
    c.rect(6, 6, 2, 2, 'S');
    // The grille's bars in front.
    for (const y of [3, 7, 10]) for (let x = 2; x < 12; x++) if (c.get(x, y)) c.set(x, y, 'k');
  });
}

/** Two fans stacked, the cooling unit's loop (14 x 31). */
function fans(frame) {
  return paint(14, 31, (c) => {
    c.draw(fan(frame), 0, 0);
    c.draw(fan((frame + 1) % 3), 0, 17);
  });
}

/** The booth's warning light on its roof, two frames (4 x 3). */
const beacon = sprite('beacon', [
  ['.kk.', 'kGGk', 'kkkk'],
  ['.kk.', 'knnk', 'kkkk'],
]);

/** A server rack with ice LEDs, frames chase them (16 x 40). */
function rack(frame, units = 8) {
  return paint(16, 40, (c) => {
    block(c, 0, 0, 16, 2, 36, { top: 'M', front: 'k', hi: 'm', shade: 'n' });
    for (let u = 0; u < units; u++) {
      const y = 5 + u * 4;
      c.rect(2, y, 12, 3, 'n');
      c.hline(2, y, 12, 'm');
      const lit = (u * 2 + frame) % 4;
      c.set(3, y + 1, lit === 0 ? 'G' : 'b');
      c.set(5, y + 1, lit === 1 ? 'A' : 'b');
      c.set(7, y + 1, lit === 2 ? 'a' : 'n');
      c.hline(9, y + 1, 4, 'k');
    }
    c.rect(1, 38, 2, 2, 'k');
    c.rect(13, 38, 2, 2, 'k');
  });
}

/** A GPU pod on the raised floor: a squat cabinet with two lit fans and a coolant pipe; frames turn the fans (24 x 23). */
function pod(frame) {
  return paint(24, 23, (c) => {
    c.rect(1, 21, 23, 2, 'k');
    block(c, 0, 0, 24, 3, 15, { top: 'M', front: 'm', hi: 'S', shade: 'n', edge: 'k' });
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
    c.hline(2, 16, 20, 'k');
    c.set(4, 17, 'G');
    c.set(6, 17, frame ? 'G' : 'n');
    // Coolant pipe off the top right.
    c.rect(19, 0, 3, 2, 'k');
    c.set(20, 0, 'a');
  });
}

/** An intern at a console: a dark desk with a lit monitor seen from behind; frames = typing (24 x 25). */
function internConsole(frame, look = {}) {
  return paint(24, 25, (c) => {
    c.rect(1, 23, 22, 2, 'k');
    c.rect(3, 6, 18, 8, 'k');
    c.rect(4, 7, 16, 6, 'n');
    c.stamp(P.internUpper, 6, 0, { map: look });
    block(c, 0, 13, 24, 3, 5, { top: 'M', front: 'm', hi: 'S', shade: 'k' });
    c.hline(1, 18, 22, 'k');
    // Monitor from behind, its glow over the top edge.
    c.rect(6, 6, 12, 1, 'A');
    c.rect(5, 7, 14, 6, 'k');
    c.rect(6, 8, 12, 4, 'm');
    c.hline(6, 8, 12, 'M');
    c.rect(11, 13, 2, 1, 'k');
    c.stamp(P.hands, 4, 14, { frame, map: look.p ? { p: look.p } : null });
  });
}

// ---------------------------------------------------------------- the room

function room() {
  const c = new Canvas(W, H);
  // Ceiling: cable ladders and light strips.
  c.rect(0, 0, W, CEIL, 'n');
  for (const y of [6, 14]) {
    c.rect(0, y, W, 4, 'k');
    c.hline(0, y + 1, W, 'm');
    for (let x = 2; x < W; x += 6) c.vline(x, y, 4, 'm');
  }
  for (let x = 14; x < W; x += 44) {
    c.rect(x, 20, 26, 3, 'k');
    c.hline(x + 1, 21, 24, 'S');
  }
  c.hline(0, CEIL - 2, W, 'k');
  c.hline(0, CEIL - 1, W, 'm');
  // Wall panels.
  c.rect(0, CEIL, W, FLOOR - CEIL, 'w');
  c.rect(0, 48, W, FLOOR - 48, 'W');
  for (let x = 6; x < W; x += 22) c.vline(x, 48, FLOOR - 51, 'w');
  c.hline(0, 48, W, 'm');
  // The big cable tray along the wall, with bundles in the accent, the status green and ice.
  c.rect(0, 34, W, 7, 'k');
  c.hline(0, 35, W, 'M');
  c.hline(0, 40, W, 'm');
  for (let x = 0; x < W; x++) {
    c.set(x, 37, x % 11 < 6 ? 'b' : 'a');
    c.set(x, 38, x % 7 < 3 ? 'G' : 'b');
    c.set(x, 39, 'n');
  }
  for (let x = 10; x < W; x += 30) c.rect(x, 41, 2, 6, 'k');
  // Skirting.
  c.rect(0, FLOOR - 3, W, 3, 'm');
  c.hline(0, FLOOR - 3, W, 'M');
  c.hline(0, FLOOR - 1, W, 'k');
  // Raised floor: tile rows receding, perforated tiles in the cold rows.
  c.rect(0, FLOOR, W, H - FLOOR, 'f');
  const rows = [FLOOR, FLOOR + 7, FLOOR + 16, FLOOR + 28, FLOOR + 44, H];
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r];
    const y1 = rows[r + 1];
    for (let i = -6; i <= 6; i++) {
      const xa = Math.round(108 + i * (14 + r * 4));
      const xb = Math.round(108 + (i + 1) * (14 + r * 4));
      if ((i + r) % 2 === 0) c.rect(xa, y0, xb - xa, y1 - y0, 'F');
      if (r % 2 === 1 && (i + 6) % 3 === 0) for (let y = y0 + 2; y < y1 - 1; y += 2) for (let x = xa + 2; x < xb - 1; x += 2) c.set(x, y, 'n');
    }
    c.hline(0, y0, W, 'k');
  }
  for (let i = -8; i <= 8; i++) line(c, 108 + i * 14, FLOOR, 108 + i * 50, H - 1, 'k');
  c.hline(0, FLOOR, W, 'k');

  // The cold aisle behind the model: racks on both sides receding to the far end.
  const A = AISLE;
  c.rect(A.x0 - 2, A.top - 3, A.x1 - A.x0 + 4, FLOOR - A.top + 3, 'k');
  c.hline(A.x0 - 1, A.top - 2, A.x1 - A.x0 + 2, 'M');
  for (let x = A.x0; x < A.x1; x++) {
    const inFar = x >= A.fx0 && x < A.fx1;
    if (inFar) {
      // Ceiling, far wall and floor of the aisle.
      for (let y = A.top; y < A.ftop; y++) c.set(x, y, 'k');
      for (let y = A.ftop; y < A.fbot; y++) c.set(x, y, 'n');
      for (let y = A.fbot; y < FLOOR; y++) c.set(x, y, 'F');
    } else {
      const s = aisleSide(x);
      for (let y = A.top; y < s.top; y++) c.set(x, y, 'k');
      for (let y = s.top; y < s.bottom; y++) c.set(x, y, 'm');
      for (let y = s.bottom; y < FLOOR; y++) c.set(x, y, 'F');
      // Unit lines on the rack fronts.
      for (let y = s.top + 2; y < s.bottom - 1; y += 3) c.set(x, y, 'n');
    }
  }
  // Rack dividers and the cold-aisle stripe down the middle of the floor.
  for (const side of AISLE_RACKS) for (const x of side) {
    const s = aisleSide(x);
    c.vline(x, s.top, s.bottom - s.top, 'k');
  }
  line(c, (A.x0 + A.x1) / 2 - 1, FLOOR - 1, (A.fx0 + A.fx1) / 2 - 1, A.fbot, 'b');
  line(c, (A.x0 + A.x1) / 2, FLOOR - 1, (A.fx0 + A.fx1) / 2, A.fbot, 'b');
  // Light strips in the aisle ceiling, converging.
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const y = Math.round(lerp(A.top + 2, A.ftop - 2, t * t * 0.9 + t * 0.1));
    const half = Math.round(lerp(10, 3, t));
    c.hline(110 - half, y, half * 2 + 1, 'S');
  }
  // The far end: a door with a lit window.
  c.rect(A.fx0 + 3, A.fbot - 13, 7, 13, 'k');
  c.rect(A.fx0 + 4, A.fbot - 12, 5, 12, 'm');
  c.rect(A.fx0 + 5, A.fbot - 11, 3, 3, 'S');

  // The cooling unit, its fans are an ambient loop.
  const U = CRAC;
  block(c, U.x, U.y, U.w, 3, U.h - 5, { top: 'S', front: 'M', hi: 'h', shade: 'm' });
  for (const fy of [U.y + 6, U.y + 23]) {
    c.rect(U.x + 2, fy - 1, 16, 16, 'k');
    c.rect(U.x + 3, fy, 14, 14, 'n');
  }
  for (let y = U.y + 39; y < U.y + U.h - 1; y += 2) c.hline(U.x + 2, y, U.w - 4, 'm');
  c.rect(U.x + 13, U.y + 4, 4, 1, 'a');

  // The glass booth: roof, back wall with its window frames, posts.
  const B = BOOTH;
  c.rect(B.x, B.y + B.roof, B.w, FLOOR + 2 - B.y - B.roof, 'k');
  // Inside: a dark back wall with a console rail and a lit strip, a door at the left.
  c.rect(B.x + 2, B.y + B.roof + 1, B.w - 4, FLOOR + 1 - B.y - B.roof - 1, 'n');
  c.rect(B.x + 2, B.y + B.roof + 1, B.w - 4, 1, 'k');
  c.rect(B.x + 2, 100, B.w - 4, 3, 'm');
  c.hline(B.x + 2, 100, B.w - 4, 'M');
  for (let x = B.x + 6; x < B.x + B.w - 4; x += 12) c.vline(x, B.y + B.roof + 2, 15, 'w');
  // Booth floor: a lighter mat inside the glass.
  c.rect(B.x + 2, FLOOR + 2, B.w - 4, B.bottom - FLOOR - 4, 'F');
  for (let y = FLOOR + 6; y < B.bottom - 2; y += 8) c.hline(B.x + 2, y, B.w - 4, 'f');
  block(c, B.x - 1, B.y, B.w + 2, 3, 2, { top: 'S', front: 'm', hi: 'h', shade: 'k' });
  for (const x of [B.x, B.x + B.w - 2]) {
    c.rect(x, B.y + B.roof, 2, B.bottom - B.y - B.roof, 'k');
    c.vline(x, B.y + B.roof, B.bottom - B.y - B.roof, 'M');
  }
  c.rect(B.x, B.bottom - 2, B.w, 2, 'k');
  c.hline(B.x + 1, B.bottom - 2, B.w - 2, 'M');
  // Glass: glints across the front panes, so the empty booth reads as glass.
  line(c, B.x + 6, B.bottom - 6, B.x + 14, B.bottom - 14, 'S');
  line(c, B.x + 9, B.bottom - 6, B.x + 13, B.bottom - 10, 'M');
  line(c, B.x + B.w - 14, B.y + B.roof + 12, B.x + B.w - 6, B.y + B.roof + 4, 'S');
  // A strip of status lights under the booth's roof.
  for (let x = B.x + 4; x < B.x + B.w - 4; x += 4) c.set(x, B.y + B.roof - 1, (x / 4) % 3 ? 'b' : 'G');
  return c;
}

// ---------------------------------------------------------------- later tiers

/** A framed wafer: the first chip run, on the booth's wall (18 x 18). */
function wafer(level) {
  return paint(18, 18, (c) => {
    c.rect(0, 0, 18, 18, 'k');
    c.rect(1, 1, 16, 16, level >= 4 ? 'b' : 'n');
    ellipse(c, 2, 2, 14, 14, 'k');
    ellipse(c, 3, 3, 12, 12, 'M');
    for (let y = 4; y < 14; y += 2) for (let x = 4; x < 14; x += 2) if (c.get(x, y)) c.set(x, y, (x + y) % 4 ? 'S' : 'a');
    c.set(9, 2, 'k');
    c.set(4, 4, 'h');
    c.set(5, 4, 'h');
    c.set(4, 5, 'h');
  });
}

/** The power riser: a conduit from the tray down to a high-voltage panel with a bolt (10 x 70). */
function riser(level) {
  return paint(10, 70, (c) => {
    c.rect(3, 0, 4, 44, 'k');
    c.vline(4, 0, 44, level >= 4 ? 'A' : 'M');
    c.vline(5, 0, 44, level >= 4 ? 'a' : 'm');
    for (let y = 6; y < 44; y += 10) c.rect(2, y, 6, 2, 'k');
    block(c, 0, 42, 10, 2, 24, { top: 'M', front: 'm', hi: 'S', shade: 'k' });
    // The bolt on the panel.
    const bolt = ['..kk', '.kAk', 'kAk.', 'kAAk', '.kAk', '.kk.', 'kk..'];
    bolt.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && c.set(3 + x, 49 + y, ch)));
    c.set(2, 60, 'G');
    c.set(4, 60, level >= 2 ? 'G' : 'n');
    c.set(6, 60, level >= 4 ? 'G' : 'n');
  });
}

/** A gantry over the racks with a robot arm reaching down to a rack top; frames move the arm (54 x 18). */
function gantry(level, frame) {
  return paint(54, 19, (c) => {
    c.rect(0, 0, 54, 3, 'k');
    c.hline(0, 1, 54, 'M');
    for (const x of [0, 52]) c.rect(x, 0, 2, 6, 'k');
    const arms = level >= 4 ? 2 : 1;
    for (let i = 0; i < arms; i++) {
      const x = (i === 0 ? 30 : 8) + (frame ? 4 : 0) * (i ? -1 : 1);
      // Carriage on the rail, then two links and a gripper.
      c.rect(x - 1, 2, 7, 4, 'k');
      c.rect(x, 3, 5, 2, 'a');
      for (const [x0, y0, x1, y1] of [[x + 2, 6, x + 7, 10], [x + 7, 10, x + 3, 14]]) {
        line(c, x0 - 1, y0, x1 - 1, y1, 'k');
        line(c, x0 + 1, y0, x1 + 1, y1, 'k');
        line(c, x0, y0, x1, y1, 'S');
      }
      c.rect(x + 6, 9, 3, 3, 'k');
      c.set(x + 7, 10, 'A');
      c.rect(x, 14, 7, 2, 'k');
      c.hline(x + 1, 14, 5, 'M');
      c.vline(x, 16, 2, 'k');
      c.vline(x + 6, 16, 2, 'k');
    }
  });
}

/** A satellite dish on a stand, pointed up and to the right (14 x 24). */
function dish(level) {
  return paint(14, 24, (c) => {
    ellipse(c, 0, 2, 12, 10, 'k');
    ellipse(c, 1, 3, 10, 8, 'S');
    ellipse(c, 2, 4, 6, 5, 'h');
    line(c, 6, 7, 11, 2, 'k');
    c.rect(10, 0, 3, 3, 'k');
    c.set(11, 1, level >= 4 ? 'A' : 'a');
    c.rect(5, 11, 3, 9, 'k');
    c.vline(6, 11, 9, 'M');
    block(c, 1, 18, 11, 1, 2, { top: 'M', front: 'm', hi: 'S', shade: 'k' });
    c.rect(1, 23, 12, 1, 'k');
  });
}

/** Stars where the end of the aisle was: the hall now opens onto space (13 x 20, the far end). */
function stars(level) {
  return paint(13, 20, (c) => {
    c.rect(0, 0, 13, 20, 'k');
    const pts = [
      [2, 2], [9, 1], [6, 5], [11, 7], [1, 9], [4, 13], [10, 12], [7, 17], [2, 18], [12, 16],
    ];
    pts.forEach(([x, y], i) => c.set(x, y, i % 3 === 0 ? 'h' : i % 3 === 1 ? 'A' : 'S'));
    // A little spiral galaxy, brighter at higher levels.
    const g = level >= 4 ? 'A' : 'a';
    for (const [x, y] of [[6, 9], [7, 9], [5, 10], [6, 10], [7, 10], [8, 10], [6, 11], [7, 11], [4, 9], [9, 11]]) c.set(x, y, g);
    c.set(6, 10, 'h');
  });
}

/** The booth's feed wall: screens light up with the scraper count (28 x 12). */
function feedWall(frame, count) {
  return paint(30, 12, (c) => {
    c.rect(0, 0, 30, 12, 'k');
    for (let i = 0; i < 10; i++) {
      const x = 1 + (i % 5) * 6;
      const y = 1 + Math.floor(i / 5) * 5;
      c.rect(x, y, 5, 4, 'n');
      if (i < count) {
        c.rect(x, y, 5, 4, 'b');
        const f = (frame + i * 3) % 2;
        c.hline(x + 1, y + 1, f ? 3 : 2, 'A');
        c.hline(x + 1, y + 2, f ? 2 : 3, 'a');
      }
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

const DESK = { top: 'M', front: 'm', hi: 'S', shade: 'k' };

/** The data centre's plinth: a server chassis on its side, LEDs along the front. */
function plinthDc() {
  return Props.plinth({ top: 'M', front: 'm', hi: 'S', shade: 'k', edge: 'k' }, (c, b) => {
    for (let x = b.x + 4; x < b.x + b.w - 4; x += 3) c.set(x, b.y + 2, 'm');
    c.hline(b.x + 2, b.front + 4, b.w - 4, 'n');
    for (let x = b.x + 4; x < b.x + 16; x += 3) c.set(x, b.front + 4, x % 2 ? 'G' : 'a');
    c.rect(b.x + b.w - 14, b.front + 3, 10, 3, 'k');
    c.hline(b.x + b.w - 13, b.front + 4, 8, 'b');
  });
}

function scene({ tier, spriteCanvas }) {
  return {
    id: 'datacentre',
    room,
    plinth: plinthDc,
    plinthTop: Props.PLINTH_TOP,
    tiers: {
      // The aisle's racks light up, nearest first, as the hall grows.
      hall: tier({ x: AISLE.x0, y: AISLE.top, w: AISLE.x1 - AISLE.x0, h: FLOOR - AISLE.top }, 2, 1.5, (c, level, frame) => {
        const lit = [0, 1, 2, 3, 4, 5, 5][level];
        AISLE_RACKS.forEach((side) => {
          for (let r = 0; r < lit; r++) {
            const x0 = Math.min(side[r], side[r + 1] ?? (side === AISLE_RACKS[0] ? AISLE.fx0 : AISLE.fx1 - 1));
            const x1 = Math.max(side[r], side[r + 1] ?? (side === AISLE_RACKS[0] ? AISLE.fx0 : AISLE.fx1 - 1));
            for (let x = x0 + 1; x < x1; x++) {
              const s = aisleSide(x);
              for (let y = s.top + 3, j = 0; y < s.bottom - 2; y += 3, j++) if ((x + j + frame) % 3 === 0) c.set(x - AISLE.x0, y - AISLE.top, (j + r) % 4 === 0 ? 'G' : 'A');
            }
          }
        });
        // Level 6: the aisle's floor glows with the cold air.
        if (level >= 6) for (let y = AISLE.fbot + 1; y < FLOOR; y += 3) {
          const t = (FLOOR - y) / (FLOOR - AISLE.fbot);
          const xa = Math.round(lerp(AISLE.x0 + 4, AISLE.fx0 + 1, t));
          const xb = Math.round(lerp(AISLE.x1 - 5, AISLE.fx1 - 2, t));
          for (let x = xa; x <= xb; x += 2) c.set(x - AISLE.x0, y - AISLE.top, 'b');
        }
      }),
      closet: tier({ x: 140, y: 70, w: 52, h: 40 }, 3, 2, (c, level, frame) => {
        const racks = [0, 1, 1, 2, 3, 3, 3][level];
        for (let i = 0; i < racks; i++) c.draw(rack((frame + i) % 3, level === 1 ? 4 : 8), 36 - i * 17, 0);
        if (level >= 5) for (const x of [7, 24, 41]) {
          c.vline(x, 0, 2, 'k');
          c.set(x, 0, 'a');
        }
      }),
      robotics: tier({ x: 139, y: 51, w: 54, h: 19 }, 2, 0.5, (c, level, frame) => c.draw(gantry(level, frame), 0, 0)),
      scraper: tier({ x: 20, y: 83, w: 30, h: 12 }, 2, 1, (c, level, frame) => c.draw(feedWall(frame, [0, 2, 4, 6, 8, 10, 10][level]), 0, 0)),
      chips: tier({ x: 51, y: 82, w: 18, h: 18 }, 1, 0, (c, level) => c.draw(wafer(level), 0, 0)),
      power: tier({ x: 131, y: 40, w: 10, h: 70 }, 1, 0, (c, level) => c.draw(riser(level), 0, 0)),
      orbital: tier({ x: 68, y: 140, w: 14, h: 24 }, 1, 0, (c, level) => c.draw(dish(level), 0, 0)),
      universe: tier({ x: AISLE.fx0, y: AISLE.ftop, w: AISLE.fx1 - AISLE.fx0, h: AISLE.fbot - AISLE.ftop }, 1, 0, (c, level) => c.draw(stars(level), 0, 0)),
      gpu: tier({ x: 141, y: 111, w: 53, h: 51 }, 2, 4, (c, level, frame) => {
        const spots = [
          [27, 2],
          [1, 4],
          [28, 27],
          [0, 28],
        ];
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) c.draw(pod((frame + i) % 2), spots[i][0], spots[i][1]);
        // Levels 5 and 6: coolant lines run between the pods, then glow.
        if (level >= 5) {
          for (const y of [25, 50]) for (let x = 2; x < 52; x++) if (!c.get(x, y)) c.set(x, y, level >= 6 && x % 4 === 0 ? 'A' : 'b');
        }
      }),
      intern: tier({ x: 19, y: 96, w: 50, h: 66 }, 2, 3, (c, level, frame) => {
        const spots = [
          [0, 16],
          [26, 17],
          [0, 40],
          [26, 41],
        ];
        // Level 5: one more at the booth's door with a tablet; level 6: the back-right one has been here all night.
        if (level >= 5) c.stamp(P.internStanding, 0, 0, { map: looks[2] });
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) {
          if (i === 1 && level >= 6) {
            const sleeper = Props.asleepAtDesk(DESK, looks[1], 5).crop(0, 0, 24, 30);
            c.draw(sleeper, spots[i][0], spots[i][1] - 3);
            c.stamp(Props.sleepZ, spots[i][0] + 10, spots[i][1] - 16, { frame });
          } else c.draw(internConsole((frame + i) % 2, looks[i]), spots[i][0], spots[i][1]);
        }
        // The booth's front glass: two glints over everything inside.
        line(c, 4, 64, 12, 56, 'S');
        line(c, 34, 30, 40, 24, 'S');
      }),
    },
    ambient: [
      { id: 'fans', x: CRAC.x + 3, y: CRAC.y + 6, fps: 2, count: 3, frames: (f) => fans(f) },
      { id: 'beacon', x: BOOTH.x + BOOTH.w - 8, y: BOOTH.y - 1, fps: 0.8, count: 2, frames: (f) => spriteCanvas(beacon, f) },
    ],
    shelf: null,
    sheetSprites: () => [
      ...[0, 1].map((f) => internConsole(f, looks[0])),
      ...[0, 1].map((f) => pod(f)),
      ...[0, 1, 2].map((f) => rack(f)),
      ...[0, 1, 2].map((f) => fans(f)),
      feedWall(0, 8),
      wafer(4),
      riser(4),
      gantry(4, 0),
      dish(4),
      stars(4),
      plinthDc(),
      outlineCopy(spriteCanvas(beacon, 0)),
    ],
  };
}

function outlineCopy(c) {
  outline(c);
  return c;
}

module.exports = { scene };
