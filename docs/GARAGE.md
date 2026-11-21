# Garage: the idle clicker mode

A second mode beside the race: endless, relaxing, something to open for a minute. You run a garage lab, tap your model to make **tokens**, buy hardware that makes tokens on its own, and ship model after model for permanent **Hype**. It lives in the same world as the race (the same mascot, icons, parody brands and tabloid voice) but shares no engine code with it.

Open it from the start screen's title step ("Garage", next to "Race"); it goes straight to `/garage` with no founder or region step. "‹ Modes" in its top bar goes back.

## Layers

| Folder | What | May import |
| --- | --- | --- |
| `src/idle/` | The idle economy: pure, deterministic TypeScript like `src/engine` (eslint enforces it: no React, React Native, Expo, Node, state libraries or anything outside `src/idle`) | nothing outside itself |
| `src/content/packs/ai-lab/garage/` | `garage.json` (every number: generators, upgrades, generations, prestige, tap and combo, events, offline, offers, achievements, Lab Rep perks, headlines) and `strings.en.json` (all its text) | `src/idle` types |
| `src/ui/garage/` | The screen, its store and components | all |
| `src/ui/ads/` | The ad layer (provider interface, mock provider, buttons, banner slot, "Remove ads" stub) | `src/idle` types, UI |
| `app/garage.tsx` | The route | |
| `scripts/balance/garage.ts` | Pacing simulator, `npm run balance:garage` | all |
| `scripts/screens/garage.js` | Screenshots and touch checks | |

UI captions live in `src/ui/strings/garage.en.json` (`ui.garage.*`, `ui.ads.*`); the content's text is looked up with `gt()` (src/ui/garage/text.ts), which also translates string params that are Garage keys (a tier's name in an incident line).

## The design as built

**Core loop.** The big tap target is the mascot on a pedestal of rings. Every finger that lands on it is one tap (multi-touch counts); the tap's tokens pop out where the finger was, the model squashes and the rings kick, with a light haptic. Taps closer than 600 ms build a **combo**: every 10 taps add +10% to tap value, up to +100% (more with upgrades). Tap value = (base × tap multipliers × global × Hype + share-of-production upgrades × rate) × combo × tap frenzy.

**Generators** (cost × 1.15 per one owned):

| Tier | Icon | Base cost | Tokens/s | Unlocked by |
| --- | --- | --- | --- | --- |
| Intern with a laptop | mortarboard | 15 | 0.5 | start |
| Rented GPU | cap-gpu-lease | 120 | 4 | start |
| Server closet | rack-1 | 1.3K | 30 | start |
| Scraper farm | bug | 14K | 200 | start |
| Data-centre hall | datacentre | 160K | 1.2K | start |
| Custom chips | cap-own-chips | 2M | 8K | Model 2 |
| Power plant deal | bolt | 30M | 55K | Model 3 |
| Robotics line | robot | 500M | 400K | Model 5 |
| Orbital cluster | launch | 9B | 3M | Model 7 |
| Pocket universe | star | 200B | 25M | Model 9 |

The list shows owned tiers and the next one to buy in full, one teaser ("Something bigger") and the next locked tier with the model that unlocks it. Buy x1 / x10 / Max (closed-form geometric sums).

**Upgrades** (62, one-off, most reset on shipping): four per tier at 5, 15, 40 and 80 owned (×2, ×2, ×2, ×3); tap upgrades (×2, ×2, ×2, ×3 by tap count); "taps also earn a share of production" (1% to 3% each); global multipliers by tokens earned; a combo-cap upgrade; golden-moment value and frequency; and three offline upgrades that are **kept** when you ship (+2 h cap, +15% rate, +4 h cap). The Upgrades tab lists what is on offer, cheapest first, and the next three coming up with their progress.

**Prestige: "Ship a model".** Shipping generation *n + 1* needs a token total this generation (1B for Model 2, then ×4, ×5.8, ×8.4 … growing, capped at ×45 per step; 3.65e21 for Model 12; ×10 per step after that). It resets tokens, generators and the non-kept upgrades and grants **Hype = floor((tokens this generation / 6.42e7) ^ 0.4)**; each Hype point adds +10% to all production. The root means each reset is faster than the last at first, and the rising thresholds keep the named models lasting a week for a casual player. Each of the 12 named generations has a parody name, a tabloid launch headline (shown as a card after shipping) and an unlock: a new tier (Models 2, 3, 5, 7, 9) or a mechanic (Model 4: +2 h offline cap; 6: bigger combos and more golden moments; 8: +10% offline rate; 10: taps earn 3% of production; 11: production ×2; 12: ×3). After Model 12 the game goes on with "Model 13", "Model 14" … (endless).

