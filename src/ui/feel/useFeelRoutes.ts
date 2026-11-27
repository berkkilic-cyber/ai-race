import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { feedback } from './cues';
import { setMusicForPath } from './music';

/** The game's tab routes (a switch between two of them sounds the tab cue). */
function isGameTab(path: string): boolean {
  return path === '/game' || path.startsWith('/game/');
}

/** Plays the tab cue when the route moves between two game tabs, and keeps the music on the mode's track. Call once, in the root layout. */
export function useFeelRoutes(): void {
  const path = usePathname();
  const last = useRef(path);
  useEffect(() => {
    const prev = last.current;
    last.current = path;
    if (prev !== path && isGameTab(prev) && isGameTab(path)) feedback('tab');
    setMusicForPath(path);
  }, [path]);
}
