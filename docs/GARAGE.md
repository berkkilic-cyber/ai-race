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

**Prestige: "Ship a model".** Shipping generation *n + 1* needs a token total this generation (1B for Model 2, 6.4B for Model 3, then steeper each step: the original curve times an extra 1.6 per step from Model 3 on; 4.01e23 for Model 12; ×10 per step after that). It resets tokens, generators and the non-kept upgrades and grants **Hype = floor((tokens this generation / 6.42e7) ^ 0.4)**; each Hype point adds +10% to all production. The root means each reset is faster than the last at first, and the rising thresholds keep the named models lasting about two weeks for a casual player. Shipping goes through ship day (below), whose choice modifies this formula. Each of the 12 named generations has a parody name, a tabloid launch headline (shown as a card after shipping) and an unlock: a new tier (Models 2, 3, 5, 7, 9) or a mechanic (Model 4: +2 h offline cap; 6: bigger combos and more golden moments; 8: +10% offline rate; 10: taps earn 3% of production; 11: production ×2; 12: ×3). After Model 12 the game goes on with "Model 13", "Model 14" … (endless).

**Events.** *Golden moments* appear on the stage for 12 s, first after 45 s and then every 2 to 5 minutes: a burst (10 or 15 minutes of production, at least 40 or 60 taps' worth), a frenzy (production ×7 for 30 s, or ×3 for 77 s) or a tap frenzy (taps ×10 for 15 s). *Incidents* start from Model 2, every 4 to 8 minutes, on a tier with at least 5 owned: that tier runs at half speed for 60 s unless tapped five times ("GPU shortage", "overheating", "intern pushed to prod", a stern letter, a union). A *ticker* runs 28 Garage headlines (some unlocked by later models) plus launch, golden-moment, incident and achievement lines. Events are drawn from the save's seeded PRNG.

**Offline earnings.** A gap longer than 60 s is time away: production at 50%, for at most 4 h (upgrades and Model 4 / 8 extend both), events paused. After 2 min away the "While you were away" panel shows the time, the tokens, Collect and the ad that doubles them.

**Achievements and stats.** 25 achievements (taps, tokens, models shipped, combo, golden moments, incidents, 100 interns, crates) including five secret ones shown as "Secret" until earned (200 taps before buying anything, ship with no upgrade, fix an incident within two seconds, own exactly 42 of something, let 10 golden moments slip away). The Stats sheet shows lifetime taps, tokens, models shipped, Hype, best combo, golden moments, incidents fixed, earned while away and time in the garage, plus Lab Rep and the ad counts.

## The lab (task 22)

The owner found the clicker "too idle": one decision (buy the cheapest row), nothing to watch, every tap the same. The lab layer turns "buy rows" into "run a lab" on top of the same idle maths. Everything is data in `garage.json` and optional in the engine (content without it plays as the plain clicker); the rules live in `src/idle/lab.ts` (inside time), `labActions.ts` (player actions and reads) and `labRates.ts` (pure multipliers).

**Stages** change the game's shape. Each is reached by progress that never resets (tokens earned in all, or the model generation), is kept when shipping, renames and redraws the room and switches one mechanic on:

| Stage | Reached at | Switches on | Model slots |
| --- | --- | --- | --- |
| The Garage | start | the clicker | 0 |
| The Office | 15M tokens in all (about 7 min of active play) | training runs | 1 |
| The Data Centre | Model 2 shipped and 50B in all | staff | 2 |
| The Company Town ("you bought a town; the mayor is a chatbot") | Model 6 | helpers handle missed happenings (25% of the reward) | 3 |
| Latent Space ("the lab moved inside its own model") | Model 9 | auto-buy (best output per token, up to 25% of the tokens in hand, every 4 s while open) | 4 |

Moving in shows a card ("The lab moved: The Office") and a ticker line; the next stage and its requirement are always shown over the room.

**Milestones.** Owning 25 / 50 / 100 / 200 of a tier multiplies its output by 1.25 / 1.25 / 1.5 / 1.5, then ×1.2 every 100 more. Each Build row shows the next one ("×1.5 at 100") with a progress bar.

**Training runs** (from the Office). A run comes ready every 5 minutes (faster with Research staff and training-speed models) into a queue of 3 that fills while away. Launching one rolls three candidates, each led by a different strength when possible: production, tap value, offline cap, offline earnings, Hype when shipping, happening rewards, fewer incidents or training speed. Rarity (Weekend Project 60, Series A 28, Frontier 10, Allegedly Sentient 2 by weight) sets how many strengths (1 to 3) and their power (×1 to ×2.4), and the chance of one drawback (35% to 70%: more incidents, less production, offline earnings, tap value, training speed or ship Hype). Names are parody parts ("VibeOracle 3.5", "GlazeMind 1.5", 144 combinations) with a one-line description by main strength. Keep one in a free slot, swap it for a kept model, or scrap all three. Kept models stay through ships.

**Staff** (from the Data Centre). Twelve people split between Research, Product and Safety with + / − per lane; a third each is neutral. With d = 3 × share − 1 (−1 to 2): Product multiplies generator output by 1 + 0.5d (none: ×0.5, all: ×2); Safety multiplies incident frequency by 1 − 0.45d, incident severity by 1 − 0.4d and ship Hype by 1 + 0.25d (none: incidents ×1.45 and harder, ship Hype ×0.75); Research multiplies training speed by 1 + 0.6d and raises the weight of the rarer tiers. Nobody on Safety or on Product shows a warning. No split is right in every situation: Product-heavy earns fastest but bleeds Hype and incidents, Safety-heavy ships bigger, Research-heavy trains better models.

**Ship day.** "Start ship day" in the Ship tab runs a short sequence on tabloid paper: the benchmark reveal on the parody leaderboard (LeaderBored Arena, Humanity's Penultimate Exam, The Strawberry Letter Count … against NopenAI, Zlaude, Germini and DeepSleek; your score grows with the generation and the Hype gained, so the first models come last and later ones top the chart), then the headline and a rival's reaction ("{rival} announces a better model, available 'in the coming weeks'"), then the launch choice. Hype gained = the base formula × kept models' ship Hype × Safety trust × the choice:

| Choice | Hype | Next generation |
| --- | --- | --- |
| Hype it | ×1.3 | incidents ×1.5 as often |
| Play it safe | ×0.9 | incidents ×0.5 as often |
| Open the weights | ×0.8 | +2 training runs (past the queue cap) and +1 Lab Rep |

The launch bonus ad stacks on the choice. The result card names the model, the Hype and the plan.

**Lab happenings.** Small tappable things appear in the room while the lab is open, first after 20 s, then every 20 to 40 s, for 9 s each, at a spot that fits them (the door, a desk, the racks): pizza delivery, an intern with a question (the next training run comes 30 s sooner), a bug in prod, an overheating rack, an investor on line one, a reporter at the door, GPUs that fell off a truck, a stern letter, a power flicker, a townsfolk petition, an escaped hallucination (later ones from later stages). A tap pays 3 to 18 seconds of production (at least a few taps' worth, more with happening models); four of them cost a little if ignored (10 to 15 s of production, never more than 5% of the tokens in hand) and turn red. They are cleared while away. Golden moments and incidents stay as before and also appear in the room.

**Automation.** The Company Town's helpers collect missed happenings for 25% of the reward instead of the penalty; Latent Space's auto-buy is a switch in the Lab tab.

## Link with the race: Lab Rep (task 25)

The two modes are one game: the race gives stories and mastery, the Garage a reason to check in several times a day. **Lab Rep** is the account level that joins them. It is never spent. It comes from shipping models (1 per ship, `labRep.perShip`; ship day's "Open the weights" adds 1) and from finishing races. It unlocks perks on a ladder in `garage.json` → `labRep.perks`.

### Garage → race: perks

| Rep | Perk | Effect (`effect`) | In the race |
| --- | --- | --- | --- |
| 1 | Seed round | +$1M start Cash (`startCash` 1) | added to the founder's start |
| 3 | Press list | +3 start Hype (`startHype` 3) | added to the founder's start |
| 6 | Garage Legend | title under the lab name (`title`) | looks only |
| 9 | Fan club | +0.5% Hype income (`hypeIncome` 0.005) | modifier `hypeIncome` add 0.005 |
| 12 | Duct-tape frame | frame on the chosen founder card (`frame`) | looks only |
| 16 | Old friends | +0.5% Cash income (`cashIncome` 0.005) | modifier `cashIncome` add 0.005 |
| 20 | Angel on line two | +$1M start Cash (`startCash` 1) | added to the founder's start |
| 25 | Thought Leader | title | looks only |
| 31 | Gold-plated frame | frame | looks only |
| 38 | Insider list | +2 start Hype (`startHype` 2) | added to the founder's start |
| 46 | Visionary (self-appointed) | title | looks only |
| 58 | Holographic frame | frame | looks only |

Each has a name and one line in the Garage strings (`garage.perk.<id>.name` / `.quip`). The newest title and frame are shown automatically (the title on the end screen under the lab name, the frame on the start screen's selected founder card). The `momentRate` kind is still accepted by the types but no perk uses it: the race engine has no moment-frequency stat, so it would do nothing.

The sizes look tiny because the simulator says they must be: a player with every perk may win at most 5 points more often than one with none (table in docs/BALANCE.md, "Task 25"). Start Cash has a cliff: +$4M was already +5 points on Sandbox (the Researcher's start lands just above an early purchase), so the two Cash perks add $2M together.

How it is applied (src/ui/meta/logic.ts, pure): `bonusForSetup({ perksOn }, labRep, content)` is the one function that decides a run's bonus (`startBonusOf` maps the active power perks to `GameSetup.bonus`; a future daily challenge adds one line there to force perks off). `withPerks(setup)` (src/ui/meta/store.ts) applies it on Found the lab and Play again; Rematch and Restart replay the recorded setup with its bonus. The run's setup records `perksOn` and `perkIds` (UI fields beside the engine's `GameSetup`, kept in the game store and in the run save).

Start screen, founder step: a chip with the Lab Rep badge and what the perks add ("+$2M Cash, +5 Hype +2"), or "perks off"; it opens the perks sheet (badge, "Play this run with perks" switch, the ladder grouped Earned / Next to earn / Later, Open the Garage). With no Lab Rep yet the chip is a pointer instead: "The Garage earns race perks".

### Race → Garage: the race reward

When a run reaches an ending, the end screen grants the Garage once (`grantRaceReward`, src/idle/race.ts; numbers in `garage.json` → `raceReward`). An abandoned run (Abandon, Restart, quitting) never reaches an ending and grants nothing.

rep = baseRep 1.6 × (win 1, loss 0.4) × difficulty (Sandbox 0.6, Frontier 1, Arms Race 1.4, Hard Takeoff 1.8) × length (Sprint 0.45, Full 1) × (1 + 0.5 × min(1, raw score / 3000)) × 0.5 ^ (earlier rewarded plays of this seed), rounded to 0.1.

The raw score is the run's score divided by the race's own difficulty and length multipliers (they are counted above). A rematch on the same seed grants half, the next a quarter (the last 50 seeds are remembered), so a seed cannot be farmed. Whole points go to `labRep` (so the Ship panel and every older display stay whole numbers), the rest waits in `race.repProgress`.

**Blueprints** ("the rival's slides, photographed from the back row"): production ×1.5 for 20 minutes per Lab Rep granted, extending a running boost, at most 2 hours left. They run while away like the ad boost (at the offline rate) and stack with it. The grant does not move the Garage's clock: the boost window starts at the race's end, and the next catch-up credits it only from then.

The end screen shows one line ("Garage: +1.2 Lab Rep · blueprints ×1.5 for 24 min"), the Lab Rep badge and a Garage button. The next time the Garage opens, a small "From your last race" card over the lab shows what came in and the boost time left, until dismissed (`markRaceNoteSeen`).

### Where Lab Rep comes from (a casual week)

Rep per race, sensible bot, 120 runs per cell (`scripts/balance/raceReward.ts`, seed 3):

| Difficulty | Length | Win | Raw score p50 (win / loss) | Rep per race (mean) | Blueprints min (mean) |
| --- | --- | --- | --- | --- | --- |
| sandbox | sprint | 62.5% | 2531 / 1020 | 0.45 | 9.0 |
| frontier | sprint | 27.5% | 2402 / 922 | 0.49 | 9.9 |
| arms-race | sprint | 14.2% | 2357 / 853 | 0.62 | 12.3 |
| hard-takeoff | sprint | 15.8% | 2314 / 773 | 0.79 | 15.8 |
| sandbox | full | 62.5% | 2465 / 1021 | 1.02 | 20.3 |
| frontier | full | 31.7% | 2331 / 914 | 1.19 | 23.8 |
| arms-race | full | 22.5% | 2386 / 843 | 1.48 | 29.6 |
| hard-takeoff | full | 11.7% | 2314 / 779 | 1.61 | 32.3 |

Ships: the casual Garage player (three check-ins a day, "Pacing" below) has Model 11 at the end of day 7, so 11 ships = **11 Lab Rep** in week one.

Races, a casual race player on Frontier:
- one Sprint a day and two Full runs at the weekend: 7 × 0.49 + 2 × 1.19 = 3.4 + 2.4 = **5.8** → 5.8 / (11 + 5.8) = **35%** from races;
- two Sprints a day and two Full runs: 14 × 0.49 + 2.4 = **9.2** → 9.2 / 20.2 = **46%**;
- the lighter pattern on Sandbox (a newer player): 7 × 0.45 + 2 × 1.02 = 5.2 → **32%**.

So a third to a half of week one's Lab Rep comes from races, and races never swamp ships. After week two ships slow down (Model 12 is a two-week goal, then each model is ten times harder), so races carry the ladder from there: at about 6 to 9 Rep a week from races the last perk (Rep 58) arrives around week six to eight.

`labPerks(content, labRep)` / `nextLabPerk` (src/idle/selectors.ts) list the ladder; `labRepTotal(state)` is Lab Rep with its fraction. The same `LabRepBadge` (level and a bar to the next perk) is on the start chip and sheet, the end screen, the Garage's race note and the Ship panel's Lab Rep card.

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
// the race link (task 25)
grantRaceReward(state, content, input, now)  raceRewardQuote  markRaceNoteSeen(state)  labRepTotal  raceBoostLeftMs
// the lab
launchTraining(state, content, now)  keepModel(state, content, uid, now, replaceUid?)  scrapCandidates  retireModel
setStaff(state, content, split, now)  moveStaff(state, content, from, to, now)
collectHappening(state, content, now)  happeningQuote  setAutoBuy(state, content, on, now)
prestige(state, content, now, { bonus?, choice? })  claimOffer(state, content, id, now, { choice? })
trainingStatus, nextStage, shipReveal, currentStage, mechanicOn, modelSlots, milestoneMult, nextMilestone,
modelEffects, staffEffects, incidentFrequency, offlineTerms, shipGain, autoBuyPick
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
- **Saves:** `{ v: 3, state }`. Version 1 (the first prototype's flat format) and version 2 (before the lab) migrate step by step; a version 2 save is placed in the stage its progress has earned (all-time tokens and generation never reset), with staff split evenly, no models and one training run ready if it is already past the Garage (a test loads an old Model 3 save into the Company Town); unknown ids are dropped, bad numbers repaired, unreadable or newer saves fall back to a fresh one with `error`.

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
| `boost` | the stage's offer slot, when the next purchase is 90 s or more away | production ×2 for 30 min, stacks to 4 h | none | 12 | none |
| `frenzyExtend` | the stage's offer slot, only during a frenzy | frenzy +20 s | 15 min | 6 | none |
| `incidentFix` | the stage's offer slot, during an incident | fixes it at once | 5 min | 10 | tap the incident 5 times |
| `crate` | the stage's offer slot, when ready | 20 min of production (at least 60 taps' worth) | 3 h | 4 | none |
| `prestigeBonus` | ship day, launch choice | +30% Hype on this ship | none | 3 | Ship it |
| `bonusMultiply` | where a just-tapped bonus was, for 6 s | that bonus's reward ×3 (the free reward counts once) | none | 20 | the free reward, already granted |

All of these numbers are in `garage.json` → `offers`.

**One offer at a time.** The header has no ad buttons any more. `pickPlacement(context)` (src/ui/ads/policy.ts, tested) chooses at most one placement, in this order: the offline double while the away report is open (and nothing else then); the launch bonus on ship day's choice (and nothing else then); the bonus multiplier while a just-tapped bonus offers it; the incident fix during an incident; the frenzy extension during a frenzy; the crate when ready; the boost when the next purchase is far away (`BOOST_WAIT_S` = 90). Nothing appears on the stage until the lab produces something. `useAdPlacement()` (src/ui/garage/adOffer.tsx) builds the context from the engine's offer status and the provider, once per store change, and every place that can show an ad renders it only when it is the pick; the screenshot script checks that no capture shows two.

**Bonus multiplier** (owner's feedback after an hour of play). Golden bursts and lab happenings stay free to tap with their normal reward. After the tap, with chance `multiplyChance` (0.33) and never in the first `multiplyAfterMs` (3 minutes) of play, the engine keeps a `bonusOffer` for `multiplyWindowMs` (6 s): the ad "Watch to make it ×3" sits where the bonus was, with a bar that runs down, then goes. It is never required; it does not survive a reload.

**Mock provider.** No ad SDK can run in Expo Go, so the only provider is `mockProvider`: an in-tree full-screen layer (`MockAdHost`, never a native `Modal`) labelled "Test ad", showing the reward, a 5-second countdown (`AD_CONFIG.mockSeconds`; `?adseconds=n` on web) and a close button from the first second. Claim after the countdown resolves `'rewarded'`, close early `'dismissed'`. One ad at a time.

**Banner.** `BannerSlot` reserves a clearly bounded, labelled 320×32 box in the top bar between the model name and the Stats button, with 16 pt of empty space on each side, so a banner can never sit on or next to a game control (the tap target and lists are below the bar). Off by default (`AD_CONFIG.bannerEnabled = false`; `?banner=1` on web shows the slot). Hidden in narrow layouts.

**Remove ads.** Settings → "Remove ads" explains the future purchase; until it exists, a test switch sets `adsRemoved`, after which every reward is granted at once with no ad (still subject to the same cooldowns and caps).

### Plugging in a real rewarded-ad provider (AdMob)

1. Move to a development build (`npx expo prebuild` / EAS Build): native ad SDKs do not run in Expo Go. Add the SDK (for example `react-native-google-mobile-ads`) and its config plugin with the app ids in `app.config.js`; add the iOS App Tracking Transparency prompt and the consent flow (UMP) the network requires.
2. Create one **rewarded** ad unit per placement in the network's console and put the ids in `AD_CONFIG.adUnits` (keys are the placement ids above; test unit ids during development).
3. Write `admobProvider: AdProvider`: keep one preloaded `RewardedAd` per placement; `isAvailable(p)` returns whether that unit has loaded; `show(p)` shows it and resolves `'rewarded'` on the earned-reward event, `'dismissed'` on close without it, `'unavailable'` on an error; reload after each show.
4. Call `setAdProvider(admobProvider)` once at start (for example in `app/_layout.tsx`), falling back to the mock when the native module is missing. Nothing else changes: buttons hide while no ad is loaded, rewards and caps stay in the engine, logs and counters keep working.
5. Banner: render the SDK's banner view inside `BannerSlot` with an adaptive size no taller than `AD_CONFIG.bannerHeight`, and turn `bannerEnabled` on.
6. "Remove ads": when the purchase exists, set `adsRemoved` from the store receipt instead of the test switch (and hide the banner).

## Pacing (`npm run balance:garage`)

Bots buy greedily by payback time, catch most golden moments, fix incidents, open crates when the offer allows and ship when the Hype gained raises the multiplier by half again (or the first time). Profiles: **casual** taps 3/s for 40 s in each of three check-ins a day (3, 3 and 4 minutes at 08:00, 13:00, 21:00); **active** taps 6/s non-stop; the ad versions watch the boost (casual: twice per check-in; active: once an hour), double offline earnings, extend frenzies, fix incidents, open crates, take the launch bonus and multiply bonuses when offered.

The lab layer in the bots: they tap a lab happening within its 9 s with a chance of 0.6 (casual) or 0.85 (active), launch every training run and keep the candidate that scores best for their style (casual values offline earnings and cap, active values production and taps; both value ship Hype), replacing their weakest kept model when the slots are full; split staff 4 / 5 / 3 (casual) or 3 / 6 / 3 (active) once it unlocks; ship with "Play it safe" (casual) or "Hype it" (active); and switch auto-buy on. `--legacy` runs the same bots on the content without the lab layer, `--without milestones,training,...` drops parts to measure each.

**Before** is the game as it was (the tables of the previous version of this document, which `--legacy` on the old content reproduces exactly); **after** is this version (`npm run balance:garage -- --days 16`). The owner's addendum asked for the same first session, a casual player (no ads) reaching the last named model in 12 to 14 days instead of 7.5, and ads worth 1.5x to 2x for that player.

Summary:

| Metric | Before | After |
| --- | --- | --- |
| Active, first ship | 15m 24s | 14m 31s |
| Active, second ship | 29m 17s | 25m 57s |
| Active, new things to buy in the first 10 min / longest gap | 29 / 1m 19s | 28 / 1m 19s |
| Casual (no ads), last named model (Model 12) | day 7.5 | day 13.5 |
| Casual + ads, last named model | day 5.3 | day 5.9 |
| Ad speed-up, casual, models 3 / 5 / 7 / 9 / 12 | 1.16x / 1.23x / 1.35x / 1.38x / 1.4x | 1.16x / 1.36x / 1.66x / 1.46x / 2.3x |
| Ad speed-up, active, ships 1 / 3 / 5 | 2.1x / 1.8x / 1.9x | 2.6x / 2.0x / 1.8x |

Model ships, active play (after):

| Ship | active: time | since last | Hype gained | active + ads: time | since last |
| --- | --- | --- | --- | --- | --- |
| 1 | 14m 31s | 14m 31s | 3 | 5m 35s | 5m 35s |
| 2 | 25m 57s | 11m 26s | 9 | 12m 54s | 7m 19s |
| 3 | 35m 00s | 9m 03s | 18 | 17m 47s | 4m 53s |
| 4 | 42m 42s | 7m 42s | 52 | 22m 58s | 5m 11s |
| 5 | 50m 32s | 7m 50s | 173 | 27m 29s | 4m 31s |
| 6 | 56m 18s | 5m 46s | 783 | 33m 10s | 5m 41s |
| 7 | 1h 3m | 7m 08s | 2954 | 39m 56s | 6m 46s |
| 8 | 1h 13m | 9m 39s | 16056 | 50m 00s | 10m 04s |
| 9 | 1h 24m | 10m 55s | 88710 | 1h | 10m 44s |

Before, for comparison: 15m 24s, 29m 17s, 38m 57s, 49m 29s, 57m 38s, 1h 6m, 1h 13m, 1h 23m, 1h 32m (active) and 7m 13s, 16m 58s, 22m 02s, 25m 28s, 30m 25s, 38m 58s, 44m 23s, 52m 49s, 1h 3m (active + ads).

Casual check-ins, model reached at the end of each day:

| Day | before: casual | before: casual + ads | after: casual | after: casual + ads |
| --- | --- | --- | --- | --- |
| 1 | 2 | 2 | 2 | 2 |
| 2 | 3 | 4 | 4 | 6 |
| 3 | 5 | 8 | 5 | 8 |
| 4 | 7 | 10 | 7 | 11 |
| 5 | 9 | 11 | 9 | 11 |
| 6 | 10 | 13 | 10 | 12 |
| 7 | 11 | 14 | 11 | 12 |
| 8 | 12 | 14 | 11 | 13 |
| 10 | 13 | 14 | 11 | 13 |
| 12 | | | 11 | 14 |
| 14 | | | 12 | 14 |
| 16 | | | 12 | 14 |

The casual player is never slower than before through day 7 (and a model ahead on day 2); after that the steeper thresholds make Model 12 a two-week goal. The long stay on Model 11 (days 7 to 13) is partly the bots' shipping rule (they wait until the Hype gained adds half again to the multiplier); every check-in still has training runs, happenings and staff to tend. The long game is a later task.

The lab (after): when each stage arrives, training runs launched, models kept and happenings tapped.

| Profile | Office | Data centre | Company town | Latent space | training runs | models kept | happenings tapped |
| --- | --- | --- | --- | --- | --- | --- | --- |
| casual | 13h | day 1.5 | day 3.3 | day 4.9 | 147 / 16 d | 20 | 119 |
| casual + ads | 13h | day 1.3 | day 1.9 | day 3.3 | 150 / 16 d | 21 | 122 |
| active | 7m 25s | 33m 59s | 50m 33s | 1h 13m | 33 / 3 h | 12 | 174 |
| active + ads | 4m 20s | 17m 40s | 27m 30s | 50m 01s | 34 / 3 h | 8 | 170 |

Ads watched (after): casual about 6 boosts, 3 crates, 2.9 offline doubles, 2.9 bonus multipliers, 2.2 frenzy extensions and 0.8 launch bonuses a day; active about 6.7 bonus multipliers, 3.3 incident fixes, 2 frenzy extensions and 1 boost an hour.

What changed in the numbers to get there: milestones are mild (×1.25 at 25 and 50, ×1.5 at 100 and 200, ×1.2 every 100 after) because a first draft with ×2 steps had the first ship at 9 minutes and Model 12 on day 3.5; model strengths are small shares (production +3 to 7% per roll before rarity); happenings pay 3 to 18 s of production; training runs come every 5 minutes; the Office needs 15M tokens in all; model thresholds from Model 3 on grow by an extra 1.6x per step; the crate gives 20 minutes of production and the launch bonus +30% Hype.

## Screen

Landscape (844×390 design size, insets from `useInsets()`): a quiet top bar (‹ Modes, the stage, Hype and the model name, the banner slot when enabled, Stats, Settings); the lab on the left; Build / Upgrades / Lab / Ship tabs on the right; the ticker along the bottom. Narrow windows stack the lab and the panel.

- **The lab** (`TapStage.tsx`, the room in `PixelRoom.tsx`, see "Art" below): every stage is a pixel-art room, a baked image plus one image per generator tier at its count bucket and a few slow loops on the shared ambient clock; it re-renders only when a bucket, the stage or the size changes. Over it: the token counter and the next stage goal on a plate (top left), the one ad offer (top right), timed effects and incidents, the model on its stage's plinth as the tap target, the combo meter, golden moments, lab happenings at their spots and the bonus multiplier offer. When a new stage unlocks the room flashes in the new stage's accent (under a second, UI thread, off with reduced motion; loading a save does not flash).
- **Lab tab** (`LabPanel.tsx`): training runs (queue pips, the next run's timer, Launch, the three candidates with rarity, description, green strengths and a red drawback, Keep / Swap in with "Retire which?" inline, Scrap all), active models and empty slots (and how many the next stage brings), staff (three lanes with count, bar, effect in words, − / +), helpers (auto-collect line, auto-buy switch). Locked parts say which stage unlocks them.
- **Ship tab** shows the progress, the Hype gain and "Start ship day" (`ShipDay.tsx`, an in-tree overlay); Lab Rep below.

- **Touch:** plain responder props on one view (no gesture-handler); each new touch identifier is one tap, so several fingers count; children draw with `pointerEvents="none"`.
- **Rendering:** the counter, the pop-out numbers and the combo meter are shared values shown through `LiveText` (a read-only TextInput whose text reanimated sets on the UI thread; on web it writes the input's value), so neither a tap nor the counter's 100 ms step commits anything in React. The model's squash and the rings run on shared values; lists subscribe through `useGarage(select, key)` and re-render only when a count, a price or an affordability flag changes; the ad slot re-renders only when the chosen placement changes; ship day reads the whole state only while it is open. The engine advances every 250 ms in the foreground.
- **Overlays:** the offline panel and the stage card (`ModalCard`), ship day, the launch card, the test ad and the Stats / Settings sheets are in-tree; no native `Modal`, no `SafeAreaView`.
- **Saves:** AsyncStorage through `src/ui/tutorial/storage.ts` (memory fallback), key `garage.save`; at most every 5 s while playing, at once on purchases, ships, rewards and resets, and when the app goes to the background. Settings (haptics) under `garage.settings`.
- **Debug (web):** `/garage?debug=1` exposes `window.__garage`: `setTokens(n)`, `grant(n)`, `fastForward(ms)` (an offline return), `golden(id?)`, `incident(id?, tier?)`, `frenzy(s?)`, `happening(id?)`, `training()` (a run with candidates), `bonusOffer(source?)`, `shipDay()`, `stage(n)`, `ad(placement)`, `scene('fresh' | 'mid' | 'ship' | 'late' | 'office' | 'datacentre' | 'town' | 'latent')` (a sample placed in the stage it has earned), `owned({ intern: 25, ... })` (set generator counts, to see the room fill), `freeze(on)` (hold the clock), `state()`. `&adseconds=n` shortens the test ad; `&banner=1` shows the banner slot.

Screenshots: `node scripts/screens/garage.js` (after `npx expo export --platform web`) writes docs/screenshots/garage/`<theme>-<W>x<H>-NN-name.png`: mode choice, fresh, mid-progress, upgrades, golden moment, frenzy, incident, offline return, test ad, doubled, ship panel, the three ship-day steps, launch result, stage card, office, training candidates, swap, kept models, happening, bonus multiplier, data centre, staff, company town, latent space, helpers, every stage's pixel room (empty, early, full, with a happening and a bonus offer), late save, stats, settings, and narrow. Captured at 844×390 and 926×428 with `INSETS=0,47,21,47` on the default theme (neon); the older blueprint, hazard and candy sets showed the previous screen and were removed.

**Performance** (`PERF=1 node scripts/screens/garage.js`, the method of scripts/screens/perf.js; `DIST=<dir>` measures another export): the data-centre room with blinking racks, a happening and a golden moment on screen, rapid touch taps on the model for 5 s at 6x CPU throttle. Task 28, five interleaved rounds at 926x428 on a shared machine (load 6 to 9): React commits per second while tapping 13.1 to 16.4 before, 0.4 to 0.8 after (each tap committed about twice and the counter up to 10 times a second; now a tap commits nothing, and what remains is the model's mood changing at a 30-tap combo). Frame time p95 50 / 66.6 / 50 / 66.7 / 33.4 ms before and 83.2 / 66.6 / 66.6 / 33.4 / 33.4 ms after: within the machine's noise, no measurable change on web, where reanimated's work runs on the main thread anyway.

## Presentation (task 28)

- **The room and the HUD.** The token counter and the next goal sit on an opaque plate at the top left. The goal is two lines: the place ("Next: The Office", cased with `cased()`), then the requirement in plain text, then the bar. Each pixel room keeps its top band (ceiling, trays, sky, the lattice) under the plate and the offer slot and puts everything that matters below them (see "Art", composition). The happening spots and the bubbles' clear-of-the-model helpers live in `LabRoom.ts` (the SVG room that file used to draw is gone).
- **Bubbles keep clear of the model.** `TapStage` passes the tap target's ring (`avoid`) to the happening, the golden moment and the bonus offer. Happenings and golden moments stay on their side of the model and wrap their label to two lines to fit (`clearSpan`); the "rack" spot is on the floor in front of the racks, so its label never crosses them. The bonus multiplier sits where the bonus was when it fits beside the model, otherwise it takes the stage's offer slot at the top right (empty then: one offer at a time).
- **First minute.** Until the first generator is bought on a brand-new lab, the line under the model says "Tap your model to make tokens", then, once the first generator is affordable, "Now buy Intern with a laptop in Build →" (`ui.garage.hint.*`, accent colour); after the purchase it is the usual quiet "Tap your model".
- **Targets.** The staff steppers draw 40 px and carry a 2 px slop each side (44 px targets); candidate buttons are 46 px tall.
- **Checks.** `scripts/screens/garage.js` checks in every capture that the offer never covers the model or a happening, a happening never covers the model, and the HUD, the model, the offer and the happening stay inside the side insets.
- **Sound and analytics** for the lab: docs/FEEL.md and docs/ANALYTICS.md; both read `src/ui/garage/moments.ts`.

## Art (tasks 29 and 30)

All five stages are drawn in pixel art: the garage, the office, the data centre, the company town and latent space. The old SVG room is gone; `LabRoom.ts` keeps only the happening spots and the bubble helpers.

**Grid and scale.** The room is **216 x 170 art pixels**, drawn at **2 dp per art pixel** (432 x 340 dp), centred horizontally and anchored to the bottom of the stage at a whole-dp offset. On a 3x phone one art pixel is 6 device pixels, on a 2x phone 4: whole pixels everywhere, never a blurry scale. The stage is 348 x 295 dp at 844x390 and 387 x 333 dp at 926x428 (insets 0,47,21,47), so the room covers both with a little to spare (the art from x 21 to 195 is always visible); anchoring to the bottom keeps the model's plinth on the same floor at every size, and bands in the room's wall and floor colours fill a bigger stage.

**Composition (what the HUD and the offer cover).** Measured in the game: the HUD plate covers art x 25 to 127, y up to 70 at 844 wide (x 15 to 117, y up to 51 at 926); the widest offer (the bonus multiplier) x 96 to 191, y up to 50 (x 106 to 201, y up to 31). So every room keeps its top band for things that do not matter (ceiling, trays and pipes, high windows, sky, the node lattice) and puts what matters lower: **on the left below y 72** (doors, the booth, the whiteboard, the water tower), **in the middle below y 72** above the model's head (the pegboard, the aisle, the campus, the halo), **on the right below y 52** (shelves, the billboard, racks). The model's body is about x 86 to 130, y 94 to 138 and its plinth x 82 to 134, y 133 to 154; no tier draws there. The happening spots land on things that match them: the door (about x 38 to 46, y 90 to 100), the desks (x 50 to 56, y 130 to 135) and the racks (x 169 to 175, y 135 to 140). The contact sheet's last panel per stage draws the visible areas, the plate, the offer, the model and the plinth.

**The model's plinth.** In every stage the model stands on a pixel plinth instead of the old opaque pad: two pallets (garage), a white launch stand with a lit strip (office), a server chassis (data centre), a marble plinth with a brass plaque (town), a slab of light (latent). It is one image per stage (`<stage>-plinth.png`, 52 x 20 art pixels with its contact shadow), drawn in the tap target under the model's feet (`ModelPlinth`); the tap area is unchanged (1.5 x 1 of the target size). The rings now only flash on a press (with the model's squash), so at rest the model just stands in the room.

The view is three-quarter: front faces flat to the viewer, tops visible, the floor receding in rows; light from the top left (top faces lightest, a highlight on the left edge, shade on the right); one-pixel ink outlines; no gradients or dithering, light pools and skies are hard steps.

**Files.**

| Where | What |
| --- | --- |
| `src/ui/garage/art/palettes.json` | The five palettes by role letter and each stage's UI accent: read by the generator and by the app (`stageColors.ts`) |
| `scripts/pixel/png.js` | Indexed PNG writer on Node's zlib |
| `scripts/pixel/canvas.js` | A canvas of palette roles; `sprite(name, frames, legend?)` turns grids into sprites |
| `scripts/pixel/art/*.js` | One file per stage (`garage.js`, `office.js`, `datacentre.js`, `town.js`, `latent.js`: the room, the tier objects, the plinth and the scene), `people.js` (interns), `props.js` (trophies, the sleeper and the pizza tower, the plinth), `draw.js` (the three-quarter block, lines, ellipses, light pools) |
| `scripts/pixel/scenes.js` | The list of stages and the kit their scenes are built with |
| `scripts/pixel/build.js` | `npm run pixel`: writes `assets/garage/*.png` (1x, @2x, @3x), `src/ui/garage/art/manifest.ts` and `docs/screenshots/garage/pixel-contact-sheet.png` (every sprite and each stage empty, early, mid, full and with layout guides, at 4x). `PREVIEW=<stage> [SPRITES=1] npm run pixel` writes only that stage's sheet to the temp folder, for quick looks |
| `src/ui/garage/PixelRoom.tsx`, `pixelLevels.ts` | The room and the plinth in the game |

**Palettes.** 18 roles per stage (some share a colour), sharing the ink, skin and wood families, dark overall with one strong accent. The accent is the stage's UI token: the stage name in the header, the next stage's colour on the "next stage" goal bar, a swatch and the unlock line on the stage card, and the stage-change flash. Buy buttons stay in the brand green and danger stays red: never use an accent for a warning.

| Role | garage | office | datacentre | town | latent |
| --- | --- | --- | --- | --- | --- |
| **accent (UI token)** | `#FFA726` | `#45FF5C` | `#2FD6C3` | `#FF8A3C` | `#B48CFF` |
| `k` ink (outlines) | `#141011` | `#0f1214` | `#0a1012` | `#140e12` | `#0e0a16` |
| `n` dark neutral | `#2a221d` | `#1f2528` | `#162528` | `#2a1c24` | `#1d1530` |
| `m` mid neutral | `#64554a` | `#46525a` | `#34504f` | `#563a48` | `#3e3060` |
| `M` light neutral | `#b59a78` | `#8d9ca5` | `#6f9799` | `#9a7684` | `#7d6aa8` |
| `h` highlight | `#f6e8cc` | `#eef5f7` | `#dcf6f3` | `#fbe6dc` | `#f0e6ff` |
| `w` wall | `#46392f` | `#2b3337` | `#1d2e31` | `#33232b` | `#1f1734` |
| `W` wall, lit | `#67513d` | `#36414a` | `#283c3f` | `#432e38` | `#2a1f46` |
| `f` floor | `#3f342b` | `#22292c` | `#152327` | `#281b22` | `#170f26` |
| `F` floor, lit | `#5a4938` | `#272f33` | `#1e3237` | `#34242c` | `#211833` |
| `a` accent | `#ffa726` | `#45ff5c` | `#2fd6c3` | `#ff8a3c` | `#a66bff` |
| `A` accent glow | `#ffd98a` | `#b8ffc0` | `#a6fff3` | `#ffc48a` | `#d9bcff` |
| `b` accent shade | `#a85a1c` | `#1f9e34` | `#137269` | `#b0451f` | `#5a2fb0` |
| `s` second colour | `#a8472a` | `#9fb3bd` | `#6fa8b0` | `#ff5c9a` | `#ff3cc8` |
| `S` second colour, lit | `#d9763f` | `#d5e2e8` | `#b9e3e6` | `#ffa8ca` | `#ff9ae6` |
| `p` skin | `#e6b08a` | `#e6b08a` | `#e6b08a` | `#e6b08a` | `#e6b08a` |
| `o` wood and cardboard | `#bd8d57` | `#a87c4c` | `#8a6a48` | `#a87c4c` | `#8a6a9a` |
| `u` wood shade | `#7d5733` | `#6e4c2c` | `#5a4430` | `#6e4c2c` | `#5a4470` |
| `G` status light | `#7ad65a` | `#45ff5c` | `#45ff5c` | `#7ad65a` | `#6affd0` |

garage: sodium amber and rust on warm concrete (task 30 lifted the walls, floor and neutrals so objects separate from the background in daylight; the bulb's pool is still the warmest thing). office: the game's neon green with cool whites. datacentre: cold teal and ice with green status lights (dark, not bright blue; its walls and floor lifted a little). town: sunset orange and pink. latent: violet and magenta.

**What the rooms show.** One baked image for the room and one image per tier slot, swapped at count levels **1, 5, 10, 25, 50, 100 owned** (`LEVELS`; level 0 shows nothing). Slots are fixed so tiers never draw on the same pixel (a test checks, at the fullest; the one exception is the intern walking in through the hall's doorway in the garage and the office) and stay clear of the model and its plinth. In every stage the interns' level 5 adds someone (walking in, presenting, waiting in the lobby, stepping out of the door) and level 6 has one intern asleep at the desk, face on the desk, with big Z's and a pizza tower.

| Tier | Garage | Office | Data centre | Town | Latent space |
| --- | --- | --- | --- | --- | --- |
| intern | folding tables with laptops (1 to 4) | wooden desks with monitors | consoles inside the glass booth | a receptionist behind the counter, hot desks, a visitor in the lobby | floating desks with screens and keyboards of light |
| gpu | open rigs of fan cards (1 to 4); a big fire extinguisher at 50 | GPU towers with lit fans (1 to 8) | GPU pods with coolant lines | white pods | floating cubes that turn |
| closet | server racks on the right wall | rack cabinets with glass doors | racks with ice LEDs | glass server pillars | floating monoliths |
| scraper | a pegboard of phones on the wall behind the model | a phone rack behind the model | the booth's feed wall | phones on display in the counter | a column of floating phones |
| hall | the roll-up door rises on aisles of racks | the server-room door lights up, propped open at 50 | the aisle's racks light up, nearest first | the campus grows outside the window | doors receding to the horizon |
| chips | trophy on the shelf | trophy on the window sill | a framed wafer in the booth | a wafer on a pedestal in the lobby | a giant chip hanging like a moon |
| power | trophy | trophy | a power riser and high-voltage panel | a reactor's cooling tower glowing on the horizon | a halo of light behind the model |
| robotics | trophy | trophy | robot arms on a gantry over the racks | a robot at the counter | a robot arm made of light |
| orbital | trophy | trophy | a satellite dish on a stand | a rocket on its pad (flame at 50) | a satellite |
| universe | trophy | trophy | stars where the end of the aisle was | a ringed planet rising | a galaxy in a glass globe |

In the garage and the office the later tiers stay as trophies (11 x 11 art pixels now, big enough to read), on the garage's shelf over the racks and on the office's window sill, up to the highest one owned.

**Motion.** Few and slow loops, frames side by side in one image: interns typing, fans, LEDs chasing, the phones' feeds, the bulb swinging, steam off a mug, the data centre's cooling fans and the booth's light, the billboard's face blinking and the water tower's light, the door's glow and a lattice node in latent space; the rocket's flame, the reactor's steam, the robot's blink and the galaxy's turn ride on their tier's frames. `PixelRoom` shows one frame through a clipped window and picks it from the shared ambient clock in a worklet (`floor(t x fps + phase) % frames`), so nothing re-renders while it animates and everything stops with the clock (background, reduced motion). At most 13 room images at the fullest plus the plinth (a test counts).

**Add a sprite.** Draw it as a grid (`sprite()`) or in code (`paint()` with `block`, `line`, `ellipse`) in the stage's file: role letters from the table, light from the top left, an ink outline, only the palette's roles (swap shirts and hair with role maps, never new colours). Compose it into a tier's `draw(level, frame)` or the room, run `PREVIEW=<stage> npm run pixel` while drawing, then `npm run pixel`, open the contact sheet and the screenshots, and look at it at phone size. To add a stage, give it a palette in `palettes.json` and a module with `scene()` in `scripts/pixel/art/`, listed in `scenes.js`.

**Regenerate.** `npm run pixel` (deterministic: the same sources give the same bytes; `CHECK=1 npm run pixel` exits 1 if a file on disk differs). `src/ui/garage/__tests__/pixelArt.test.ts` fails when the files are stale, checks every referenced image at 1x, 2x and 3x, the slots (no overlaps, clear of the model and the plinth), that the later stages show every later tier at every level, the image count, and that `assets/garage` stays under 1.5 MB (about 430 KB now).

**Screenshots.** `scripts/screens/garage.js` captures every stage's pixel room empty, early, full and with a happening and a bonus offer (`NN-pixel-<stage>-*.png`), checks that each draws its room and its plinth and that a stage change flashes the room.
