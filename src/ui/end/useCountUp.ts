import { useEffect, useState } from 'react';

const canAnimate = () => typeof requestAnimationFrame === 'function';

/** Counts from 0 up to `target` over `ms` with an ease-out, then holds. */
export function useCountUp(target: number, ms = 1400): number {
  const [value, setValue] = useState(0);
  const animate = canAnimate() && target > 0;
  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    let start: number | null = null;
    const tickFrame = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tickFrame);
    };
    frame = requestAnimationFrame(tickFrame);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, ms]);
  return animate ? value : target;
}
