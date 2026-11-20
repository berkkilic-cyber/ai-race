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

// AI and headless play
chooseAiActions(state, pack, labId): Action[]               // also used for rivals
runHeadless(pack, setup, opts): GameState                   // plays a whole run with a bot as the player
                                                            // opts: { policy, maxTicks, onTick? }; policies: sensible,
                                                            // random, idle, and capability / reach / shadow (tree-focused)
defaultBalance: BalanceConfig                               // src/engine/balance.ts
```

- State is immutable from the caller's point of view: `step` and `applyAction` return a new state and never mutate their input. Internally the engine may clone once and mutate.
- Deterministic: all randomness comes from a seeded PRNG whose state is `GameState.rng`. Same seed and same actions give the same run.
- `step` does nothing when `status === 'ended'` or when `pendingEvent` is set.
- 1,000 headless runs must finish in under 60 seconds.
- News params: {lab} and {rival} are lab ids, {region} a region id, {achievement} an achievement id; the UI resolves them to names. The engine's own news keys are `ENGINE_NEWS_KEYS`; `validatePack` requires a string for each, and for the UI theme words `term.*`.

## Simulation rules

A tick is one game day. The UI runs 2 ticks per second at 1x speed; a run should last roughly 2,400 to 3,600 ticks (20 to 30 minutes). All constants below are named fields in `BalanceConfig` so the balance pass can tune them without code changes.

Each tick, for every active lab, in `labOrder`:

1. **Compute** = sum over online data centres of `level × computePerLevel`, times the `computeCapacity` modifier, plus `computeBonus`.
2. **Effective capability** = the highest `capabilityLevel` among owned nodes, capped at `floor(compute / computePerCapabilityLevel)`. A lab with no capability node has level 0 and its starter product.
3. **Spread.** In each region where the lab has adoption > 0 and is not banned:
   `growth = baseSpread × appeal × openness × adoption × free`, where `free = 1 − sum of all labs' adoption there` and `appeal = (1 + appealPerCapability × capability) × spreadRate modifier × (1 − backlash / 200)`. When `free` is near zero, a lab with higher appeal slowly takes share from labs with lower appeal (`stealRate`).
4. **Seeding.** From each region with adoption ≥ `seedThreshold`, each neighbouring region where the lab is absent and not banned has a per-tick chance `seedChance × openness × seedChance modifier` to start at `seedAmount`. `launchInRegion` does the same on demand for Cash.
5. **Income.** `cash += (cashBase + Σ users × wealth × cashPerUser) × cashIncome modifier − upkeep`. Upkeep is data centre levels × region `powerCost` × `dataCentreUpkeep`. Cash never goes below zero: when upkeep cannot be paid, the costliest data centre goes offline for `unpaidOfflineTicks`. `hype += hypeBase + hypePerNewUser × new users this tick`, times the `hypeIncome` modifier.
6. **AGI progress** `+= agiBase × capability^agiExponent × (1 + agiComputeFactor × compute^agiComputeExponent) × agiRate modifier`, times `aiAgiFactor` for AI labs (a difficulty knob). An exponent below 1 gives compute diminishing returns, so a lab that hoards data centres cannot run away with AGI.
7. **Regulation** rises with growth in strict regions: `Σ new users × strictness × regulationPerGrowth`, plus `regulationPerShare × world share`, times the `regulationGain` modifier. **Backlash** rises with capability and footprint: `backlashPerCapability × capability × world share + backlashPerDataCentreLevel × total levels`, times the `backlashGain` modifier. Both have a small natural decay and clamp to 0..100. AI labs get no event cards to relieve their meters, so for them both gains are multiplied by `aiMeterGainFactor` and they lose an extra `aiRegulationDecay` / `aiBacklashDecay` per tick.
8. **Bans.** Each time a lab's regulation crosses 25, 50 and 75, the strictest regions where it is present ban it for `banDuration` ticks (adoption there decays while banned). A news item with `regionId` is emitted so the map can flash.
9. **Elimination.** Regulation ≥ 100 → eliminated `banned`. Backlash ≥ 100 → eliminated `revolt`. An eliminated lab's adoption decays to zero over a few ticks.

Then, once per tick:

- **AI labs** act every `aiDecisionInterval` ticks through `chooseAiActions` (same actions and costs as the player, weighted by `personality`). Rivals enter at their `entryTick`. The controller protects itself: from meter level 50 it grows cautious per meter (fewer capability nodes as backlash rises, launches avoid strict regions, nodes that lower a worrying meter are wanted whatever the personality); above 40% caution it stops launching and stops adding compute. AI labs never buy other labs: buying out rivals is the player's path to a monopoly.
- **Events.** When `tick ≥ nextEventTick` and nothing is pending, draw one eligible `EventDef` for the player by weight (respecting `once`), set `pendingEvent`. The next one is scheduled `eventIntervalMin..Max` ticks after it is resolved. AI labs do not get choice events.
- **Headlines.** Every `headlineIntervalMin..Max` ticks one eligible `HeadlineDef` is added to `news`; `about: 'rival'` picks a random active rival and applies its effects to that rival.
- **Achievements.** `checkAt: 'tick'` achievements are tested for the player.
- **Endings**, checked in this order: player eliminated → `banned` / `revolt`; a rival's AGI progress ≥ 100 → `rivalAgi`; player's AGI progress ≥ 100 → `agi`; all rivals eliminated or acquired (and all have entered) → `monopoly`; player world share ≥ `dependenceShare` → `dependence`. The matching `EndingDef` variant is chosen, `checkAt: 'end'` achievements are tested, and a score is computed.

**Actions.** `buyNode` needs all `requires`, Hype (and Cash if `cashCost`); node prices rise by `nodeCostGrowth` per node already owned, and data centre upgrades by `dataCentreUpgradeGrowth` per level already owned. `buildDataCentre` needs presence in the region, no ban, Cash, and fewer than `maxDataCentresPerRegion` there. `acquireRival` needs the `canAcquire` flag and Cash ≥ a price that grows with the rival's users, compute and AGI progress; the buyer takes over a share of the rival's adoption. `resolveEvent` pays the choice cost, applies effects, rolls the optional risk and fills `lastEventResult`.

## Bots and balance tooling

`runHeadless` plays the player's seat with a `BotPolicy`: `sensible` (the same planner as the rivals, default personality), `random`, `idle`, and the tree-focused `capability`, `reach` and `shadow` policies, which plan like `sensible` with their own personality and a push towards their win (model tiers and spare compute; launches every decision; buy-out tools and saving cash for acquisitions). `scripts/balance/` plays many runs per policy across founders and home regions and prints a report (`npm run balance`, see `docs/BALANCE.md`).

## UI state

A single Zustand store holds `GameState` and the pack. A game-loop hook calls `step` on a timer (paused, 1x, 2x, 3x). Screens read through selectors and dispatch `Action`s; they never compute game rules themselves. All user-visible text goes through the pack's `strings` with a `t(key, params)` helper.
