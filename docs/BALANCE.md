# Balance

## Task 27: routes and founders (current numbers)

Why: the three upgrade routes and three founders should each be a real choice. Before this pass the shadow-focused bot won 54 to 61% on Frontier while the sensible (mixed) bot won 32 to 35% and the capability bot about 25%, and the Hustler was the weakest founder. A dominant route kills replay value. Goal: routes within 12 points of each other, mixing rewarded, founders within 8 points, and the game neither harder nor easier overall.

### Method

`npm run balance -- --runs 300 --difficulty all --runLength sprint,full --brief --routes --seed 7` (14,400 runs; seed 7 is the task 21 seed, so the "before" numbers below are exactly task 21's table). Tuning used seed 1 (Frontier, 100 to 300 runs per step); seed 7 was played only for the before and after tables. New tooling:

- `--routes`: per run length and difficulty, every policy's win rate overall and per founder, triggers, run length, nodes owned per tree, how often each tree's two top rows were bought (and when), event risks fired and rivals bought per run, and the target checks below.
- `--patch file.json`: what-if node, founder and difficulty changes for sweeps (`PackPatch` in `scripts/balance/simulate.ts`), e.g. `{"nodes":{"shadow-ma-team":{"grantsFlags":[]}}}`.
- `npm run balance:reach -- --cloud-native [--max-built 0|1]`: a determined human probe for the Cloud Native achievement (see below).

Expect about ±2.7 points of seed noise at 300 runs per cell (±4.7 per founder, 100 runs each).

### Diagnosis: why Shadow won

Probes on seed 1, Frontier, 300 runs, sprint / full (win rates of shadow, sensible, capability):

| Probe | shadow | sensible | capability | Reading |
| --- | --- | --- | --- | --- |
| Baseline | 59.0 / 53.3 | 31.7 / 34.0 | 23.0 / 25.3 | |
| No buy-outs (M&A Team grants no `canAcquire`) | 24.0 / 21.0 | 28.7 / 31.0 | 23.0 / 25.3 | Buy-outs are the whole lead: without them shadow is a capability bot |
| Benchmark Tuning without its Hype ×1.3 | 57.7 / 53.3 | 14.3 / 18.7 | 7.7 / 14.0 | A universal must-buy, not a shadow edge (kept) |
| Staged Demos without its Hype ×1.25 | 49.3 / 39.7 | 27.7 / 22.3 | 22.3 / 25.0 | Hurts everyone (kept) |
| Talent Poaching without its rival slow-down | 51.3 / 52.7 | 32.3 / 34.3 | 24.3 / 27.0 | Small for shadow; the sensible bot leans on it more (a ×0.9 version dropped sensible to 18% on Sprint), kept |

1. **Buy-outs turned idle Cash into deleted rivals.** Cash ends most runs unspent; the M&A Team (×0.75 price, no downside) let the shadow bot spend it on 1.8 rivals per run. Each buy-out removes an AGI racer, so the shadow bot lost to a rival's AGI in 13 to 17% of runs against 37 to 42% for the others, and it won by AGI (21 to 24%) as often as the capability bot, plus 24 to 31% by monopoly.
2. **Its exposure never landed.** The tree's risk was `riskChance`, which only scales event-choice gambles; bots (and any human who reads the card) pick the safe choice, so risks fired 0.03 to 0.11 times per shadow run. The Backlash costs sat on nodes the shadow bot skips (Revolving Door 10 to 23%, Regulatory Capture 3 to 9%, Hostile Takeovers 0%).
3. **A human exploits it the same way or harder:** "buy the cheapest rival, repeat" is obvious from the race screen, and a human would also pick off the AGI leader.

Why Capability was weak: its tree had almost no regulation defence (Interpretability ×0.9 only) and its bot has little taste for Shadow's lobbying, so it was banned in 25 to 28% of Frontier runs (sensible 14 to 17%; peak Regulation p50 79 vs 66). Why the Hustler was weak: faster spread means more users in strict regions and more world share, which both feed Regulation, with no protection and no help in the AGI race (the capability bot with the Hustler was banned in 40 of 100 runs). The Researcher's AGI ×1.25 was the strongest perk (39 to 49%).

A trap for later passes: **node changes act on rivals too.** Rivals buy from the same trees; the capability safety nodes now also keep them out of bans, so they reach AGI more often, which the rivals' AGI clock (`aiAgiFactor`) compensates. Making the M&A Team dearer also changes which rivals buy it (a rival with it carries the antitrust Regulation), so small M&A changes moved the sensible bot by several points.

### What changed

| Item | Before | After | Why |
| --- | --- | --- | --- |
| M&A Team | 75 Hype + 80 Cash; buy-outs ×0.75 | 85 + 100; buy-outs ×0.9; **Regulation +25%** (antitrust) | Buy-outs stay the payoff but cost real money and draw regulators |
| Hostile Takeovers | 120 Hype + 100 Cash; ×0.7; −5 lead rival AGI, +8 Backlash | 130 Hype, no Cash; ×0.85; −5 lead rival AGI, **+10 Backlash, +8 Regulation** | The shadow bot saved its Cash and never reached it; now it is the route's top node (bought in 77% of shadow runs) and the monopoly ending stays alive, at a visible price |
| Benchmark Tuning | Hype ×1.3, risk ×1.1 | adds **Backlash +5%** | Shadow carries a standing scandal cost |
| Bot Farm | spread ×1.25, seeding ×1.2, risk ×1.25 | adds **Backlash +10%** | Same |
| Interpretability | Backlash ×0.85, Regulation ×0.9 | Regulation ×0.8 | Capability's safety branch defends against bans |
| Alignment Program | Backlash ×0.8, AGI ×1.05 | adds Regulation ×0.9 | Same |
| Own Chips | compute ×1.4, upkeep ×0.85 | adds AGI ×1.1 | Rewards the compute branch, which the shadow route skips to keep Cash for buy-outs |
| Researcher | AGI ×1.25 | AGI ×1.11 | Strongest founder |
| Hustler | spread ×1.12 | spread ×1.12, **Hype +3%** | Spreading alone fed Regulation without helping the race |
| Insider | 16 Hype; Regulation ×0.75 | 22 Hype; Regulation ×0.75, **Backlash ×0.9, Hype +2%** | Bans are rarer now, so a Regulation-only perk lost value; Backlash is the live danger |
| `acquireBaseCost` pack / Frontier / Arms Race / Hard Takeoff | 550 / 600 / 700 / 850 | 690 / 750 / 875 / 1060 | Buy-outs dearer |
| `acquirePerAgi` (Hard Takeoff) | 7 (9) | 10 (12) | The AGI leader costs more to buy than a straggler |
| `acquireAdoptionShare` | 0.3 | 0.25 | Buy-outs snowball less |
| `aiAgiFactor` pack (= Frontier) / Sandbox / Arms Race / Hard Takeoff | 1.18 / 1.16 / 1.31 / 1.36 | 1.13 / 1.09 / 1.24 / 1.25 | Restores each level's overall win rate after rivals gained from the safety nodes |
| Cloud Native achievement | AGI win, 0 data centres built | AGI win, at most 1 data centre built | Could not be earned (below) |

Texts: founder descriptions carry the new numbers; M&A Team, Hostile Takeovers and Bot Farm now say what they expose you to (English and Turkish). No engine rule changed; runLengths.json is untouched.

### Before / after (seed 7, 300 runs per cell)

Frontier, sprint / full:

| Policy | Before | After |
| --- | --- | --- |
| sensible (mixed) | 35.0 / 31.7 | 31.3 / 33.3 |
| capability | 24.7 / 26.3 | 26.3 / 35.0 |
| reach | 31.0 / 32.0 | 27.7 / 35.0 |
| shadow | 60.7 / 54.0 | 33.3 / 32.7 |
| random | 7.3 / 1.7 | 13.7 / 5.3 |
| idle | 0.0 / 0.0 | 0.0 / 0.0 |
| Single-route spread (target ≤ 12) | 36.0 / 27.7 | **7.0 / 2.3** |
| Mixed − best single (target ≥ −5) | −25.7 / −22.3 | **−2.0 / −1.7** |

Frontier, sensible bot by founder, sprint / full (target: within 8):

| Founder | Before | After |
| --- | --- | --- |
| Researcher | 47.0 / 39.0 | 28.0 / 38.0 |
| Hustler | 21.0 / 27.0 | 34.0 / 31.0 |
| Insider | 37.0 / 29.0 | 32.0 / 31.0 |
| Spread | 26.0 / 12.0 | **6.0 / 7.0** |

How each route plays on Frontier (after; sprint / full): shadow wins agi 20.3 / 19.7, dependence 5.0 / 8.0, monopoly 8.0 / 5.0, and loses by revolt 23.0 / 30.0 (sensible 15.3 / 18.3) with 1.42 rivals bought per run (was 1.86 / 1.76; revolt was 6.0 / 15.0). Capability wins agi 18.0 / 29.7 and is banned 9.7 / 7.0 (was 27.0 / 24.7). Reach wins dependence 20.0 / 21.3. Shadow-route top nodes: M&A Team 86.7 / 85% of shadow runs, Hostile Takeovers 77% (was 0%); Own Chips is bought in 90% of capability runs and 4% of shadow runs.

Sensible bot per difficulty, sprint / full (target: within 5 of before):

| Difficulty | Before | After | Change |
| --- | --- | --- | --- |
| Sandbox | 62.0 / 67.0 | 59.7 / 63.7 | −2.3 / −3.3 |
| Frontier | 35.0 / 31.7 | 31.3 / 33.3 | −3.7 / +1.6 |
| Arms Race | 17.3 / 15.0 | 12.3 / 19.0 | −5.0 / +4.0 |
| Hard Takeoff | 6.7 / 11.0 | 5.3 / 9.3 | −1.4 / −1.7 |

Sprint vs Full: every one of the 24 policy and difficulty cells is within 10 points (largest: Sandbox reach −9.3, Frontier capability −8.7, Sandbox and Frontier random +8.3). Median Frontier run: sensible 846 / 2,843 ticks (8.5 / 26.6 min at 1x with cards), as before.

Endings, all policies and difficulties pooled, sprint / full:

| Ending | Before | After |
| --- | --- | --- |
| rival-agi | 35.0 / 34.7 | 38.2 / 35.6 |
| revolt | 8.7 / 10.4 | 18.1 / 19.8 |
| dependence | 9.4 / 7.8 | 10.8 / 10.0 |
| agi-aligned | 8.6 / 10.2 | 8.2 / 10.6 |
| rival-agi-close | 7.3 / 7.7 | 8.1 / 8.3 |
| banned | 16.4 / 16.6 | 8.0 / 7.2 |
| banned-captured | 7.6 / 5.3 | 4.5 / 3.6 |
| revolt-robots | 1.2 / 1.3 | 2.3 / 2.5 |
| monopoly-hostile | 0.0 / 0.1 | 1.4 / 1.1 |
| monopoly | 4.1 / 3.4 | 0.0 / 0.1 |
| banned-home | 0.8 / 1.4 | 0.3 / 0.7 |
| banned-home-defiant | 0.5 / 0.8 | 0.2 / 0.5 |
| agi | 0.3 / 0.4 | 0.0 / 0.0 (a few runs) |

On Frontier the largest single ending is 26.3 / 28.0% for the sensible bot and 24.2 / 22.8% for the four planning bots pooled (target ≤ 45%).

### Against the targets

| Target (Frontier, both lengths) | Result | Met |
| --- | --- | --- |
| Single-route bots within 12 points | spread 7.0 / 2.3 | yes |
| Mixed ≥ best single − 5 | −2.0 / −1.7 | yes |
| Founders (sensible) within 8 points | 6.0 / 7.0 | yes |
| Sensible per difficulty within 5 of before | all within 5; Arms Race Sprint exactly −5.0 | yes, at the edge on Arms Race Sprint |
| Every ending still occurs; none above 45% on Frontier | all 13 occur; largest 28.0% | yes, but `monopoly` (without Hostile Takeovers) and `agi` (without the safety team) are now a handful of runs |
| Sprint and Full within 10 in every cell | largest 9.3 | yes |
| Idle wins 0% | 0.0% everywhere | yes |

### How each route plays now

- **Capability.** Early: first model, GPU lease, safety team; data centres in cheap, quiet regions. Middle: Interpretability and Alignment keep regulators off while the models climb; the compute branch (megadeal, Own Chips) is where Cash goes and Own Chips speeds AGI. End: tier 4 to 5 and a straight AGI race, usually against one rival close behind. What goes wrong: Backlash from big models and many data centres (revolt, the robots ending), or a rival simply gets there first. Bans are rare if you take the safety branch.
- **Reach.** Early: Chat App, social and the language nodes. Middle: oceans and strict regions open, launches get cheaper and the map lights up; Compliance and PR hold the meters. End: dependence at 43% of the world, sometimes AGI. What goes wrong: fast spread into strict regions builds Regulation (bans), and rivals that enter early box you out of the dependence path on the harder levels.
- **Shadow.** Early: Benchmark Tuning and Staged Demos make the most Hype in the game, at a standing Backlash cost. Middle: poaching slows rivals; the M&A Team unlocks buy-outs, but antitrust scrutiny makes Regulation build 25% faster and each buy-out is expensive (the AGI leader most of all). End: Hostile Takeovers makes buy-outs cheaper and can finish a monopoly, or buying out the racers clears the way to AGI. What goes wrong: Backlash. Shadow runs end in a public revolt far more often than mixed play (30% vs 18% on Full Frontier; 23% vs 15% on Sprint); Bot Farm and Hostile Takeovers add Backlash, and regulators come for a lab that buys its rivals. Strong when it works, but it is now the route that blows up.
- **Mixed (sensible).** Take what is cheap and useful from all three: the Hype nodes, the safety branch, the channels, poaching. It wins as often as the best single route.

### Cloud Native

The achievement asked for an AGI win without ever building a data centre. Without one, compute comes only from one-off sources: GPU Lease and Megadeal (15), event choices (parking lot 4, cloud credits 4, billboard 2, shell company 6, GPU shortage 10 each time, rent 3) and the chip tape-out (10, needs Own Chips, which is pointless without data centres). The probe player (plans like the sensible bot, never builds, takes every compute choice, taps every moment; rivals build as usual) peaked at compute 25 to 39 (p50), model tier 2, and reached AGI in **0 of 240 runs** (Sandbox and Frontier, Sprint and Full; it often won by dependence or monopoly instead). The condition now allows one data centre of your own ("rent the rest"); the same probe with one data centre earns it in 3 / 1 (Full Sandbox / Frontier) and 7 / 1 (Sprint) of 60 runs: rare, as a secret achievement should be.

### In tension

- **Monopoly is rarer.** Shadow used to win by monopoly in a quarter of runs; now 5 to 8% on Frontier. Bringing Hostile Takeovers to ×0.75 restored about 13% monopoly but pushed shadow to 40% (above sensible + 5), so the win-rate targets were favoured. The `monopoly` ending without Hostile Takeovers is now very rare because the shadow bot buys it first; `monopoly-hostile` replaced it.
- **Revolt replaced bans as the common loss** (pooled bans 16% → 8%, revolts 9% → 19%): the capability safety nodes and the Insider make bans rarer, and Shadow's exposure is Backlash. Intended for Shadow; worth watching for everyone.
- **Random play wins more** (Frontier 7.3 / 1.7 → 13.7 / 5.3, Sandbox 23 / 14 → 38 / 30): a button-masher stumbles into the safety branch and is banned less often. It is still far below every planning bot.
- **Arms Race Sprint** sits exactly at the −5 line (12.3% vs 17.3%) while Arms Race Full is +4.0; one `aiAgiFactor` serves both lengths, and moving it would push Full out instead.
- **Founders on other levels** were not a target: on Sandbox and Arms Race the Insider leads (71 to 76% and 18 to 27%), the Hustler trails. Frontier is balanced.
- **Hype is very sensitive:** a 1% Hype perk moves a founder by several points, and Benchmark Tuning's Hype is load-bearing for every route.

### Where humans will differ

The bots never read a card for its story and pick risk-free choices, so the riskChance part of Shadow still bites humans more than bots. A human on Shadow will likely target the AGI leader with buy-outs (dearer now: 10 Cash per AGI point) and will feel the antitrust Regulation and the Backlash of Hostile Takeovers. A human on Capability will notice that the safety branch makes bans rare; on Reach, that strict regions still need Compliance first.

---

## Task 21: Sprint run length

Why: a full run takes 20 to 25 minutes, long for a phone sitting, and the first session decides whether a player comes back. A **Sprint** plays the whole arc in about a third of the time and is preselected for a first-time player (no finished run stored). Presets live in `src/content/packs/ai-lab/runLengths.json` (`ContentPack.runLengths`, default `full`); the balance layers are engine defaults ← pack ← difficulty ← run length, then paced (`docs/ARCHITECTURE.md`, "Run length").

### How a Sprint is made

Scale rates, not the clock: `pace` 3.4 multiplies every per-tick rate and divides every tick count, effect duration, rival entry tick and tick condition, so spread, income, AGI, meters, bans, rival entries and AI decisions all happen 3.4 times as fast per tick and every ratio between them is the Full game's. Moments stay in real time (a person taps them). On top of pace, a few Sprint-only levers, chosen among those no difficulty sets (a run-length override replaces a difficulty's value, so a lever a difficulty uses would erase the difference between levels):

