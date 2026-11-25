/**
 * Props shared by the stages: the later tiers as trophies (big enough to read at phone
 * size), a sleeper's "Z", an intern asleep at a desk, pizza boxes, and the plinth the model
 * stands on. Light from the top left, one-pixel ink outline, palette roles only.
 */
const { sprite } = require('../canvas');
const { block, paint, outline, ellipse } = require('./draw');

/** The later tiers as trophies, 11 x 11: a chip, a lightning bolt, a robot arm, a rocket, a star. */
const trophies = {
  chips: sprite('trophy-chips', [
    '.k.k.k.k.k.',
    'kkkkkkkkkkk',
    '.kMhhhhhMk.',
    'kkhmmmmmMkk',
    '.khmkkkmMk.',
    'kkhmkAkmMkk',
    '.khmkkkmMk.',
    'kkhmmmmmMkk',
    '.kMMMMMMmk.',
    'kkkkkkkkkkk',
    '.k.k.k.k.k.',
  ]),
  power: sprite('trophy-power', [
    '......kkkk.',
    '.....kAAak.',
    '....kAAak..',
    '...kAAak...',
    '..kAAAAkkk.',
    '.kkkkAAAak.',
    '....kAAak..',
    '...kAAak...',
    '..kAak.....',
    '.kAak......',
    '.kkk.......',
  ]),
  robotics: sprite('trophy-robotics', [
    '......kkkk.',
    '.....khMak.',
    '....khkkk..',
    '...khk.....',
    '..khk......',
    '.kkhkk.....',
    '.khAhk.....',
    '.kkMkk.....',
    'kkkkkkkk...',
    'kMMMMMmk...',
    'kkkkkkkk...',
  ]),
  orbital: sprite('trophy-orbital', [
    '.....k.....',
    '....kak....',
    '...khMk....',
    '...khMk....',
    '...kakak...',
    '...khMk....',
    '..kkhMkk...',
    '.kbkhMkbk..',
    '.kbkkkkbk..',
    '..k.kAk.k..',
    '....kak....',
  ]),
  universe: sprite('trophy-universe', [
    '.....k.....',
    '....kAk....',
    '....kAk....',
    'kkkkkAkkkkk',
    'kAAAAhAAAak',
    '.kkAAAAakk.',
    '..kAAkAak..',
    '.kAak.kAak.',
    '.kak...kak.',
    'kkk.....kkk',
    '...........',
  ]),
};

/** A big "Z" and a small one drifting up over a sleeper, two frames (12 x 14). */
const sleepZ = (() => {
  const Z = (c, x, y, s) => {
    for (let i = 0; i < s; i++) {
      c.set(x + i, y, 'h');
      c.set(x + i, y + s - 1, 'h');
      c.set(x + s - 1 - i, y + i, 'h');
    }
  };
  const frames = [0, 1].map((f) =>
    paint(12, 14, (c) => {
      Z(c, 1 + f, 6 - f * 2 + 1, 6);
      Z(c, 7 - f, 1 + f, 4);
      outline(c);
    }),
  );
  return { name: 'sleep-z', w: 12, h: 14, frames: frames.map((c) => c.px) };
})();

/** A pizza box, three-quarter view (12 x 5). */
const pizzaBox = sprite('pizza-box', ['kkkkkkkkkkkk', 'khoooooooook', 'koooosSooook', 'kuuuuuuuuuuk', 'kkkkkkkkkkkk']);

/** A tower of pizza boxes, the top one open on a last slice (12 x h). */
function pizzaTower(c, x, y, boxes) {
  for (let i = 0; i < boxes; i++) c.stamp(pizzaBox, x + (i % 2 ? 1 : 0), y + (boxes - 1 - i) * 4);
  // The open lid of the top box, leaning back, with a slice on the base.
  const ty = y - 5;
  c.rect(x + 1, ty, 10, 5, 'k');
  c.rect(x + 2, ty + 1, 8, 3, 'o');
  c.hline(x + 2, ty + 1, 8, 'h');
  c.set(x + 5, y + 1, 'S');
  c.set(x + 6, y + 1, 'a');
  c.set(x + 6, y + 2, 'S');
}

/**
 * An intern asleep at a desk: head down on folded arms, laptop shut, a pizza tower at the
 * side. `deskMat` styles the desk (the stage's furniture), `look` swaps shirt and hair.
 * Returns a canvas 38 x 30; the desk sits at the left, 24 wide, the same place as an awake
 * intern's desk at (0, 3).
 */
function asleepAtDesk(deskMat, look = {}, deskH = 1) {
  return paint(38, 30, (c) => {
    const map = (r) => look[r] ?? r;
    c.rect(1, 28, 22, 2, 'n');
    // Shoulders slumped forward behind the desk.
    c.rect(4, 9, 16, 7, 'k');
    c.rect(5, 10, 14, 6, map('s'));
    c.hline(5, 10, 14, map('S'));
    c.vline(18, 11, 5, map('b'));
    // The desk.
    block(c, 0, 14, 24, 3, deskH, deskMat);
    // The head lying on its side on the desk, face to us: hair on the left, eyes shut, mouth open.
    c.rect(3, 6, 14, 10, 'k');
    c.rect(4, 7, 5, 8, map('n'));
    c.rect(9, 7, 7, 8, 'p');
    c.vline(9, 7, 8, map('n'));
    c.hline(10, 9, 2, 'k');
    c.hline(13, 9, 2, 'k');
    c.rect(11, 12, 2, 2, 'k');
    c.set(4, 7, 'k');
    c.set(16, 7, 'k');
    c.set(16, 14, 'k');
    // An arm flopped on the desk.
    c.rect(16, 13, 6, 3, 'k');
    c.hline(17, 14, 4, map('s'));
    c.set(21, 14, 'p');
    // A pizza tower beside the desk, on the floor.
    pizzaTower(c, 25, 15, 3);
    c.rect(25, 28, 12, 2, 'n');
  });
}

/**
 * The plinth under the model (52 x 20): a three-quarter block 48 wide with a contact shadow.
 * `mat` is the block's materials; `detail(c)` adds the stage's touch (planks, a lit strip...).
 * The model's feet stand on row PLINTH_TOP of the image.
 */
const PLINTH_W = 52;
const PLINTH_H = 20;
const PLINTH_TOP = 4;
function plinth(mat, detail, { depth = 5, height = 8, shadow = 'k' } = {}) {
  return paint(PLINTH_W, PLINTH_H, (c) => {
    ellipse(c, 0, PLINTH_H - 6, PLINTH_W, 6, shadow);
    block(c, 2, 0, PLINTH_W - 4, depth, height, mat);
    // Round the top corners by one pixel.
    c.set(2, 0, 0);
    c.set(PLINTH_W - 3, 0, 0);
    if (detail) detail(c, { x: 3, y: 1, w: PLINTH_W - 6, depth, height, front: 1 + depth });
  });
}

module.exports = { trophies, sleepZ, pizzaBox, pizzaTower, asleepAtDesk, plinth, PLINTH_W, PLINTH_H, PLINTH_TOP };
