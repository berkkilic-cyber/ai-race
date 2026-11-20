import type { TreeId } from '@/engine';

import { colors } from '../theme';

/** Accent colour per tree, from existing theme tokens. Dark text (`colors.onPlayer`) reads on all three. */
export const TREE_ACCENT: Record<TreeId, string> = {
  capability: colors.info,
  reach: colors.good,
  shadow: colors.bad,
};
