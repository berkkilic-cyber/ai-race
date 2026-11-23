# Architecture

One Expo (React Native) + TypeScript app. Three layers, with a strict dependency direction:

```
app/, src/ui/   →   src/content/   →   src/engine/
(screens)          (theme packs)       (pure simulation)
```

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/engine/` | Theme-agnostic simulation. Pure TypeScript, deterministic, no React, no React Native, no Expo, no Node APIs, no JSON content | nothing outside `src/engine/` |
| `src/content/` | Content packs (`packs/ai-lab/`): JSON data, strings, pack assembly, validation | `src/engine/` types |
| `src/ui/`, `app/` | Screens (expo-router), components, game loop hook, stores | both |
| `scripts/` | Node scripts: balance simulation, map build | all |

`src/engine/types.ts` is the contract between the layers. Do not change it in a task branch; ask the orchestrator.

A second game theme (crypto founder, rocket company) must be possible by adding `src/content/packs/<theme>/` only. Never hard-code AI-lab names, numbers or text in the engine or in shared UI components.

## Engine public API (`src/engine/index.ts`)

```ts
createGame(pack: ContentPack, setup: GameSetup): GameState
step(state: GameState, pack: ContentPack): GameState        // advance one tick
applyAction(state, pack, action: Action): ActionResult
canApply(state, pack, action: Action): ActionCheck

// selectors (pure reads)
getMeters(state, labId): Meters
getCompute(state, pack, labId): number
getCapabilityLevel(state, pack, labId): number              // effective model tier, capped by compute
getUsers(state, pack, labId): number                        // millions
getWorldShare(state, pack, labId): number                   // 0..1
getIncome(state, pack, labId): { cash: number; hype: number }   // per tick
getNodeCost(state, pack, labId, nodeId): { hype: number; cash: number }
getDataCentreCost(state, pack, labId, regionId): number
getUpgradeCost(state, pack, labId, dataCentreId): number
getLaunchCost(state, pack, labId, regionId): number
getAcquirePrice(state, pack, labId, targetLabId): number
getModifierTotal(state, pack, labId, stat, regionId?): number
isBanned(state, labId, regionId): boolean
checkConditions(state, pack, labId, conditions): boolean
getEndingParams(state): Record<string, string>              // {lab} = player, {rival} = winning rival, for ending text
getMoments(state, labId): MomentState[]                     // the lab's moments on the map now
getMomentProgress(state, uid): number                       // 0..1 of the moment's lifetime used (1 once it is gone)
getOwnedCapabilityLevel(state, pack, labId): number         // highest tier owned, whatever the compute
getComputeRequired(pack, level): number                     // compute needed to run a tier
getComputeShortfall(state, pack, labId): number             // compute missing for the highest owned tier (0 if none)
getWinProgress(state, pack, labId): WinProgress             // { agi 0..1, dependence 0..1 (share ÷ threshold),
                                                            //   monopoly: { remaining, total } rivals }
getStandings(state, pack): StandingRow[]                    // one row per lab, by world share: status, share, users,
                                                            // agi 0..1, tier / ownedTier, compute, data centres,
                                                            // banned regions, home region
getIncomeBreakdown(state, pack, labId): IncomeBreakdown     // { hype, cash }: { total, lines[] } per tick; sources
                                                            // base, newUsers (last tick), perUser, modifiers, and one
                                                            // upkeep line per online data centre (negative)
getReachableRegions(state, pack, labId): RegionReach[]      // per region: present, reachable now (full-chance seeding),
                                                            // from / via / channel of the best route, or blockedBy
                                                            // barrier ids and unlockedBy { barrier: node ids }

// AI and headless play
chooseAiActions(state, pack, labId): Action[]               // also used for rivals
runHeadless(pack, setup, opts): GameState                   // plays a whole run with a bot as the player
                                                            // opts: { policy, maxTicks, onTick?, momentSkill?,
                                                            // onMomentCollected? }; policies: sensible, random, idle,
                                                            // and capability / reach / shadow (tree-focused)
defaultBalance: BalanceConfig                               // src/engine/balance.ts

// difficulty
getDifficulties(pack): DifficultyDef[]                      // the pack's levels, easiest first ([] if none)
getDifficulty(state, pack): DifficultyDef | undefined       // the run's level after fallback
getBalance(state, pack): BalanceConfig                      // the merged balance the run plays with
getFounderStart(pack, founderId, difficulty?): { hype, cash } // a founder's start at a level (start screen)
resolveDifficulty(pack, id?): DifficultyDef | undefined     // named -> pack default -> none

