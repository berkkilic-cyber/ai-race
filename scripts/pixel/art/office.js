/**
 * The Office: the game's neon green with cool whites; a real startup. Windows onto a night
 * skyline, a whiteboard with a hockey-stick chart, carpet tiles, a plant, a coffee machine
 * and a "days since last incident" board. The same tiers, upgraded: desks with monitors,
 * GPU towers with lit glass, rack cabinets, a phone rack, and the compute hall behind a
 * glass door.
 */
const { Canvas, sprite } = require('../canvas');
const { block, line, paint } = require('./draw');
const P = require('./people');
const G = require('./garage');

const W = G.W;
const H = G.H;
const CEIL = G.CEIL;
const FLOOR = G.FLOOR;

// ---------------------------------------------------------------- sprites (grids)

/** A monitor seen from behind on its stand; the screen's glow leaks over the top (12 x 9). */
const monitorBack = sprite('monitor-back', [
  '.AAAAAAAAAA.',
  'kkkkkkkkkkkk',
  'kMhMMMMMMMmk',
  'kMMMMMMMMMmk',
  'kmmmmmmmmmmk',
  'kkkkkkkkkkkk',
  '....kmmk....',
  '...kkkkkk...',
]);

/** A plant in a pot (12 x 20). */
const plant = sprite('plant', [
  '.....kk.....',
  '....kabk....',
  '..kk.kab.kk.',
  '.kabkkabkabk',
  'kaabbkabkbbk',
  'kabbkabbkbk.',
  '.kbkabbbkbbk',
  'kkkabkbbbbbk',
  'kaabbkbkbbk.',
  'kabbkbbkkbk.',
  '.kkbbkbbkk..',
  '..kkbbbbk...',
  '...kkbbk....',
  '..kkkkkkkk..',
  '..kShSSSsk..',
  '..kSSSSSsk..',
  '...kSSSsk...',
  '...kSSSsk...',
  '...kSSssk...',
  '....kkkk....',
]);

/** A small plant on the counter (6 x 8). */
const smallPlant = sprite('small-plant', ['.kk.k.', 'kabkak', 'kbkabk', '.kbbk.', 'kkkkkk', 'kShSsk', '.kSsk.', '.kkkk.']);

/** The coffee machine on its counter, cup under the spout (16 x 22). */
const coffeeMachine = sprite('coffee-machine', [
  '...kkkkkkkk.....',
  '...kMMMMMmk.....',
  '...knnnnnnk.....',
  '...knAanGnk.....',
  '...knnnnnnk.....',
  '...knkkkknk.....',
  '...knk..knk.....',
  '...knkhhknk.....',
  '...knkShknk.....',
  '...knnnnnnk.....',
  '...kkkkkkkk.....',
  'kkkkkkkkkkkkkkkk',
  'kSSSSSSSSSSSSSsk',
  'kooooooooooooouk',
  'kuuuuuuuuuuuuuuk',
  'kuummmmmmmmmmuuk',
  'kuumkkkkkkkkmuuk',
  'kuumkuuuuuukmuuk',
  'kuumkuuuuuukmuuk',
  'kuumkkkkkkkkmuuk',
  'kuuuuuuuuuuuuuuk',
  'kkkkkkkkkkkkkkkk',
]);

