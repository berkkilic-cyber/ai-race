# Visual direction: "calm lab, loud world"

This document defines the game's own identity: the concept, which every theme follows, and the themes themselves. It must stay original: do not imitate the branding, logo, colours or typography of any specific real company or game.

## The idea

- **The lab is composed.** The player's own interface (shell, trees, panels, start screen) is orderly and in the theme's own voice: a technical drawing, a warning label, or a relentlessly cheerful startup, always with one confident accent for the player.
- **The world is loud.** Everything that comes from outside (event cards, headlines, the ticker, bans, rival moves) arrives as tabloid news: condensed bold capitals, hard-edged red and black bands, stamps, slight rotation, no rounded corners.
- **Signature: composure.** The interface reacts to danger. As the three meters rise, the composed surface gives way (each theme in its own way, see below): the ticker speeds up and grows louder, banners appear, and near the limit the screen trembles. A player should be able to feel how the run is going from the whole screen, with the numbers hidden.

## Themes

Six themes with identical token names, chosen at build time by `EXPO_PUBLIC_THEME` (`neon`, `blueprint`, `hazard`, `candy`, and the retired `paper` and `night`; unset or anything else gives the default, `neon`, `DEFAULT_THEME` in `src/ui/theme.ts`). A theme is three things, all in `src/ui/theme.ts` and nowhere else:

