import type { ContentPack } from '@/engine';
import { aiLabDaily, aiLabPack, type DailyContent } from '@/content';
import { aiLabGeometry, type MapGeometry } from '@/content/packs/ai-lab/geometry';
import { aiLabLabNames } from '@/content/packs/ai-lab/labNames';

export interface PackEntry {
  pack: ContentPack;
  geometry: MapGeometry;
  /** Parody lab names for the start screen's random-name button. */
  labNames: readonly string[];
  /** The daily challenge and front page content (src/ui/daily); absent = no daily for this theme. */
  daily?: DailyContent;
}

/** Every playable theme pack with its map. The only place the UI names a pack. */
const PACKS: Record<string, PackEntry> = {
  [aiLabPack.id]: { pack: aiLabPack, geometry: aiLabGeometry, labNames: aiLabLabNames, daily: aiLabDaily },
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