// run length
getRunLengths(pack): RunLengthDef[]                         // the pack's presets, shortest first ([] if none)
getRunLength(state, pack): RunLengthDef | undefined         // the run's preset after fallback
getScoreMultiplier(state, pack): number                     // difficulty × run length multipliers
resolveRunLength(pack, id?): RunLengthDef | undefined       // named -> pack default -> none
getFounderStart(pack, founderId, difficulty?, runLength?)   // (the start screen passes both)
```

- State is immutable from the caller's point of view: `step` and `applyAction` return a new state and never mutate their input. Internally the engine may clone once and mutate.
- Deterministic: all randomness comes from a seeded PRNG whose state is `GameState.rng`. Same seed and same actions give the same run.
- `step` does nothing when `status === 'ended'` or when `pendingEvent` is set.
- 1,000 headless runs must finish in under 60 seconds.
- News params: {lab} and {rival} are lab ids, {region} a region id, {achievement} an achievement id, {model} a node's name key (translate it), {tier} a number; the UI resolves them to names. The engine's own news keys are `ENGINE_NEWS_KEYS`; `validatePack` requires a string for each, and for the UI theme words `term.*` (`term.rival` labels the lead rival's AGI meter, `term.rivals` the rival labs themselves).
- Packs also define `stat.<Stat>.gain` / `stat.<Stat>.loss` for every `Stat` (required by `validatePack`, `{pct}` = size of the change, e.g. "Spreads {pct} faster") so the UI can describe modifiers in plain words, `barrier.*` / `channel.*` names for `getReachableRegions` (with an optional mid-sentence form `barrier.<id>.inline`, "Blocked by the ocean."), and optional background parody brands as `brand.<id>.name` / `brand.<id>.kind`.
- Every news item the engine emits has a `kind` (`ENGINE_NEWS_KINDS` maps each engine key): `launch` (a lab ships a new model tier; also carries `nodeId` and `tier`), `entry` (a rival enters, or a lab first reaches a region through a channel: params `channel`, `from` and, for jumps, `via`), `ban`, `elimination`, `acquisition`, `achievement`, `moment` (an expired threat), `headline` (pack headlines), `other` (region launches, unpaid data centres, content `news` effects).

## Simulation rules

A tick is one game day. The UI runs 2 ticks per second at 1x speed; a run should last roughly 2,400 to 3,600 ticks (20 to 30 minutes). All constants below are named fields in `BalanceConfig` so the balance pass can tune them without code changes.

Each tick, for every active lab, in `labOrder`:

1. **Compute** = sum over online data centres of `level × computePerLevel`, times the `computeCapacity` modifier, plus `computeBonus`.
2. **Effective capability** = the highest `capabilityLevel` among owned nodes, capped at `floor(compute / computePerCapabilityLevel)`. A lab with no capability node has level 0 and its starter product.
3. **Spread.** In each region where the lab has adoption > 0 and is not banned:
   `growth = baseSpread × appeal × openness × adoption × free`, where `free = 1 − sum of all labs' adoption there` and `appeal = (1 + appealPerCapability × capability) × spreadRate modifier × (1 − backlash / 200)`. When `free` is near zero, a lab with higher appeal slowly takes share from labs with lower appeal (`stealRate`).
4. **Seeding.** From each region with adoption ≥ `seedThreshold`, each neighbouring region where the lab is absent and not banned has a per-tick chance `seedChance × openness × seedChance modifier` to start at `seedAmount`. `launchInRegion` does the same on demand for Cash (launches ignore barriers).
   **Barriers and channels.** A region may carry `barriers` (on seeding into it) and `linkBarriers` (on the link to a neighbour, listed on both sides, e.g. sea links); the ids come from `ContentPack.barriers`. Each barrier on the link or the target that the lab holds no channel for multiplies the chance by `barrierSeedFactor`. A lab holds the channels of its owned nodes (`NodeDef.channels`) and, while the flag is set, `channel:<id>` flags (a `setFlag` effect with `durationTicks` makes it timed). `ChannelDef.kind`: `clear` lifts the barriers in `clears` (default: the barrier with the channel's id); `jump` also seeds regions two links away (not neighbours) at × `viralSeedFactor`, barriers of both links and the target counting; `open` multiplies the holder's seed chance by `openSeedFactor` and every other active lab's appeal by (1 + `openRivalSpreadBonus`) per holder. The first time a lab reaches a region by a seed that a `clear` channel let through, or by a jump, one news item of kind `entry` is emitted (the channel's `entryTextKey`, else `engine.news.entry.channel`; params `lab`, `region`, `from`, `channel`, `via` for jumps; tone good for the player, neutral for rivals; internal flag `$entered:<region>`). `open` alone never names a route.
