/**
 * Latent Space: violet and magenta. The lab moved inside its own model: no walls, a grid
 * floor running to a horizon of weights (bars of every height), a lattice of nodes in the
 * void above, a free-standing door that glows. Interns type at floating desks on keyboards
 * made of light; racks are floating monoliths; GPUs are floating cubes. The hall is a line
 * of doors receding to the horizon; power is a halo of light behind the model; the scraper
 * is a column of floating phones; chips hang in the sky like a moon with a satellite
 * circling; a robot arm made of light reaches up at the right; and the universe sits in a
 * glass globe on a stand.
 *
 * Composition: the lattice and the void's top sit under the HUD and the offer slot; the
 * door, the receding doors and the halo start below y 72 on the left, the moon below 50.
 */
const { Canvas } = require('../canvas');
const { block, line, ellipse, paint, outline } = require('./draw');
const P = require('./people');
const Props = require('./props');
const G = require('./garage');

const W = G.W;
const H = G.H;
const CEIL = G.CEIL;
const FLOOR = G.FLOOR;

/** The horizon (where the grid floor meets the void) and the vanishing point. */
const HORIZON = 100;
const VP = { x: 108, y: HORIZON };
/** The door standing on the grid. */
const DOOR = { x: 22, y: 74, w: 16, h: 33 };

// ---------------------------------------------------------------- the room

function room() {
  const c = new Canvas(W, H);
  // The void: dark bands to a lit haze at the horizon.
  const bands = [
    [0, 'k'],
    [20, 'n'],
    [56, 'w'],
    [80, 'W'],
    [92, 'm'],
  ];
  bands.forEach(([y, role], i) => c.rect(0, y, W, (bands[i + 1]?.[0] ?? HORIZON) - y, role));
  for (const [y, role] of bands.slice(1)) for (let x = 1; x < W; x += 2) c.set(x, y - 1, role);
  // Specks of light.
  for (let i = 0; i < 70; i++) {
    const x = (i * 53) % W;
    const y = (i * 37) % 88;
    c.set(x, y, i % 5 === 0 ? 'A' : 'M');
  }
  // The lattice: layers of nodes joined by edges, up in the void.
  const layers = [
    [12, [30, 46, 62]],
    [52, [24, 38, 52, 66]],
    [92, [30, 46, 62]],
    [132, [24, 38, 52, 66]],
    [172, [30, 46, 62]],
    [208, [38, 54]],
  ];
  for (let l = 0; l < layers.length - 1; l++) {
    const [x0, ys0] = layers[l];
    const [x1, ys1] = layers[l + 1];
    for (const y0 of ys0) for (const y1 of ys1) if ((y0 + y1 + l) % 3 !== 0) line(c, x0, y0, x1, y1, 'm');
  }
  for (const [x, ys] of layers) for (const y of ys) {
    c.rect(x - 1, y - 1, 3, 3, 'b');
    c.set(x, y, 'A');
  }
  // The horizon of weights: bars of every height, lit tops, standing on the horizon.
  for (let x = 0; x < W; x += 3) {
    const v = Math.abs(Math.sin(x * 0.37) * 0.6 + Math.sin(x * 0.11 + 1) * 0.4);
    const h = 2 + Math.round(v * 16);
    c.rect(x, HORIZON - h, 2, h, (x / 3) % 4 === 0 ? 'b' : 'n');
    c.set(x, HORIZON - h, (x / 3) % 5 === 0 ? 's' : 'a');
    c.set(x + 1, HORIZON - h, 'A');
  }
  c.hline(0, HORIZON, W, 'A');
  // The grid floor: lines across, closer together towards the horizon, and lines to the vanishing point.
  c.rect(0, HORIZON + 1, W, H - HORIZON - 1, 'f');
  for (let i = 1; i < 12; i++) {
    const y = Math.round(HORIZON + 1.2 * i * i * 0.5 + i * 1.6);
    if (y >= H) break;
    c.hline(0, y, W, i < 4 ? 'b' : 'm');
  }
  for (let i = -14; i <= 14; i++) line(c, VP.x + i * 4, HORIZON + 1, VP.x + i * 30, H - 1 + 40, 'b');
  // A haze over the far floor.
  for (let y = HORIZON + 1; y < HORIZON + 4; y++) for (let x = (y % 2); x < W; x += 2) c.set(x, y, 'm');
  // The door, standing on the grid: frame, a glow inside (an ambient loop), a shadow.
  const D = DOOR;
  ellipse(c, D.x - 4, D.y + D.h - 2, D.w + 8, 6, 'n');
  c.rect(D.x - 2, D.y - 2, D.w + 4, D.h + 2, 'k');
  c.rect(D.x - 1, D.y - 1, D.w + 2, D.h + 1, 'M');
  c.hline(D.x - 1, D.y - 1, D.w + 2, 'h');
  c.rect(D.x, D.y, D.w, D.h, 'A');
  // Light spilling out onto the grid.
  for (let j = 0; j < 8; j++) c.hline(D.x - j, D.y + D.h + j + 1, D.w + j * 2, j % 2 ? 'b' : 'a');
  return c;
}