**Events.** *Golden moments* appear on the stage for 12 s, first after 45 s and then every 2 to 5 minutes: a burst (10 or 15 minutes of production, at least 40 or 60 taps' worth), a frenzy (production ×7 for 30 s, or ×3 for 77 s) or a tap frenzy (taps ×10 for 15 s). *Incidents* start from Model 2, every 4 to 8 minutes, on a tier with at least 5 owned: that tier runs at half speed for 60 s unless tapped five times ("GPU shortage", "overheating", "intern pushed to prod", a stern letter, a union). A *ticker* runs 28 Garage headlines (some unlocked by later models) plus launch, golden-moment, incident and achievement lines. Events are drawn from the save's seeded PRNG.

**Offline earnings.** A gap longer than 60 s is time away: production at 50%, for at most 4 h (upgrades and Model 4 / 8 extend both), events paused. After 2 min away the "While you were away" panel shows the time, the tokens, Collect and the ad that doubles them.

**Achievements and stats.** 25 achievements (taps, tokens, models shipped, combo, golden moments, incidents, 100 interns, crates) including five secret ones shown as "Secret" until earned (200 taps before buying anything, ship with no upgrade, fix an incident within two seconds, own exactly 42 of something, let 10 golden moments slip away). The Stats sheet shows lifetime taps, tokens, models shipped, Hype, best combo, golden moments, incidents fixed, earned while away and time in the garage, plus Lab Rep and the ad counts.

## Link with the race: Lab Rep

Every model shipped earns 1 **Lab Rep** (`labRep.perShip`; `perGeneration` can reward depth). Perks are data in `garage.json` → `labRep.perks`:

| Rep | Perk (race runs) | `effect` |
| --- | --- | --- |
| 1 | Seed round: start with +$50M Cash | `startCash` 50 |
| 3 | Press list: start with +20 Hype | `startHype` 20 |
| 6 | Fan club: +5% Hype income | `hypeIncome` 0.05 |
| 10 | Lucky breaks: moments 10% more often | `momentRate` 0.1 |
| 15 | Old friends: +5% Cash income | `cashIncome` 0.05 |

`labPerks(content, labRep)` (src/idle/selectors.ts) returns the active perks, `nextLabPerk` the next one. The Ship panel and Stats sheet show them; **the race does not apply them yet** (this task does not touch src/engine). The hook, for a later task: read the save with `deserialize(await readValue('garage.save'), garageContent(), Date.now())`, take `labPerks(content, state.labRep)`, and fold the effects into the race's `GameSetup` (start resources) or as founder-style modifiers when a run starts (in `useGameStore.newGame`). That needs a small, agreed change to `GameSetup` in `src/engine/types.ts`.

## Idle engine API (`src/idle/index.ts`)

```ts
createGarage(content, now, seed?): GarageState
advance(state, content, now): GarageState            // closed form, see below
tap(state, content, now): { state, gained, combo }
buy(state, content, generatorId, count, now): ActionResult    // ActionResult = { state, ok, reason?, gained? }
buyMax(state, content, generatorId, now): ActionResult
buyUpgrade(state, content, upgradeId, now): ActionResult
canAfford(state, content, id, count?): boolean       // costOf(state, content, id, count?)
prestige(state, content, now, { bonus? }): ActionResult
collectGolden(state, content, now): ActionResult     // gained = burst tokens
tapIncident(state, content, now): ActionResult
offerStatus(state, content, offerId, now?): { available, reason?, readyAt?, usesLeft }
claimOffer(state, content, offerId, now): ActionResult
dismissOffline(state): GarageState
// selectors
totalRate, generatorRate, baseRate, tapValue, comboMultiplier, comboAt, multipliers, hypeMultiplier,
unitCost, bulkCost, maxAffordable, buyQuote, generatorRows, availableUpgrades, nextUnlocks,
prestigePreview, shipThreshold, hypeForLifetime, generationName, offlineEarnings, offlineCapMs,
crateValue, labPerks, nextLabPerk, requirementMet, requirementProgress
// saves
serialize(state): string; deserialize(text, content, now): { state, migratedFrom?, error? }
// numbers
formatAmount(n), formatDuration(ms), amount(n), MAX_AMOUNT
validateGarage(content): string[]
```

- **Immutable and deterministic:** every action returns a new state; the same seed, times and actions give the same save.
- **Time:** `advance` walks from breakpoint to breakpoint (a boost, frenzy or incident ending, a golden moment, incident or headline due), so production is exact and a long online gap costs a handful of steps, never one per second. A test checks one 59-second step against 59 one-second steps, events included. A gap above `offline.thresholdMs` is time away (offline rate, capped, piecewise across a boost ending; a test integrates the same span in 1-second steps).
- **Clock guards:** a clock that goes backwards shifts every stored time by the same delta (no production, boosts and cooldowns keep their remaining time, daily caps cannot be reset by moving the clock back); a forward jump of any size is bounded by the offline cap; `NaN` is ignored.
- **Big numbers: plain doubles.** Doubles reach 1.8e308 with 15 to 16 significant digits; the content is tuned so a long save stays far below `MAX_AMOUNT` (1e300; the simulator's casual player is near 1e23 after ten days), and every amount written to state goes through `amount()` (NaN and negatives become 0, overflow caps). A mantissa/exponent type would cost allocation on every tap and tick, complicate JSON saves and closed-form maths (`Math.pow`, `Math.log` for Max buys), and buy nothing at this scale. `formatAmount` prints K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc … up to Vg (1e63), then scientific (`3.21e72`). Property tests drive random actions at random times (including clock jumps both ways) and check that every amount, rate and cost stays finite and non-negative.
- **Saves:** `{ v: 2, state }`. Version 1 (the first prototype's flat format) migrates step by step; unknown ids are dropped, bad numbers repaired, unreadable or newer saves fall back to a fresh one with `error`.

## Ad layer (`src/ui/ads/`)

```ts
interface AdProvider {
  readonly name: string;
  isAvailable(placement: PlacementId): boolean;
  show(placement: PlacementId, info: { reward: string }): Promise<'rewarded' | 'dismissed' | 'unavailable'>;
}
setAdProvider(provider)                       // mockProvider by default
requestRewardedAd(placement, rewardText)      // logs and counts; grants at once with ads removed
adReady(placement)
<AdButton placement label reward status onRewarded showCooldown? />   // status = offerStatus(...) from the idle engine
<MockAdHost />  <BannerSlot />  <RemoveAdsPanel />
useAdStore: { adsRemoved, stats[placement]: { requested, shown, rewarded, dismissed, unavailable, granted } }
```

Rules: every ad is opt-in and rewarded; the button says what the reward is before the player commits; nothing opens unasked. The idle engine owns the rules (reward, cooldown, daily cap per rolling 24 hours, whether the offer applies); the ad layer only decides whether an ad can be shown. When no ad can be shown the button disappears and the screen offers the plain version (Collect, Ship it, tap the incident). Each request, show and result logs an `[AI-RACE] ad requested / ad shown / ad rewarded / ad dismissed / ad unavailable / ad reward granted without ad` line (development builds) and is counted per placement in local storage (`garage.ads.v1`), visible at the bottom of the Stats sheet.

| Placement id | Where | Reward | Cooldown | Daily cap | Plain version |
| --- | --- | --- | --- | --- | --- |
| `offlineDouble` | "While you were away" panel | offline earnings ×2 (once per report) | none | 6 | Collect |
| `boost` | top bar (persistent) | production ×2 for 30 min, stacks to 4 h | none | 12 | none (shows "Ready in …" at the cap) |
| `frenzyExtend` | next to an active frenzy | frenzy +20 s | 15 min | 6 | none (button hidden) |
| `incidentFix` | next to an incident | fixes it at once | 5 min | 10 | tap the incident 5 times |
| `crate` | top bar (persistent) | 10 min of production (at least 40 taps' worth) | 3 h | 4 | none (shows "Ready in …") |
| `prestigeBonus` | Ship panel | +25% Hype on this ship | none | 3 | Ship it |

All of these numbers are in `garage.json` → `offers`.

**Mock provider.** No ad SDK can run in Expo Go, so the only provider is `mockProvider`: an in-tree full-screen layer (`MockAdHost`, never a native `Modal`) labelled "Test ad", showing the reward, a 5-second countdown (`AD_CONFIG.mockSeconds`; `?adseconds=n` on web) and a close button from the first second. Claim after the countdown resolves `'rewarded'`, close early `'dismissed'`. One ad at a time.

**Banner.** `BannerSlot` reserves a clearly bounded, labelled 320×32 box in the top bar between the model name and the offer buttons, with 16 pt of empty space on each side, so a banner can never sit on or next to a game control (the tap target and lists are below the bar). Off by default (`AD_CONFIG.bannerEnabled = false`; `?banner=1` on web shows the slot). Hidden in narrow layouts.

**Remove ads.** Settings → "Remove ads" explains the future purchase; until it exists, a test switch sets `adsRemoved`, after which every reward is granted at once with no ad (still subject to the same cooldowns and caps).

### Plugging in a real rewarded-ad provider (AdMob)

1. Move to a development build (`npx expo prebuild` / EAS Build): native ad SDKs do not run in Expo Go. Add the SDK (for example `react-native-google-mobile-ads`) and its config plugin with the app ids in `app.config.js`; add the iOS App Tracking Transparency prompt and the consent flow (UMP) the network requires.
2. Create one **rewarded** ad unit per placement in the network's console and put the ids in `AD_CONFIG.adUnits` (keys are the placement ids above; test unit ids during development).
3. Write `admobProvider: AdProvider`: keep one preloaded `RewardedAd` per placement; `isAvailable(p)` returns whether that unit has loaded; `show(p)` shows it and resolves `'rewarded'` on the earned-reward event, `'dismissed'` on close without it, `'unavailable'` on an error; reload after each show.
4. Call `setAdProvider(admobProvider)` once at start (for example in `app/_layout.tsx`), falling back to the mock when the native module is missing. Nothing else changes: buttons hide while no ad is loaded, rewards and caps stay in the engine, logs and counters keep working.
5. Banner: render the SDK's banner view inside `BannerSlot` with an adaptive size no taller than `AD_CONFIG.bannerHeight`, and turn `bannerEnabled` on.
6. "Remove ads": when the purchase exists, set `adsRemoved` from the store receipt instead of the test switch (and hide the banner).

## Pacing (`npm run balance:garage`)

Bots buy greedily by payback time, catch most golden moments, fix incidents, open crates when the offer allows and ship when the Hype gained raises the multiplier by half again (or the first time). Profiles: **casual** taps 3/s for 40 s in each of three check-ins a day (3, 3 and 4 minutes at 08:00, 13:00, 21:00); **active** taps 6/s non-stop; the ad versions watch the boost (casual: twice per check-in; active: once an hour), double offline earnings, extend frenzies, fix incidents, open crates and take the launch bonus.

Early game (active, no ads):

| Metric | Value |
| --- | --- |
| First generator bought | 3 s |
| New things to buy in the first 10 min | 29 |
| Median gap between new things (first 10 min) | 10 s |
| Longest gap between new things (first 10 min) | 1 min 19 s |

Model ships, active play:

| Ship | active: time | since last | Hype gained | active + ads: time | since last |
| --- | --- | --- | --- | --- | --- |
| 1 | 15m 24s | 15m 24s | 2 | 7m 13s | 7m 13s |
| 2 | 29m 17s | 13m 53s | 6 | 16m 58s | 9m 45s |
| 3 | 38m 57s | 9m 40s | 21 | 22m 02s | 5m 04s |
| 4 | 49m 29s | 10m 32s | 24 | 25m 28s | 3m 26s |
| 5 | 57m 38s | 8m 09s | 67 | 30m 25s | 4m 57s |
| 6 | 1h 6m | 8m 32s | 213 | 38m 58s | 8m 33s |
| 7 | 1h 13m | 6m 53s | 782 | 44m 23s | 5m 25s |
| 8 | 1h 23m | 10m 35s | 3298 | 52m 49s | 8m 26s |
| 9 | 1h 32m | 8m 57s | 15377 | 1h 3m | 10m 34s |
| 10 | 2h 14m | 41m 53s | 70595 | 1h 25m | 22m 15s |

Casual check-ins, model reached at the end of each day:

| Day | casual: model | tokens (all time) | rate /s | casual + ads: model | tokens (all time) |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1.7B | 5.49K | 2 | 13.5B |
| 2 | 3 | 211B | 34.5M | 4 | 1.88T |
| 3 | 5 | 5.79T | 125M | 8 | 51.5Qa |
| 4 | 7 | 2.04Qa | 177B | 10 | 3Qi |
| 5 | 9 | 889Qa | 25.6T | 11 | 1.37Sx |
| 6 | 10 | 96.6Qi | 7.81Qa | 13 | 82.4Sx |
| 7 | 11 | 2.03Sx | 60.5Qa | 14 | 427Sx |
| 8 | 12 | 11.4Sx | 568Qa | 14 | 997Sx |
| 9 | 13 | 59.7Sx | 1.44Qi | 14 | 1.95Sp |
| 10 | 13 | 174Sx | 1.84Qi | 14 | 2.97Sp |

The last named model (Superintelligence (Beta), Model 12) arrives on day 7.5 for the casual player and day 5.3 with ads; after it the endless models continue.

Ad speed-up: casual reaches models 3 / 5 / 7 / 9 1.16x / 1.23x / 1.35x / 1.38x sooner and the end of the named models 1.4x sooner; active ships 1 / 3 / 5 come 2.1x / 1.8x / 1.9x sooner (the first ship sits entirely inside the first 30-minute boost). Ads watched by the ad bots: casual about 6 boosts, 3 crates, 2.5 offline doubles, 1.6 frenzy extensions and 1.2 launch bonuses a day; active about 1 boost, 2 frenzy extensions and 3.3 incident fixes an hour.

Against the targets: first generator within 10 s (yes, 3 s); something new every 20 to 60 s for the first ten minutes (median 10 s; the longest gap is about 80 s, and golden moments make purchases arrive in clusters); first ship at 15 to 25 minutes of active play (15.4 minutes) with later ships faster (7 to 11 minutes each until Model 10, where the thresholds start to bite); at least a week of casual check-ins before the named content runs out (7.5 days); ads 1.5x to 2x overall (about 1.2 to 1.4x for the casual milestones, 1.8 to 2.1x for active play).

## Screen

Landscape (844×390 design size, insets from `useInsets()`): top bar (‹ Modes, the model name and Hype, the banner slot when enabled, Boost and Bonus crate offers, Stats, Settings); the tap stage on the left (tokens and rate in large type, timed effects and incidents, the model, the combo meter, golden moments); Build / Upgrades / Ship tabs on the right; the ticker along the bottom. Narrow windows stack the offers, the stage and the panel.

- **Touch:** plain responder props on one view (no gesture-handler); each new touch identifier is one tap, so several fingers count; children draw with `pointerEvents="none"`.
- **Rendering:** the counter updates on its own 100 ms timer (interpolating between engine ticks) and re-renders only itself; pop-out numbers are twelve pooled views driven by shared values; the model's squash and the rings run on shared values; lists subscribe through `useGarage(select, key)` and re-render only when a count, a price or an affordability flag changes. The engine advances every 250 ms in the foreground.
- **Overlays:** the offline panel (`ModalCard`), the launch headline, the test ad and the Stats / Settings sheets are in-tree; no native `Modal`, no `SafeAreaView`.
- **Saves:** AsyncStorage through `src/ui/tutorial/storage.ts` (memory fallback), key `garage.save`; at most every 5 s while playing, at once on purchases, ships, rewards and resets, and when the app goes to the background. Settings (haptics) under `garage.settings`.
- **Debug (web):** `/garage?debug=1` exposes `window.__garage`: `setTokens(n)`, `fastForward(ms)` (an offline return), `golden(id?)`, `incident(id?, tier?)`, `frenzy(s?)`, `ad(placement)`, `scene('fresh' | 'mid' | 'ship' | 'late')`, `state()`. `&adseconds=n` shortens the test ad; `&banner=1` shows the banner slot.

Screenshots: `node scripts/screens/garage.js` (after `npx expo export --platform web`) writes docs/screenshots/garage/`<theme>-<W>x<H>-NN-name.png`: mode choice, fresh, mid-progress, upgrades, golden moment, frenzy, incident, offline return, test ad, doubled, ship panel, launch headline, late save, stats, settings, and narrow. Captured at 844×390 and 926×428 with `INSETS=0,47,21,47` on the default theme, and at 844×390 on `hazard` and `candy`.
