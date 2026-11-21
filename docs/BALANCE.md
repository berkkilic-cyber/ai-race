# Balance

## Task 12: moments, launch news, spread channels (current numbers)

Seed **2026**, 1,000 runs per policy (6,000 runs in about 390 s on 2 workers, so 1,000 runs take about 65 s of wall time here while sharing the machine; the jest budget test, 200 headless runs with moments in under 12 s, passes). Bots tap moments with `momentSkill` 0.7 (sensible and the focused policies), 0.3 (random), 0 (idle).

| Policy     | Runs | Win   | agi   | dependence | monopoly | banned | revolt | rivalAgi | Ticks p10/p50/p90  |
| ---------- | ---- | ----- | ----- | ---------- | -------- | ------ | ------ | -------- | ------------------ |
| sensible   | 1000 | 46.5% | 31.2% | 10.9%      | 4.4%     | 10.2%  | 11.5%  | 31.8%    | 1775 / 2741 / 3057 |
| capability | 1000 | 34.6% | 28.2% | 6.1%       | 0.3%     | 18.7%  | 15.3%  | 31.4%    | 1699 / 2639 / 3059 |
| reach      | 1000 | 48.3% | 14.6% | 26.9%      | 6.8%     | 18.7%  | 10.0%  | 23.0%    | 1443 / 2592 / 3046 |
| shadow     | 1000 | 68.5% | 22.1% | 10.0%      | 36.4%    | 8.8%   | 8.7%   | 14.0%    | 1717 / 2492 / 2927 |
| random     | 1000 | 5.4%  | 1.9%  | 3.5%       | 0.0%     | 77.3%  | 15.8%  | 1.5%     | 1403 / 1836 / 2497 |
| idle       | 1000 | 0.0%  | 0.0%  | 0.0%       | 0.0%     | 0.0%   | 0.0%   | 100.0%   | 2547 / 3007 / 3123 |

### Against the targets

| # | Target | Result | Met |
| --- | --- | --- | --- |
| 1 | sensible wins 30 to 60%; median 2,400 to 3,600 ticks; p10 > 1,500; p90 < 4,800 | 46.5%; 2,741; 1,775; 3,057 | yes |
| 2 | idle ≤ 2%, random ≤ 20% | 0.0%, 5.4% | yes |
| 3 | every trigger ≥ 3% for sensible; each win ≥ 25% for its focused policy | lowest monopoly 4.4%; agi 28.2% (capability), dependence 26.9% (reach), monopoly 36.4% (shadow) | yes |
| 4 | rivals eliminate themselves in < 20% of appearances; lead rival AGI > 50 in most player wins | 6.2%; 73.5% of wins | yes |
| 5 | typical sensible win owns about 18 to 30 nodes; buying every rival rare | nodes p10/p50/p90 28/30/33; cash p50 594; every rival bought 1.2% | yes (top of range, as before) |
| 6 | first node ≤ ~60, first data centre ≤ ~250, something every 60 to 120 ticks | tick 1, tick 1; purchase gap median 60, p75 90, p90 130 | yes |
| 7 | no founder < 20% or > 70%; flag regions < 10% or > 85% | founders 39.6% to 56.6%; regions 26.2% (india) to 73.2% (nigeria) | yes |

### Moments

Per sensible run (median): 52 tapped, 22 missed. Moment income is **10.3% of all Hype** earned (moments + income, median 330 Hype a run) and **2.0% of all Cash**. Boost rewards are `scaleWithIncome` amounts: a fixed part plus a few ticks of the lab's average income so far, so they grow mildly with the run.

Win rate by moment skill (sensible, 1,000 runs each):

| momentSkill | Win | Tapped / missed (median) | Moment share of Hype |
| --- | --- | --- | --- |
| 0 | 21.1% | 0 / 76 | 0% |
| 0.4 | 31.4% | 30 / 45 | 6.1% |
| 0.7 | 46.5% | 52 / 22 | 10.3% |
| 1.0 | 59.1% | 76 / 0 | 14.1% |