/** The door's glow: light breathing inside the frame, three frames (18 x 33). */
function doorGlow(f) {
  return paint(DOOR.w, DOOR.h, (c) => {
    c.rect(0, 0, DOOR.w, DOOR.h, 'A');
    const inset = [1, 3, 2][f];
    c.rect(inset, inset, DOOR.w - inset * 2, DOOR.h - inset * 2, 'h');
    c.rect(inset + 2, inset + 3, DOOR.w - inset * 2 - 4, DOOR.h - inset * 2 - 6, 'h');
    c.set(DOOR.w - 4, DOOR.h / 2, 'a');
  });
}

/** A node in the lattice lighting up, two frames (3 x 3). */
function nodePulse(f) {
  return paint(3, 3, (c) => {
    c.rect(0, 0, 3, 3, f ? 's' : 'b');
    c.set(1, 1, f ? 'h' : 'A');
  });
}

// ---------------------------------------------------------------- objects

/** An intern at a floating desk: a slab with a lit edge, a screen of light, a keyboard of light, a shadow below (24 x 30). */
function floatingDesk(frame, look = {}) {
  return paint(24, 30, (c) => {
    // Shadow on the grid, well below: the desk floats.
    ellipse(c, 3, 26, 18, 4, 'n');
    c.stamp(P.internUpper, 6, 0, { map: look });
    // The screen: a frame of light hanging in front of the chest, see-through.
    c.box(4, 8, 16, 5, 'a');
    c.hline(5, 9, 14, 'A');
    c.hline(6, 11, 5, 'S');
    // The slab.
    block(c, 0, 13, 24, 2, 2, { top: 'M', front: 'b', hi: 'h', shade: 'k' });
    c.hline(1, 18, 22, 'a');
    // The keyboard of light, flickering with the typing.
    for (let x = 6; x < 18; x += 2) c.set(x, 14, (x + frame * 2) % 4 === 0 ? 'h' : 'G');
    c.stamp(P.hands, 4, 13, { frame, map: look.p ? { p: look.p } : null });
  });
}

/** A floating monolith: a dark slab with a magenta seam that pulses, its shadow below (12 x 38). */
function monolith(frame) {
  return paint(12, 38, (c) => {
    ellipse(c, 1, 34, 10, 4, 'n');
    c.rect(1, 0, 10, 31, 'k');
    c.rect(2, 1, 8, 29, 'n');
    c.vline(2, 1, 29, 'm');
    c.hline(2, 1, 8, 'M');
    for (let y = 3; y < 29; y++) c.set(6, y, (y + frame * 5) % 15 < 5 ? 'S' : 's');
    for (let y = 5; y < 29; y += 6) c.set(4, y, 'a');
  });
}

