import type { GarageContent } from '@/idle';

import data from './garage.json';
import strings from './strings.en.json';
import stringsTr from './strings.tr.json';

/**
 * The ai-lab theme's Garage (idle clicker) content: generators, upgrades, model
 * generations, events, offers, achievements and Lab Rep perks as data (garage.json), and
 * its English text (strings.en.json). Validated by validateGarage in the tests.
 */
export const aiLabGarage: GarageContent = { ...(data as unknown as Omit<GarageContent, 'strings'>), strings };

/**
 * The Garage text per locale, English (complete) first. Other locales may lack keys; the UI
 * fills them from English (src/ui/garage/content.ts).
 */
export const aiLabGarageStrings: Record<string, Record<string, string>> = { en: strings, tr: stringsTr as Record<string, string> };
