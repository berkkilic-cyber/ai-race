/**
 * The pixel scenes: for each drawn stage, the baked room and, per generator tier, a fixed
 * slot and what it shows at each count bucket. Slots never overlap each other, keep clear
 * of the model's tap area in the middle and of the HUD plate at the top left.
 *
 * Coordinates are art pixels in a W x H room (see the Art section of docs/GARAGE.md):
 * the room is drawn at 2 dp per art pixel, centred horizontally and anchored to the bottom
 * of the stage, so the model's pedestal (centre bottom) always lands on the same floor.
 */
const { Canvas } = require('./canvas');
const G = require('./art/garage');
const O = require('./art/office');
const P = require('./art/people');

/** Count buckets: owning at least this many of a tier shows the next level (1..6). */
const LEVELS = [1, 5, 10, 25, 50, 100];

/** Art pixels per dp-pixel pair: the room is drawn at 2 dp per art pixel. */
const DP_PER_PIXEL = 2;

const ROOM = { w: G.W, h: G.H, ceiling: G.CEIL, floor: G.FLOOR };

function blank(w, h) {
  return new Canvas(w, h);
}

/**
 * A tier: `slot` in room pixels, `frames` per level (1 = still), `fps`, and `draw(level,
 * frame)` returning a canvas of the slot's size.
 */
function tier(slot, frames, fps, draw) {
  return { slot, frames, fps, draw: (level, frame) => {
    const c = blank(slot.w, slot.h);
    draw(c, level, frame);
    return c;
  } };
}

// ------------------------------------------------------------------ garage

const garageLooks = [
  {},
  { s: 'a', S: 'A', b: 'b', n: 'u' },
  { s: 'm', S: 'M', b: 'n', n: 'k' },
  { s: 'b', S: 'a', b: 's', n: 'o' },
];

const garage = {
  id: 'garage',
  room: () => G.room(),
  tiers: {
    hall: tier({ x: 20, y: 60, w: 52, h: 50 }, 2, 1.5, (c, level, frame) => {
      const open = [0, 0.3, 0.5, 0.7, 0.85, 1, 1][level];
      G.rollUpDoor(c, 5, 6, 42, 41, open, frame);
    }),
    closet: tier({ x: 140, y: 58, w: 52, h: 52 }, 3, 2, (c, level, frame) => {
      const racks = [0, 1, 1, 2, 3, 3, 3][level];
      const units = level === 1 ? 3 : 6;
      for (let i = 0; i < racks; i++) c.draw(G.serverRack((frame + i) % 3, units), 36 - i * 17, 12);
      // Level 5: cables draped over the tops; level 6: a desk fan on top, cooling the lot.
      if (level >= 5) {
        for (let x = 4; x < 51; x++) c.set(x, 13 + (x % 9 < 5 ? 0 : 1), 'k');
        for (const x of [9, 26, 43]) for (let y = 14; y < 24; y++) c.set(x + (y % 3 === 0 ? 1 : 0), y, 'k');
      }
      if (level >= 6) c.stamp(G.sprites.deskFan, 40, 1, { frame });
    }),
    scraper: tier({ x: 136, y: 46, w: 32, h: 23 }, 2, 1, (c, level, frame) => {
      const phones = [0, 2, 4, 6, 8, 10, 10][level];
      c.draw(G.pegboard(frame, phones), 1, 0);
    }),
    gpu: tier({ x: 142, y: 112, w: 52, h: 46 }, 2, 4, (c, level, frame) => {
      const spots = [
        [26, 0],
        [1, 2],
        [27, 24],
        [0, 26],
      ];
      const n = Math.min(4, level);
      for (let i = 0; i < n; i++) c.draw(G.gpuRig((frame + i) % 2), spots[i][0], spots[i][1]);
    }),
    // Level 5 of the GPU rigs also hangs a fire extinguisher by the racks.
    gpuExtra: tier({ x: 132, y: 96, w: 8, h: 16, of: 'gpu' }, 1, 0, (c, level) => {
      if (level >= 5) c.stamp(G.sprites.extinguisher, 1, 2);
    }),
    intern: tier({ x: 22, y: 72, w: 56, h: 98 }, 2, 3, (c, level, frame) => {
      const spots = [
        [2, 32],
        [28, 34],
        [2, 59],
        [28, 61],
      ];
      // Back row first so the front row overlaps it.
      // Level 5: one more coming in at the door with a mug; level 6: one asleep on the floor by the pizza.
      if (level >= 5) c.stamp(P.internStanding, 31, 18, { map: garageLooks[2] });
      const n = Math.min(4, level);
      for (let i = 0; i < n; i++) c.draw(G.internDesk((frame + i) % 2, garageLooks[i]), spots[i][0], spots[i][1]);
      if (level >= 6) {
        c.stamp(P.internAsleep, 0, 88, { map: garageLooks[3] });
        c.stamp(P.snore, 3, 82, { frame });
        for (let i = 0; i < 3; i++) c.stamp(G.sprites.pizzaBox, 27 + (i % 2), 91 - i * 3);
      }
    }),
  },
  ambient: [
    { id: 'bulb', x: 127, y: 26, fps: 1.2, frames: (f) => spriteCanvas(G.sprites.bulb, f) },
    { id: 'steam', x: 74, y: 64, fps: 2.5, frames: (f) => spriteCanvas(G.sprites.steam, f), count: 3 },
  ],
  shelf: { x: 147, y: 34, step: 9 },
  shelfItems: G.shelfItems,
  sheetSprites: () => [
    ...[0, 1].map((f) => G.internDesk(f)),
    ...[0, 1].map((f) => G.gpuRig(f)),
    ...[0, 1, 2].map((f) => G.serverRack(f)),
    G.pegboard(0, 8),
    ...Object.values(G.sprites).flatMap((s) => s.frames.map((_, f) => spriteCanvas(s, f))),
    ...Object.values(P).flatMap((s) => s.frames.map((_, f) => spriteCanvas(s, f))),
  ],
};

function spriteCanvas(spr, frame) {
  const c = blank(spr.w, spr.h);
  c.stamp(spr, 0, 0, { frame });
  return c;
}

// ------------------------------------------------------------------ office

const office = O.scene ? O.scene({ tier, blank, spriteCanvas }) : null;

const SCENES = [garage, office].filter(Boolean);

/** Later tiers shown as items on the shelf, in order. */
const SHELF_TIERS = ['chips', 'power', 'robotics', 'orbital', 'universe'];

module.exports = { SCENES, LEVELS, DP_PER_PIXEL, ROOM, SHELF_TIERS, spriteCanvas, G };