- a **palette** (`palettes`): every colour token, including the theme-only ones (`grid`, `gridMajor`, `stripeA`, `stripeB`, `outline`, `shadow`, `mark`, `drain`, `chrome`, and `shady`, the shadow tree's accent: the bad colour everywhere except neon, where it is amber so that red stays for danger);
- a **shape language** (`shapes`): corner radii, line weights, flat shadow offset, button depth, clipped-corner size, the glow on active elements (`glow`), and which decoration panels, tree tiles, the ground, the composure overlays and the mascot use (`panel`, `tile`, `ground`, `composure`, `mascot`, `stamp`), plus how rival colours are kept apart from the player and the alarm (`rivalHue`, `rivalLift`, `rivalAlarmHue`, `rivalSat`);
- a **type pairing** (`themeFontFaces`, `voice`).

Components stay shared: they read these tokens (and draw decoration through `src/ui/components/Deco.tsx`: crop marks, clipped corners, viewfinder brackets, hazard stripes, the drafting grid, the instrument dot grid, rubber stamps) instead of branching on the theme name. Only the active theme's fonts are bundled and loaded (`src/ui/fonts.ts`, see Type).

**Default: `neon`.** The product owner played `blueprint` on an iPhone and asked for something else: "Its too blue, too blueprint. Make it techy like neon green, dark gray maybe, red etc." `neon` is that direction made precise: a lab's control room or trading terminal, not a hacker film. Graphite greys (neutral, never blue-black or pure black) in three clearly separated steps so panels read; near-white type with a cool-grey secondary; one neon green as the player's colour, kept electric by using it sparingly (thin lines, lit map dots, key numbers, the active tab and speed, the primary button: the only large green fill); red for danger and nothing else; a pale teal for good news and a soft sky blue for information, both far enough from the green and the red that neither can pass for them. On the dark map the player's glowing green territory is the brightest thing on screen, so it reads at a glance; the loud world (event cards, BREAKING band, ticker) stays a stark pale card with black ink and red, and crashes into the dark interface harder than it did on cobalt. Body text is above 13:1 on the ground, the secondary grey above 6:1.

Screenshots: docs/screenshots/themes/neon-*.png (map at rest, midgame, critical, region panel, event card and result, trees, start, end), `compare-neon-vs-blueprint.png` (the same midgame map in both), and the `neon-*` sets in docs/screenshots/maplive and docs/screenshots/clarity.

**`blueprint` is now an alternative** (with `hazard` and `candy`), kept because it is still the most distinctive of the set. It was chosen on distinctiveness first and phone legibility second. A saturated cobalt drawing with white linework and one signal-yellow lab is unlike any strategy or tycoon game we could name (those lean dark navy, parchment or black-and-yellow), and one screenshot without a logo is recognisable: the drafting grid, the crop-marked panels and the title block carry the identity even when the map is quiet. On a phone the yellow player territory is the only warm colour on the map, so it reads at a glance; white and pale-cyan text on cobalt is above 7:1 (labels above 4.5:1). `hazard` is the runner-up (the most legible, but black and safety yellow is a familiar industrial trope); `candy` is the most surprising but its pale map is the weakest at a glance. Before blueprint or candy is offered in Turkish, their fonts need Turkish glyphs (see Type, "Turkish glyphs").

**`paper` is retired from the default** (and `night` with it): warm cream, a burnt-orange accent, a display serif and a rounded orange mascot read as the house style of an AI assistant product, not as a game. Both still build with `EXPO_PUBLIC_THEME=paper` / `night` for comparison.

| | neon (default) | blueprint | hazard | candy |
| --- | --- | --- | --- | --- |
| Idea | The lab's control room | An engineer's drawing of the lab | A warning label | The over-friendly startup |
| Ground (`bg`) | `#1B1C1F` graphite with a faint instrument graticule (1-point dots every 16 points at 8 %, a small registration cross every 64, `grid` / `gridMajor` white), much finer than the map's dots so it never competes with them | `#1149C9` saturated cobalt with a drafting grid of translucent white lines (`grid` / `gridMajor` `#E6F3FF` at 8 % / 13 %, a major line every 5 cells), so the grid stays when the sheet floods | `#0E0F11` cool near-black | `#E4D8FF` soft lilac |
| Surfaces | `surface` `#24262A`, `raised` `#2F3237`, `chrome` `#131416` (the strip and rail are the darkest step, so the main area reads as a lit screen) | `surface` `#0B3CA6` (darker sheet), `raised` `#0F43B5`, `chrome` `#0B3CA6` | `#17191C`, `#23262B`, chrome `#17191C` | mint `#CFF7E6`, peach `#FFDCC8`, chrome = ground |
| Lines | `border` `#3E4249` hairlines, `outline` `#6A7079` brackets | `border` `#7DB6FF` pale cyan, `outline` `#E6F3FF` white linework | `border` `#3B3F46`, `outline` `#F4F4F0` | `border` = `outline` = ink `#1E1440` |
| Text / dim | `#EEF0F2` / `#A0A7AF` | `#FFFFFF` / `#BDE0FF` | `#F4F4F0` / `#A3A8B0` | `#1E1440` / `#544873` |
| Player (accent) | neon green `#45FF5C`, ink on it `#06140A`, pressed `playerDeep` `#1F9E34` | signal yellow `#FFD400`, ink on it `#06215F` | safety yellow `#FFD000`, ink `#0E0F11` | hot magenta `#F0107F`, white on it (`playerText` `#B80064`) |
| good / bad / info | pale teal `#7FE6D2` / `#FF6B6B` / sky `#8DB9FF` | `#86F2BE` / `#FFC2C2` / `#A6EBFF` | `#4FE08F` / `#FF6A5E` / `#6CC8FF` | `#0E9F6A` (`goodText` `#00704A`) / `#B3002A` / `#2347C4` |
| Alarm, marks | `#FF2D3D`; `amber` `#FFB21E` for caution; ground warms to `drain` `#2B1114` | red pencil `#FF3B3B`, flood `drain` `#A3162B` | `#FF2A1F` beacons | `#E8003A`, ground drains to `#CFCDD6` |
| Map dots | rest `#3B3F45` quiet grey, banned `#6E1C25` dark red; the player's dots carry a faint green halo; rivals vivid (see below) | rest `#3F76E3`, banned `#082F86`; rivals lifted to light tints | rest `#2C3036`, banned `#050506` | rest `#C6B4F2`, banned `#3A2E5C`; rivals darkened |
| News | pale paper `#F6F6F2`, ink `#0B0B0C`, red `#CF0E25`; black cast shadow | white paper, navy ink `#081634`, red `#D9142B`; deep-blue cast shadow | white, black, red `#D90A00`; yellow under the choices | stark white, black, red `#D40000`; heavier black shadow |
| Corners | small (2 / 3 / 4, no pills) | square (all radii 0) | square, 9-point clipped corners on panels and tiles | round (8 / 14 / 22, pill buttons) |
| Lines and depth | 1-point hairlines, no shadows; a faint glow (`glow` 8) on the primary button, the active tab and speed, the player's launch banner; pressed primary dims to `playerDeep` and loses its glow | 1-point hairlines, no shadows, no button depth | 1.5 / 2-point chunky borders, 4-point button edge | 2 / 2.5-point ink outlines, 3-point flat offset shadows (sticker look) |
| Panels | hairline panels with viewfinder brackets in the corners (`panel: 'bracket'`); the side panel floats inset; the active tab is a dark plate with green brackets | outlined sheets with crop marks at the corners; the lab name sits in a title block | plates; a hazard-stripe band under the top strip and over the side panel | stickers: outlined, shadowed, the top strip's resources and meters are two stickers |
| Tree tiles | rack modules (`tile: 'module'`): a dark tile with a status bar down the left edge, lit in the tree's colour when owned or buyable; owned = faintly tinted, never filled | schematic components: outlined boxes with a pin stub on each side, names in plain grotesque; owned = tinted, not filled | bolted plates: three rivets and a clipped corner | stickers |
| Mascot | a small display module with a pixel face (`mascot: 'pixel'`), lit green, amber when worried, red in a panic | a signal-yellow schematic chip: square body, three pin stubs a side, a pin-1 notch, the face in navy ink | a warning triangle with a face | a magenta sticker blob, ink outline, flat shadow, slightly askew |

Rival colours come from the pack and are never edited there. `readableLabColor` (via `readableOn` in `src/ui/color.ts`) adjusts them per theme: rivals are lifted towards white or ink by `rivalLift`, rotated at least `rivalAlarmHue` degrees away from the alarm's hue, then at least `rivalHue` degrees away from the player's hue (on candy the pink rival would otherwise pass for the magenta player), saturated to at least `rivalSat`, and finally stepped until they reach 3:1 on the theme's ground. On neon (`rivalHue` 90, `rivalAlarmHue` 38, `rivalSat` 0.78) the pack's green rival becomes amber `#E9AD49`, the cyan one sky blue `#5C96F7`, the pink one magenta `#F06ECA` (clear of the alarm red) and the violet one stays violet `#B891FE`: four hues at least 40 degrees apart, away from the green and the red. A test checks contrast, distance from the player, the alarm and each other, and saturation on every theme.

`paper` and `night` keep their original palette (cream `#F4EFE6` / near-black `#11100E`, vermilion `#E4572E` / `#FF6B3D`) and the soft shape language (radius 3 / 8 / 14, hairlines, a 3-point button edge).

## Type

Every face is an open-licence (SIL OFL 1.1) Google font, bundled through its `@expo-google-fonts/*` package; only the weights listed are imported and only the active theme's are loaded. Loading is lazy per theme (`src/ui/fonts.ts`): each theme's requires sit in their own branch, picked by the inlined `EXPO_PUBLIC_THEME`, and run on first use; production builds fold the other branches away, and every branch's requires are inside a `try` block, which Metro treats as optional dependencies, so a theme whose font package is not installed still bundles (in development too) and the active theme never depends on another theme's package. A test checks that every font require sits in a `try` block. Roles: `heading` (lab name, headings, endings), `number` (resources, meters, tabular), `label` (small captions), `body` / `bodyBold` (running text, buttons, tile names), `news` / `newsHeavy` (the loud voice). The `voice` presets (`calmHeading`, `calmNumber`, `calmLabel`, `body`, `bodyStrong`, `loudKicker`, `loudHeadline`, `loudBody`) carry them; components never set font families themselves.

| Role | neon | blueprint | hazard | candy | paper / night (retired) |
| --- | --- | --- | --- | --- | --- |
| heading | Chakra Petch SemiBold, capitals, tracked | B612 Bold, capitals | Big Shoulders Black, capitals | Fredoka Bold | Fraunces SemiBold |
| number | Azeret Mono Medium (monospaced) | B612 Regular (tabular) | Big Shoulders Stencil ExtraBold (stencil numerals) | Fredoka SemiBold | Fraunces Medium |
| label | Azeret Mono Medium, capitals | B612 Mono Regular, capitals | Barlow SemiBold, capitals, tracked | Fredoka SemiBold, lower case | system sans |
| body / bold | Instrument Sans Regular / SemiBold | Hanken Grotesk Regular / SemiBold | Barlow Medium / Bold | Fredoka Medium / SemiBold | system sans |
| news | Saira Extra Condensed Bold / ExtraBold | Sofia Sans Extra Condensed Bold / ExtraBold | Big Shoulders Bold / Black | Anton | Barlow Condensed Bold / ExtraBold |

The loud voice is always uppercase, condensed and heavy; numbers that change use tabular figures.

**Turkish glyphs (ğ Ğ ı İ ş Ş, plus ç ö ü).** The game ships in Turkish too (docs/GLOSSARY.tr.md), and the faces must carry those letters before a theme is offered to players:

- `neon` (default): fine, every face draws the Turkish letters.
- `blueprint`: **B612 and B612 Mono lack Turkish glyphs** (heading, number, label). In Turkish the missing letters fall back to the system face mid-word. Swap or extend these faces before blueprint is offered in Turkish.
- `candy`: **Fredoka lacks Turkish glyphs** (heading, number, label, body). Same fallback; swap or extend before candy is offered in Turkish.
- `hazard`: not reported missing by the first Turkish pass; check on a device before offering it.

Capitals: text under a case-changing preset is cased in JS with the Turkish rules by the locale Text (`src/ui/locale/Text.tsx`), so a face only needs the dotted capital İ and the dotless ı, not locale-aware casing.

## Composure

`useComposure()` returns a level from the highest of the three meters: 0 calm (< 40), 1 uneasy (40 to 64), 2 tense (65 to 84), 3 critical (≥ 85), plus which meter drives it.

| Level | What changes |
| --- | --- |
| 0 | The calm surface, slow ticker, mascot calm |
| 1 | Accent rule under the top strip turns amber; ticker 1.3× speed; mascot glances sideways |
| 2 | A thin alarm-coloured frame around the main area; the driving meter's label gets a tabloid tag ("REGULATORS CIRCLING"); ticker 1.7×, bolder; background tint shifts warm; mascot sweats |
| 3 | "BREAKING" band slides across the top of the main area naming the danger; the frame pulses; the shell trembles a little every few seconds (1 to 2 px, never continuous, off when the OS asks for reduced motion); ticker 2.2×; mascot panics |

Each theme draws these levels its own way (`shape.composure`), on top of the shared ticker speed-up, meter tag, BREAKING band, tremble and mascot moods:

| Theme | 1 uneasy | 2 tense | 3 critical |
| --- | --- | --- | --- |
| paper, night (`classic`) | amber rule | thin alarm frame, warm tint | frame pulses |
| blueprint (`redline`) | amber rule | a red-pencil revision cloud around the drawing and an outlined "REVISE" stamp | heavier cloud, a large "REJECTED" stamp, a pulsing red frame, the sheet itself floods red (the ground turns `drain`; grid and dots stay on it) |
| hazard (`tape`) | amber rule over the stripe band | the frame becomes hazard tape | thicker tape, two pulsing red beacons, striped ends on the BREAKING band |
| neon (`alert`) | corner brackets around the main area (quiet green at rest) turn amber | the brackets turn red, a red glow creeps in from the edges, the ground starts to warm, the strip's figures flicker now and then | red-alert: a hard 3-point red frame that pulses, the glow at full strength, the ground at `drain`, figures flicker more often (no flicker, pulse or tremble with reduced motion); the mascot's face goes amber, then red |
| candy (`drain`) | an "All good!" sticker appears in the corner | the lilac ground drains towards grey, the sticker tilts and asks "All good?"; the top strip's two stickers start to come loose (opposite tilts) and lose their mint | the ground is grey, the strip stickers are grey and askew, the corner sticker peels (curled corner, lifted shadow) |

Transitions between levels are animated (about 600 ms) so the change is felt.

## Map: dot matrix

The world is drawn as a grid of dots, not filled shapes. The build script places dots on a regular grid inside each region. At rest dots are a faint tone of the border colour. As a lab's adoption in a region grows, a matching share of that region's dots light up in the lab's colour (the order in which dots light is fixed per region and spreads outward from the region's marker point, so growth looks like spreading, not random noise). Several labs in one region each light their share.