5. **Income.** `cash += (cashBase + Σ users × wealth × cashPerUser) × cashIncome modifier − upkeep`. Upkeep is data centre levels × region `powerCost` × `dataCentreUpkeep`. Cash never goes below zero: when upkeep cannot be paid, the costliest data centre goes offline for `unpaidOfflineTicks`. `hype += hypeBase + hypePerNewUser × new users this tick`, times the `hypeIncome` modifier.
6. **AGI progress** `+= agiBase × capability^agiExponent × (1 + agiComputeFactor × compute^agiComputeExponent) × agiRate modifier`, times `aiAgiFactor` for AI labs (a difficulty knob). An exponent below 1 gives compute diminishing returns, so a lab that hoards data centres cannot run away with AGI.
7. **Regulation** rises with growth in strict regions: `Σ new users × strictness × regulationPerGrowth`, plus `regulationPerShare × world share`, times the `regulationGain` modifier. **Backlash** rises with capability and footprint: `backlashPerCapability × capability × world share + backlashPerDataCentreLevel × total levels`, times the `backlashGain` modifier. Both have a small natural decay and clamp to 0..100. AI labs get no event cards to relieve their meters, so for them both gains are multiplied by `aiMeterGainFactor` and they lose an extra `aiRegulationDecay` / `aiBacklashDecay` per tick.
8. **Bans.** Each time a lab's regulation crosses 25, 50 and 75, the strictest regions where it is present ban it for `banDuration` ticks (adoption there decays while banned). A news item with `regionId` is emitted so the map can flash.
9. **Elimination.** Regulation ≥ 100 → eliminated `banned`. Backlash ≥ 100 → eliminated `revolt`. An eliminated lab's adoption decays to zero over a few ticks.

Timed flags (`setFlag` with `durationTicks`) are removed when `tick` reaches `LabState.flagTimers[flag]`; a timed flag never shortens a permanent one. `LabState.newUsersLastTick` keeps the last tick's growth for `getIncomeBreakdown`.

10. **Model launches.** When a lab's effective capability (rule 2, after the compute cap) reaches a tier it has never run this run, one news item of kind `launch` is emitted: `engine.news.launch.player` (tone good) or `engine.news.launch.rival` (tone bad), params `lab`, `model` (name key of the owned node providing the tier) and `tier`, with `nodeId`, `tier`, `labId` and the lab's home `regionId`. Internal flags `$launched:<tier>` make it once per tier per lab, even if compute later drops and recovers; a jump of several tiers announces only the top one. Rival launches use `engine.news.launch.rival` or its numbered variants `engine.news.launch.rival.2`, `.3`, ... (counted in the pack's first locale), picked by (lab's index in `labOrder` + tier) mod (variants + 1), so no random draw is spent.

Then, once per tick:

