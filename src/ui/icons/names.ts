/** Every icon name, by group. `IconName` is the union of all of them. */

export const resourceIconNames = [
  'hype',
  'cash',
  'compute',
  'tier',
  'users',
  'datacentre',
  'regulation',
  'backlash',
  'rival-agi',
  'world-share',
] as const;

/** One per upgrade node, named by node id. */
export const upgradeIconNames = [
  'cap-model-1',
  'cap-gpu-lease',
  'cap-model-2',
  'cap-safety-team',
  'cap-gpu-megadeal',
  'cap-model-3',
  'cap-interpretability',
  'cap-own-chips',
  'cap-model-4',
  'cap-alignment',
  'cap-robotics',
  'cap-model-5',
  'reach-app',
  'reach-api',
  'reach-social',
  'reach-loc-spanish',
  'reach-enterprise',
  'reach-media',
  'reach-loc-asia',
  'reach-partnerships',
  'reach-pr',
  'reach-compliance',
  'reach-government',
  'reach-superapp',
  'shadow-benchmarks',
  'shadow-lobbying',
  'shadow-astroturf',
  'shadow-poaching',
  'shadow-donations',
  'shadow-demos',
  'shadow-nda',
  'shadow-revolving-door',
  'shadow-bot-farm',
  'shadow-ma-team',
  'shadow-capture',
  'shadow-hostile',
] as const;

/** Map moment bubbles. `cash` is shared with the resources. */
export const momentIconNames = [
  'megaphone',
  'star',
  'cash',
  'chip',
  'document',
  'gavel',
  'recruiter',
  'thermometer',
  'camera',
  'speech',
  'crowd',
  'trophy',
  'mortarboard',
  'heart',
  'bug',
  'bolt',
] as const;

export const mapObjectIconNames = ['gpu-crate', 'rack-1', 'rack-2', 'rack-3', 'robot', 'lobbyist', 'undersea-cable', 'launch'] as const;

export const channelIconNames = ['channel-ocean', 'channel-language', 'channel-strict', 'channel-viral', 'channel-open'] as const;

export const interfaceIconNames = ['map', 'trees', 'news', 'race', 'regions', 'info', 'lock', 'check', 'close', 'help', 'settings'] as const;

export type IconName =
  | (typeof resourceIconNames)[number]
  | (typeof upgradeIconNames)[number]
  | (typeof momentIconNames)[number]
  | (typeof mapObjectIconNames)[number]
  | (typeof channelIconNames)[number]
  | (typeof interfaceIconNames)[number];

/** Groups in display order (the gallery uses these). A name may appear in two groups. */
export const iconGroups: readonly { id: string; names: readonly IconName[] }[] = [
  { id: 'resources', names: resourceIconNames },
  { id: 'upgrades', names: upgradeIconNames },
  { id: 'moments', names: momentIconNames },
  { id: 'map', names: mapObjectIconNames },
  { id: 'channels', names: channelIconNames },
  { id: 'interface', names: interfaceIconNames },
];

/** Every icon name once. */
export const iconNames: readonly IconName[] = [...new Set(iconGroups.flatMap((g) => g.names))];