The spread (38 points from 0 to 1) is wider than the 10 to 20 aimed for. The two aims conflict: probes showed the swing comes almost entirely from boost Hype (with every threat penalty removed, skill 0 vs 1 still moved 18% → 66%; with only the Hype parts of boosts kept, 19% → 63%), and the race against rival AGI is so tight that each percent of extra Hype is worth about 2.5 points of win rate. Hype share at the 10% floor gives this spread; a 10 to 20 point spread would need moment Hype near 4 to 5% (the first version: 4.1%), or a structural change (rubber-banding Hype, a softer AGI race). Threat penalties are small on purpose; they matter for meters, not for the win rate.

AI rivals get no moments. A player at skill 0.7 gains about 10% more Hype, which is worth about 25 points of win rate; `aiAgiFactor` rose from 1.15 (task 8) to **1.3** to carry that expected income (the rivals' clock instead of their wallet, because rival Hype only buys nodes the AI already affords).

### Launch news

Median per run: 4 player launches and 16 rival launches; no engine news item without a `kind` in 6,000 runs.

### Spread channels and the reach policy

Barriers: `ocean` on the 12 sea links between continents (usa–russia, brazil–france, andes–france, the four far-south links, indonesia–australia, indonesia–pacific, iberia / italy / balkans–north-africa); `strict` on the six strict regions; `language:spanish` on the five Spanish-speaking regions; `language:asia-africa` on 14 non-English Asian and African regions. `barrierSeedFactor` 0.25 (engine default), `viralSeedFactor` 0.25 (pack; default 0.5), `openSeedFactor` 1.5, `openRivalSpreadBonus` 0.05.

Reach policy, seed 2026, 1,000 runs, current balance:

| | Win | agi | dependence | monopoly |
| --- | --- | --- | --- | --- |
| channels off (`barrierSeedFactor` 1, `viralSeedFactor` 0) | 54.0% | 25.8% | 24.6% | 3.6% |
| channels on | 48.3% | 14.6% | 26.9% | 6.8% |

With channels the reach route wins by dependence more often and by AGI much less: it is a distinct path, and dependence did not become trivial (the first channel draft, with `viralSeedFactor` 0.5 and `dependenceShare` 0.40, pushed sensible dependence to 30 to 40% and random to 18%; hence the lower jump factor and the 0.45 threshold). For reference, the reach policy's dependence rate was 30.6% in the task 8 report and 36.2% at the start of this task (moments in, no channels, 500 runs).

### Shadow dominance

The shadow policy won 88% (90% at the start of this task, 59% by monopoly): buy-outs were cheap and each one handed over 60% of the target's users, so every purchase paid for the next. Changes: `acquireBaseCost` 150 → 500, `acquirePerAgi` 3 → 7, `acquireAdoptionShare` 0.6 → 0.3 (the buyer keeps 30% of the target's adoption), and the Hostile Takeovers discount ×0.6 → ×0.7. Shadow now wins **68.5%** (36.4% by monopoly) and sensible still reaches monopoly in 4.4% of runs. Weakening the shadow tree's Hype nodes instead (tried: Benchmark Tuning, Staged Demos, Bot Farm) hurt sensible more than shadow.

### Pack balance changes in this task (`balance.json`)

| Constant | Old | New | Reason |
| --- | --- | --- | --- |
| aiAgiFactor | 1.15 | 1.3 | Rivals carry the player's expected moment income. |
| dependenceShare | 0.40 | 0.45 | Channels make spreading easier; keeps dependence a goal, not a default. |
| viralSeedFactor | (new) | 0.25 | Chat App is cheap; word of mouth must not double spread. |
| acquireBaseCost | 150 | 500 | Shadow dominance. |
| acquirePerAgi | 3 | 7 | Same. |
| acquireAdoptionShare | (engine 0.6) | 0.3 | Same: buy-outs no longer snowball. |
| shadow-hostile acquireCost | ×0.6 | ×0.7 | Same. |

Engine `BalanceConfig` additions (defaults): `momentFirstTick` 40, `momentIntervalMin` 30, `momentIntervalMax` 54, `momentShareSpeedup` 1.5, `momentIntervalFloor` 16, `maxActiveMoments` 3, `barrierSeedFactor` 0.25, `viralSeedFactor` 0.5, `openSeedFactor` 1.5, `openRivalSpreadBonus` 0.05.

Tuning used seeds 1 and 3 at 150 to 300 runs per policy; the tables are seed 2026. Expect ±3 points between seeds; capability's AGI rate (28.2%) and sensible's monopoly rate (4.4%) are the closest to their limits.

---

# Balance pass (task 8, historical)

