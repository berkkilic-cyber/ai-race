import { track } from '@/analytics';

import { useGarageStore } from '../garage/store';
import { streakView } from '../missions/logic';
import { useMissionsStore } from '../missions/store';

const HOUR_MS = 3_600_000;
const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * The comeback habits (task 32): a return from time away with its away storage, daily
 * missions completed and claimed, the daily crate, streak days, and Paradigm Shifts. Each
 * handler compares a reference or a number per store change and tracks only on a discrete
 * change; nothing is sent per tick.
 */
export function subscribeHabits(): () => void {
  const offGarage = useGarageStore.subscribe((st, prev) => {
    const a = st.state;
    const b = prev.state;
    if (!a || a === b) return;
    const report = a.offline;
    // A new away report (or a longer one on top of an unread report).
    if (report && b && (b.offline === null || report.awayMs > b.offline.awayMs) && a.createdAt === b.createdAt) {
      const awayMs = b.offline ? report.awayMs - b.offline.awayMs : report.awayMs;
      track({ name: 'away_return', params: { hoursAway: tenth(awayMs / HOUR_MS), capped: report.capped === true, capacityHours: tenth((report.capMs ?? 0) / HOUR_MS) } });
    }
  });
  const offMissions = useMissionsStore.subscribe((st, prev) => {
    const a = st.save.today;
    const b = prev.save.today;
    if (a === b && st.save.streak === prev.save.streak) return;
    if (a && b && a.day === b.day) {
      for (const id of a.done) if (!b.done.includes(id)) track({ name: 'mission_complete', params: { id } });
      for (const id of a.claimed) if (!b.claimed.includes(id)) track({ name: 'mission_claim', params: { id } });
      if (a.crate && !b.crate) track({ name: 'daily_crate_claim', params: { streak: streakView(st.save.streak, a.day).current } });
    }
    if (st.save.streak.lastDay !== prev.save.streak.lastDay && st.loaded && prev.loaded) track({ name: 'streak_day', params: { streak: st.save.streak.current, usedDayOff: st.lastUsedDayOff } });
  });
  return () => {
    offGarage();
    offMissions();
  };
}
