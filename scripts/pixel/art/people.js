/**
 * People: the interns. Front-facing (behind their desks), so a face above a laptop reads at
 * a glance. Shirts and hair are swapped per intern with role maps, never new colours.
 */
const { sprite } = require('../canvas');

/** An intern's head and shoulders, seen from the front behind a desk (10 x 12). */
const internUpper = sprite('intern-upper', [
  '...kkkkkk...',
  '..knnnnnnk..',
  '.knnnnnnnnk.',
  '.knnnnnpnnk.',
  '.knpppppppk.',
  '.kppkppkppk.',
  '.kppppppppk.',
  '..kppppppk..',
  '..kkkppkkk..',
  '.kSSsssssbk.',
  'kSSsssssssbk',
  'kSsssssssbbk',
  'kSsssssssbbk',
  'kSsssssssbbk',
]);

/** Hands on the keys, two frames (typing). Drawn on the desk top, 12 x 2. */
const hands = sprite('intern-hands', [
  ['kpk..........kpk', '................'],
  ['................', 'kpk..........kpk'],
]);

/** An intern standing with a mug, front view (8 x 18). */
const internStanding = sprite('intern-standing', [
  '..kkkk..',
  '.knnnnk.',
  'knnnnnnk',
  'knppppnk',
  'kpkppkpk',
  'kppppppk',
  '.kppppk.',
  'kkkppkkk',
  'kSsssssk',
  'kSsssskk',
  'kSsssskh',
  'kpSsssko',
  'kkssssko',
  '.knnnnk.',
  '.knnnnk.',
  '.knkknk.',
  '.knk.nk.',
  '.kk..kk.',
]);

/** An intern asleep in a sleeping bag on the floor (20 x 7). */
const internAsleep = sprite('intern-asleep', [
  '.........kkkkkkkkkkkk..',
  '..kkkk..kSSSSSSSSSSSsk.',
  '.knnnnk.kSsssssssssssbk',
  'khhnppkkSssssssssssssbk',
  'khhpkpkSsssssssssssssbk',
  'khhppppkbbbbbbbbbbbbbbk',
  '.kkkkkkkkkkkkkkkkkkkkk.',
]);

/** "z" over the sleeper, two frames. */
const snore = sprite('snore', [
  ['hhh..', '..h..', '.h...', 'hhh..', '.....'],
  ['.....', '.hhh.', '...h.', '..h..', '.hhh.'],
]);

module.exports = { internUpper, hands, internStanding, internAsleep, snore };
