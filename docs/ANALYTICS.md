# Analytics

The plan's targets are retention numbers: players back on day 1, 7 and 30, sessions per day, tutorial and first-run completion, rewarded ads per daily player. This layer measures them **on the device**. No analytics vendor has been chosen yet, so nothing is sent over the network and no dependency was added. A vendor plugs in later as one more `AnalyticsProvider` (see "Adding a vendor" below).

## Code layout

| Where | What |
| --- | --- |
| `src/analytics/` | Pure TypeScript (no React, no React Native, no imports from `src/ui`; a test checks this). `events.ts` typed event union, `core.ts` `track()` and the provider slot, `providers/` (noop, console, memory, buffer, combine), `retention.ts` the retention maths, `session.ts` sessions and the install record on top of `track`. |
| `src/ui/analytics/` | Wiring. `install.ts` builds the providers and starts the session; `subscriptions.ts` turns store changes into events; `AnalyticsRoot.tsx` (mounted once in `app/_layout.tsx`) tracks screens from the router and sessions from `AppState`; `AnalyticsDebugSection.tsx` is the debug view; `hooks.ts` has `useAdOfferShown`. |
| `scripts/screens/analytics.js` | Plays a bot run on the web build and prints the captured events, then screenshots the debug section. |

Providers installed by the app: **buffer** (the rolling log in storage), **memory** (last 200 events this launch, for the debug view and `window.__analytics`), **console** (development builds only, one `[AI-RACE ANALYTICS]` line per event). `noop` is the default before install; `combineProviders` fans out to several.

## Rules the layer keeps

