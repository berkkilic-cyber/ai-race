/**
 * What the live map draws for a theme pack, as data: which owned nodes put objects on the
 * map, which icon a spread channel travels with, and which barriers count as a long
 * crossing worth showing for rivals. Another pack supplies its own entry; a pack without
 * one gets no objects and plain route icons.
 */

/** Where a node's map object stands. */
export type ObjectPlacement = 'strongest' | 'strictest';

export interface MapObjectRule {
  /** Icon name (src/ui/icons). */
  icon: string;
  /** strongest: the player's regions with most users; strictest: the strictest regions where the player is present. */
  place: ObjectPlacement;
  /** How many regions get one. Several rules with the same icon take the largest count. */
  count: number;
}

export interface MapLiveConfig {
  /** Node id -> map object shown while the player owns the node. */
  objects: Record<string, MapObjectRule>;
  /** Channel id (or its prefix before ':') -> icon that travels along the route. */
  channelIcons: Record<string, string>;
  /** Barrier ids whose crossing is a long jump (drawn higher, shown for rivals too). */
  crossings: string[];
  /** Channel ids that are word-of-mouth jumps (drawn dashed). Channels of kind 'jump' count too. */
  viral: string[];
}

/** By pack id. Node ids follow the icon-name convention (an upgrade's icon is named by its node id). */
export const MAP_LIVE_CONFIGS: Record<string, MapLiveConfig> = {
  'ai-lab': {
    objects: {
      'cap-robotics': { icon: 'robot', place: 'strongest', count: 3 },
      'shadow-lobbying': { icon: 'lobbyist', place: 'strictest', count: 2 },
      'shadow-capture': { icon: 'lobbyist', place: 'strictest', count: 4 },
    },
    channelIcons: {
      ocean: 'channel-ocean',
      language: 'channel-language',
      strict: 'channel-strict',
      viral: 'channel-viral',
      open: 'channel-open',
    },
    crossings: ['ocean'],
    viral: ['viral'],
  },
};

export const EMPTY_CONFIG: MapLiveConfig = { objects: {}, channelIcons: {}, crossings: [], viral: [] };

export function mapLiveConfig(packId: string): MapLiveConfig {
  return MAP_LIVE_CONFIGS[packId] ?? EMPTY_CONFIG;
}

/** Icon for a channel id ("language:spanish" falls back to "language"). */
export function channelIcon(config: MapLiveConfig, channelId: string): string {
  return config.channelIcons[channelId] ?? config.channelIcons[channelId.split(':')[0]] ?? 'launch';
}

/** Icon for a barrier: the icon of the channel family with the same id, else a lock. */
export function barrierIcon(config: MapLiveConfig, barrierId: string): string {
  return config.channelIcons[barrierId] ?? config.channelIcons[barrierId.split(':')[0]] ?? 'lock';
}