- Launch: a ring ripples out from the marker point.
- Data centre: a small solid square with a soft pulse, and when online a thin line of light to the two or three neighbouring regions it serves best.
- Ban: the region's dots drop to dark and a rotated "BANNED" stamp sits over it for the duration.
- News flash on a region: its dots blink.
- Selected region: its dots enlarge slightly and a thin outline of the region shape appears.
- Performance: dots are grouped into a small fixed number of paths per region (for example 8 to 12 buckets), never one element per dot; a bucket's colour changes only when the share crosses its threshold.

## Mascot

A small original face for the player's model, used in the top strip, on the start screen and later as the app icon: two eyes and a short mouth on a body that belongs to the theme (`shape.mascot`): a small display module whose pixel face lights green, amber or red by mood (neon), a yellow schematic chip with pin stubs (blueprint), a warning triangle (hazard), a magenta sticker blob (candy), the soft accent square (paper, night). None resembles an existing brand mark or mascot. Moods: calm, pleased (after good news or a purchase), smug (leading the race), uneasy, sweating, panicking, and asleep while paused. Built from simple shapes and animated with small transforms; it blinks.

## Feedback

- Resource numbers count to their new value; a gain pops slightly, a loss dips.
- Buying a node sends a pulse along its connectors.
- Event cards drop in with a slight rotation and a thud (haptic), stamped with a kicker ("BREAKING", "EXCLUSIVE", "DEVELOPING").
- Buttons depress; primary actions have weight.
- Every animation eases out, lasts under 400 ms unless it is ambient, and respects reduced motion.
