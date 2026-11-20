import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Where the tutorial's coach marks point. Screens register the views it can point at
 * (one line: `ref={useTutorialTarget('shell.speed')}`); the tutorial host measures them in
 * window coordinates when it needs to. Registration is UI bookkeeping only: nothing here
 * reads or changes the game.
 */

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MeasureTarget = () => Promise<TargetRect | null>;

const targets = new Map<string, MeasureTarget>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const listener of listeners) listener();
}

/** Registers a target; returns the unregister function (only removes this registration). */
export function registerTarget(id: string, measure: MeasureTarget): () => void {
  targets.set(id, measure);
  changed();
  return () => {
    if (targets.get(id) === measure) {
      targets.delete(id);
      changed();
    }
  };
}

export function hasTarget(id: string): boolean {
  return targets.has(id);
}

/** Ids currently registered (for tests and debugging). */
export function targetIds(): string[] {
  return [...targets.keys()];
}

/** A usable rect: finite, non-negative size. */
export function validRect(r: TargetRect | null | undefined): r is TargetRect {
  return !!r && [r.x, r.y, r.width, r.height].every((v) => typeof v === 'number' && Number.isFinite(v)) && r.width > 0 && r.height > 0;
}

/** Measures a target in window coordinates; null when it is not registered or not laid out. */
export async function measureTarget(id: string): Promise<TargetRect | null> {
  const measure = targets.get(id);
  if (!measure) return null;
  try {
    const r = await measure();
    return validRect(r) ? r : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders when targets come and go; returns a counter that changes with them. */
export function useTargetsVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

interface Measurable {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

/** Window rect of a native view (or a DOM node on web). */
export function measureView(node: Measurable | null): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    try {
      node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Ref callback that registers the view as tutorial target `id` while it is mounted.
 * Pass null to register nothing.
 */
export function useTutorialTarget(id: string | null): (node: unknown) => (() => void) | undefined {
  return useCallback(
    (node: unknown) => {
      if (!id || !node) return undefined;
      return registerTarget(id, () => measureView(node as Measurable));
    },
    [id],
  );
}

/** Registers a target with a custom measure (e.g. a point on the map). Null registers nothing. */
export function useTutorialTargetMeasure(id: string | null, measure: MeasureTarget | null): void {
  useEffect(() => {
    if (!id || !measure) return;
    return registerTarget(id, measure);
  }, [id, measure]);
}
