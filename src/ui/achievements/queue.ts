/** A queued achievement toast. `key` is unique per toast so the same id can show again in a new run. */
export interface Toast {
  key: number;
  achievementId: string;
}

/** Toasts waiting or showing; the first one is on screen unless the host is blocked. */
export interface ToastQueue {
  toasts: readonly Toast[];
  nextKey: number;
}

export const EMPTY_QUEUE: ToastQueue = { toasts: [], nextKey: 1 };

/** Ids in `next` that are not in `prev`, in the order they were earned. */
export function newAchievementIds(prev: readonly string[], next: readonly string[]): string[] {
  if (prev === next) return [];
  const had = new Set(prev);
  return next.filter((id) => !had.has(id));
}

/** Appends toasts for the given achievement ids, skipping ids already queued. */
export function enqueueToasts(queue: ToastQueue, ids: readonly string[]): ToastQueue {
  const queued = new Set(queue.toasts.map((toast) => toast.achievementId));
  let nextKey = queue.nextKey;
  const added: Toast[] = [];
  for (const id of ids) {
    if (queued.has(id)) continue;
    queued.add(id);
    added.push({ key: nextKey++, achievementId: id });
  }
  if (added.length === 0) return queue;
  return { toasts: [...queue.toasts, ...added], nextKey };
}

/** The toast to show now: the oldest one, or none while blocked (e.g. an event card is up). */
export function currentToast(queue: ToastQueue, blocked: boolean): Toast | null {
  return blocked ? null : (queue.toasts[0] ?? null);
}

/** Removes the toast with `key` (after it has been shown). */
export function dismissToast(queue: ToastQueue, key: number): ToastQueue {
  const toasts = queue.toasts.filter((toast) => toast.key !== key);
  return toasts.length === queue.toasts.length ? queue : { ...queue, toasts };
}
