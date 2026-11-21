import { aiLabGarage } from '@/content/packs/ai-lab/garage';
import type { GarageContent } from '@/idle';

/** The Garage content of the active theme (one theme today). The only place the UI names it. */
export function garageContent(): GarageContent {
  return aiLabGarage;
}
