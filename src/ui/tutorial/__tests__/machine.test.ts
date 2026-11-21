import tutorialStrings from '../../strings/tutorial.en.json';
import { INITIAL, loaded, next, observe, replayNextRun, skip, start, STEPS, view, type Observation, type TutorialState } from '../machine';
import { blockersAround, blockersAroundAll, dimPath, holeFor, placeCaption } from '../placement';

const BASE: Observation = {
  running: true,
  seed: 7,
  eventPending: false,
  eventShowing: false,
  route: 'map',
  rootVisible: false,
  rootSheetOpen: false,
  rootOwned: false,
  canBuyRoot: true,
  dataCentres: 0,
  canBuildHome: true,
  homeSheetOpen: false,
};

const o = (patch: Partial<Observation> = {}): Observation => ({ ...BASE, ...patch });
const stepOf = (s: TutorialState) => STEPS[s.step];

/** Plays the tutorial from step 1 to the end, doing what each step asks. */
function playThrough(): { visited: string[]; final: TutorialState } {
  let s = observe(loaded(INITIAL, false), o());
  const visited: string[] = [];
  let obs = o();
  for (let guard = 0; guard < 50 && s.status === 'active'; guard++) {
    const id = stepOf(s);
    if (visited[visited.length - 1] !== id) visited.push(id);
    if (id === 'buyModel') {
      obs = o({ route: 'trees', rootVisible: true, rootOwned: true });
      s = observe(s, obs);
    } else if (id === 'buildDc') {
      obs = o({ route: 'map', rootOwned: true, dataCentres: 0 });
      s = observe(s, obs); // records the baseline
      obs = { ...obs, dataCentres: 1 };
      s = observe(s, obs);
    } else if (id === 'event') {
      obs = o({ eventPending: true, eventShowing: true, rootOwned: true, dataCentres: 1 });
      s = next(s, obs);
    } else {
      obs = o({ rootOwned: true, dataCentres: 1 });
      s = next(s, obs);
    }
  }
  return { visited, final: s };
}

