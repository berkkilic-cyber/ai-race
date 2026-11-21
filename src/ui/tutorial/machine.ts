/**
 * The first-run tutorial as a small pure state machine. It never changes the game: it
 * reads an Observation (built by the host from the store and the UI) and says which
 * step shows, what it points at, and whether the run should be paused while it does.
 */

export const STEPS = ['home', 'strip', 'buyModel', 'buildDc', 'compute', 'meters', 'speed', 'event', 'outro'] as const;
export type StepId = (typeof STEPS)[number];

/** Steps the player must complete by doing something (no Next button). */
export const REQUIRED: ReadonlySet<StepId> = new Set<StepId>(['buyModel', 'buildDc']);

/** Numbered steps shown as "n of N" (the outro is not counted). */
export const COUNTED_STEPS = STEPS.length - 1;

export interface TutorialState {
  /** loading: the done flag is not read yet; pending: runs at the next run; active: showing; done: finished or skipped. */
  status: 'loading' | 'pending' | 'active' | 'done';
  step: number;
  /** Player data centres when the build step began (the step needs one more). */
  dcBaseline: number | null;
  /** Seed of the run the tutorial is running in. */
  runSeed: number | null;
}

export interface Observation {
  /** A run exists and is in progress. */
  running: boolean;
  seed: number | null;
  /** The player's event card is pending (choices on screen). */
  eventPending: boolean;
  /** An event card or its result is on screen. */
  eventShowing: boolean;
  route: 'map' | 'trees' | 'news' | 'other';
  /** The tree with the first model node is on screen (its tile is registered). */
  rootVisible: boolean;
  /** The first model node's sheet is open (its buy button is registered). */
  rootSheetOpen: boolean;
  rootOwned: boolean;
  /** canApply(buyNode root) is ok. */
  canBuyRoot: boolean;
  dataCentres: number;
  /** canApply(buildDataCentre home) is ok. */
  canBuildHome: boolean;
  /** The region sheet for the home region is open (its build button is registered). */
  homeSheetOpen: boolean;
}

export type StepAction =
  /** Next button. */
  | 'next'
  /** The player has to do the highlighted thing. */
  | 'do'
  /** Time runs until the player can do it. */
  | 'wait'
  /** Last line: finishes the tutorial. */
  | 'finish';

export interface TutorialView {
  step: StepId;
  /** 0-based position in STEPS. */
  index: number;
  /** String key of the caption. */
  captionKey: string;
  /**
   * Targets to cut out, primary first. Each is a target id or several separated by "|"
   * (first one registered wins, e.g. a wide-mode id with a narrow-mode fallback).
   * "tree.root" and "tree.buy" stand for the first model node's tile and buy button.
   */
  targets: string[];
  action: StepAction;
  /** The host pauses the run while this is true and restores the speed afterwards. */
  pause: boolean;
  /** Drawn over the event card (step 8) instead of under it. */
  overEvent: boolean;
}

export const INITIAL: TutorialState = { status: 'loading', step: 0, dcBaseline: null, runSeed: null };

/** After the done flag is read. */
export function loaded(s: TutorialState, done: boolean): TutorialState {
  if (s.status !== 'loading') return s;
  return { ...s, status: done ? 'done' : 'pending' };
}

/** Starts (or restarts) from step 1 in the current run. */
export function start(seed: number | null): TutorialState {
  return { status: 'active', step: 0, dcBaseline: null, runSeed: seed };
}

/** "Skip tutorial" at any step. */
export function skip(s: TutorialState): TutorialState {
  return { ...s, status: 'done', dcBaseline: null };
}

/** Replay from the start screen: runs again when the next run starts. */
export function replayNextRun(s: TutorialState): TutorialState {
  return { ...s, status: 'pending', step: 0, dcBaseline: null, runSeed: null };
}

function advance(s: TutorialState): TutorialState {
  const step = s.step + 1;
  if (step >= STEPS.length) return { ...s, status: 'done', dcBaseline: null };
  return { ...s, step, dcBaseline: null };
}

/** The Next (or final) button: only moves on from steps that show one. */
export function next(s: TutorialState, obs: Observation): TutorialState {
  if (s.status !== 'active') return s;
  const v = view(s, obs);
  if (!v || (v.action !== 'next' && v.action !== 'finish')) return s;
  return advance(s);
}