/** A GPU tower with a glass side and lit fans; frames turn the fans (12 x 21). */
const gpuTower = sprite('gpu-tower', [
  [
    'kkkkkkkkkkkk',
    'kMMMMMMMMMmk',
    'knkkkkkkkkmk',
    'knkkaaaknkmk',
    'knkakmkankmk',
    'knkamkmankmk',
    'knkakmkankmk',
    'knkkaaaknkmk',
    'knkkkkkkkkmk',
    'knknAAAAnkmk',
    'knkkkkkkkkmk',
    'knkkaaaknkmk',
    'knkakmkankmk',
    'knkamkmankmk',
    'knkakmkankmk',
    'knkkaaaknkmk',
    'knkkkkkkkkmk',
    'knnnnnnnnnnk',
    'kkkkkkkkkkkk',
    '.kk......kk.',
  ],
  [
    'kkkkkkkkkkkk',
    'kMMMMMMMMMmk',
    'knkkkkkkkkmk',
    'knkkaaaknkmk',
    'knkamkmankmk',
    'knkakkkankmk',
    'knkamkmankmk',
    'knkkaaaknkmk',
    'knkkkkkkkkmk',
    'knknAAAAnkmk',
    'knkkkkkkkkmk',
    'knkkaaaknkmk',
    'knkamkmankmk',
    'knkakkkankmk',
    'knkamkmankmk',
    'knkkaaaknkmk',
    'knkkkkkkkkmk',
    'knnnnnnnnnnk',
    'kkkkkkkkkkkk',
    '.kk......kk.',
  ],
]);

/** A phone standing in the rack, two frames (4 x 6). */
const rackPhone = sprite('rack-phone', [
  ['kkkk', 'khAk', 'kAAk', 'kAhk', 'kmmk', 'kkkk'],
  ['kkkk', 'kAAk', 'kAhk', 'khAk', 'kmmk', 'kkkk'],
]);

/** The ring light on its stand: the founder films updates (10 x 26). */
const ringLight = sprite('ring-light', [
  '..kkkkkk..',
  '.khhhhhhk.',
  'khhkkkkhhk',
  'khk....khk',
  'khk....khk',
  'khk....khk',
  'khk....khk',
  'khhkkkkhhk',
  '.khhhhhhk.',
  '..kkkkkk..',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '....km....',
  '...kkmk...',
  '..kk.kk...',
  '.kk...kk..',
  'kk.....kk.',
  'k.......k.',
]);

// ---------------------------------------------------------------- composed objects

/** An intern at a desk with a monitor, in an office chair; frames = typing (24 x 26). */
function internDesk(frame, look = {}) {
  return paint(24, 27, (c) => {
    c.rect(1, 25, 22, 2, 'n');
    // The chair's back behind the intern.
    c.rect(3, 7, 18, 9, 'k');
    c.rect(4, 8, 16, 7, 'm');
    c.hline(4, 8, 16, 'M');
    c.stamp(P.internUpper, 6, 0, { map: look });
    // Desk: wood top, modesty panel.
    block(c, 0, 14, 24, 3, 7, { top: 'o', front: 'u', hi: 'S', shade: 'k' });
    c.hline(1, 18, 22, 'k');
    c.stamp(monitorBack, 6, 8);
    c.stamp(P.hands, 4, 15, { frame, map: look.p ? { p: look.p } : null });
  });
}

/** A rack cabinet with a glass door; LEDs chase (16 x 40). */
function cabinet(frame, units = 7) {
  return paint(16, 40, (c) => {
    block(c, 0, 0, 16, 2, 36, { top: 'M', front: 'k', hi: 'm', shade: 'n' });
    for (let u = 0; u < units; u++) {
      const y = 6 + u * 4;
      c.rect(3, y, 10, 3, 'n');
      c.hline(3, y, 10, 'm');
      const lit = (u + frame) % 3;
      c.set(4, y + 1, lit === 0 ? 'A' : 'b');
      c.set(6, y + 1, lit === 1 ? 'a' : 'b');
      c.set(11, y + 1, lit === 2 ? 'h' : 'm');
    }
    // The glass door: a frame with a glint at the top left.
    c.box(2, 4, 12, 33, 'm');
    c.set(3, 5, 'S');
    c.set(4, 5, 'S');
    c.set(3, 6, 'S');
    // Feet.
    c.rect(1, 38, 2, 2, 'k');
    c.rect(13, 38, 2, 2, 'k');
  });
}