| Lever (Full value) | Sprint | Why |
| --- | --- | --- |
| `pace` (1) | 3.4 | 1x real time: about 850 ticks instead of 2,800. At 3.4 the AI decides every 3 ticks (10.2 standard ticks), the closest to Full's 10. |
| `eventIntervalMin` / `Max` (100 / 160, paced) | 220 / 340 | Paced alone a card would come every 15 to 23 s of play and the cards would hold the clock for a third of the run; now one every 32 to 50 s, about 10 per Sprint (Full: 21, every 50 to 80 s). |
| `headlineIntervalMin` / `Max` (25 / 50) | 50 / 100 | A ticker headline every 7 to 15 s (paced alone: every 4 to 7 s; Full: 12 to 25 s). |
| `regulationDecay` / `backlashDecay` (0.01) | 0.014 / 0.013 | Fewer cards means less meter relief (cards are where bots and players calm the meters). |
| `momentBoostWeightFactor` (1) | 1.6 | A Sprint has a third as many moments (real time); more of them are boosts. Threat weights stay with the difficulty. |
| `rivalStartHype` / `rivalStartCash` (15 / 100) | 12 / 85 | Rivals' flat start is relatively larger in a short run. |
| `aiMeterGainFactor` (0.6) | 0.71 | Rivals get no cards either way; in a Sprint the player gets fewer, so rivals feel their meters a little sooner (they turn cautious and slow down). |
| Score multiplier | ×0.6 | A third of the time; the score's speed bonus is paced, so raw Sprint and Full scores are comparable before the multiplier. |

