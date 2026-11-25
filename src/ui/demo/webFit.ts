/**
 * Browser fit for the demo (web only): no text selection, no scroll bounce or pull-to-refresh,
 * and keyboard shortcuts during a run (space: pause / resume, 1 / 2 / 3: speed). The
 * letterbox itself is the demo's wrapper page (scripts/demo/wrapper.html), which sizes the
 * game's frame, so the game's own layout maths see the real box.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useGameStore, type Speed } from '../store/game';
import { colors } from '../theme';

const STYLE_ID = 'demo-web-fit';

/** The CSS the demo adds to the page. */
export function webFitCss(bg: string): string {
  return [
    `html,body{background:${bg};overscroll-behavior:none;}`,
    'body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation;}',
    'input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}',
  ].join('\n');
}

/** What a key does to the run's speed: the new speed, or null when the key is not a shortcut. */
export function speedForKey(key: string, speed: Speed, lastRunning: Speed): Speed | null {
  if (key === ' ' || key === 'Spacebar') return speed === 0 ? (lastRunning === 0 ? 1 : lastRunning) : 0;
  if (key === '1' || key === '2' || key === '3') return Number(key) as Speed;
  return null;
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
}

export function useWebFit(on: boolean): void {
  useEffect(() => {
    if (!on || Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = webFitCss(colors.bg);
      document.head.appendChild(style);
    }
    let lastRunning: Speed = 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const { state, speed, setSpeed } = useGameStore.getState();
      if (!state || state.status !== 'running' || !/\/game/.test(window.location.pathname)) return;
      const next = speedForKey(e.key, speed, lastRunning);
      if (next === null) return;
      e.preventDefault();
      if (speed !== 0) lastRunning = speed;
      setSpeed(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);
}
