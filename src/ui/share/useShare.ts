import { useCallback, useEffect, useRef, useState } from 'react';

import type { ShareKind } from '@/analytics';

import { trackShareTap } from '../analytics/daily';
import { shareText } from './share';

/** How long "Copied" stays up. */
export const NOTICE_MS = 2500;

/**
 * A share action for a button: tracks the tap, opens the share sheet (or copies on web) and
 * shows "Copied" / "Could not share" for a moment. One timer, no per-frame state.
 */
export function useShare(): { share: (text: string, kind: ShareKind, where: string) => void; notice: 'copied' | 'failed' | null } {
  const [notice, setNotice] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const share = useCallback((text: string, kind: ShareKind, where: string) => {
    trackShareTap(kind, where);
    void shareText(text).then((out) => {
      if (!live.current || (out !== 'copied' && out !== 'failed')) return;
      setNotice(out);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    });
  }, []);
  return { share, notice };
}