describe('tutorial machine', () => {
  it('starts when the first run is on, once the done flag is read', () => {
    expect(observe(INITIAL, o()).status).toBe('loading');
    const pending = loaded(INITIAL, false);
    expect(pending.status).toBe('pending');
    expect(observe(pending, o({ running: false })).status).toBe('pending');
    const active = observe(pending, o());
    expect(active.status).toBe('active');
    expect(stepOf(active)).toBe('home');
  });

  it('does not start when it was done before', () => {
    const done = loaded(INITIAL, true);
    expect(observe(done, o()).status).toBe('done');
    expect(view(done, o())).toBeNull();
  });

  it('runs the steps in order and ends done', () => {
    const { visited, final } = playThrough();
    expect(visited).toEqual([...STEPS]);
    expect(final.status).toBe('done');
  });

  it('Next only moves on from steps that show it', () => {
    let s = start(7);
    s = next(next(s, o()), o()); // home, strip
    expect(stepOf(s)).toBe('buyModel');
    expect(stepOf(next(s, o()))).toBe('buyModel');
    expect(stepOf(next(s, o({ route: 'trees', rootVisible: true })))).toBe('buyModel');
  });

  it('buy step guides to Trees, the tile, the sheet, and completes on the purchase', () => {
    const s: TutorialState = { ...start(7), step: STEPS.indexOf('buyModel') };
    expect(view(s, o({ route: 'map' }))?.targets).toEqual(['tab.trees']);
    expect(view(s, o({ route: 'trees', rootVisible: false }))?.targets).toEqual(['tree.picker']);
    expect(view(s, o({ route: 'trees', rootVisible: true }))?.targets).toEqual(['tree.root']);
    expect(view(s, o({ route: 'trees', rootVisible: true, rootSheetOpen: true }))?.targets).toEqual(['tree.buy']);
    expect(view(s, o({ route: 'trees', rootVisible: true }))?.pause).toBe(true);
    expect(stepOf(observe(s, o({ route: 'trees', rootOwned: true })))).toBe('buildDc');
  });

  it('lets time run while the player cannot afford the required action', () => {
    const buy: TutorialState = { ...start(7), step: STEPS.indexOf('buyModel') };
    const wait = view(buy, o({ route: 'trees', rootVisible: true, canBuyRoot: false }));
    expect(wait?.action).toBe('wait');
    expect(wait?.pause).toBe(false);
    expect(wait?.captionKey).toBe('ui.tutorial.buyModel.wait');
    const build: TutorialState = { ...start(7), step: STEPS.indexOf('buildDc') };
    const waitCash = view(build, o({ canBuildHome: false }));
    expect(waitCash?.action).toBe('wait');
    expect(waitCash?.pause).toBe(false);
  });

  it('build step needs one more data centre than when it began', () => {
    let s: TutorialState = { ...start(7), step: STEPS.indexOf('buildDc') };
    s = observe(s, o({ dataCentres: 2 }));
    expect(s.dcBaseline).toBe(2);
    expect(stepOf(observe(s, o({ dataCentres: 2 })))).toBe('buildDc');
    expect(stepOf(observe(s, o({ dataCentres: 3 })))).toBe('compute');
    expect(view(s, o({ homeSheetOpen: false }))?.targets).toEqual(['map.home', 'map.regions', 'map.regionList']);
    expect(view(s, o({ homeSheetOpen: true }))?.targets).toEqual(['region.build.home']);
    expect(view(s, o({ route: 'news' }))?.targets).toEqual(['tab.map']);
  });

  it('steps 1 to 7 wait behind an event card and come back after it', () => {
    for (const id of ['home', 'strip', 'buyModel', 'buildDc', 'compute', 'meters', 'speed'] as const) {
      const s: TutorialState = { ...start(7), step: STEPS.indexOf(id) };
      expect(view(s, o({ eventPending: true, eventShowing: true }))).toBeNull();
      expect(view(s, o({ eventShowing: true }))).toBeNull(); // the result view
      expect(view(s, o())).not.toBeNull();
      // Next does nothing while hidden.
      expect(next(s, o({ eventPending: true, eventShowing: true })).step).toBe(s.step);
    }
  });

  it('step 8 waits with the run going, then explains the card over it', () => {
    const s: TutorialState = { ...start(7), step: STEPS.indexOf('event') };
    expect(view(s, o())).toBeNull();
    const v = view(s, o({ eventPending: true, eventShowing: true }));
    expect(v?.overEvent).toBe(true);
    expect(v?.targets).toEqual(['event.choices']);
    const outro = next(s, o({ eventPending: true, eventShowing: true }));
    expect(stepOf(outro)).toBe('outro');
    // The last line waits until the card and its result are gone.
    expect(view(outro, o({ eventShowing: true }))).toBeNull();
    expect(view(outro, o())?.action).toBe('finish');
    expect(next(outro, o()).status).toBe('done');
  });

  it('skip ends it at any step', () => {
    for (let i = 0; i < STEPS.length; i++) {
      const s = skip({ ...start(7), step: i });
      expect(s.status).toBe('done');
      expect(view(s, o())).toBeNull();
    }
  });

  it('replays from step 1, now or at the next run', () => {
    const done = skip(start(7));
    const now = start(9);
    expect(now.status).toBe('active');
    expect(now.step).toBe(0);
    const queued = replayNextRun(done);
    expect(queued.status).toBe('pending');
    expect(observe(queued, o({ running: false })).status).toBe('pending');
    expect(stepOf(observe(queued, o({ seed: 11 })))).toBe('home');
  });

  it('restarts from step 1 in a new run', () => {
    const s: TutorialState = { ...start(7), step: 4 };
    const again = observe(s, o({ seed: 8 }));
    expect(again.step).toBe(0);
    expect(again.runSeed).toBe(8);
  });

  it('pauses the run on explaining steps only', () => {
    const s = start(7);
    expect(view(s, o())?.pause).toBe(true);
    const ev: TutorialState = { ...s, step: STEPS.indexOf('event') };
    expect(view(ev, o({ eventPending: true, eventShowing: true }))?.pause).toBe(false);
  });

  it('has a caption of at most two short sentences for every key it uses', () => {
    const strings = tutorialStrings as Record<string, string>;
    const keys = new Set<string>();
    const routes: Observation['route'][] = ['map', 'trees', 'news'];
    for (let i = 0; i < STEPS.length; i++) {
      for (const route of routes)
        for (const flags of [{}, { rootVisible: true }, { rootVisible: true, rootSheetOpen: true }, { canBuyRoot: false }, { canBuildHome: false }, { homeSheetOpen: true }, { eventPending: true, eventShowing: true }]) {
          const v = view({ ...start(7), step: i }, o({ route, ...flags }));
          if (v) keys.add(v.captionKey);
        }
    }
    expect(keys.size).toBeGreaterThanOrEqual(STEPS.length);
    for (const key of keys) {
      expect(strings[key]).toBeDefined();
      const sentences = strings[key].split(/[.!?](\s|$)/).filter((x) => x && x.trim().length > 1);
      expect(sentences.length).toBeLessThanOrEqual(2);
      expect(strings[key].length).toBeLessThanOrEqual(130);
    }
  });
});