/** A wall-mounted phone rack: two shelves of phones charging (24 x 26). */
function phoneRack(frame, count) {
  return paint(24, 26, (c) => {
    c.rect(0, 0, 24, 26, 'k');
    c.rect(1, 1, 22, 24, 'n');
    c.vline(1, 1, 24, 'm');
    for (const y of [11, 23]) {
      c.rect(1, y, 22, 2, 'M');
      c.hline(1, y + 1, 22, 'm');
    }
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 5);
      const x = 2 + (i % 5) * 4;
      const y = row === 0 ? 5 : 17;
      c.stamp(rackPhone, x, y, { frame: (frame + i * 5) % 2 });
    }
  });
}

/** The glass door to the server room; `open` 0..1 lights it and swings it (hall levels). */
function serverDoor(c, x, y, w, h, level, frame) {
  c.rect(x - 2, y - 2, w + 4, h + 2, 'k');
  c.rect(x - 1, y - 1, w + 2, 1, 'M');
  c.rect(x, y, w, h, 'n');
  if (level > 0) {
    // Behind the glass: racks in the server room, more of them lit as the hall grows.
    c.rect(x, y, w, h, 'k');
    c.rect(x, y + h - 5, w, 5, 'n');
    const racks = Math.min(3, Math.ceil(level / 2));
    for (let i = 0; i < racks; i++) {
      const rx = x + 2 + i * 6;
      if (rx + 4 > x + w) break;
      c.rect(rx, y + 5, 4, h - 10, 'n');
      c.vline(rx, y + 5, h - 10, 'm');
      for (let j = 0; j < 7; j++) {
        const ly = y + 7 + j * 4;
        if (ly > y + h - 7) break;
        c.set(rx + 2, ly, (i + j + frame) % 3 === 0 ? 'A' : 'b');
      }
    }
  }
  // Glass glint and the door's frame and handle.
  c.box(x, y, w, h, 'm');
  line(c, x + 2, y + 6, x + 6, y + 2, 'S');
  line(c, x + 2, y + 10, x + 10, y + 2, level > 0 ? 'm' : 'S');
  c.rect(x + w - 4, y + Math.floor(h / 2), 2, 4, 'M');
  if (level >= 5) {
    // Propped open: light spills out across the carpet.
    for (let j = 0; j < 7; j++) c.hline(x - 2 + j, y + h + j, w + 2, j % 2 ? 'F' : 'b');
  }
}

// ---------------------------------------------------------------- the room

