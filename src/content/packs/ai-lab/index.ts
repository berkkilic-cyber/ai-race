import type {
  AchievementDef,
  BarrierDef,
  ChannelDef,
  ContentPack,
  DifficultyDef,
  EndingDef,
  EventDef,
  FounderDef,
  HeadlineDef,
  MomentDef,
  NodeDef,
  RegionDef,
  RegionId,
  RivalDef,
  RunLengthDef,
} from '@/engine/types';

import achievements from './achievements.json';
import balance from './balance.json';
import barriers from './barriers.json';
import channels from './channels.json';
import difficulties from './difficulties.json';
import endings from './endings.json';
import events from './events.json';
import founders from './founders.json';
import headlines from './headlines.json';
import map from './map.json';
import moments from './moments.json';
import nodes from './nodes.json';
import regions from './regions.json';
import rivals from './rivals.json';
import runLengths from './runLengths.json';
import en from './strings/en.json';

/**
 * JSON imports widen string literals (e.g. `tree: string`), so each file is
 * asserted to its contract type here. `validatePack` checks the real shape at
 * test time with zod, so these assertions are backed by the validation test.
 */
export const aiLabPack: ContentPack = {
  id: 'ai-lab',
  version: 1,
  regions: regions as unknown as RegionDef[],
  nodes: nodes as unknown as NodeDef[],
  events: events as unknown as EventDef[],
  headlines: headlines as unknown as HeadlineDef[],
  founders: founders as FounderDef[],
  rivals: rivals as RivalDef[],
  endings: endings as unknown as EndingDef[],
  achievements: achievements as unknown as AchievementDef[],
  moments: moments as unknown as MomentDef[],
  barriers: barriers as BarrierDef[],
  channels: channels as ChannelDef[],
  balance,
  difficulties: difficulties as DifficultyDef[],
  defaultDifficulty: 'frontier',
  runLengths: runLengths as RunLengthDef[],
  defaultRunLength: 'full',
  strings: { en: en as Record<string, string> },
};

/**
 * Map helper outside the ContentPack contract: world-atlas countries-110m has a
 * few shapes without an ISO 3166-1 numeric id. They are assigned to regions by
 * their atlas `properties.name` here, so the map can merge them too.
 */
export const aiLabNoIdCountries: Record<string, RegionId> = map.noIdCountries;
