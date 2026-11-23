/// <reference types="node" />
/**
 * First-session timing: a fresh install's first run (the run length and difficulty a
 * first-time player gets preselected: the first of each), with a player who follows the
 * tutorial's prompts promptly. Drives the real tutorial state machine (src/ui/tutorial/machine.ts)
 * against the engine on a simulated clock:
 *
 * - a caption takes READ_BASE + words / WORDS_PER_SECOND seconds to read, then a tap
 *   (TAP_SECONDS) for its Next button or the action it asks for;
 * - the game runs at TICKS_PER_SECOND (1x) whenever the tutorial does not pause it;
 * - an event card takes CARD_SECONDS (the clock stops while it is up);
 * - after the tutorial the player plays like the sensible bot (decisions every
 *   aiDecisionInterval ticks, same as runHeadless) and taps no moments.
 *
 *   npx esbuild scripts/balance/firstSession.ts --bundle --platform=node --format=esm --alias:@=./src \
 *     --log-level=warning --outfile=node_modules/.cache/balance/first.mjs && node node_modules/.cache/balance/first.mjs [--seeds 60] [--runLength sprint] [--difficulty sandbox]
 */
import { aiLabPack } from '@/content';
import {
  applyAction,
  canApply,
  chooseAiActions,
  chooseEventChoice,
  createGame,
  getBalance,
  getDifficulties,
  getRunLengths,
  step,
  type Action,
  type GameState,
} from '@/engine';
import { INITIAL, loaded, next as nextStep, observe, view, type Observation, type TutorialState } from '@/ui/tutorial/machine';
import tutorialStrings from '@/ui/strings/tutorial.en.json';

const TICKS_PER_SECOND = 2;
const READ_BASE = 0.8;
const WORDS_PER_SECOND = 4.5;
const TAP_SECONDS = 0.7;
const CARD_SECONDS = 8;

const PACK = aiLabPack;
const FOUNDERS = PACK.founders.map((f) => f.id);
const HOMES = ['canada', 'india', 'brazil', 'nordics', 'nigeria', 'japan', 'mexico', 'turkiye'].filter((id) => PACK.regions.some((r) => r.id === id));

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const SEEDS = Number(arg('seeds', '60'));
const RUN_LENGTH = arg('runLength', getRunLengths(PACK)[0]?.id ?? '');
const DIFFICULTY = arg('difficulty', getDifficulties(PACK)[0]?.id ?? '');
const ROOT = PACK.nodes.find((n) => n.tree === 'capability' && n.requires.length === 0)!.id;

function readSeconds(key: string): number {
  const text = (tutorialStrings as Record<string, string>)[key] ?? '';
  return READ_BASE + text.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND;
}

interface Times {
  firstPurchase: number | null;
  firstModelLaunch: number | null;
  firstDataCentre: number | null;
  firstRegionLaunch: number | null;
  tutorialDone: number | null;
  ending: number | null;
  endingKind: string | null;
  ticks: number;
  cards: number;
}

