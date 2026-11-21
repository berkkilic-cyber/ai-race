import { StartScreen } from '@/ui/start';

/**
 * Starts loading the game routes' code as soon as this module runs. On web the static
 * export splits every route into its own chunk; navigating to /game before its chunk is
 * there makes the router try a synchronous require first, which Metro reports as a fatal
 * "Requiring unknown module" (logged as [AI-RACE ERROR]) before it falls back to loading
 * the chunk. Started here, at module evaluation, the import loads the chunks quietly, and
 * the start screen waits for it before entering the game. On native it resolves at once.
 */
const gameRoutes: Promise<unknown> = Promise.all([import('./game/_layout'), import('./game/index'), import('./game/trees'), import('./game/news'), import('./game/race')]).catch(() => undefined);

export default function StartRoute() {
  return <StartScreen beforeEnter={gameRoutes} />;
}