## Method

`npm run balance` (scripts in `scripts/balance/`) bundles the engine, the ai-lab pack and the script with esbuild and plays headless runs in plain Node on worker threads (one per CPU). Each configuration is a bot policy; its N runs cycle through the three founders and twelve home regions, with seeds `seed × 100003 + i`:

| Home region | Why |
| --- | --- |
| usa | rich, large, open, a rival's home |
| uk-ireland | rich, open, island |
| germany | rich, strict, a rival's home |
| nordics | rich, small, open, cheap power |
| japan | rich, island |
| china | huge, very strict, a rival's home |
| india | huge, poor, open |
| turkiye | middle of the road |
| brazil | large, a rival's home |
| nigeria | poor, open |
| east-africa | poor, large |
| pacific | tiny |

Policies (`BotPolicy` in `src/engine/ai.ts`): `sensible` (the rivals' planner with the default personality), `random` (a random valid action on half of its decisions), `idle` (only answers event cards, with the first choice), and three focused policies that plan like `sensible` but aim at one win: `capability` (races up the model tiers and keeps buying compute) for AGI, `reach` (launches on every decision) for dependence, `shadow` (heads for the buy-out nodes and saves cash for acquisitions) for monopoly.

The report gives, per policy: win rate, ending triggers and variants, run length percentiles, the tick of the first node, first data centre and each model tier, the gaps between purchases, nodes, cash and Hype at the end, data centres built, final world share, lead rival AGI at the end, how each rival left the race, peak meters, and win rate by founder and by home region.

Other commands: `npm run balance -- --runs 300 --coverage` adds content coverage (cards and headlines never drawn, achievements and ending variants earned, news param problems; every 4th coverage run uses a secret lab name); `npm run balance:trace -- --policy shadow --home usa` prints every lab every N ticks for one run; `npm run balance:reach` plays probes for achievements and endings the bots never aim for. `--balance '{"key":1}'` overrides balance numbers for a sweep.

Tuning used seeds 1, 3 and 7 (120 to 1,000 runs per step). The tables below are from **seed 2026, 1,000 runs per policy, never used for tuning**: 6,000 runs in 239 s on 2 workers while other jobs shared the machine, so 1,000 runs take about 36 to 40 s (about 100 ms of CPU per run of about 3,000 ticks).

## Final report (seed 2026, 1,000 runs per policy)

| Policy     | Runs | Win   | agi   | dependence | monopoly | banned | revolt | rivalAgi | none | Ticks p10/p50/p90  |
| ---------- | ---- | ----- | ----- | ---------- | -------- | ------ | ------ | -------- | ---- | ------------------ |
| sensible   | 1000 | 54.9% | 26.6% | 19.0%      | 9.3%     | 7.3%   | 5.8%   | 32.0%    | 0.0% | 1758 / 2969 / 3255 |
| capability | 1000 | 42.2% | 32.2% | 9.8%       | 0.2%     | 13.1%  | 10.2%  | 34.5%    | 0.0% | 1703 / 2905 / 3300 |
| reach      | 1000 | 60.4% | 22.0% | 30.6%      | 7.8%     | 13.1%  | 5.7%   | 20.8%    | 0.0% | 1458 / 2832 / 3237 |
| shadow     | 1000 | 88.1% | 9.6%  | 16.7%      | 61.8%    | 2.7%   | 3.3%   | 5.9%     | 0.0% | 1491 / 2201 / 3024 |
| random     | 1000 | 12.0% | 1.8%  | 10.2%      | 0.0%     | 72.2%  | 14.3%  | 1.5%     | 0.0% | 1418 / 1881 / 2606 |
| idle       | 1000 | 0.0%  | 0.0%  | 0.0%       | 0.0%     | 0.0%   | 0.0%   | 100.0%   | 0.0% | 2653 / 3248 / 3377 |

### Policy `sensible`

Ending variants: agi-aligned 26.6%, dependence 19.0%, rival-agi 18.2%, rival-agi-close 13.8%, monopoly 9.2%, banned 6.1%, revolt 4.2%, revolt-robots 1.6%, banned-captured 0.9%, banned-home-defiant 0.3%, monopoly-hostile 0.1%

| Milestone         | Reached | Median | p90  |
| ----------------- | ------- | ------ | ---- |
| First node        | 100.0%  | 1      | 1    |
| First data centre | 100.0%  | 1      | 1    |
| Model tier 1      | 100.0%  | 1      | 1    |
| Model tier 2      | 100.0%  | 271    | 411  |
| Model tier 3      | 100.0%  | 821    | 1235 |
| Model tier 4      | 98.6%   | 1431   | 2301 |
| Model tier 5      | 33.3%   | 2351   | 2731 |

Purchases: 35 per run (median); gap between purchases median 60, p75 110, p90 150 ticks; per-run median gap p50 60.

| Runs   | n    | Nodes p10/p50/p90 | Cash p50/p90 | Hype p50/p90 | DCs built | Share p50 | Lead rival AGI p50 | Lead rival AGI > 50 |
| ------ | ---- | ----------------- | ------------ | ------------ | --------- | --------- | ------------------ | ------------------- |
| all    | 1000 | 26 / 30 / 32      | 602 / 2892   | 107 / 236    | 3         | 25.5%     | 88                 | 73.8%               |
| wins   | 549  | 26 / 29 / 32      | 375 / 1412   | 111 / 230    | 3         | 36.2%     | 77                 | 63.6%               |
| losses | 451  | 27 / 30 / 31      | 1109 / 3716  | 100 / 240    | 3         | 23.6%     | 100                | 86.3%               |

Runs where the player bought every rival: 1.3%. Peak meters p50/p90: player regulation 58/95, backlash 50/90; rivals' highest regulation 95/100, backlash 57/72.

| Rival      | Entered | Banned | Revolt | Bought by player | Bought by rival | AGI at end p50        |
| ---------- | ------- | ------ | ------ | ---------------- | --------------- | --------------------- |
| overfit    | 100.0%  | 39.4%  | 0.2%   | 2.3%             | 0.0%            | 67                    |
| gruendlich | 100.0%  | 0.0%   | 0.0%   | 18.6%            | 0.0%            | 80                    |
| lanterns   | 100.0%  | 5.6%   | 0.0%   | 12.2%            | 0.0%            | 86                    |
| canopy     | 100.0%  | 0.0%   | 0.0%   | 22.6%            | 0.0%            | 58                    |
| all        | -       | -      | -      | -                | -               | self-eliminated 11.3% |

| founder    | n   | Win rate | Median ticks | Triggers (a d m b r aR)         |
| ---------- | --- | -------- | ------------ | ------------------------------- |
| hustler    | 333 | 44.1%    | 2972         | a:44 d:69 m:34 b:33 r:21 rR:132 |
| insider    | 333 | 57.7%    | 3028         | a:63 d:93 m:36 b:1 r:29 rR:111  |
| researcher | 334 | 62.9%    | 2866         | a:159 d:28 m:23 b:39 r:8 rR:77  |

| home region | n  | Win rate | Median ticks | Triggers (a d m b r aR)      |
| ----------- | -- | -------- | ------------ | ---------------------------- |
| brazil      | 84 | 64.3%    | 3031         | a:17 d:13 m:24 b:3 r:3 rR:24 |
| china       | 84 | 42.9%    | 1772         | a:1 d:35 m:0 b:31 r:11 rR:6  |
| east-africa | 81 | 43.2%    | 3108         | a:27 d:6 m:2 b:1 r:7 rR:38   |
| germany     | 84 | 54.8%    | 3100         | a:21 d:10 m:15 b:0 r:2 rR:36 |
| india       | 84 | 51.2%    | 1665         | a:1 d:42 m:0 b:27 r:13 rR:1  |
| japan       | 84 | 52.4%    | 2944         | a:13 d:15 m:16 b:2 r:2 rR:36 |
| nigeria     | 82 | 76.8%    | 3008         | a:60 d:2 m:1 b:0 r:3 rR:16   |
| nordics     | 84 | 41.7%    | 3057         | a:15 d:9 m:11 b:1 r:6 rR:42  |
| pacific     | 81 | 70.4%    | 3041         | a:51 d:5 m:1 b:0 r:0 rR:24   |
| turkiye     | 84 | 51.2%    | 3076         | a:29 d:9 m:5 b:0 r:1 rR:40   |
| uk-ireland  | 84 | 50.0%    | 3061         | a:23 d:6 m:13 b:3 r:1 rR:38  |
| usa         | 84 | 60.7%    | 2784         | a:8 d:38 m:5 b:5 r:9 rR:19   |

### Against the targets

| # | Target | Result | Met |
| --- | --- | --- | --- |
| 1 | sensible wins 30 to 60%; median 2,400 to 3,600 ticks; p10 > 1,500; p90 < 4,800 | 54.9%; 2,969; 1,758; 3,255 | yes |
| 2 | idle ≤ 2%, random ≤ 20% | 0.0%, 12.0% | yes |
| 3 | every trigger ≥ 3% for sensible; each win ≥ 25% for its focused policy | lowest is revolt 5.8%; agi 32.2% (capability), dependence 30.6% (reach), monopoly 61.8% (shadow) | yes |
| 4 | rivals eliminate themselves in < 20% of appearances; lead rival AGI > 50 in most player wins | 11.3%; 63.6% of wins | yes |
| 5 | typical sensible win owns about 18 to 30 nodes, no huge pile; buying every rival rare | nodes p10/p50/p90 26/29/32; cash p50 375, p90 1,412; every rival bought in 1.3% | yes (nodes at the top of the range) |
| 6 | first node ≤ ~60 ticks, first data centre ≤ ~250, something meaningful every 60 to 120 ticks | tick 1 and tick 1 (both affordable at the start); purchase gap median 60, p75 110, p90 150 | yes |
| 7 | no founder < 20% or > 70%; flag regions < 10% or > 85% | founders 44.1% to 62.9%; regions 41.7% (nordics) to 76.8% (nigeria), none flagged | yes |

Dependence threshold: **`dependenceShare` = 0.40** (40% of the world's population using the player's lab). The spec's "90% adoption" is unreachable with four rivals sharing the map: the biggest labs end around 40 to 55% of the world. At 0.50 the reach policy reached dependence in 14% of runs and sensible in 2 to 4%; 0.45 gave 20% for reach; 0.40 gives 30.6% for reach and 19% for sensible, while random reaches it in 10%.

## What changed

### Engine rules (all in `BalanceConfig`, documented in `docs/ARCHITECTURE.md`, unit-tested in `src/engine/__tests__/balanceRules.test.ts`)

| Rule | New constant (default) | Why |
| --- | --- | --- |
| Compute's AGI boost has diminishing returns: `1 + agiComputeFactor × compute^agiComputeExponent` | `agiComputeExponent` (1 = old rule) | A rich lab built 600+ compute and went from 16 to 100 AGI in 300 ticks; the race was decided by cash, not by model tier. |
| AI labs' AGI progress × `aiAgiFactor` | `aiAgiFactor` (1) | A difficulty knob that sets the rivals' clock without slowing the player's own economy. |
| AI labs' per-tick meter gains × `aiMeterGainFactor`, plus extra decay | `aiMeterGainFactor` (0.6), `aiRegulationDecay` (0), `aiBacklashDecay` (0.01) | AI labs get no event cards to relieve their meters; without relief they always revolted (on the fixture pack an idle player won by monopoly). Defaults now include this relief. |
| Flat cash income per tick | `cashBase` (0) | Early income from a small home was below one data centre's upkeep, so data centres went offline in the first 600 ticks. |
| Node price × (1 + `nodeCostGrowth` × nodes owned) | `nodeCostGrowth` (0) | Winners bought all 36 nodes. |
| Upgrade price × (1 + `dataCentreUpgradeGrowth` × levels owned) | `dataCentreUpgradeGrowth` (0) | Compute was the only sink for runaway cash. |
| AI controller: per-meter caution from 50 (was 55); at 40% caution stop launching / adding compute; meter-lowering nodes get a strong bonus whatever the personality | `CAUTION_START`, `SELF_PRESERVATION` in `ai.ts` | Rivals walked into bans and revolts. |
| AI labs never acquire other labs | `ai.ts` | A rival that bought the others grew to 50%+ share and was banned, handing the player a free monopoly (idle monopoly 19%). |
| Player-seat default personality shadow 0.6 → 0.8 | `DEFAULT_PERSONALITY` | The sensible bot almost never reached the buy-out nodes, so its monopoly rate was below 3%. |
| Tree-focused bot policies | `BotPolicy` | To test each win path on purpose. |
| `runHeadless` `onTick` observer | `HeadlessOptions` | Lets the balance script record a run without cloning state. |

Engine speed-ups with identical results (checked by comparing reports before and after): per-region spreadRate / regulationGain / seedChance / cashIncome multipliers cached per modifier table; user counts cached per adoption record between changes; `storeWorkspace` writes only changed adoption entries; node-granted flags cached; no per-tick allocation in the spread step.

### Pack balance overrides (`src/content/packs/ai-lab/balance.json`)

| Constant | Old | New | Reason |
| --- | --- | --- | --- |
| rivalStartCash | 150 | 100 | Rivals out-built the player in the first 600 ticks. |
| baseSpread | 0.003 | 0.0055 | Nothing happened for 1,000 ticks, then everything at once; growth is now visible early. |
| seedChance | 0.003 | 0.006 | Same: spread across borders was too slow to matter. |
| seedAmount | 0.004 | 0.006 | Same. |
| dataCentreCountGrowth | 0.4 | 0.8 | Rich labs built 13+ sites. |
| dataCentreUpgradeGrowth | (new) | 0.05 | Cash sink for big labs. |
| launchCostPerMillion | 0.08 | 0.2 | Launching into India or China was cheap and decided dependence. |
| cashPerUser | 0.012 | 0.003 | Late income of 30+/tick against costs of a few hundred: cash ran away. |
| cashBase | (new) | 0.25 | Keeps the early game playable in small homes. |
| hypeBase | 0.06 | 0.3 | Hype came almost only from growth bursts in huge homes; now it trickles steadily. |
| hypePerNewUser | 0.3 | 0.12 | Same: a China or India home produced hundreds of Hype in a burst. |
| agiBase | 0.003 | 0.0022 | Sets the AGI clock (with the rules below) to about 3,000 ticks. |
| agiComputeFactor | 0.01 | 0.06 | Paired with exponent 0.5: compute 100 gives ×1.6, 400 ×2.2 (was ×2 and ×5). |
| agiComputeExponent | (new) | 0.5 | Diminishing returns on compute. |
| aiAgiFactor | (new) | 1.15 | Rivals slightly quicker to AGI than the player: brings sensible wins into range. |
| regulationPerGrowth | 0.03 | 0.07 | Bans never happened; regulation now bites with growth in strict regions. |
| regulationPerShare | 0.2 | 0.45 | Same, for big labs. |
| backlashPerCapability | 0.06 | 0.115 | Revolt was near 0% for sensible play. |
| backlashPerDataCentreLevel | 0.002 | 0.003 | Footprint should cost goodwill. |
| acquireBaseCost | 1000 | 150 | Buy-outs were unaffordable at the new cash levels; monopoly needs them. |
| acquirePerUser | 3 | 0.1 | The largest rival cost 4,000+ late, out of reach of any player. |
| acquirePerCompute | 8 | 1 | Same. |
| acquirePerAgi | 15 | 3 | Same. |
| nodeCostGrowth | (new) | 0.04 | Fewer nodes at the end (36 → about 29). |
| dependenceShare | 0.5 | 0.4 | See above. |
| aiMeterGainFactor, aiBacklashDecay | (new) | engine defaults 0.6 and 0.01 | Rivals' self-elimination 22% → 11%. |

### Content numbers

| Item | Old | New | Reason |
| --- | --- | --- | --- |
| founder researcher: agiRate | ×1.2 | ×1.25 | Researcher won 14% when growth decided everything; rebalanced after other changes (text updated). |
| founder hustler: spreadRate; start Hype | ×1.2; 15 | ×1.12; 20 | Spread compounds; ×1.2 won 76% (text updated). |
| founder insider: start Hype, Cash | 12, 100 | 16, 160 | Insider was the weakest founder. |
| rival lanterns (China): entry tick, expansion | 120, 0.8 | 300, 0.6 | The China rival reached AGI in almost every run. |
| cap-model-3 / 4 / 5 agiRate | ×1.1 / 1.15 / 1.25 | ×1.15 / 1.2 / 1.3 | The capability path was weaker than spreading for AGI. |
| cap-gpu-lease / cap-gpu-megadeal bonus compute | 3 / 6 | 5 / 10 | Makes compute without data centres (Cloud Native) possible. |
| event gpu-shortage "pay" compute | 8 | 10 | Same. |
| shadow-ma-team / shadow-hostile acquireCost | ×0.9 / ×0.7 | ×0.75 / ×0.6 | The monopoly path needs affordable buy-outs. |
| achievement speedrun-to-nowhere | end by tick 300 | lose by tick 1,500 | No run can end within 300 ticks (text updated). |

## Content checks (Part A item 4)

300 runs per policy with `--coverage` (seed 3, 1,800 runs): no run threw; no news item lacked a lab or region id for {lab}, {rival} or {region}; every event card and every headline was drawn in the 300 sensible runs (the rarest: the easter-egg cards rare-time-traveller 2 runs, rare-aliens 3, rare-toaster and rare-pottery 6; the rarest regular card robot-union 11). Before the balance pass four regular cards and one headline were never drawn: hearing, home-crackdown, un-summit and the headline p-hearing-clip need regulation that never rose, and final-review needs AGI ≥ 75 after tick 1,800 when runs ended around 1,900. The meter and pacing changes fixed them; no condition was wrong. (The secret-name cards need their names, and rare-toaster and rare-pottery are deliberate 2 to 3% cards.)

Achievements and ending variants the bots do not earn, and why each is reachable:

| Item | Status |
| --- | --- |
| shadow-cabinet (all 12 Shadow nodes) | Not earned by bots (they win first); full-stack, the same for Capability, is earned. A long Shadow run affords all 12. |
| monk-mode, agi-reckless, agi (default), monopoly (default) | `balance:reach` probes with the needed node priced out: 12, 33, 40 and 56 of 200 runs. |
| broke-genius (AGI win with ≤ 5 cash) | A deliberate choice: spend down before the last AGI tick. Bots keep a cash reserve. |
| cloud-native (AGI win, never built a data centre) | Hard on purpose. Without data centres compute comes from nodes (15), events (parking lot 4, cloud credits 4, billboard 2, export-ban shell 6, gpu-shortage 10 each time, rent 3 each time) and the chip tape-out (10): 50 to 60 reaches model tier 3 to 4, about 0.04 AGI per tick, so it needs rivals slowed or bought. The probe (no lab may build) never sees it because the bot does not pick the compute choices. |
| speedrun-to-nowhere | Now "lose within 1,500 days"; earned in 55 of the 1,800 coverage runs. |
| Egg names | office-supplies, doors-please and the paperclips ending are earned in coverage runs with the secret names. |

## Known weak spots

- **Shadow is the strongest path.** The shadow policy wins 88% (62% by monopoly). Buy-outs had to become cheap for sensible play to reach monopoly in ≥ 3% of runs, and a player who goes straight for the M&A team exploits that. Raising `acquirePerAgi` or the M&A node costs would tame it at the price of fewer sensible monopolies.
- **The USA rival is banned in 39% of its sensible appearances.** It grows to 40 to 50% of the world and regulation catches it; the other rivals almost never fall. Total self-elimination is 11%, under the 20% cap, but one rival carries most of it.
- **Huge homes play differently.** China and India homes end around tick 1,700 (dependence or bans) instead of 3,000. Win rates are fine (43%, 51%), run length is not.
- **Nodes at the end are at the top of the target** (median 29 of 36); the bot buys every node it can afford.
- **Bot-centric numbers.** The first node and first data centre are affordable at tick 0, so "first data centre" measures the bot's eagerness, not the economy.
- **Idle runs** see rivals self-eliminate 27% of the time: without a player taking share, the USA rival grows unchecked into a ban.
- Results move by about ±3 points between seeds at 1,000 runs; rates near a limit (sensible revolt 5.8%, nodes 29) should be re-checked after content changes.

## Where humans will differ from bots

- Humans read event cards; the sensible bot scores choices by a heuristic and never plays for a flag. Expect fewer surprise bans and revolts from risky choices once players learn which choices carry risk, and more achievements.
- Humans will launch into India and China early and on purpose; the bot launches with a probability. Expect more dependence wins and shorter runs for experienced players.
- Humans spend in bursts and save for big purchases; the bot spends every 10 ticks. Purchase gaps will feel longer but each purchase bigger.
- The sensible bot buys every affordable node; humans will specialise, reaching tier 5 or the M&A team earlier. Specialised play (the focused policies) wins 42 to 88%, so expect a skilled player's win rate to sit above the sensible bot's 55%.
- Humans pause at 1x to read; speed affects only real time, not balance.