/**
 * Applies what happened in the game and the UI: starts a pending tutorial when a run is
 * on, restarts it in a new run, completes required steps when their action succeeded.
 */
export function observe(s: TutorialState, obs: Observation): TutorialState {
  if (s.status === 'pending') return obs.running ? start(obs.seed) : s;
  if (s.status !== 'active') return s;
  if (obs.running && obs.seed !== null && s.runSeed !== null && obs.seed !== s.runSeed) return start(obs.seed);
  let out = s.runSeed === null && obs.seed !== null ? { ...s, runSeed: obs.seed } : s;
  const id = STEPS[out.step];
  if (id === 'buyModel' && obs.rootOwned) out = advance(out);
  else if (id === 'buildDc') {
    if (out.dcBaseline === null) out = { ...out, dcBaseline: obs.dataCentres };
    else if (obs.dataCentres > out.dcBaseline) out = advance(out);
  }
  return out;
}

const FULL = (step: StepId, index: number, captionKey: string, targets: string[], action: StepAction, pause: boolean, overEvent = false): TutorialView => ({
  step,
  index,
  captionKey,
  targets,
  action,
  pause,
  overEvent,
});

/**
 * What to draw now, or null for nothing (inactive, no run, or waiting behind an event
 * card, which steps 1 to 7 never draw over).
 */
export function view(s: TutorialState, obs: Observation): TutorialView | null {
  if (s.status !== 'active' || !obs.running) return null;
  const index = s.step;
  const id = STEPS[index];
  if (!id) return null;
  const key = (suffix?: string) => `ui.tutorial.${id}${suffix ? `.${suffix}` : ''}`;

  if (id === 'event') {
    // Waits, with the run going, until the first card arrives; then explains it.
    if (!obs.eventPending) return null;
    return FULL(id, index, key(), ['event.choices'], 'next', false, true);
  }
  if (id === 'outro') {
    if (obs.eventShowing) return null;
    return FULL(id, index, key(), [], 'finish', true);
  }
  // Steps 1 to 7 wait behind an event card or its result.
  if (obs.eventShowing) return null;

  switch (id) {
    case 'home':
      if (obs.route !== 'map') return FULL(id, index, key('openMap'), ['tab.map'], 'do', true);
      return FULL(id, index, key(), ['map.home'], 'next', true);
    case 'strip':
      return FULL(id, index, key(), ['shell.hype|shell.resources', 'shell.cash|shell.resources'], 'next', true);
    case 'buyModel':
      if (obs.route !== 'trees') return FULL(id, index, key('openTrees'), ['tab.trees'], 'do', true);
      if (!obs.canBuyRoot && !obs.rootSheetOpen) return FULL(id, index, key('wait'), ['shell.hype|shell.resources'], 'wait', false);
      if (obs.rootSheetOpen) return FULL(id, index, key('confirm'), ['tree.buy'], obs.canBuyRoot ? 'do' : 'wait', obs.canBuyRoot);
      if (!obs.rootVisible) return FULL(id, index, key('pickTree'), ['tree.picker'], 'do', true);
      return FULL(id, index, key('buy'), ['tree.root'], 'do', true);
    case 'buildDc':
      if (obs.route !== 'map') return FULL(id, index, key('openMap'), ['tab.map'], 'do', true);
      if (!obs.canBuildHome) return FULL(id, index, key('wait'), ['shell.cash|shell.resources'], 'wait', false);
      if (obs.homeSheetOpen) return FULL(id, index, key('build'), ['region.build.home'], 'do', true);
      // Either route opens the home panel: a tap on the map, or the Regions button and its list
      // (the list's cut-out appears while it is open).
      return FULL(id, index, key('tapHome'), ['map.home', 'map.regions', 'map.regionList'], 'do', true);
    case 'compute':
      return FULL(id, index, key(), ['shell.compute|shell.resources', 'shell.tier'], 'next', true);
    case 'meters':
      return FULL(id, index, key(), ['shell.meters'], 'next', true);
    case 'speed':
      return FULL(id, index, key(), ['shell.speed', 'shell.ticker'], 'next', true);
    default:
      return null;
  }
}