Real time at 1x: 2 ticks a second (`BASE_TICK_MS` 500) while no card is up; cards are estimated at 8 s each.

### Sprint vs Full (seed 7, 300 runs per policy, difficulty and length, never used for tuning)

Tuning used seed 1 and seed 7 at 150 to 300 runs per step. Command: `npm run balance -- --runs 300 --difficulty all --runLength sprint,full --brief --seed 7` (14,400 runs, 13.5 min on 2 workers).

| Difficulty   | Policy     | Runs | sprint win | full win | Gap pp | sprint min p50 | full min p50 | Cards   | Moments | Rival launches |
| ------------ | ---------- | ---- | ---------- | -------- | ------ | -------------- | ------------ | ------- | ------- | -------------- |
| sandbox      | sensible   | 300  | 62.0%      | 67.0%    | -5.0   | 6.7 / 8.0      | 22.9 / 25.8  | 10 / 21 | 18 / 67 | 16 / 16        |
| sandbox      | capability | 300  | 53.0%      | 56.3%    | -3.3   | 6.8 / 8.1      | 22.4 / 25.1  | 10 / 21 | 19 / 66 | 16 / 16        |
| sandbox      | reach      | 300  | 73.3%      | 70.3%    | +3.0   | 4.4 / 5.3      | 14.7 / 16.7  | 7 / 14  | 12 / 44 | 13 / 14        |
| sandbox      | shadow     | 300  | 80.3%      | 81.7%    | -1.3   | 6.0 / 7.2      | 19.8 / 22.2  | 9 / 18  | 15 / 54 | 15 / 14        |
| sandbox      | random     | 300  | 23.3%      | 14.0%    | +9.3   | 4.3 / 5.2      | 14.6 / 16.4  | 7 / 13  | 11 / 41 | 13 / 13        |
| sandbox      | idle       | 300  | 0.0%       | 0.0%     | +0.0   | 7.9 / 9.5      | 27.3 / 30.7  | 12 / 25 | 18 / 65 | 17 / 17        |
| frontier     | sensible   | 300  | 35.0%      | 31.7%    | +3.3   | 7.1 / 8.5      | 24.0 / 26.9  | 10 / 22 | 19 / 65 | 16 / 16        |
| frontier     | capability | 300  | 24.7%      | 26.3%    | -1.7   | 6.9 / 8.3      | 23.0 / 25.9  | 10 / 21 | 18 / 65 | 16 / 16        |
| frontier     | reach      | 300  | 31.0%      | 32.0%    | -1.0   | 6.4 / 7.7      | 21.5 / 24.1  | 10 / 20 | 18 / 63 | 16 / 16        |
| frontier     | shadow     | 300  | 60.7%      | 54.0%    | +6.7   | 6.3 / 7.5      | 21.6 / 24.3  | 9 / 20  | 16 / 60 | 16 / 16        |
| frontier     | random     | 300  | 7.3%       | 1.7%     | +5.7   | 4.4 / 5.3      | 14.3 / 16.1  | 7 / 13  | 11 / 39 | 14 / 14        |
| frontier     | idle       | 300  | 0.0%       | 0.0%     | +0.0   | 7.7 / 9.3      | 26.4 / 29.6  | 11 / 24 | 18 / 63 | 17 / 17        |
| arms-race    | sensible   | 300  | 17.3%      | 15.0%    | +2.3   | 7.0 / 8.4      | 23.6 / 26.6  | 10 / 22 | 18 / 63 | 16 / 16        |
| arms-race    | capability | 300  | 11.0%      | 12.0%    | -1.0   | 6.7 / 8.1      | 22.6 / 25.3  | 10 / 21 | 17 / 60 | 16 / 16        |
| arms-race    | reach      | 300  | 12.3%      | 14.0%    | -1.7   | 6.6 / 7.9      | 20.9 / 23.6  | 10 / 20 | 18 / 60 | 16 / 16        |
| arms-race    | shadow     | 300  | 25.0%      | 23.0%    | +2.0   | 6.7 / 8.0      | 22.7 / 25.3  | 10 / 21 | 17 / 60 | 16 / 16        |
| arms-race    | random     | 300  | 2.3%       | 1.3%     | +1.0   | 4.7 / 5.6      | 14.9 / 16.8  | 7 / 14  | 12 / 40 | 15 / 14        |
| arms-race    | idle       | 300  | 0.0%       | 0.0%     | +0.0   | 7.4 / 8.8      | 23.9 / 26.9  | 11 / 22 | 17 / 57 | 17 / 16        |
| hard-takeoff | sensible   | 300  | 6.7%       | 11.0%    | -4.3   | 6.7 / 8.1      | 22.5 / 25.2  | 10 / 21 | 17 / 58 | 16 / 16        |
| hard-takeoff | capability | 300  | 3.7%       | 7.0%     | -3.3   | 6.5 / 7.7      | 22.2 / 25.0  | 10 / 20 | 16 / 57 | 16 / 16        |
| hard-takeoff | reach      | 300  | 2.7%       | 3.0%     | -0.3   | 6.5 / 7.8      | 20.5 / 23.2  | 10 / 19 | 17 / 56 | 16 / 16        |
| hard-takeoff | shadow     | 300  | 8.3%       | 3.7%     | +4.7   | 6.5 / 7.8      | 22.4 / 25.2  | 10 / 20 | 16 / 57 | 16 / 16        |
| hard-takeoff | random     | 300  | 1.0%       | 0.3%     | +0.7   | 4.6 / 5.6      | 15.1 / 16.9  | 7 / 14  | 12 / 40 | 15 / 15        |
| hard-takeoff | idle       | 300  | 0.0%       | 0.0%     | +0.0   | 6.9 / 8.2      | 23.0 / 25.8  | 10 / 21 | 16 / 55 | 17 / 16        |

