import type { ContentPack } from '@/engine';
import { aiLabPack } from '@/content';
import { aiLabGeometry, type MapGeometry } from '@/content/packs/ai-lab/geometry';

export interface PackEntry {
  pack: ContentPack;
  geometry: MapGeometry;
}

/** Every playable theme pack with its map. The only place the UI names a pack. */
const PACKS: Record<string, PackEntry> = {
  [aiLabPack.id]: { pack: aiLabPack, geometry: aiLabGeometry },
};

export const DEFAULT_PACK_ID = aiLabPack.id;

export function getPackEntry(packId: string = DEFAULT_PACK_ID): PackEntry {
  const entry = PACKS[packId];
  if (!entry) throw new Error(`Unknown pack: ${packId}`);
  return entry;
}

export function packIds(): string[] {
  return Object.keys(PACKS);
}
