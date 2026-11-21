import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Touch diagnostics for the maps: the last touch, the responder callbacks that fired, the
 * hit-tested region and the view. Recorded always (plain object writes, no React work);
 * shown only while the debug overlay is on. The overlay is toggled by a two-second long
 * press on the build stamp or the mascot and stays on for the session (module memory).
 */

export interface TouchDebugInfo {
  /** Which map wrote last ('game' or 'picker'). */
  map: string;
  /** Raw values of the last touch event (the touch that changed). */
  raw: { pageX: number; pageY: number; locationX: number; locationY: number } | null;
  /** The same touch in touch-view coordinates, as the controller used it. */
  local: { x: number; y: number } | null;
  /** Origin of the touch view in page coordinates: from the grant (page - location) and from measureInWindow. */
  origin: { x: number; y: number } | null;
  measured: { x: number; y: number } | null;
  touches: number;
  /** The active touches as the controller saw them: "id:x,y" in touch-view points. */
  list: string;
  phase: string;
  /** Responder callbacks in firing order, newest last, with counts. */
  callbacks: { name: string; count: number }[];
  /** Last tap: hit-tested region id (or 'none' for sea). */
  region: string | null;
  view: { s: number; tx: number; ty: number };
  layout: { w: number; h: number };
  taps: number;
}

const info: TouchDebugInfo = {
  map: '-',
  raw: null,
  local: null,
  origin: null,
  measured: null,
  touches: 0,
  list: '',
  phase: 'idle',
  callbacks: [],
  region: null,
  view: { s: 1, tx: 0, ty: 0 },
  layout: { w: 0, h: 0 },
  taps: 0,
};

let enabled = false;
const listeners = new Set<() => void>();

/** The live record (mutated in place; read it, do not keep copies). */
export function touchDebugInfo(): TouchDebugInfo {
  return info;
}

/** Records a responder callback (the list keeps the last eight names, repeats counted). */
export function noteCallback(name: string): void {
  const last = info.callbacks[info.callbacks.length - 1];
  if (last && last.name === name) last.count++;
  else {
    info.callbacks.push({ name, count: 1 });
    if (info.callbacks.length > 8) info.callbacks.shift();
  }
}

export function recordTouch(partial: Partial<TouchDebugInfo>): void {
  Object.assign(info, partial);
}

export function isTouchDebugOn(): boolean {
  return enabled;
}

export function setTouchDebug(on: boolean): void {
  if (enabled === on) return;
  enabled = on;
  for (const l of listeners) l();
}

export function toggleTouchDebug(): void {
  setTouchDebug(!enabled);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTouchDebugOn(): boolean {
  return useSyncExternalStore(subscribe, () => enabled, () => enabled);
}

/** Re-renders every `ms` while `on` (the overlay polls the record instead of rendering per move). */
export function usePoll(on: boolean, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(timer);
  }, [on, ms]);
  return n;
}