Endings, all policies and difficulties pooled (7,200 runs per length):

| Ending              | sprint | full  | Ratio |
| ------------------- | ------ | ----- | ----- |
| rival-agi           | 35.0%  | 34.7% | 1.01  |
| banned              | 16.4%  | 16.6% | 0.99  |
| revolt              | 8.7%   | 10.4% | 0.84  |
| agi-aligned         | 8.6%   | 10.2% | 0.85  |
| dependence          | 9.4%   | 7.8%  | 1.21  |
| rival-agi-close     | 7.3%   | 7.7%  | 0.96  |
| banned-captured     | 7.6%   | 5.3%  | 1.43  |
| monopoly            | 4.1%   | 3.4%  | 1.21  |
| banned-home         | 0.8%   | 1.4%  | 0.55  |
| revolt-robots       | 1.2%   | 1.3%  | 0.92  |
| banned-home-defiant | 0.5%   | 0.8%  | 0.64  |
| agi                 | 0.3%   | 0.4%  | 0.80  |
| monopoly-hostile    | 0.0%   | 0.1%  | 0.33  |

Sprint by difficulty:

| Difficulty   | Sensible win | Sensible ticks p50 | Best focused | capability agi | reach dependence | shadow monopoly | Random win | Idle win | Endings (sensible) | Weakest founder  | Weakest home   |
| ------------ | ------------ | ------------------ | ------------ | -------------- | ---------------- | --------------- | ---------- | -------- | ------------------ | ---------------- | -------------- |
| sandbox      | 62.0%        | 802                | shadow 80.3% | 29.3%          | 59.7%            | 45.3%           | 23.3%      | 0.0%     | 6/6                | hustler 56.0%    | china 50.0%    |
| frontier     | 35.0%        | 848                | shadow 60.7% | 19.3%          | 19.0%            | 31.0%           | 7.3%       | 0.0%     | 6/6                | hustler 21.0%    | india 20.8%    |
| arms-race    | 17.3%        | 841                | shadow 25.0% | 10.3%          | 6.7%             | 11.0%           | 2.3%       | 0.0%     | 5/6                | hustler 8.0%     | china 0.0% (!) |
| hard-takeoff | 6.7%         | 808                | shadow 8.3%  | 3.7%           | 0.3%             | 0.0%            | 1.0%       | 0.0%     | 4/6                | insider 2.0% (!) | japan 0.0% (!) |

