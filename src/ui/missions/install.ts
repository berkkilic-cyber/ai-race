import { installMissionsDebug } from './debug';
import { installMissions } from './store';

/** Starts the missions' tracking (once) and, on web debug pages, `window.__missions`. */
export function startMissions(): void {
  installMissions();
  installMissionsDebug();
}