/** A floating cube, edges of light, slowly turning (two frames) with a shadow (20 x 24). */
function cube(frame) {
  return paint(20, 24, (c) => {
    ellipse(c, 2, 20, 16, 4, 'n');
    if (frame === 0) {
      block(c, 2, 0, 16, 4, 11, { top: 'h', front: 'M', hi: 'h', shade: 'm', edge: 'a' });
      c.box(2, 0, 16, 17, 'b');
    } else {
      // Turned: a diamond top, two faces.
      for (let j = 0; j < 5; j++) c.hline(10 - j * 2, j, j * 4 + 1, 'h');
      for (let j = 0; j < 4; j++) c.hline(10 - (3 - j) * 2, 5 + j, (3 - j) * 4 + 1, 'h');
      c.rect(2, 5, 8, 11, 'M');
      c.rect(10, 5, 8, 11, 'm');
      outline(c, 'b');
      ellipse(c, 2, 20, 16, 4, 'n');
    }
    c.set(9, 10, 'A');
    c.set(10, 10, 'h');
  });
}

/** The hall: doors receding to the horizon, more of them lit as it grows (42 x 30). */
function doors(level, frame) {
  return paint(42, 30, (c) => {
    const n = [0, 1, 2, 3, 4, 5, 5][level];
    for (let i = n - 1; i >= 0; i--) {
      const t = i / 5;
      const h = Math.round(26 - t * 18);
      const w = Math.round(h * 0.55);
      const x = Math.round(2 + i * 8 - t * 2);
      const bottom = 29 - Math.round(t * 3);
      c.rect(x - 1, bottom - h - 1, w + 2, h + 2, 'k');
      c.rect(x, bottom - h, w, h, 'M');
      const lit = (i + frame) % 3 === 0 || level >= 6;
      c.rect(x + 1, bottom - h + 1, w - 2, h - 1, lit ? 'h' : 'A');
      c.set(x + w - 3, bottom - Math.floor(h / 2), 'a');
    }
  });
}

/** Power: a halo of light around the model's place, two frames of sparkle (40 x 30, the upper arc). */
function halo(level, frame) {
  return paint(40, 30, (c) => {
    const thick = level >= 4 ? 3 : 2;
    for (let j = 0; j < 30; j++) for (let i = 0; i < 40; i++) {
      const dx = (i + 0.5 - 20) / 20;
      const dy = (j + 0.5 - 20) / 20;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r <= 1 && r > 1 - thick / 20) c.set(i, j, r > 1 - 1 / 20 ? 'A' : r > 1 - 2 / 20 ? 'h' : 'a');
    }
    // Sparks around it.
    const sparks = frame ? [[3, 10], [36, 6], [20, 0], [10, 3]] : [[1, 16], [38, 14], [28, 2], [14, 1]];
    for (const [x, y] of sparks) {
      c.set(x, y, 'h');
      c.set(x - 1, y, 'S');
      c.set(x + 1, y, 'S');
    }
  });
}

/** The scraper: a column of phones floating, lit with the count (12 x 36). */
function phoneColumn(frame, count) {
  return paint(12, 36, (c) => {
    for (let i = 0; i < count; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col * 6 + (row % 2);
      const y = row * 7 + col * 3;
      c.rect(x, y, 5, 6, 'k');
      const f = (frame + i * 3) % 2;
      c.rect(x + 1, y + 1, 3, 4, f ? 'S' : 'a');
      c.hline(x + 1, y + 1 + (f ? 1 : 2), 3, 'h');
    }
  });
}

/** Chips as a moon: a huge chip hanging in the void (26 x 16). */
function chipMoon(level) {
  return paint(26, 16, (c) => {
    for (let x = 3; x < 23; x += 3) {
      c.vline(x, 0, 2, 'M');
      c.vline(x, 14, 2, 'M');
    }
    c.rect(2, 2, 22, 12, 'k');
    c.rect(3, 3, 20, 10, 'M');
    c.hline(3, 3, 20, 'h');
    c.vline(3, 3, 10, 'h');
    c.rect(8, 5, 10, 6, 'k');
    c.rect(9, 6, 8, 4, level >= 4 ? 's' : 'b');
    c.rect(11, 7, 4, 2, level >= 4 ? 'S' : 'a');
  });
}