Full by difficulty (same seeds):

| Difficulty   | Sensible win | Sensible ticks p50 | Best focused    | capability agi | reach dependence | shadow monopoly | Random win | Idle win | Endings (sensible) | Weakest founder  | Weakest home     |
| ------------ | ------------ | ------------------ | --------------- | -------------- | ---------------- | --------------- | ---------- | -------- | ------------------ | ---------------- | ---------------- |
| sandbox      | 67.0%        | 2754               | shadow 81.7%    | 32.7%          | 54.7%            | 38.3%           | 14.0%      | 0.0%     | 6/6                | hustler 55.0%    | japan 50.0%      |
| frontier     | 31.7%        | 2880               | shadow 54.0%    | 25.0%          | 15.3%            | 24.0%           | 1.7%       | 0.0%     | 6/6                | hustler 27.0%    | china 8.3%       |
| arms-race    | 15.0%        | 2835               | shadow 23.0%    | 12.0%          | 8.7%             | 5.0%            | 1.3%       | 0.0%     | 5/6                | hustler 2.0% (!) | usa 0.0% (!)     |
| hard-takeoff | 11.0%        | 2697               | capability 7.0% | 7.0%           | 0.3%             | 0.0%            | 0.3%       | 0.0%     | 5/6                | insider 2.0% (!) | nordics 0.0% (!) |

### Against the targets

| Target | Result | Met |
| --- | --- | --- |
| Median Sprint run 8 to 10 min at 1x, sensible, default difficulty | Frontier 8.5 min with cards (7.1 min of ticks alone, 848 ticks, 10 cards); every good policy and level 7.5 to 8.5 min with cards | yes with card time; ticks alone are a little under 8 |
| Win rate per policy and difficulty within 10 pp of Full | all 24 cells; largest gaps Sandbox random +9.3, Frontier shadow +6.7, Sandbox sensible −5.0, Hard Takeoff sensible −4.3 | yes |
| No ending below a third of its Full frequency | lowest ratios: `monopoly-hostile` 0.33 (3 Sprint runs vs 9 Full runs of 7,200), `banned-home` 0.55, `banned-home-defiant` 0.64 | yes, `monopoly-hostile` exactly at the line (very rare in both) |
| All three routes viable | capability agi / reach dependence / shadow monopoly on Frontier: Sprint 19.3% / 19.0% / 31.0%, Full 25.0% / 15.3% / 24.0% | yes |
| Events, rival pressure and moments still land | about 10 cards, 16 rival model launches (Full 16) and 16 to 19 moments per Sprint | yes |
| Idle never wins | 0.0% everywhere | yes |

### First session (fresh install: Sprint on Sandbox, the tutorial on)

`scripts/balance/firstSession.ts` drives the real tutorial state machine against the engine on a simulated clock: a caption takes 0.8 s + 4.5 words a second to read, then 0.7 s for its tap; the game runs at 2 ticks a second whenever the tutorial does not pause it; a card takes 8 s; after the tutorial the player plays like the sensible bot. 200 seeds, founders and homes rotating:

