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
  useWebFit(on);
  if (!on) return null;
  return (
    <>
      <DemoGateCard />
      <RotateHint />
    </>
  );
}