- **AI labs** act every `aiDecisionInterval` ticks through `chooseAiActions` (same actions and costs as the player, weighted by `personality`). Rivals enter at their `entryTick`. The controller protects itself: from meter level 50 it grows cautious per meter (fewer capability nodes as backlash rises, launches avoid strict regions, nodes that lower a worrying meter are wanted whatever the personality); above 40% caution it stops launching and stops adding compute. AI labs never buy other labs: buying out rivals is the player's path to a monopoly.
- **Moments** (tap-to-collect, only for human-controlled labs). First, moments with `tick ≥ expiresTick` expire: `onExpire` applies, the lab's `stats.momentsMissed` rises, and a threat (not a boost) adds one news item of kind `moment` with its `expireTextKey` (params `lab`, `region`). Then, when `tick ≥ nextMomentTick`, each active human lab with fewer than `maxActiveMoments` moments gets one: a `MomentDef` whose `conditions` hold is drawn by `weight`, and placed in a region where the lab is present, not banned and has no other moment, weighted by its users there; a moment with a `dataCentre` effect only goes where the lab has a data centre. The next attempt is `momentIntervalMin..Max` ticks later, × (1 − `momentShareSpeedup` × the lab's world share), never below `momentIntervalFloor`. `collectMoment` applies `onCollect` and raises `momentsCollected`; collecting adds no news. Effects with `atMoment: true` act on the moment's region instead of their scope; `resource` effects with `scaleWithIncome: n` add n ticks of the lab's average income of that resource so far (`stats.*Earned ÷ tick`). Because this runs inside `step`, nothing spawns or expires while an event card is pending; `checkEnding` clears all moments. AI labs get no moments; their `aiAgiFactor` carries the expected moment income instead (see `docs/BALANCE.md`).
- **Events.** When `tick ≥ nextEventTick` and nothing is pending, draw one eligible `EventDef` for the player by weight (respecting `once`), set `pendingEvent`. The next one is scheduled `eventIntervalMin..Max` ticks after it is resolved. AI labs do not get choice events.
- **Headlines.** Every `headlineIntervalMin..Max` ticks one eligible `HeadlineDef` is added to `news`; `about: 'rival'` picks a random active rival and applies its effects to that rival.
- **Achievements.** `checkAt: 'tick'` achievements are tested for the player.
- **Endings**, checked in this order: player eliminated → `banned` / `revolt`; a rival's AGI progress ≥ 100 → `rivalAgi`; player's AGI progress ≥ 100 → `agi`; all rivals eliminated or acquired (and all have entered) → `monopoly`; player world share ≥ `dependenceShare` → `dependence`. The matching `EndingDef` variant is chosen, `checkAt: 'end'` achievements are tested, and a score is computed.

