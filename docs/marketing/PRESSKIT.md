# [NAME]: press kit

## In one sentence

[NAME] is a satirical strategy game for phones in which you found a fictional AI lab and race four rival labs to AGI on a living world map, before regulators, public backlash or the rivals stop you.

## In one paragraph

[NAME] turns the AI race into a ten-to-twenty-five-minute strategy game. You pick a founder and a home region, ship models, spread across 40 regions and spend Hype and Cash on three upgrade routes: Capability, Reach and the shadier Shadow. Event cards drawn from a familiar news cycle (GPUs sold from a car boot, a model that tries blackmail in a safety test, a founder fired and rehired in a weekend) force trade-offs, while three meters, Regulation, Backlash and the Rival AGI race, can end the run at any moment. An idle mode, the Garage, grows a pixel-art lab between runs. Every lab, model and person in it is invented.

## In three paragraphs

[NAME] is a strategy game about the race to build the smartest machine on Earth, played on a phone held sideways. You found a lab with a name, a founder (the Researcher, the Hustler or the Insider) and a home region, then spread your model across a living world map where oceans, languages and strict regulators slow you down and the right upgrades open new routes. Four rival labs do the same in their own colours. You win by reaching AGI first, by getting 45% of the world to depend on you, or by buying out every rival; you lose by being banned worldwide, by a public revolt, or by coming second.

The tone is the point. The interface is a calm control room; everything from outside arrives as tabloid news, and as the meters rise the calm gives way: the ticker speeds up, the frame turns red, a BREAKING band slides across, the mascot panics. The event cards and headlines mirror the real AI news cycle but name only made-up labs, models and people, and keep disasters cartoonish. Runs come in two lengths, a Sprint of about ten minutes and a full run of about twenty-five, on four difficulty levels. The Garage, an idle mode, lets you tap and build a pixel-art lab from a garage to an office and beyond, and earns small perks for the race.

[NAME] is made by one person, Berk, who had never made a game before, directing a team of AI agents. An orchestrator model writes task briefs and merges finished work; up to ten developer agents work in parallel, each in its own git branch. A strict architecture (a pure, deterministic game engine with a contract no task may change), about 1,300 automated tests and a headless balance simulator that plays thousands of bot runs keep that team honest. The simulator found the game's dominant strategy (buying out every rival) before any player did; it took several passes to bring the three routes level.

## Fact sheet

| | |
| --- | --- |
| Name | [NAME] (working title: AI Race) |
| Developer | Berk ([CONTACT]), one person directing AI agents |
| Platforms | iPhone (iOS), Android, browser demo on itch.io |
| Orientation | Landscape |
| Price model | Free to play; ads and in-app purchases are planned after launch (not in the current build) |
| Languages | English, Turkish |
| Status | In development. Free browser demo available: [DEMO_URL]. Soft launch planned in Türkiye first; date not set |
| Run length | Sprint about 10 minutes, full run about 25 minutes |
| Content | 40 regions, 36 upgrades on 3 routes, 55 event cards, 77 headlines, 15 endings, 20 achievements, 4 difficulty levels, 4 rival labs, an idle mode with 5 stages |
| Engine | Expo, React Native, TypeScript |
| Online | Plays offline; no account |

## Features

- A living world map: regions light up dot by dot as labs spread; launches ripple, data centres pulse, bans stamp regions red.
- Three upgrade routes of twelve nodes each: Capability, Reach and Shadow, each with its own way to win and its own way to blow up.
- 55 event cards with two or three choices each, many with a risk.
- Three ways to win, three ways to lose, fifteen endings.
- An interface that loses its composure as the run gets dangerous.
- Tap-to-collect moments on the map: boosts to grab and threats to stop in time.
- The Garage: an idle mode with a pixel-art lab that fills up, model training runs, staff, helpers and ship days, earning perks for the race.
- Four difficulty levels, two run lengths.
- Full Turkish translation, written for Turkish players (not machine-literal).

## How it was built (the accurate version)

- **One person, no prior game.** Berk decides what the game is, plays every build and reviews the work. He does not write the code by hand.
- **An orchestrator and developer agents.** An orchestrator model turns goals into written task briefs with rules (which folders a task owns, what must be tested, what "done" means) and merges finished branches. Up to ten developer agents work at once, each on one brief in its own git branch.
- **Guard rails, not trust.** The game engine is pure, deterministic TypeScript with no user interface; a shared contract file may not be edited in a task branch; every engine rule needs a unit test and every content file passes a validation test. The suite had 1,347 tests on 25 November 2026.
- **Balance by simulation.** A headless simulator plays the game with bots across founders, regions, routes and difficulty levels, thousands of runs per check. At one point the Shadow route's bot won 88% of its runs by buying out rivals; after several passes the single-route bots win within 7 points of each other on the default level.
- **Art in code.** The Garage's pixel art is generated by scripts from palettes and sprite descriptions; screenshot scripts regenerate every screen for review.
- **What did not go smoothly.** One evening ten agents ran at once and all hit the usage limit together; reviewing the agents' output, not writing it, is the bottleneck.
- `[TOOLS]`: the specific AI tools used, if Berk chooses to name them.

## Media

- Screenshots, English and Turkish, App Store sizes: docs/marketing/screenshots/{en,tr}/{2622x1206,2688x1242}/
- Clips (1920x1080, no audio): docs/marketing/clips/garage-fill.mp4, sprint-run.mp4, event-cards.mp4
- Logo and icon: assets/images/icon.png (a dedicated press logo is still to do)

## Contact

[CONTACT: name, email, Discord [DISCORD_URL], X/Bluesky handle]