describe('coach mark placement', () => {
  const screen = { width: 844, height: 390 };
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const card = { width: 300, height: 110 };
  const inside = (p: { left: number; top: number }) => p.left >= 0 && p.top >= 0 && p.left + card.width <= screen.width && p.top + card.height <= screen.height;
  const covers = (p: { left: number; top: number }, h: { x: number; y: number; width: number; height: number }) =>
    p.left < h.x + h.width && p.left + card.width > h.x && p.top < h.y + h.height && p.top + card.height > h.y;

  it('puts the caption beside its target without covering it', () => {
    for (const hole of [
      { x: 120, y: 0, width: 200, height: 40 },
      { x: 700, y: 4, width: 120, height: 32 },
      { x: 0, y: 100, width: 56, height: 56 },
      { x: 100, y: 330, width: 700, height: 40 },
    ]) {
      const p = placeCaption({ holes: [hole], screen, insets, card });
      expect(inside(p)).toBe(true);
      expect(covers(p, hole)).toBe(false);
    }
  });

  it('avoids every cut-out when there are several', () => {
    const holes = [
      { x: 700, y: 4, width: 120, height: 32 },
      { x: 56, y: 362, width: 788, height: 28 },
    ];
    const p = placeCaption({ holes, screen, insets, card });
    for (const h of holes) expect(covers(p, h)).toBe(false);
  });

  it('stays inside the safe area', () => {
    const p = placeCaption({ holes: [{ x: 0, y: 0, width: 40, height: 40 }], screen: { width: 859, height: 396 }, insets: { top: 0, right: 59, bottom: 21, left: 59 }, card });
    expect(p.left).toBeGreaterThanOrEqual(59);
    expect(p.left + card.width).toBeLessThanOrEqual(859 - 59);
    expect(p.top + card.height).toBeLessThanOrEqual(396 - 21);
  });

  it('centres when there is nothing to point at', () => {
    const p = placeCaption({ holes: [], screen, insets, card });
    expect(p.left).toBeCloseTo((844 - 300) / 2);
  });

  it('builds a finite dim path and blockers that leave only the hole open', () => {
    const hole = holeFor({ x: 10, y: 10, width: 30, height: 20 }, screen);
    expect(hole.x).toBe(4);
    const d = dimPath(screen, [hole, { x: 0, y: 0, width: 0, height: 0 }]);
    expect(d).toMatch(/^M0 0H844V390H0Z/);
    expect(d).not.toMatch(/NaN|Infinity/);
    const blockers = blockersAround(hole, screen);
    const area = blockers.reduce((sum, b) => sum + b.width * b.height, 0);
    expect(area + hole.width * hole.height).toBeCloseTo(screen.width * screen.height);
  });

  it('blocks everything but several holes (map cut-out, Regions button, the list)', () => {
    const holes = [
      { x: 100, y: 120, width: 60, height: 60 },
      { x: 10, y: 330, width: 90, height: 44 },
      { x: 480, y: 0, width: 364, height: 390 },
      { x: 140, y: 150, width: 40, height: 40 }, // overlaps the first
    ];
    const blockers = blockersAroundAll(holes, screen);
    const inside = (b: { x: number; y: number; width: number; height: number }, x: number, y: number) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
    const blocked = (x: number, y: number) => blockers.some((b) => inside(b, x, y));
    for (const [x, y] of [[130, 150], [50, 350], [600, 200], [170, 185]]) expect(blocked(x, y)).toBe(false);
    for (const [x, y] of [[5, 5], [300, 200], [130, 100], [470, 389], [50, 300]]) expect(blocked(x, y)).toBe(true);
    // No blocker overlaps a hole.
    for (const b of blockers) for (const h of holes) {
      const ox = Math.min(b.x + b.width, h.x + h.width) - Math.max(b.x, h.x);
      const oy = Math.min(b.y + b.height, h.y + h.height) - Math.max(b.y, h.y);
      expect(ox > 0 && oy > 0).toBe(false);
    }
    expect(blockersAroundAll([], screen)).toEqual([{ x: 0, y: 0, width: 844, height: 390 }]);
  });
});