**Actions.** `buyNode` needs all `requires`, Hype (and Cash if `cashCost`); node prices rise by `nodeCostGrowth` per node already owned, and data centre upgrades by `dataCentreUpgradeGrowth` per level already owned. `buildDataCentre` needs presence in the region, no ban, Cash, and fewer than `maxDataCentresPerRegion` there. `collectMoment` needs an existing, unexpired moment of that lab (`unknownId` otherwise, `notAllowed` for another lab's) and fails with `eventPending` while a card is up. `acquireRival` needs the `canAcquire` flag and Cash ≥ a price that grows with the rival's users, compute and AGI progress; the buyer takes over a share of the rival's adoption. `resolveEvent` pays the choice cost, applies effects, rolls the optional risk and fills `lastEventResult`.

## Difficulty

A pack may define `difficulties` (`DifficultyDef`: id, name and description keys, a `balance` override and a `scoreMultiplier`) and a `defaultDifficulty`. `GameSetup.difficulty` picks one; an unknown or missing id falls back to the pack default, then to no override. `createGame` stores the resolved id in `GameState.difficulty`, and every engine entry point that gets a state reads the run's context through `getContext(pack, state.difficulty)`: one context per pack and level, sharing the pack's lookup tables, with the balance merged as engine defaults ← pack `balance` ← difficulty `balance`. Selectors keep their signatures. `getComputeRequired(pack, level, state?)` is the only one without a state; `validatePack` therefore keeps the compute curve (`computePerCapabilityLevel`, `capabilityComputeExponent`) out of difficulty overrides. The final score is multiplied by `scoreMultiplier` (rounded once). UI code that needs a balance number must read `getBalance(state, pack)`, never `pack.balance`.

Balance levers added for difficulty (all neutral at their defaults): `playerStartHypeFactor` / `playerStartCashFactor` (founder start × factor), `rivalEntryTickFactor` (every rival's `entryTick` ×, rounded), `aiExpansionFactor` (rivals' personality `expansion` ×), `playerRegulationGainFactor` / `playerBacklashGainFactor` (human labs' per-tick meter gains ×), `momentBoostWeightFactor` / `momentThreatWeightFactor` (spawn weight by moment kind ×) and `momentLifetimeFactor` (moment lifetime ×, at least 1 tick). Levels and their numbers: `docs/BALANCE.md`.

## Start bonus (`GameSetup.bonus`)

A bonus earned outside the run (the Garage's Lab Rep perks, src/ui/meta) reaches the engine as `GameSetup.bonus: StartBonus` (`startHype?`, `startCash?`, `modifiers?`). `createGame` applies it to the human lab only: `startHype` / `startCash` are added to the founder's start **after** the difficulty's `playerStart*Factor` (the player is shown a fixed "+3 Hype", which must mean the same on every level; never below 0, non-finite amounts ignored); each modifier is appended after the founder's as a permanent entry in `LabState.timedModifiers` with `untilTick = PERMANENT_UNTIL_TICK` (`Number.MAX_SAFE_INTEGER`, finite so it survives the JSON run save; `LabState` has no list of permanent extra modifiers and `types.ts` was not changed). Absent, empty or zero bonus = bit-identical game (tested). Rivals are untouched. Tests: src/engine/__tests__/startBonus.test.ts.

## Run length

A pack may define `runLengths` (`RunLengthDef`: id, name and description keys, a `balance` override and a `scoreMultiplier`) and a `defaultRunLength`, resolved exactly like a difficulty: `GameSetup.runLength` names one, an unknown or missing id falls back to the pack default, then to none; `createGame` stores the resolved id in `GameState.runLength`, and every entry point reads `getContext(pack, state.difficulty, state.runLength)` (one context per pack, level and length). Balance layers: engine defaults ← pack `balance` ← difficulty `balance` ← run-length `balance`, then **paced**. The final score is multiplied by both multipliers (rounded once). A pack without run lengths, or a preset with no overrides, plays bit for bit as before (tested).

**Pace.** `BalanceConfig.pace` (default 1; only a run length may set it, `validatePack` keeps it out of the pack balance and difficulties) is how much game happens per tick, so a short run plays the same arc in fewer ticks instead of stopping early. Everything is written for the standard run and converted once, in `applyPace` (src/engine/balance.ts) and at the few places content carries ticks:

- per-tick rates (`PACE_RATE_KEYS`: spread, steal, seed chance, ban and elimination decay, income bases and per-user cash, AGI base, meter per-tick gains and decays, upkeep, the score's per-tick speed bonus) × pace; per-tick fractions stay at most 1;
- tick counts (`PACE_TICK_KEYS`: AI decision interval and cash reserve, event and headline timing, ban duration, offline durations, the score's target tick) ÷ pace, rounded, at least 1;
- content: effect durations (`timedModifier`, `ban`, `dataCentre` disable, timed `setFlag`), rivals' entry ticks (after `rivalEntryTickFactor`) and `tickAtLeast` / `tickAtMost` conditions ÷ pace;
- not paced: per-event amounts (Hype per new user, Regulation per new user), costs, thresholds, start resources, and moment spawn timing and lifetimes, which are real time because a person taps them (the effects a moment applies are paced like any other effect; its income-scaled rewards follow the paced income).

`runHeadless` takes `opts.runLength` (replaces `setup.runLength`). UI code that needs a balance number reads `getBalance(state, pack)`, which is the paced balance. Content and numbers: `docs/BALANCE.md` ("Task 21").

## Bots and balance tooling

`runHeadless` plays the player's seat with a `BotPolicy`. Its `momentSkill` option (0..1, default `DEFAULT_MOMENT_SKILL`: 0.7 for sensible and the focused policies, 0.3 random, 0 idle) is the chance the bot taps a moment before it expires, rolled when the moment appears with a generator of its own (so the roll never shifts the game's random stream); a tapped moment is collected after a reaction delay of up to 60% of its lifetime. Policies: `sensible` (the same planner as the rivals, default personality), `random`, `idle`, and the tree-focused `capability`, `reach` and `shadow` policies, which plan like `sensible` with their own personality and a push towards their win (model tiers and spare compute; launches every decision; buy-out tools and saving cash for acquisitions). `scripts/balance/` plays many runs per policy across founders and home regions and prints a report (`npm run balance`, see `docs/BALANCE.md`; `--moment-skill` plays each policy at several tap skills, `--moments file.json` swaps the pack's moments for a sweep; `--difficulty id,id|all` plays each policy at each level and adds a table across levels; `--runLength id,id|all` plays each policy at each run length and adds a table comparing the first with the last: win rates and their gap, real minutes at 1x, event cards, moments, rival launches, and every ending's frequency; `--brief` prints only the summary tables). `scripts/balance/firstSession.ts` times a fresh install's first run with a prompt player following the real tutorial state machine (see its header).

## UI state

A single Zustand store holds `GameState` and the pack. A game-loop hook calls `step` on a timer (paused, 1x, 2x, 3x). Screens read through selectors and dispatch `Action`s; they never compute game rules themselves. All user-visible text goes through the pack's `strings` with a `t(key, params)` helper.
