/**
 * A one-way request channel to the world map: "bring this region into easy reach". The
 * tutorial uses it before asking the player to tap their home region; the map zooms in
 * only when the region is small on screen. UI bookkeeping only, nothing here touches the game.
 */

type Listener = (regionId: string) => void;

const listeners = new Set<Listener>();

/** Asks every mounted map to make the region an easy target. */
export function requestMapFocus(regionId: string): void {
  for (const listener of listeners) listener(regionId);
}

/** Subscribes a map to focus requests; returns the unsubscribe function. */
export function onMapFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