/** A satellite circling: a body with two solar wings (22 x 10). */
function satellite(level) {
  return paint(22, 10, (c) => {
    for (const x of [0, 14]) {
      c.rect(x, 2, 8, 6, 'k');
      c.rect(x + 1, 3, 6, 4, 'b');
      for (let i = x + 2; i < x + 7; i += 2) c.vline(i, 3, 4, 'a');
    }
    c.hline(7, 5, 8, 'k');
    c.rect(9, 1, 4, 8, 'k');
    c.rect(10, 2, 2, 6, 'h');
    c.set(11, 0, 'k');
    if (level >= 4) c.set(11, 0, 'S');
  });
}

/** A robot arm made of light, reaching up from the floor (14 x 46). */
function lightArm(level, frame) {
  return paint(14, 46, (c) => {
    ellipse(c, 0, 42, 14, 4, 'n');
    c.rect(3, 38, 8, 5, 'b');
    c.hline(3, 38, 8, 'A');
    const seg = (x0, y0, x1, y1) => {
      line(c, x0 - 1, y0, x1 - 1, y1, 'b');
      line(c, x0, y0, x1, y1, 'A');
      line(c, x0 + 1, y0, x1 + 1, y1, 'a');
    };
    const elbow = frame ? [4, 20] : [5, 21];
    seg(7, 38, elbow[0], elbow[1]);
    seg(elbow[0], elbow[1], 10, 6);
    c.rect(elbow[0] - 1, elbow[1] - 1, 3, 3, 'h');
    c.rect(9, 5, 3, 3, 'h');
    // The gripper, holding a glowing token.
    line(c, 10, 5, 7, 1, 'A');
    line(c, 11, 5, 13, 1, 'A');
    c.rect(9, 0, 3, 3, level >= 4 ? 'S' : 'G');
  });
}

/** The universe in a glass globe on a stand (18 x 30). */
function globe(level, frame) {
  return paint(18, 30, (c) => {
    ellipse(c, 0, 0, 18, 18, 'M');
    ellipse(c, 1, 1, 16, 16, 'k');
    // The galaxy inside: a spiral of light.
    const arms = level >= 4 ? 2 : 1;
    for (let a = 0; a < arms; a++) {
      for (let t = 0; t < 18; t++) {
        const ang = t * 0.42 + a * Math.PI + frame * 0.5;
        const r = t * 0.38;
        c.set(9 + Math.cos(ang) * r - 0.5, 9 + Math.sin(ang) * r * 0.7 - 0.5, t < 6 ? 'h' : t < 12 ? 'S' : 's');
      }
    }
    c.rect(8, 8, 2, 2, 'h');
    for (const [x, y] of [[4, 5], [13, 12], [12, 4], [5, 13]]) c.set(x, y, 'A');
    // Glass glint.
    c.set(4, 3, 'h');
    c.set(3, 4, 'h');
    // The stand.
    c.rect(6, 17, 6, 2, 'k');
    block(c, 3, 19, 12, 2, 5, { top: 'M', front: 'b', hi: 'A', shade: 'k' });
    c.rect(2, 28, 14, 2, 'n');
  });
}

// ---------------------------------------------------------------- scene

const looks = [
  { s: 'a', S: 'A', b: 'b', n: 'u' },
  { s: 'S', S: 'h', b: 's', n: 'k' },
  { s: 'm', S: 'M', b: 'n', n: 'o' },
  { s: 's', S: 'S', b: 'b', n: 'k' },
];

const DESK = { top: 'M', front: 'b', hi: 'h', shade: 'k' };

/** The latent plinth: a slab of light floating over its own shadow. */
function plinthLatent() {
  return Props.plinth(
    { top: 'A', front: 'b', hi: 'h', shade: 'k', edge: 'a' },
    (c, b) => {
      for (let x = b.x + 3; x < b.x + b.w - 3; x += 4) c.set(x, b.y + 2, 'h');
      c.hline(b.x + 1, b.front + 2, b.w - 2, 'a');
      for (let x = b.x + 2; x < b.x + b.w - 2; x += 3) c.set(x, b.front + 4, 's');
    },
    { depth: 5, height: 6, shadow: 'n' },
  );
}

