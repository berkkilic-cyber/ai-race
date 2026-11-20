import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useGameStore } from '../store/game';

/** Sends the player to /end when the run ends, and to / when there is no run. */
export function useEndNavigation(): void {
  const router = useRouter();
  const status = useGameStore((s) => s.state?.status ?? null);
  useEffect(() => {
    if (status === 'ended') router.replace('/end');
    else if (status === null) router.replace('/');
  }, [status, router]);
}
