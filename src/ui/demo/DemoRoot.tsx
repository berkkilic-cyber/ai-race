import { useLocale } from '../locale/store';
import { isDemo } from './config';
import { DemoGateCard } from './DemoGateCard';
import { RotateHint } from './RotateHint';
import { useWebFit } from './webFit';

/**
 * Demo mode's root layer, mounted once in app/_layout.tsx: the "In the full game" card, the
 * rotate hint and the browser fit. Renders nothing and does nothing in the full game.
 */
export function DemoRoot() {
  const on = isDemo();
  // Outside the router's remount on a language change: re-render the card and hint with it.
  useLocale();
  useWebFit(on);
  if (!on) return null;
  return (
    <>
      <DemoGateCard />
      <RotateHint />
    </>
  );
}