function scene({ tier, spriteCanvas }) {
  return {
    id: 'latent',
    room,
    plinth: plinthLatent,
    plinthTop: Props.PLINTH_TOP,
    tiers: {
      hall: tier({ x: 46, y: 75, w: 42, h: 30 }, 2, 0.8, (c, level, frame) => c.draw(doors(level, frame), 0, 0)),
      power: tier({ x: 89, y: 72, w: 40, h: 30 }, 2, 1, (c, level, frame) => c.draw(halo(level, frame), 0, 0)),
      scraper: tier({ x: 129, y: 66, w: 12, h: 36 }, 2, 1, (c, level, frame) => c.draw(phoneColumn(frame, [0, 2, 4, 6, 8, 10, 10][level]), 0, 0)),
      closet: tier({ x: 141, y: 64, w: 52, h: 38 }, 3, 1.5, (c, level, frame) => {
        const n = [0, 1, 2, 3, 4, 4, 4][level];
        for (let i = 0; i < n; i++) c.draw(monolith((frame + i) % 3), 39 - i * 13, (i % 2) * -2 + 2);
        if (level >= 6) for (let i = 0; i < 4; i++) c.set(45 - i * 13, 0, 'S');
      }),
      orbital: tier({ x: 142, y: 51, w: 22, h: 10 }, 1, 0, (c, level) => c.draw(satellite(level), 0, 0)),
      chips: tier({ x: 166, y: 47, w: 26, h: 16 }, 1, 0, (c, level) => c.draw(chipMoon(level), 0, 0)),
      gpu: tier({ x: 141, y: 112, w: 40, h: 52 }, 2, 1.5, (c, level, frame) => {
        const spots = [
          [20, 0],
          [0, 4],
          [20, 26],
          [0, 28],
        ];
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) c.draw(cube((frame + i) % 2), spots[i][0], spots[i][1]);
        if (level >= 5) for (const [x, y] of [[18, 2], [38, 22], [18, 50], [1, 26]]) c.set(x, y, level >= 6 ? 'h' : 'A');
      }),
      robotics: tier({ x: 181, y: 116, w: 14, h: 46 }, 2, 0.6, (c, level, frame) => c.draw(lightArm(level, frame), 0, 0)),
      universe: tier({ x: 64, y: 134, w: 18, h: 30 }, 2, 0.5, (c, level, frame) => c.draw(globe(level, frame), 0, 0)),
      intern: tier({ x: 18, y: 88, w: 48, h: 80 }, 2, 3, (c, level, frame) => {
        const spots = [
          [0, 22],
          [22, 20],
          [0, 48],
          [22, 46],
        ];
        // Level 5: one more steps out of the door; level 6: the back-right one has been here all night (inside its own model).
        if (level >= 5) c.stamp(P.internStanding, 21, 2, { map: looks[2] });
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) {
          if (i === 1 && level >= 6) {
            c.draw(Props.asleepAtDesk(DESK, looks[1], 2).crop(0, 0, 24, 30), spots[i][0], spots[i][1] - 3);
            c.stamp(Props.sleepZ, spots[i][0] + 12, spots[i][1] - 3, { frame });
          } else c.draw(floatingDesk((frame + i) % 2, looks[i]), spots[i][0], spots[i][1]);
        }
      }),
    },
    ambient: [
      { id: 'door', x: DOOR.x, y: DOOR.y, fps: 1, count: 3, frames: (f) => doorGlow(f) },
      { id: 'node', x: 131, y: 51, fps: 0.7, count: 2, frames: (f) => nodePulse(f) },
    ],
    shelf: null,
    sheetSprites: () => [
      ...[0, 1].map((f) => floatingDesk(f, looks[0])),
      ...[0, 1].map((f) => cube(f)),
      ...[0, 1, 2].map((f) => monolith(f)),
      doors(6, 0),
      halo(6, 0),
      phoneColumn(0, 10),
      chipMoon(6),
      satellite(6),
      lightArm(6, 0),
      globe(6, 0),
      plinthLatent(),
      doorGlow(1),
    ],
  };
}

module.exports = { scene };