function room() {
  const c = new Canvas(W, H);
  // Ceiling with light panels.
  c.rect(0, 0, W, CEIL, 'n');
  for (let x = 10; x < W; x += 40) {
    c.rect(x, 8, 24, 6, 'k');
    c.rect(x + 1, 9, 22, 4, 'S');
    c.hline(x + 1, 9, 22, 'h');
  }
  c.hline(0, CEIL - 2, W, 'k');
  c.hline(0, CEIL - 1, W, 'M');
  // Painted wall over a darker wainscot.
  c.rect(0, CEIL, W, FLOOR - CEIL, 'w');
  c.rect(0, 92, W, FLOOR - 92, 'W');
  c.hline(0, 92, W, 'M');
  c.hline(0, 93, W, 'm');
  for (let x = 4; x < W; x += 18) c.vline(x, 95, FLOOR - 98, 'w');
  // Skirting.
  c.rect(0, FLOOR - 3, W, 3, 'm');
  c.hline(0, FLOOR - 3, W, 'M');
  c.hline(0, FLOOR - 1, W, 'k');
  // Carpet tiles, rows receding.
  c.rect(0, FLOOR, W, H - FLOOR, 'f');
  const rows = [FLOOR, FLOOR + 8, FLOOR + 18, FLOOR + 31, FLOOR + 47, H];
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r];
    const y1 = rows[r + 1];
    const tw = 12 + r * 4;
    for (let x = -tw + ((r % 2) * tw) / 2 + 108 % tw; x < W; x += tw * 2) c.rect(Math.round(x), y0, tw, y1 - y0, 'F');
    c.hline(0, y0, W, 'n');
  }
  c.hline(0, FLOOR, W, 'k');
  // A rug under the model's spot.
  // Window onto the night skyline, at the right of the back wall.
  const wx = 126;
  const wy = 34;
  const ww = 42;
  const wh = 32;
  c.rect(wx - 2, wy - 2, ww + 4, wh + 4, 'k');
  c.rect(wx - 1, wy - 1, ww + 2, wh + 2, 'M');
  c.rect(wx, wy, ww, wh, 'k');
  // Sky: a dark band, a moon.
  c.rect(wx, wy, ww, wh, 'n');
  c.rect(wx + 32, wy + 4, 4, 4, 'S');
  c.set(wx + 32, wy + 4, 'n');
  c.set(wx + 35, wy + 7, 'h');
  const towers = [
    [0, 18, 6], [6, 10, 7], [13, 22, 5], [18, 14, 8], [26, 20, 6], [32, 12, 5], [37, 17, 5],
  ];
  for (const [tx, th, tw] of towers) {
    const top = wy + wh - th;
    c.rect(wx + tx, top, tw, th, 'm');
    c.vline(wx + tx, top, th, 'M');
    for (let yy = top + 2; yy < wy + wh - 2; yy += 3) for (let xx = wx + tx + 2; xx < wx + tx + tw - 1; xx += 2) if ((xx * 7 + yy * 3) % 5 < 2) c.set(xx, yy, (xx + yy) % 3 ? 'A' : 'h');
  }
  // Mullion and sill.
  c.vline(wx + ww / 2, wy, wh, 'M');
  c.hline(wx, wy + 13, ww, 'M');
  c.rect(wx - 3, wy + wh + 1, ww + 6, 2, 'S');
  c.hline(wx - 3, wy + wh + 3, ww + 6, 'k');
  // Whiteboard with the hockey-stick chart, beside the server-room door.
  const bx = 48;
  const by = 72;
  c.rect(bx, by, 24, 18, 'k');
  c.rect(bx + 1, by + 1, 22, 16, 'S');
  c.hline(bx + 1, by + 1, 22, 'h');
  c.vline(bx + 3, by + 3, 12, 'k');
  c.hline(bx + 3, by + 14, 18, 'k');
  line(c, bx + 4, by + 13, bx + 12, by + 12, 'b');
  line(c, bx + 12, by + 12, bx + 16, by + 9, 'b');
  line(c, bx + 16, by + 9, bx + 19, by + 3, 'b');
  c.set(bx + 18, by + 3, 'b');
  c.set(bx + 20, by + 4, 'b');
  for (const yy of [by + 4, by + 7]) c.hline(bx + 6, yy, 6, 'm');
  c.rect(bx + 2, by + 18, 20, 1, 'm');
  c.set(bx + 6, by + 17, 'a');
  c.set(bx + 9, by + 17, 'M');
  // Days since last incident: a warning sign over a big zero.
  const sx = 74;
  const sy = 72;
  c.rect(sx, sy, 14, 15, 'k');
  c.rect(sx + 1, sy + 1, 12, 13, 'S');
  c.hline(sx + 1, sy + 1, 12, 'h');
  // Triangle.
  for (let j = 0; j < 4; j++) c.hline(sx + 7 - j, sy + 2 + j, 1 + j * 2 - 1 > 0 ? 1 + j * 2 - 1 : 1, 'k');
  c.set(sx + 6, sy + 4, 'S');
  // Zero.
  c.rect(sx + 4, sy + 7, 6, 6, 'k');
  c.rect(sx + 6, sy + 8, 2, 4, 'S');
  // Coffee counter at the left of the model, and a plant on the right.
  c.stamp(coffeeMachine, 72, 88);
  c.stamp(smallPlant, 82, 92);
  // The server-room door, shut.
  serverDoor(c, 26, 66, 18, FLOOR - 66 - 3, 0, 0);
  // A wall shelf over the cabinets for the trophies.
  c.rect(142, 68, 50, 2, 'S');
  c.hline(142, 68, 50, 'h');
  c.hline(142, 70, 50, 'k');
  return c;
}

