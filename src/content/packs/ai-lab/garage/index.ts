import type { GarageContent } from '@/idle';

import data from './garage.json';
import strings from './strings.en.json';

/**
 * The ai-lab theme's Garage (idle clicker) content: generators, upgrades, model
 * generations, events, offers, achievements and Lab Rep perks as data (garage.json), and
 * its English text (strings.en.json). Validated by validateGarage in the tests.
 */
export const aiLabGarage: GarageContent = { ...(data as unknown as Omit<GarageContent, 'strings'>), strings };
