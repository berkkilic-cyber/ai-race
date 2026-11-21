# AI Race (working title): game spec

A satirical strategy game for phones. You found a frontier AI lab and race to dominate the world before regulators, public backlash or rival labs stop you. Structure: a world map, 20 to 30 minute runs, upgrade trees, several endings. Free to play; ads and purchases come after milestone 1.

Tone: fictional labs, fictional people, obvious parody. **Never use real company names, real product or model names, or real individuals.** Headlines mirror the real AI news cycle (a model escapes its test sandbox, a model blackmails an engineer in a safety test, a rigged benchmark, a staged demo, a founder fired and rehired in a weekend) rewritten with the game's own labs and models. Keep disasters cartoonish and non-technical.

Background parody brands: besides the four fictional rival labs, the world winks at the industry through obvious joke names (MVIDIA, NopenAI, Zlaude and friends, defined once as `brand.<id>.name` strings). They appear only in world headlines, moments, harmless flavour text and a lawyer easter egg, and only in light jokes about industry clichés (shortages, keynotes, renaming, leaderboards, version numbers). Nothing fraudulent, illegal, dangerous or scandalous is ever attributed to them; scandals belong to the player's lab and the fictional rivals. A content test enforces where they may appear.

## A run

1. Found the lab: name, home region, founder type (Researcher, Hustler, Insider), each with one perk.
2. Ship the first model: users appear at home, Hype trickles in.
3. Spend Hype on three trees. Spend Cash on data centres, launches and deals.
4. Spread across the map; rival labs in their own colours do the same.
5. Handle event cards (two or three choices each) roughly once a minute.
6. Beat the clock: Regulation, Backlash and the Rival meter. Any at 100% ends the run.
7. Ending screen: result, score, the headlines you caused.

## Systems

- **Map:** about 40 regions with population, wealth, openness, strictness, power cost. The map is alive: regions brighten with adoption, rivals take territory in their colours, data centres pulse, bans and protests flash red.
- **Currencies:** Hype (from users and headlines; buys tree nodes) and Cash (from products; buys data centres, launches, deals). Compute is a level raised by building data centres and getting GPUs; it caps model capability.
- **Data centres:** built in a region with Cash; location matters (power cost, strictness, local opposition); events can hit them.
- **Trees, about 12 nodes each:** Capability (models, GPUs, own chips, robotics: faster adoption and AGI, more backlash), Reach (products, media, partnerships, government deals: new regions, less backlash, costs Cash), Shadow (fake benchmarks, lobbying, politics, poaching: slows regulation and rivals, scandal risk).
- **Moments:** between decisions, small tappable bubbles pop up on regions where the player has users. Boosts (a post goes viral, an angel investor wires money) give a little Hype, Cash or goodwill when tapped and simply vanish if ignored; threats (a leaked memo, a cooling alarm, a regulator's letter) must be tapped in time or a small penalty lands. They come faster as the player grows, never pile up past a cap, pause with event cards, and add up to a modest bonus: tapping matters, but the game is not a tapping contest. Rivals do not get them.
- **How you spread (Reach channels):** oceans, languages and strict regulators slow natural spread between regions; the map shows what blocks a region and which upgrade opens it. Reach upgrades change *how* the model travels, like transmission routes in an outbreak game: Chat App spreads by word of mouth (skips a neighbour), Localisation removes language barriers, Enterprise Sales and Strategic Partnerships cross oceans along sea links, Government Contracts and the Compliance Office open strict regions, The Everything App does both word of mouth and oceans, and calling a weights leak "open source" makes everything spread more easily for a while, rivals included. The news reports each new route ("crosses the ocean into Brazil"). Launching in a region for Cash always works.
- **Clarity:** the game always shows the tier a lab owns next to the tier it can actually run (compute caps it) and how much compute is missing, the player's own progress to each win next to the rivals', a standings table, and where Hype and Cash come from.
- **Launch news:** whenever any lab, the player's or a rival, actually runs a new model generation (owned and powered by enough compute), the news says so, so the race is visible.
- **Wins:** AGI first; world dependence (45% of the world population using your models); monopoly (every rival bought out or eliminated).
- **Losses:** banned worldwide; public revolt; a rival reaches AGI first.
- **Easter eggs:** secret lab names with a perk or headline, very rare event cards, secret achievements, parody nods to AI history and sci-fi. At least 10. None needed to win, none explained in the game.

## Milestone 1: one playable run

English only, placeholder art, no ads or purchases. Out of scope on purpose: IPO and shareholder pressure, Rogue mode (play as the escaped AI), multiplayer, idle/offline progress.

| # | Task | Done when |
| --- | --- | --- |
| 1 | Project setup | App runs on iOS, Android and web; typecheck, lint and tests run in CI |
| 2 | Game engine | Simulation per `docs/ARCHITECTURE.md`, unit-tested, headless runs work |
| 3 | Content | 40 regions, 36 nodes, 30+ event cards, headlines, 6+ endings, 10+ easter eggs, validated |
| 4 | Map screen | Living map, region sheet with build/launch, top bar with resources and meters |
| 5 | Trees screen | Three trees, buy nodes, locked/affordable states |
| 6 | Events and news | Event cards with choices, news ticker |
| 7 | Start and end screens | Lab setup, ending with score and summary, play again |
| 8 | Balance pass | 1,000 bot runs: sensible strategy wins 30 to 60%, median run 20 to 30 minutes |

## Later, decided by results

Art, sound and Turkish text; ads and purchases; soft launch in Türkiye; daily challenge, then friend lobbies; Rogue mode; Steam page; more themes on the same engine.