const looks = [
  { s: 'a', S: 'A', b: 'b', n: 'u' },
  { s: 'S', S: 'h', b: 's', n: 'k' },
  { s: 'm', S: 'M', b: 'n', n: 'o' },
  { s: 'b', S: 'a', b: 'n', n: 'k' },
];

/** The office scene for scripts/pixel/scenes.js. */
function scene({ tier, spriteCanvas }) {
  return {
    id: 'office',
    room,
    tiers: {
      hall: tier({ x: 20, y: 60, w: 30, h: 58 }, 2, 1.5, (c, level, frame) => serverDoor(c, 6, 6, 18, 41, level, frame)),
      closet: tier({ x: 140, y: 70, w: 52, h: 40 }, 3, 2, (c, level, frame) => {
        const racks = [0, 1, 1, 2, 3, 3, 3][level];
        for (let i = 0; i < racks; i++) c.draw(cabinet((frame + i) % 3, level === 1 ? 3 : 7), 36 - i * 17, 0);
      }),
      scraper: tier({ x: 170, y: 36, w: 24, h: 28 }, 2, 1, (c, level, frame) => {
        c.draw(phoneRack(frame, [0, 2, 4, 6, 8, 10, 10][level]), 0, 0);
      }),
      gpu: tier({ x: 142, y: 110, w: 52, h: 50 }, 2, 4, (c, level, frame) => {
        const n = [0, 1, 2, 4, 6, 8, 8][level];
        // Back row of four, then the front row.
        for (let i = 0; i < n; i++) {
          const row = i < 4 ? 0 : 1;
          const col = i % 4;
          c.stamp(gpuTower, 2 + col * 12 + row * 1, 2 + row * 26, { frame: (frame + i) % 2 });
          c.rect(3 + col * 12 + row, 22 + row * 26, 11, 1, 'n');
        }
      }),
      // At the top level of GPUs the founder starts filming updates: a ring light by the plant.
      gpuExtra: tier({ x: 129, y: 84, w: 10, h: 26, of: 'gpu' }, 1, 0, (c, level) => {
        if (level >= 6) c.stamp(ringLight, 0, 0);
      }),
      intern: tier({ x: 22, y: 72, w: 56, h: 98 }, 2, 3, (c, level, frame) => {
        const spots = [
          [2, 30],
          [28, 32],
          [2, 58],
          [28, 60],
        ];
        if (level >= 5) c.stamp(P.internStanding, 31, 18, { map: looks[2] });
        const n = Math.min(4, level);
        for (let i = 0; i < n; i++) c.draw(internDesk((frame + i) % 2, looks[i]), spots[i][0], spots[i][1]);
        if (level >= 6) {
          c.stamp(P.internAsleep, 0, 88, { map: { s: 'm', S: 'M', b: 'n', n: 'u' } });
          c.stamp(P.snore, 3, 82, { frame });
          for (let i = 0; i < 3; i++) c.stamp(G.sprites.pizzaBox, 27 + (i % 2), 91 - i * 3);
        }
      }),
    },
    ambient: [{ id: 'steam', x: 77, y: 81, fps: 2.5, count: 3, frames: (f) => spriteCanvas(G.sprites.steam, f) }],
    shelf: { x: 146, y: 60, step: 9 },
    shelfItems: G.shelfItems,
    sheetSprites: () => [
      ...[0, 1].map((f) => internDesk(f, looks[0])),
      ...[0, 1, 2].map((f) => cabinet(f)),
      phoneRack(0, 10),
      ...[monitorBack, smallPlant, coffeeMachine, gpuTower, rackPhone, ringLight].flatMap((s) => s.frames.map((_, f) => spriteCanvas(s, f))),
    ],
  };
}

module.exports = { scene, sprites: { monitorBack, plant, smallPlant, coffeeMachine, gpuTower, rackPhone, ringLight } };
