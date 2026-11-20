import type { NewsTone } from '@/engine';

import { colors } from '../theme';

export const TONE_COLOR: Record<NewsTone, string> = { good: colors.good, bad: colors.bad, neutral: colors.info };
