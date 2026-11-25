/**
 * Every analytics event the game can send: a name and typed params. Only discrete player
 * actions and app lifecycle moments produce events; nothing is sent per game tick.
 *
 * No personal data: no device identifiers, no player-typed text (the lab name is never
 * logged), only ids from the content pack, numbers and fixed enums.
 */

export type GameMode = 'race' | 'garage';

/** How a run was left before its ending: a new run over it, dropped back to the menu, or the error screen. */
export type QuitHow = 'restart' | 'menu' | 'error';

/** What the player did with a training run's candidates. */
export type GaragePickAction = 'keep' | 'swap' | 'scrap';

/** How a lab happening went: tapped by the player, missed, or collected by a helper (batched, with a count). */
export type GarageHappeningOutcome = 'tapped' | 'missed' | 'auto';

/** What a share button shared: the daily result, a normal run's result, or from the front page. */
export type ShareKind = 'daily' | 'run' | 'frontpage';

export type AnalyticsEvent =
  | { name: 'app_open' }
  | { name: 'session_start' }
  | { name: 'session_end'; params: { seconds: number } }
  | { name: 'screen_view'; params: { screen: string } }
  | { name: 'mode_select'; params: { mode: GameMode } }
  | { name: 'tutorial_step'; params: { step: number; id: string } }
  | { name: 'tutorial_complete' }
  | { name: 'tutorial_skip'; params: { step: number } }
  | { name: 'run_start'; params: { founder: string; difficulty: string; runLength?: string; homeRegion: string; perks?: number; daily: boolean } }
  | { name: 'run_end'; params: { ending: string; won: boolean; score: number; ticks: number; seconds: number; daily: boolean } }
  | { name: 'run_quit'; params: { ticks: number; how: QuitHow } }
  | { name: 'node_buy'; params: { nodeId: string; kind: string } }
  | { name: 'region_launch'; params: { regionId: string } }
  | { name: 'data_centre_build'; params: { regionId: string } }
  | { name: 'data_centre_upgrade' }
  | { name: 'rival_acquire'; params: { rivalId: string } }
  | { name: 'event_shown'; params: { eventId: string } }
  | { name: 'event_choice'; params: { eventId: string; choice: string } }
  | { name: 'moment_collect'; params: { momentId: string; kind: string } }
  | { name: 'garage_open' }
  | { name: 'garage_tap_batch'; params: { taps: number } }
  | { name: 'garage_generator_buy'; params: { tier: number; count: number } }
  | { name: 'garage_upgrade_buy'; params: { id: string } }
  | { name: 'garage_prestige'; params: { index: number } }
  | { name: 'garage_stage_unlock'; params: { stage: string } }
  | { name: 'garage_training_start' }
  | { name: 'garage_training_pick'; params: { rarity: string; strength: string; action: GaragePickAction } }
  | { name: 'garage_staff_change'; params: { research: number; product: number; safety: number } }
  | { name: 'garage_happening'; params: { id: string; outcome: GarageHappeningOutcome; count?: number } }
  | { name: 'garage_milestone'; params: { tier: number; count: number } }
  | { name: 'garage_ship_choice'; params: { choice: string } }
  | { name: 'ad_offer_shown'; params: { placement: string } }
  | { name: 'ad_started'; params: { placement: string } }
  | { name: 'ad_completed'; params: { placement: string } }
  | { name: 'remove_ads_tap'; params: { on: boolean } }
  | { name: 'race_reward_granted'; params: { rep: number; boost: number } }
  | { name: 'perks_toggle'; params: { on: boolean } }
  | { name: 'daily_start'; params: { day: number } }
  | { name: 'daily_end'; params: { day: number; ending: string; score: number; streak: number } }
  | { name: 'share_tap'; params: { kind: ShareKind; where: string } }
  | { name: 'frontpage_open' }
  | { name: 'settings_change'; params: { key: string; value: string | number | boolean } }
  | { name: 'error'; params: { where: string; message: string } };

export type EventName = AnalyticsEvent['name'];

/** Params of one event by name ({} for events without params). */
export type EventParams<N extends EventName> = Extract<AnalyticsEvent, { name: N }> extends { params: infer P } ? P : Record<string, never>;

export type ParamValue = string | number | boolean;

/** An event as stored and handed to providers: flat params plus when it happened. */
export interface TrackedEvent {
  name: EventName;
  params: Record<string, ParamValue>;
  /** Epoch ms from the analytics clock. */
  t: number;
  /** Session number of this install (1-based) when it was tracked; 0 before the first session. */
  s: number;
}

/** Every event name, for docs and tests. */
export const EVENT_NAMES: readonly EventName[] = [
  'app_open',
  'session_start',
  'session_end',
  'screen_view',
  'mode_select',
  'tutorial_step',
  'tutorial_complete',
  'tutorial_skip',
  'run_start',
  'run_end',
  'run_quit',
  'node_buy',
  'region_launch',
  'data_centre_build',
  'data_centre_upgrade',
  'rival_acquire',
  'event_shown',
  'event_choice',
  'moment_collect',
  'garage_open',
  'garage_tap_batch',
  'garage_generator_buy',
  'garage_upgrade_buy',
  'garage_prestige',
  'garage_stage_unlock',
  'garage_training_start',
  'garage_training_pick',
  'garage_staff_change',
  'garage_happening',
  'garage_milestone',
  'garage_ship_choice',
  'ad_offer_shown',
  'ad_started',
  'ad_completed',
  'remove_ads_tap',
  'race_reward_granted',
  'perks_toggle',
  'daily_start',
  'daily_end',
  'share_tap',
  'frontpage_open',
  'settings_change',
  'error',
];

/** Longest string param kept (error messages are cut to this). */
export const MAX_PARAM_LENGTH = 160;

/** Drops undefined values, cuts long strings and non-finite numbers, so stored events stay small and valid. */
export function cleanParams(params: object | undefined): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') out[k] = v.length > MAX_PARAM_LENGTH ? v.slice(0, MAX_PARAM_LENGTH) : v;
    else if (typeof v === 'number') out[k] = Number.isFinite(v) ? v : 0;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
