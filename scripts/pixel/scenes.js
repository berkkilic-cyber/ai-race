/**
 * The pixel scenes: for each stage, the baked room and, per generator tier, a fixed slot
 * and what it shows at each count bucket. Slots never overlap each other, keep clear of
 * the model and its plinth in the middle and keep what matters out from under the HUD
 * plate (top left) and the offer slot (top right).
 *
 * Coordinates are art pixels in a W x H room (see the Art section of docs/GARAGE.md):
 * the room is drawn at 2 dp per art pixel, centred horizontally and anchored to the bottom
 * of the stage, so the model's plinth (centre bottom) always lands on the same floor.
 */
const { Canvas } = require('./canvas');
const G = require('./art/garage');
const O = require('./art/office');
const D = require('./art/datacentre');

/** Count buckets: owning at least this many of a tier shows the next level (1..6). */
const LEVELS = [1, 5, 10, 25, 50, 100];

/** dp per art pixel: the room is drawn at 2 dp per art pixel. */
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
  return {
    slot,
    frames,
    fps,
    draw: (level, frame) => {
      const c = blank(slot.w, slot.h);
      draw(c, level, frame);
      return c;
    },
  };
}

function spriteCanvas(spr, frame) {
  const c = blank(spr.w, spr.h);
  c.stamp(spr, 0, 0, { frame });
  return c;
}

const kit = { tier, blank, spriteCanvas };

const STAGE_MODULES = [G, O, D];

const SCENES = STAGE_MODULES.map((m) => m.scene(kit));

/** Later tiers shown as items on the shelf (the garage and the office), in order. */
const SHELF_TIERS = ['chips', 'power', 'robotics', 'orbital', 'universe'];

module.exports = { SCENES, LEVELS, DP_PER_PIXEL, ROOM, SHELF_TIERS, spriteCanvas, G };