| Milestone | Target | p50 (p10 to p90) |
| --- | --- | --- |
| First purchase (the first model) | ≤ 30 s | 20 s |
| First data centre | | 30 s |
| First model launch (tier 1 running) | ≤ 60 s | 43 s |
| First paid region launch (the bot's own choice; the tutorial does not prompt it) | | 283 s (71 to 388) |
| Tutorial finished | ≤ 3 min | 68 s |
| Ending | 8 to 10 min | 9.3 min (5.9 to 10.3); Frontier 9.6 |

The tutorial lost about a third of its words (same steps; home region, Compute and the meters still explained) and its last line now says how to win.

### In tension

- **Card time is an estimate.** Real minutes depend on how long a person reads a card (8 s assumed). At 15 s a card the Frontier median would be about 9.7 min.
- **Hard Takeoff Sprint sees 4 of 6 endings for the sensible bot** (Full 5 of 6); pooled across policies every ending occurs.
- **Random gains most from the Sprint** (+9.3 on Sandbox): extra meter decay keeps a button-masher alive longer. Bots that plan are within ±7.
- **Sprint-only levers are global.** A run-length override replaces a difficulty's value rather than scaling it, so levers the difficulties use (`aiAgiFactor`, player meter factors, entry factors) are off limits; if per-level Sprint tuning is ever needed, the engine would need multiplicative run-length factors.

---

## Task 17: difficulty levels

(`aiAgiFactor` and the buy-out prices per level were changed by task 27; see above.)

Why: the first full phone run was "easily won". The sensible bot won 45.6% at one fixed difficulty and a person plays better than the bot. Four levels now live in `src/content/packs/ai-lab/difficulties.json` (`ContentPack.difficulties`, default `frontier`); each is a balance override merged over the pack's `balance` (engine defaults ← pack ← level) plus a score multiplier. The "Task 12b" numbers below are the pack balance with no level, i.e. the game as it was.

### Levers and values

New `BalanceConfig` levers (neutral defaults, see `docs/ARCHITECTURE.md`): player start factors, rival entry and expansion factors, player meter gain factors, moment boost / threat weight factors and a moment lifetime factor. Existing ones used: `aiAgiFactor`, `acquireBaseCost`, `acquirePerAgi`, `dataCentreUpkeep`, `backlashPerDataCentreLevel`. Blank = the pack value (in brackets).

| Lever | Sandbox | Frontier (default) | Arms Race | Hard Takeoff |
| --- | --- | --- | --- | --- |
| Score multiplier | ×0.75 | ×1 | ×1.35 | ×1.75 |
| `aiAgiFactor` (1.18): rivals' AGI clock | 1.16 | | 1.31 | 1.36 |
| `rivalEntryTickFactor`: rivals enter at entryTick × | 1.15 | 0.9 | 0.85 | 0.7 |
| `aiExpansionFactor`: rivals launch / build × | 0.95 | 1.1 | 1.0 | 1.1 |
| `playerStartHypeFactor` / `playerStartCashFactor` | 1.15 / 1.15 | | 0.85 / 0.85 | 0.7 / 0.7 |
| `playerRegulationGainFactor` | 0.95 | 1.1 | 1.15 | 1.3 |
| `playerBacklashGainFactor` | 0.95 | 1.1 | 1.25 | 1.4 |
| `momentThreatWeightFactor` (boosts stay ×1) | 0.7 | 1.2 | 1.6 | 2.2 |
| `momentLifetimeFactor` | 1.2 | | 0.85 | 0.7 |
| `acquireBaseCost` (550) / `acquirePerAgi` (7) | | 600 / | 700 / | 850 / 9 |
| `dataCentreUpkeep` (0.06) / `backlashPerDataCentreLevel` (0.003) | | | 0.08 / 0.0045 | 0.09 / 0.006 |

How the levels feel: Sandbox gives later, lazier rivals, a fatter start, calmer meters and mostly friendly moments that stay longer. Frontier keeps the original rival clock but rivals arrive sooner and spread wider, meters climb 10% faster and threats are more common: the old "sensible" play no longer wins half the time. Arms Race and Hard Takeoff push the player's own Backlash and Regulation (so safety upgrades, the compliance and lobbying nodes and event choices that calm the meters are needed, not optional), make every data-centre level cost more upkeep and more backlash (cheap-power, quiet sites matter), start the player poorer, make threats the common moment and give less time to tap them, and price buy-outs higher.

Not used: `dependenceShare`. Rivals that enter earlier and expand harder already squeeze the dependence path (reach policy: 54.6% dependence on Sandbox, 5.1% on Arms Race); a lower threshold on Sandbox would make it a spreading game, a higher one on Arms Race would close the path. Also, the race screen's dependence caption reads `pack.balance.dependenceShare` (`src/ui/race/logic.ts`); if a level ever overrides it, that line must read `getBalance(state, pack)` instead. The compute curve is pack-only by validation (`getComputeRequired` is called without a state).

### Calibration (seed 2031, 1,000 runs per policy and level, never used for tuning)

Tuning used seed 1 at 300 runs per step. Command: `npm run balance -- --runs 1000 --difficulty all --seed 2031` (24,000 runs, about 37 min on 2 shared workers); Sandbox was rerun alone after its final step (`aiAgiFactor` 1.14 → 1.16; 70.1% before).

| Difficulty | Sensible win | Target | Sensible ticks p10/p50/p90 | Best focused | capability agi | reach dependence | shadow monopoly | Random | Idle | Endings (sensible) | Weakest founder | Weakest home |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sandbox | 68.1% | 60–70% | 1587 / 2751 / 3221 | shadow 83.8% | 31.4% | 54.5% | 39.4% | 16.5% | 0.0% | 6/6 | hustler 57.7% | turkiye 56.0% |
| Frontier | 33.6% | 30–40% | 1743 / 2820 / 3196 | shadow 51.8% | 23.2% | 16.6% | 19.6% | 3.9% | 0.0% | 6/6 | hustler 25.5% | nordics 19.0% |
| Arms Race | 18.8% | 15–22% | 1893 / 2776 / 3002 | shadow 21.3% | 11.5% | 5.1% | 4.9% | 1.3% | 0.0% | 5/6 | hustler 9.0% | india 6.0% |
| Hard Takeoff | 9.4% | 5–10% | 1864 / 2710 / 2909 | capability 6.2% | 6.2% | 0.4% | 0.3% | 0.1% | 0.0% | 5/6 | hustler 2.4% | brazil 3.6% |

All policies per level:

| Policy | Win | agi | dependence | monopoly | banned | revolt | rivalAgi | Ticks p10/p50/p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sandbox/sensible | 68.1% | 27.7% | 31.9% | 8.5% | 6.4% | 10.0% | 15.5% | 1587 / 2751 / 3221 |
| sandbox/capability | 52.8% | 31.4% | 21.3% | 0.1% | 14.2% | 14.4% | 18.6% | 1578 / 2681 / 3264 |
| sandbox/reach | 73.2% | 14.1% | 54.5% | 4.6% | 12.6% | 7.2% | 7.0% | 1334 / 1728 / 3093 |
| sandbox/shadow | 83.8% | 18.0% | 26.4% | 39.4% | 6.3% | 4.0% | 5.9% | 1532 / 2386 / 2941 |
| sandbox/random | 16.5% | 1.6% | 14.9% | 0.0% | 72.4% | 10.6% | 0.5% | 1377 / 1733 / 2425 |
| sandbox/idle | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 2965 / 3279 / 3386 |
| frontier/sensible | 33.6% | 24.4% | 7.1% | 2.1% | 14.1% | 11.1% | 41.2% | 1743 / 2820 / 3196 |
| frontier/capability | 26.0% | 23.2% | 2.8% | 0.0% | 24.0% | 12.7% | 37.3% | 1678 / 2743 / 3210 |
| frontier/reach | 31.1% | 12.5% | 16.6% | 2.0% | 24.4% | 15.1% | 29.4% | 1412 / 2555 / 3174 |
| frontier/shadow | 51.8% | 23.1% | 9.1% | 19.6% | 15.2% | 13.9% | 19.1% | 1673 / 2571 / 3069 |
| frontier/random | 3.9% | 1.0% | 2.9% | 0.0% | 82.6% | 11.7% | 1.8% | 1367 / 1748 / 2454 |
| frontier/idle | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 2533 / 3156 / 3272 |
| arms-race/sensible | 18.8% | 16.4% | 2.4% | 0.0% | 13.7% | 13.7% | 53.8% | 1893 / 2776 / 3002 |
| arms-race/capability | 12.5% | 11.5% | 1.0% | 0.0% | 20.6% | 12.3% | 54.6% | 1749 / 2717 / 2989 |
| arms-race/reach | 10.9% | 5.4% | 5.1% | 0.4% | 26.6% | 18.8% | 43.7% | 1477 / 2531 / 3005 |
| arms-race/shadow | 21.3% | 13.3% | 3.1% | 4.9% | 14.0% | 23.8% | 40.9% | 1784 / 2665 / 2973 |
| arms-race/random | 1.3% | 0.3% | 1.0% | 0.0% | 81.7% | 14.9% | 2.1% | 1358 / 1784 / 2312 |
| arms-race/idle | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 2419 / 2878 / 3037 |
| hard-takeoff/sensible | 9.4% | 9.1% | 0.3% | 0.0% | 12.5% | 12.8% | 65.3% | 1864 / 2710 / 2909 |
| hard-takeoff/capability | 6.2% | 6.2% | 0.0% | 0.0% | 17.9% | 11.7% | 64.2% | 1749 / 2628 / 2849 |
| hard-takeoff/reach | 1.8% | 1.4% | 0.4% | 0.0% | 26.9% | 21.3% | 50.0% | 1472 / 2462 / 2902 |
| hard-takeoff/shadow | 5.2% | 4.8% | 0.1% | 0.3% | 9.9% | 26.3% | 58.6% | 1788 / 2631 / 2869 |
| hard-takeoff/random | 0.1% | 0.1% | 0.0% | 0.0% | 80.5% | 16.9% | 2.5% | 1372 / 1787 / 2299 |
| hard-takeoff/idle | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 2248 / 2750 / 2936 |

Frontier, sensible, by founder: researcher 46.1%, insider 29.1%, hustler 25.5%; by home region from nordics 19.0% to nigeria 62.2% (none under 8%). Ending variants on Frontier (sensible): agi-aligned 24.4%, rival-agi 24.4%, rival-agi-close 16.8%, banned 12.2%, revolt 8.5%, dependence 7.1%, revolt-robots 2.6%, banned-captured 1.7%, monopoly 1.5%, monopoly-hostile 0.6%, banned-home-defiant 0.2%. Peak player Backlash p50 rises from 56 (Sandbox) to 66 (Hard Takeoff).

### Against the targets

| Target | Result | Met |
| --- | --- | --- |
| Sensible at momentSkill 0.7: Sandbox 60–70%, Frontier 30–40%, Arms Race 15–22%, Hard Takeoff 5–10% | 68.1%, 33.6%, 18.8%, 9.4% | yes |
| Idle never wins | 0.0% on every level | yes |
| Median run 2,200–3,600 ticks on every level (sensible, as target 1) | sensible 2,710–2,820; focused policies 2,462–2,743 except Sandbox reach 1,728 | yes for sensible |
| All six endings occur on Frontier | 6/6 (lowest monopoly 2.1%) | yes |
| Each win type reachable on Arms Race by its focused policy | agi 11.5% (capability), dependence 5.1% (reach), monopoly 4.9% (shadow) | yes, but dependence and monopoly are rare |
| No founder or home under 8% on Frontier | lowest hustler 25.5%, nordics 19.0% | yes |
| Hard Takeoff: best focused policy under about 35% | capability 6.2% (sensible 9.4%) | yes |

### In tension

- **Best focused vs sensible.** On Sandbox and Frontier the shadow policy is the best bot (83.8%, 51.8%): a player who goes for buy-outs finds Frontier much easier than 33.6%. On the two hard levels the focused bots do worse than sensible (they over-commit while rivals are fast and meters bite), so "best focused" there underestimates a good human; Hard Takeoff's ceiling for a strong player is unknown but every bot is under 10%.
- **Hard levels narrow to the AGI race.** On Arms Race dependence and monopoly are reachable but rare (about 5% for their focused policy); on Hard Takeoff nearly every win is AGI. Earlier, wider rivals squeeze the share paths and higher buy-out prices the monopoly path.
- **Founders and homes on the hard levels.** Hustler (spread perk) falls to 9.0% on Arms Race and 2.4% on Hard Takeoff; india 6.0% on Arms Race and brazil 3.6% on Hard Takeoff. Only Frontier has a floor target; these are flagged, not fixed.
- **Revolt rises with difficulty** (shadow policy revolt 4.0% → 26.3%): intended (Backlash is the "engage with safety" lever) but the bots do not seek safety nodes until meters pass 50, so humans should fare relatively better here.
- **Rival expansion is not monotonic** (Frontier ×1.1, Arms Race ×1.0, Hard Takeoff ×1.1): at ×1.2 on Arms Race the reach policy's dependence fell to 2%, so Arms Race gets its pressure from earlier entry, the AGI clock and the player's meters instead.
- **Sandbox reach runs are short** (median 1,728 ticks): late, lazy rivals leave the map open, so the spreading bot hits 43% world share early. Random runs are short on every level (about 1,750: banned), as before.
- **The rival AGI clock is noisy to tune**: ±0.02 on `aiAgiFactor` moves Sandbox by about 2 points, inside seed noise (±1.5 points at 1,000 runs).

---

## Task 12b: moments retune (pack balance without a difficulty level)

Goal: tapping should feel rewarding but not decide the run. The first moments pass let tap skill swing the sensible bot from 21.1% (never taps) to 59.1% (taps everything), 38 points. Target: at most about 20 to 25 points across `momentSkill` 0 / 0.4 / 0.7 / 1.0, skill 0 at about 30% or more, skill 1.0 at about 55% or less, every target below still met at 0.7.

### What drives the swing (probes, seeds 1 and 3, 300 to 600 runs)

- **Hype is almost all of it.** With every boost's Hype set to 0, skill 1.0 won 22% (the same as skill 0). With every boost's Cash set to 0, nothing moved (61.7% vs 57.7%). Cash ends most runs unspent, so Cash rewards feel good and cost almost no balance.
- **Threats do not matter for the win rate.** Removing every threat penalty moved skill 0 from 31.2% to 30.8%.
- **Spread is not free either.** A `spreadRate` ×1.25 buff for 30 ticks on the most common boost (viral post) was worth about 7 points at skill 1.0; ×1.2 for 20 ticks is about half that.
- **Skill 0 is set by `aiAgiFactor` alone** (nothing is tapped), so the floor and the spread are separate knobs: moment rewards set the spread, the rivals' clock sets where it sits.

### Changes

Moments (`moments.json`; text and icons unchanged, every name still fits its effect):

| Moment | Old | New |
| --- | --- | --- |
| viral-post | Hype 5.5 + 11.1 ticks of income | Hype 2.2 + 4.5 ticks; spread ×1.2 for 20 ticks |
| glowing-review | Hype 3.7 + 9.2 | Hype 1.5 + 3.8; backlash −0.6 |
| angel-wire | Cash 11 + 8.8 | Cash 14 + 10 |
| intern-bugfix | Cash 6.6 + 6.6 | Cash 8 + 8 |
| celebrity-mention | Hype 7.4 + 14.8 | Hype 3 + 6; adoption ×1.03 in that region |
| campus-adoption | adoption ×1.04; Hype 1.8 + 5.5 | adoption ×1.06; Hype 0.8 + 2.2 |
| dock-gpus | compute +2 | unchanged |
| mascot-meme | Hype 5.5 + 11.1; backlash −1 | Hype 1.9 + 3.8; backlash −1.5 |
| keynote-slot | Hype 9.2 + 16.6 | Hype 2.2 + 4.5; Hype income ×1.5 for 20 ticks |
| leaderboard-win | Hype 5.5 + 11.1; AGI +0.3 | Hype 1.9 + 3.8; AGI +0.4 |
| cheap-power | Cash 4.4 + 11 | Cash 6 + 12 |
| sovereign-fund | Cash 11 + 15.4 | Cash 14 + 16 |
| rival-recruiter (threat) | AGI −0.3 (permanent) | AGI rate ×0.85 for 40 ticks |
| prompt-injection (threat) | Hype −8% | Hype −5% |
| site-protest (threat) | backlash +0.6; adoption ×0.93 | backlash +0.6; adoption ×0.95 |

Boost Hype is about 40% of what it was; each boost still gives a visible amount plus a second, less compounding reward. A pack test (`aiLabPack.test.ts`) keeps boost Hype at most 4 + 8 ticks of income and threat penalties modest and temporary.

Pack balance (`balance.json`):

| Constant | Old | New | Reason |
| --- | --- | --- | --- |
| aiAgiFactor | 1.3 | 1.18 | Rivals carried the old 10% moment Hype; the player now gains about 4% at skill 0.7. Also lifts skill 0 to about 30%. |
| momentIntervalMin / Max | 30 / 54 (engine default) | 36 / 64 | Moments came every 35 ticks (17.5 s at 1x), faster than the 20 to 40 s aimed for; now every 42 ticks (21 s). |
| acquireBaseCost | 500 | 550 | Slower rivals made the shadow route stronger (70.5% at seed 3); 600 gave shadow 65% but cut sensible monopoly towards 3%. |
| dependenceShare | 0.45 | 0.43 | Slower rivals moved reach wins from dependence to AGI: reach dependence fell to 22.0% (seed 2028), under the 25% target. 0.43 gives 29.1%; random stays at 5.5%. |

Balance script: `--moments file.json` swaps the pack's moments for a sweep; Hype-rate buffs from tapped moments now count as moment Hype (the extra income while the buff runs); the report gives how often a moment appears.

### Results (seed 2029, 1,000 runs per policy, not used for tuning)

| Policy     | Runs | Win   | agi   | dependence | monopoly | banned | revolt | rivalAgi | Ticks p10/p50/p90  |
| ---------- | ---- | ----- | ----- | ---------- | -------- | ------ | ------ | -------- | ------------------ |
| sensible   | 1000 | 45.6% | 26.6% | 15.3%      | 3.7%     | 11.5%  | 8.8%   | 34.1%    | 1724 / 2871 / 3219 |
| capability | 1000 | 41.8% | 30.5% | 11.1%      | 0.2%     | 16.2%  | 13.5%  | 28.5%    | 1697 / 2770 / 3248 |
| reach      | 1000 | 49.0% | 15.1% | 29.1%      | 4.8%     | 17.5%  | 11.7%  | 21.8%    | 1425 / 2629 / 3205 |
| shadow     | 1000 | 70.5% | 23.1% | 13.6%      | 33.8%    | 11.1%  | 6.9%   | 11.5%    | 1656 / 2548 / 3041 |
| random     | 1000 | 7.9%  | 2.4%  | 5.5%       | 0.0%     | 76.0%  | 14.8%  | 1.3%     | 1396 / 1794 / 2518 |
| idle       | 1000 | 0.0%  | 0.0%  | 0.0%       | 0.0%     | 0.0%   | 0.0%   | 100.0%   | 2617 / 3194 / 3303 |

Win rate by moment skill (seed 2029, 1,000 runs each; moment share = moment income ÷ (moments + income)):

| momentSkill | sensible | capability | Tapped / missed (sensible, median) | Moment share of Hype / Cash (sensible) |
| --- | --- | --- | --- | --- |
| 0 | 33.8% | 30.2% | 0 / 67 | 0% / 0% |
| 0.4 | 39.6% | 33.2% | 26 / 40 | 2.4% / 1.2% |
| 0.7 | 45.6% | 41.8% | 47 / 20 | 4.1% / 2.0% |
| 1.0 | 52.0% | 44.6% | 67 / 0 | 5.9% / 2.7% |

Spread from skill 0 to 1.0: **18.2 points** for sensible (was 38.0), 14.4 for capability. On seed 2028 (before the `dependenceShare` change) the sensible spread was 31.3% → 51.7%, 20.4 points. A moment appears every 42 ticks of a median run (about 21 s at 1x); sensible at 0.7 taps 47 and misses 20 per run, median 105 Hype and 91 Cash from moments.

### Against the targets (sensible and focused policies at momentSkill 0.7)

| # | Target | Result | Met |
| --- | --- | --- | --- |
| 1 | sensible wins 30 to 60%; median 2,400 to 3,600 ticks; p10 > 1,500; p90 < 4,800 | 45.6%; 2,871; 1,724; 3,219 | yes |
| 2 | idle ≤ 2%, random ≤ 20% | 0.0%, 7.9% | yes |
| 3 | every trigger ≥ 3% for sensible; each win ≥ 25% for its focused policy | lowest monopoly 3.7%; agi 30.5% (capability), dependence 29.1% (reach), monopoly 33.8% (shadow) | yes |
| 4 | rivals eliminate themselves in < 20% of appearances; lead rival AGI > 50 in most player wins | 8.1%; 70.0% of wins | yes |
| 5 | typical sensible win owns about 18 to 30 nodes; buying every rival rare | win nodes p10/p50/p90 27/29/33; every rival bought 0.3% | yes (top of range, as before) |
| 6 | first node ≤ ~60, first data centre ≤ ~250, something every 60 to 120 ticks | tick 1, tick 1; purchase gap median 60, p75 100, p90 140 | yes |
| 7 | no founder < 20% or > 70%; flag regions < 10% or > 85% | founders 41.4% to 53.6%; regions 33.3% to 72.0% (nigeria) | yes |

### In tension

- **Shadow vs sensible monopoly.** Shadow wins 70.5% on seed 2029 (67.5% on seed 2028), right at the "under about 70%" line. Raising `acquireBaseCost` to 600 brings it to about 65% but pulls sensible monopoly (3.7% here) to about 3%, the floor of target 3. The two pull on the same lever; 550 is the middle.
- **Capability AGI** was 26.6% on seed 2028 and 30.5% on seed 2029: above 25%, within seed noise of the limit.
- Lowering the swing further is easy (boost Hype × 0.7 gave about 15 points) but makes tapping matter little; the current numbers keep a visible gain at every skill step.

---

## Task 12: moments, launch news, spread channels (historical)

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
| cloud-native (AGI win, never built a data centre) | (Task 27: it could not be earned; now at most one data centre, see above.) Hard on purpose. Without data centres compute comes from nodes (15), events (parking lot 4, cloud credits 4, billboard 2, export-ban shell 6, gpu-shortage 10 each time, rent 3 each time) and the chip tape-out (10): 50 to 60 reaches model tier 3 to 4, about 0.04 AGI per tick, so it needs rivals slowed or bought. The probe (no lab may build) never sees it because the bot does not pick the compute choices. |
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
