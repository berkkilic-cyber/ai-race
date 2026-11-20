/**
 * Per-record bookkeeping shared by the derived values and the tick workspace: which
 * adoption records were changed outside the lab phase, and the users of each record as
 * of its last sync. Lives in its own module so derived.ts and workspace.ts do not import
 * each other.
 */

/**
 * Adoption records changed outside the tick's lab phase since they were last synced
 * (setAdoption marks them). Lets a reused workspace skip reloading unchanged labs.
 */
const changedRecords = new WeakSet<Record<string, number>>();

/** Users (millions) of each adoption record as of the last storeWorkspace, valid while the record is unchanged. */
const usersCache = new WeakMap<Record<string, number>, number>();

export function markAdoptionChanged(record: Record<string, number>): void {
  changedRecords.add(record);
}

/** True when the record was changed outside the lab phase since it was last synced. */
export function isAdoptionChanged(record: Record<string, number>): boolean {
  return changedRecords.has(record);
}

/** Marks the record as synced with the workspace again. */
export function clearAdoptionChanged(record: Record<string, number>): void {
  changedRecords.delete(record);
}

/** Remembers the users of a record that was just synced. */
export function setCachedUsers(record: Record<string, number>, users: number): void {
  usersCache.set(record, users);
}

/** Users of an adoption record if known since its last change (see storeWorkspace), else undefined. */
export function cachedUsers(record: Record<string, number>): number | undefined {
  return changedRecords.has(record) ? undefined : usersCache.get(record);
}
