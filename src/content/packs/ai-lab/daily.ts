import type { DailyContent } from '../../daily';

import daily from './daily.json';

/**
 * The ai-lab theme's daily challenge: the epoch of daily number 1, the run length, the fair
 * home regions and the twists (start bonuses and rival lists only, see src/content/daily.ts).
 * Its text (twists, share phrases, front-page templates) is in strings/en.json and tr.json.
 * Validated by validateDaily in src/content/__tests__/daily.test.ts.
 */
export const aiLabDaily: DailyContent = daily as DailyContent;