function play(seed: number): Times {
  const founderId = FOUNDERS[seed % FOUNDERS.length];
  const homeRegion = HOMES[seed % HOMES.length];
  let state: GameState = createGame(PACK, { playerName: 'First Lab', founderId, homeRegion, seed, difficulty: DIFFICULTY, runLength: RUN_LENGTH });
  const me = state.playerLabId;
  const interval = Math.max(1, Math.round(getBalance(state, PACK).aiDecisionInterval));
  let tut: TutorialState = loaded(INITIAL, false);
  const ui = { route: 'map' as Observation['route'], treeOpen: false, rootSheet: false, homeSheet: false };
  let clock = 0;
  let readingKey: string | null = null;
  let readUntil = 0;
  const times: Times = { firstPurchase: null, firstModelLaunch: null, firstDataCentre: null, firstRegionLaunch: null, tutorialDone: null, ending: null, endingKind: null, ticks: 0, cards: 0 };

  const apply = (action: Action) => {
    const r = applyAction(state, PACK, action);
    if (!r.ok) return false;
    state = r.state;
    if (action.type === 'buyNode' || action.type === 'buildDataCentre' || action.type === 'launchInRegion' || action.type === 'upgradeDataCentre') times.firstPurchase ??= clock;
    if (action.type === 'buildDataCentre') times.firstDataCentre ??= clock;
    if (action.type === 'launchInRegion') times.firstRegionLaunch ??= clock;
    return true;
  };
  const obs = (): Observation => {
    const lab = state.labs[me];
    return {
      running: state.status === 'running',
      seed: state.seed,
      eventPending: state.pendingEvent !== null,
      eventShowing: state.pendingEvent !== null,
      route: ui.route,
      rootVisible: ui.route === 'trees' && ui.treeOpen,
      rootSheetOpen: ui.rootSheet,
      rootOwned: lab.ownedNodes.includes(ROOT),
      canBuyRoot: canApply(state, PACK, { type: 'buyNode', labId: me, nodeId: ROOT }).ok,
      dataCentres: lab.dataCentres.length,
      canBuildHome: canApply(state, PACK, { type: 'buildDataCentre', labId: me, regionId: homeRegion }).ok,
      homeSheetOpen: ui.homeSheet,
    };
  };
  const resolveCard = () => {
    const choice = chooseEventChoice(state, PACK, me);
    clock += CARD_SECONDS;
    times.cards++;
    if (choice !== undefined) apply({ type: 'resolveEvent', labId: me, choiceId: choice });
  };
  const tick = () => {
    const before = state.news.length;
    state = step(state, PACK);
    clock += 1 / TICKS_PER_SECOND;
    for (let i = before; i < state.news.length; i++) if (state.news[i].kind === 'launch' && state.news[i].labId === me) times.firstModelLaunch ??= clock;
    // news is capped; also catch the first tier from the lab's flags
    if (times.firstModelLaunch === null && state.labs[me].flags.some((f) => f.startsWith('$launched:'))) times.firstModelLaunch = clock;
  };

  // ── Tutorial ──
  for (let guard = 0; guard < 20000 && state.status === 'running' && tut.status !== 'done'; guard++) {
    tut = observe(tut, obs());
    const v = view(tut, obs());
    if (!v) {
      if (state.pendingEvent) resolveCard();
      else tick();
      continue;
    }
    if (readingKey !== v.captionKey) {
      readingKey = v.captionKey;
      readUntil = clock + readSeconds(v.captionKey);
    }
    if (v.action === 'wait') {
      tick();
      continue;
    }
    if (clock < readUntil) {
      // Reading: the clock moves (a paused caption stops the game, an unpaused one does not).
      if (v.pause) clock = readUntil;
      else tick();
      continue;
    }
    clock += TAP_SECONDS;
    if (v.action === 'next' || v.action === 'finish') {
      if (v.step === 'event') {
        tut = nextStep(tut, obs());
        resolveCard();
      } else tut = nextStep(tut, obs());
      readingKey = null;
      continue;
    }
    const key = v.captionKey.replace('ui.tutorial.', '');
    if (key.endsWith('openMap')) ui.route = 'map';
    else if (key === 'buyModel.openTrees') ui.route = 'trees';
    else if (key === 'buyModel.pickTree') ui.treeOpen = true;
    else if (key === 'buyModel.buy') ui.rootSheet = true;
    else if (key === 'buyModel.confirm') {
      apply({ type: 'buyNode', labId: me, nodeId: ROOT });
      ui.rootSheet = false;
    } else if (key === 'buildDc.tapHome') ui.homeSheet = true;
    else if (key === 'buildDc.build') {
      apply({ type: 'buildDataCentre', labId: me, regionId: homeRegion });
      ui.homeSheet = false;
    }
    readingKey = null;
  }
  times.tutorialDone = tut.status === 'done' ? clock : null;

  // ── The rest of the run: the sensible bot at 1x ──
  while (state.status === 'running' && state.tick < 20000) {
    if (state.pendingEvent) resolveCard();
    if (state.tick % interval === 0) for (const action of chooseAiActions(state, PACK, me)) apply(action);
    tick();
  }
  times.ending = state.status === 'ended' ? clock : null;
  times.endingKind = state.ending?.kind ?? null;
  times.ticks = state.tick;
  return times;
}

function pctl(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))];
}

const runs = Array.from({ length: SEEDS }, (_, i) => play(1000 + i));
const row = (label: string, pick: (t: Times) => number | null, unit: 'seconds' | 'minutes' = 'seconds') => {
  const values = runs.map(pick).filter((v): v is number => v !== null);
  const f = (v: number | null) => (v === null ? '-' : unit === 'minutes' ? (v / 60).toFixed(1) : v.toFixed(0));
  return `| ${label} | ${values.length}/${runs.length} | ${f(pctl(values, 10))} | ${f(pctl(values, 50))} | ${f(pctl(values, 90))} |`;
};
console.log(`First session: run length ${RUN_LENGTH || 'none'}, difficulty ${DIFFICULTY || 'none'}, ${SEEDS} seeds (founders and homes rotate).`);
console.log(`Model: read ${READ_BASE} s + ${WORDS_PER_SECOND} words/s per caption, ${TAP_SECONDS} s per tap, ${CARD_SECONDS} s per event card, ${TICKS_PER_SECOND} ticks/s at 1x.\n`);
console.log('| Milestone | Reached | p10 | p50 | p90 |');
console.log('| --- | --- | --- | --- | --- |');
console.log(row('First purchase (s)', (t) => t.firstPurchase));
console.log(row('First data centre (s)', (t) => t.firstDataCentre));
console.log(row('First model launch, tier 1 running (s)', (t) => t.firstModelLaunch));
console.log(row('First region launch for Cash (s)', (t) => t.firstRegionLaunch));
console.log(row('Tutorial finished (s)', (t) => t.tutorialDone));
console.log(row('Ending (min)', (t) => t.ending, 'minutes'));
const wins = runs.filter((r) => r.endingKind === 'win').length;
console.log(`\nWins ${wins}/${runs.length}; median ticks ${pctl(runs.map((r) => r.ticks), 50)}; median event cards ${pctl(runs.map((r) => r.cards), 50)}.`);
