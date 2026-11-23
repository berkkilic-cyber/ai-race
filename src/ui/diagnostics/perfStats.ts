import { Platform } from 'react-native';

/**
 * Numbers for the performance readout (PerfHud): plain module counters, no React state and
 * no work while the readout is off, apart from two clock reads per game tick.
 *
 * - Tick cost: the store's tick() reports its time (engine step, and step plus the store
 *   listeners, which run every selector of every mounted component).
 * - React commits: counted through React's DevTools hook when one exists (development
 *   builds on a device, and web pages opened by scripts/screens/perf.js). A production
 *   build on a device has none, and the readout shows a dash.
 * - Frame rate and the slowest frame: a requestAnimationFrame loop on the JS thread, only
 *   while the readout is on. A frame that takes long here is time the JS thread was busy
 *   (React, the store, the engine), which is what makes touches and JS-driven updates lag.
 * - SVG elements: counted in the page, on web only.
 */

const clock: () => number = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();

export function perfNow(): number {
  return clock();
}

let lastStepMs = 0;
let lastTickMs = 0;
let maxTickMs = 0;

/** Called by the store after each tick: engine step alone, and step plus store listeners. */
export function noteTick(stepMs: number, totalMs: number): void {
  lastStepMs = stepMs;
  lastTickMs = totalMs;
  if (totalMs > maxTickMs) maxTickMs = totalMs;
}

let commits = 0;
let ownCommits = 0;
let hooked: 'yes' | 'no' | null = null;

interface DevtoolsHook {
  onCommitFiberRoot?: (...args: unknown[]) => unknown;
}

/** Wraps the DevTools hook's commit callback once, to count commits. */
function hookCommits(): void {
  if (hooked) return;
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook || typeof hook.onCommitFiberRoot !== 'function') {
    hooked = 'no';
    return;
  }
  const original = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function onCommitFiberRoot(this: unknown, ...args: unknown[]) {
    commits++;
    return original.apply(this, args);
  };
  hooked = 'yes';
}

/** The debug overlay's own renders (it polls), so they can be left out of the commit rate. */
export function noteOverlayCommit(): void {
  ownCommits++;
}

const WINDOW_S = 5;

let running = false;
let frameId: number | null = null;
let lastFrame = 0;
let frames = 0;
/** Slowest frame per second for the last WINDOW_S seconds (ring). */
const slowest: number[] = [];
let currentSlowest = 0;

function onFrame(t: number): void {
  if (!running) return;
  if (lastFrame > 0) {
    const dt = t - lastFrame;
    if (dt > currentSlowest) currentSlowest = dt;
  }
  lastFrame = t;
  frames++;
  frameId = requestAnimationFrame(onFrame);
}

export function startPerfSampling(): void {
  if (running) return;
  hookCommits();
  running = true;
  lastFrame = 0;
  frames = 0;
  currentSlowest = 0;
  slowest.length = 0;
  frameId = requestAnimationFrame(onFrame);
}

export function stopPerfSampling(): void {
  running = false;
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
}

export interface PerfSnapshot {
  /** Frames per second on the JS thread since the last snapshot. */
  fps: number;
  /** Slowest JS frame in the last 5 seconds, ms. */
  slowestMs: number;
  /** React commits per second (without the overlay's own), or null when they cannot be counted. */
  commitsPerSec: number | null;
  /** Last tick: step plus store listeners, engine step alone, and the worst since the last snapshot, ms. */
  tickMs: number;
  stepMs: number;
  maxTickMs: number;
  /** SVG elements in the page (web only, else null). */
  svg: number | null;
}

let lastSnap = 0;
let lastCommits = 0;
let lastOwn = 0;

/** Rates since the previous call; call about once a second while the readout is on. */
export function takePerfSnapshot(): PerfSnapshot {
  const now = clock();
  const secs = lastSnap > 0 ? Math.max(0.001, (now - lastSnap) / 1000) : 1;
  slowest.push(currentSlowest);
  if (slowest.length > WINDOW_S) slowest.shift();
  const snap: PerfSnapshot = {
    fps: lastSnap > 0 ? frames / secs : 0,
    slowestMs: Math.max(0, ...slowest),
    commitsPerSec: hooked === 'yes' && lastSnap > 0 ? Math.max(0, commits - lastCommits - (ownCommits - lastOwn)) / secs : null,
    tickMs: lastTickMs,
    stepMs: lastStepMs,
    maxTickMs,
    svg: Platform.OS === 'web' && typeof document !== 'undefined' ? document.querySelectorAll('svg *').length : null,
  };
  frames = 0;
  currentSlowest = 0;
  maxTickMs = 0;
  lastSnap = now;
  lastCommits = commits;
  lastOwn = ownCommits;
  return snap;
}
