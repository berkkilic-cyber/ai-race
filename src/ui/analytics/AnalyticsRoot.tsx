import { usePathname } from 'expo-router';
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { countAnalyticsError, track } from '@/analytics';

import { useGameStore } from '../store/game';
import { AnalyticsDebugSection } from './AnalyticsDebugSection';
import { getAnalyticsRuntime, installAnalytics } from './install';
import { flushTaps, quitRun } from './subscriptions';

/** What a route change means for analytics (pure, tested). */
export function routeEvents(prev: string | null, next: string): { mode: 'race' | 'garage' | null; garageOpen: boolean; leftGarage: boolean; leftRaceForMenu: boolean } {
  const isGame = (p: string | null) => p === '/game' || !!p?.startsWith('/game/');
  return {
    mode: prev === '/' && next === '/garage' ? 'garage' : prev === '/' && isGame(next) ? 'race' : null,
    garageOpen: next === '/garage' && prev !== '/garage',
    leftGarage: prev === '/garage' && next !== '/garage',
    leftRaceForMenu: isGame(prev) && next === '/',
  };
}

function useRouteTracking(): void {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (pathname === prev.current) return;
    const r = routeEvents(prev.current, pathname);
    if (r.leftGarage) flushTaps();
    if (r.leftRaceForMenu) quitRun(useGameStore.getState().state, 'menu');
    track({ name: 'screen_view', params: { screen: pathname } });
    if (r.mode) track({ name: 'mode_select', params: { mode: r.mode } });
    if (r.garageOpen) track({ name: 'garage_open' });
    prev.current = pathname;
  }, [pathname]);
}

function useAppStateSessions(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const rt = getAnalyticsRuntime();
      if (!rt) return;
      if (next === 'background') {
        flushTaps();
        rt.session.background();
      } else if (next === 'active') rt.session.foreground();
    });
    return () => sub.remove();
  }, []);
}

function Wiring() {
  // Installed during the first render so the first screen_view already has a provider.
  installAnalytics();
  useRouteTracking();
  useAppStateSessions();
  return <AnalyticsDebugSection />;
}

/** Analytics never takes the app down: a render error here hides it for the session. */
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    countAnalyticsError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The analytics layer's one mount (app/_layout.tsx): installs providers and store
 * subscriptions, starts and ends sessions from AppState, tracks screens from the router,
 * and hosts the debug view's Analytics section. Renders nothing else.
 */
export function AnalyticsRoot() {
  return (
    <Guard>
      <Wiring />
    </Guard>
  );
}