- **Zero work per game tick.** Only discrete actions produce events. The race store subscription compares a few references per tick and returns; actions arrive through `onGameAction` (called by the store's `dispatch`). A test runs 1,000 ticks and checks that no event is tracked and nothing is written.
- **Batched writes.** The buffer and the retention state are written at most once every 5 s after a change (`BUFFER_FLUSH_MS`), and at once when the app goes to the background. The habits events (task 32, src/ui/analytics/habits.ts) compare a reference or a number per store change: a new away report, the missions store's done and claimed lists, the crate flag, the streak's last day and the Paradigm count. Garage taps are summed and sent as one `garage_tap_batch` at most every 30 s, and when leaving the Garage or going to the background. The same flush sends the settled staff split and the helpers' batched happenings. The auto-buy helper's purchases (every 4 s in Latent Space) are not player purchases and send no `garage_generator_buy`. The pure reader `src/ui/garage/moments.ts` turns two Garage states into the discrete lab changes; the sound mapping uses the same reader.
- **Never throws into the game.** Every provider and listener call is wrapped; errors are swallowed and counted (`analyticsErrors()`, shown in the debug view). The React mount sits in its own error boundary that renders nothing on failure.
- **No personal data.** No device identifiers, no advertising ids, no player-typed text (the lab name is never logged: a test plays a run with a marker name and checks it is absent). The install id is random (`crypto.getRandomValues`, else `Math.random`). Params are content ids, numbers and fixed enums; strings are cut to 160 characters. Error messages are logged as they are (cut), so code must not put player text into error messages.

## Events

Every event is stored as `{ name, params, t, s }`: `t` is epoch ms, `s` the session number of this install (0 before the first session starts).

| Event | Params | When |
| --- | --- | --- |
| `app_open` | | Launch, once the install record is loaded. |
| `session_start` | | Launch, and coming back from the background after more than 30 s. |
| `session_end` | `seconds` | When the next session starts (on return, or on the next launch if the app was killed in the background). Stamped with the session it ends. |
| `screen_view` | `screen` (route path, e.g. `/game/trees`) | Every route change. |
| `mode_select` | `mode`: `race` \| `garage` | Leaving the start screen for the game or the Garage. |
| `tutorial_step` | `step` (1-based), `id` (step id) | Each tutorial step shown. |
| `tutorial_complete` | | The tutorial ends from its last step. |
| `tutorial_skip` | `step` | The tutorial ends before its last step. |
| `run_start` | `founder`, `difficulty` (`none` if the pack has no levels), `runLength?`, `homeRegion`, `perks` (number of Lab Rep race perks in the start bonus; 0 when off) | A new run (also Play again). |
| `run_end` | `ending` (ending id), `won`, `score`, `ticks`, `seconds` (wall time since `run_start`) | The run reaches an ending. |
| `run_quit` | `ticks`, `how`: `restart` \| `menu` \| `error` | A run is left before its ending: a new run over it, back to the start screen, or dropped by the error screen. |
| `node_buy` | `nodeId`, `kind` (tree id) | The player buys a node. |
| `region_launch` | `regionId` | The player pays to launch in a region. |
| `data_centre_build` | `regionId` | The player builds a data centre. |
| `data_centre_upgrade` | | The player upgrades a data centre. |
| `rival_acquire` | `rivalId` | The player buys out a rival. |
| `event_shown` | `eventId` | An event card appears. |
| `event_choice` | `eventId`, `choice` | The player resolves it. |
| `moment_collect` | `momentId` (def id), `kind`: `boost` \| `threat` | The player taps a moment. |
| `garage_open` | | The Garage route opens. |
| `garage_tap_batch` | `taps` | Taps since the last batch (never one event per tap). |
| `garage_generator_buy` | `tier` (1-based), `count` | Generators bought in one purchase. |
| `garage_upgrade_buy` | `id` | |
| `garage_prestige` | `index` (the new generation number) | Shipping a model. |
| `garage_stage_unlock` | `stage` (stage id: `office`, `datacentre`, `town`, `latent`) | The lab moves to a new stage. |
| `garage_training_start` | | A training run is launched (its candidates are revealed). |
| `garage_training_pick` | `rarity` (rarity id), `strength` (main strength: `production`, `tap`, `offlineCap`, `offlineRate`, `shipHype`, `happening`, `incident`, `trainingSpeed`), `action`: `keep` \| `swap` \| `scrap` | The player keeps a candidate in a free slot, swaps it for a kept model, or scraps all three (then the rarest candidate is reported). |
| `garage_staff_change` | `research`, `product`, `safety` (headcount per lane) | Debounced: once the player has stopped moving staff for 2.5 s (`STAFF_SETTLE_MS`), or on leaving; one event however many taps. |
| `garage_happening` | `id` (happening id), `outcome`: `tapped` \| `missed` \| `auto`, `count?` | One event per tapped or missed happening. Helpers' collections (`auto`, the Company Town on) are counted per id and sent as one event per id with `count`, at most every 5 minutes (`AUTO_HAPPENING_BATCH_MS`) and on leaving. |
| `garage_milestone` | `tier` (1-based), `count` (the milestone reached: 25, 50, 100, 200, 300 …) | Owning a milestone count of a tier (one event per tier per purchase, the highest reached). |
| `garage_ship_choice` | `choice` (`hype`, `safe`, `open`) | Right after `garage_prestige`, when the ship went through ship day's launch choice. |
| `ad_offer_shown` | `placement` (`offlineDouble`, `boost`, `frenzyExtend`, `incidentFix`, `crate`, `prestigeBonus`, `bonusMultiply`) | A rewarded-ad button becomes visible with its offer available (ads not removed). |
| `ad_started` | `placement` | An ad opens. |
| `ad_completed` | `placement` | An ad is watched to the reward. |
| `remove_ads_tap` | `on` | The remove-ads switch changes (the future purchase). |
| `race_reward_granted` | `rep` (Lab Rep, one decimal), `boost` (blueprints minutes) | A finished race granted the Garage its reward (end screen). |
| `perks_toggle` | `on` | The player flips "Play this run with perks" in the perks sheet. |
| `settings_change` | `key`, `value` | A setting changes (today: Garage haptics). |
| `away_return` | `hoursAway` (one decimal), `capped` (the away storage filled), `capacityHours` | A return from time away produced a "While you were away" report (a longer gap on top of an unread report counts the extra time). |
| `mission_complete` | `id` (mission id) | A daily mission reached its goal (once per mission per day). |
| `mission_claim` | `id` | The player claimed a mission's reward. |
| `daily_crate_claim` | `streak` | The player opened the daily crate (all three claimed). |
| `streak_day` | `streak`, `usedDayOff` | The first claim of a UTC day moved the streak (with whether the day off covered a missed day). |
| `paradigm_shift` | `count` (shifts so far) | The player (after the confirmation) made a Paradigm Shift. |
| `error` | `where`, `message` | Anything logged through `logError` (error boundary, uncaught errors, failed saves). |

User properties (`setUserProps`): `build` (commit from the build stamp, `+` if dirty), `theme` (content pack id), `locale` (`Intl` locale, e.g. `en-GB`), `platform` (`ios`, `android`, `web`), `installId`.

## Definitions

All days are **local calendar days** of the device (timezone offset taken at each moment). The install's day is **D0**; the next local calendar day is D1, and so on. A session belongs to the day it started on.

- **Session.** Starts on launch, or on returning to the foreground more than 30 s (`SESSION_RESUME_MS`) after going to the background; a shorter trip is the same session. Its length is from start to the moment it went to the background (or, for an app killed in the foreground, its last tracked event).
- **D1 / D7 / D30 retention** (per install): the install had at least one session that *started* on day index exactly 1 / 7 / 30. Across installs: installs retained on Dn ÷ installs whose Dn has arrived. Locally the debug view shows `yes`, `no`, or `-` while that day is still ahead.
- **Sessions per day** (locally): sessions ÷ days with at least one session ("per active day"). Across players: sessions on a day ÷ players with a session that day (DAU).
- **Session length**: mean of ended sessions' `session_end.seconds`.
- **Tutorial completion**: installs with `tutorial_complete` ÷ installs with `tutorial_step` step 1. Skips count as not completed.
- **First-run completion**: installs that reached every step of the funnel `app_open` → `tutorial_step` 1 → `tutorial_complete` → `run_start` → `run_end`, ÷ installs with `app_open`. The first time of each step is kept per install (seconds after install in the debug view), so the funnel survives the rolling log dropping old events. Note that the tutorial starts inside the first run, so `run_start` normally comes before `tutorial_step` 1 in time; the funnel counts whether each step was ever reached.
- **Rewarded ads per daily player**: `ad_completed` events on a day ÷ players with a session that day. `ad_started` ÷ `ad_offer_shown` is the offer take-up; `ad_completed` ÷ `ad_started` the completion rate.

## Local storage

| Key | Content |
| --- | --- |
| `ai-race.analytics.log.v1` | The rolling event log, newest last, at most 2,000 events (`BUFFER_CAP`). |
| `ai-race.analytics.retention.v1` | The retention state: install id and time, sessions per day index (count, ended count, seconds), the open session, first time of each funnel step, the last 20 session lengths. |

## Debug view

Long-press the mascot (or the build stamp on the start screen) for two seconds to turn on the debug overlay; the **Analytics** panel sits at the top right on every screen. Hide collapses it to its title.

- `install i-… · day D3`: this install's random id and today's day index.
- `sessions today 2 · total 9 · per active day 2.25`.
- `session now 4:12 · average 6:30`: the open session so far and the mean ended session.
- `returned D1 yes · D7 no · D30 -`: `-` means that day has not arrived yet.
- `stored 412 events · 31 writes · 0 errors`: the rolling log size, storage writes this launch, and analytics errors swallowed.
- **First run**: each funnel step with its first time after install (`+12:04`), or `not yet` (dimmed).
- **Last 30 events**, newest first, with local clock time.
- **Copy log** (web: the clipboard) or **Share log** (native: the system share sheet; React Native has no clipboard without a new dependency) exports the whole stored log as text.

On web with `?debug=1`, `window.__analytics` offers `events()`, `log()`, `report()`, `flush()` and `writes()` for scripts: `node scripts/screens/analytics.js [outDir]` after `npx expo export --platform web`.

## Adding a vendor

Write a provider in `src/ui/analytics/` (it needs the vendor's React Native SDK, so not in `src/analytics/`) that maps `track(event)` to the SDK's capture call (`event.name`, `event.params`), `setUserProps` to its person properties, and `flush` to its flush. Add it to the `combineProviders(...)` list in `install.ts`. Keep the buffer provider: it is the debug view's source and a local fallback. Disable the SDK's own automatic capture (screens, app lifecycle) where it duplicates ours, and never call its identify with anything but `installId`.

## Vendor recommendation

Requirements: works with Expo SDK 58 (managed workflow, EAS builds), no advertising identifier, so no App Tracking Transparency prompt, retention and funnel reports, an affordable free tier. Researched November 2026; check the vendors' current terms before signing up.

**PostHog** ([React Native docs](https://posthog.com/docs/libraries/react-native), [Expo guide](https://docs.expo.dev/guides/using-posthog/), [pricing](https://posthog.com/docs/product-analytics/pricing))
- Pros: Expo install is `npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization`; the docs say there are no native dependencies outside supported Expo packages, so it should work in Expo Go and EAS builds without config plugins. Offline queue in file storage (default 1,000 events, oldest dropped), sent on the next launch. Built-in retention, funnels, lifecycle and session reports that match our definitions. EU hosting (`https://eu.i.posthog.com`). Open source, can be self-hosted.
- Cons: a bigger SDK than we need (session replay, feature flags, surveys: leave them off). Its docs do not discuss IDFA or ATT; as far as I know it uses its own random anonymous id and not an advertising id, but this must be confirmed against its iOS privacy manifest before release. Four extra Expo packages.
- Free tier: 1,000,000 events per month free, then from $0.00005 per event, falling with volume.
- Adding it: install the five packages, add a `posthogProvider` (about 30 lines) to `install.ts`, project key in app config, EU host, `captureAppLifecycleEvents` and screen autocapture off, update the App Store privacy labels ("Product interaction", not linked to identity, not used for tracking).

**Aptabase** ([React Native](https://aptabase.com/for-react-native), [pricing](https://aptabase.com/pricing))
- Pros: privacy-first: no device identifiers, cookies or fingerprinting, no personal data, so no consent banner. One small package (`@aptabase/react-native`), works in Expo Go (set `appVersion` in `init()` there). EU or US hosting. Open source.
- Cons: dashboards are simple: event counts and properties; its pages do not describe retention cohorts or funnels, so D1/D7/D30 would need exports and our own maths. Sessions are anonymous by design, so per-install retention may not be possible at all. No documented offline queue.
- Free tier: 20,000 events per month; paid from $10/month for 200,000. Our bot run produced about 150 events per 25-minute run, so the free tier covers roughly 130 runs a month.
- Adding it: one package, `Aptabase.init(key)`, a provider of about 15 lines, INTERNET permission on Android (already present in Expo builds).

**Google Analytics for Firebase** via `@react-native-firebase/analytics` ([usage](https://rnfirebase.io/analytics/usage))
- Pros: free with no event cap; mature retention, funnel and audience reports; pairs with Crashlytics and Remote Config.
- Cons: needs native code: config plugins, `google-services` files, a development build (no Expo Go). To stay clear of the IDFA you must link the core variant without ad id support (`$RNFirebaseAnalyticsWithoutAdIdSupport`), which the docs say is incompatible with AdMob, and AdMob is the likely rewarded-ad network. Data goes to Google; privacy labels are heavier.
- Free tier: no event limit (BigQuery export has its own quotas).
- Adding it: `@react-native-firebase/app` and `/analytics`, plugin entries in app config, Firebase project files, a new development build and store build, a provider of about 20 lines.

**Recommendation: PostHog.** It is the only one of the three that gives D1/D7/D30 retention and the first-run funnel out of the box, installs with Expo packages only, keeps working offline, and its free tier is fifty times Aptabase's. Confirm it collects no advertising identifier on iOS before the first release build. Do not install it until the owner approves the vendor.
