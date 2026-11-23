import { aiLabGarage, aiLabGarageStrings } from '@/content/packs/ai-lab/garage';
import type { GarageContent } from '@/idle';

import { getCurrentLocale } from '../locale/current';

const byLocale = new Map<string, GarageContent>();

/**
 * The Garage content of the active theme (one theme today) in the active language, keys the
 * language lacks filled from English. The only place the UI names it.
 */
export function garageContent(): GarageContent {
  const locale = getCurrentLocale();
  const own = aiLabGarageStrings[locale];
  if (!own || own === aiLabGarage.strings) return aiLabGarage;
  let content = byLocale.get(locale);
  if (!content) {
    content = { ...aiLabGarage, strings: { ...aiLabGarage.strings, ...own } };
    byLocale.set(locale, content);
  }
  return content;
}
