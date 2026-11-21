# Visual direction: "calm lab, loud world"

This document defines the game's own identity: the concept, which every theme follows, and the themes themselves. It must stay original: do not imitate the branding, logo, colours or typography of any specific real company or game.

## The idea

- **The lab is composed.** The player's own interface (shell, trees, panels, start screen) is orderly and in the theme's own voice: a technical drawing, a warning label, or a relentlessly cheerful startup, always with one confident accent for the player.
- **The world is loud.** Everything that comes from outside (event cards, headlines, the ticker, bans, rival moves) arrives as tabloid news: condensed bold capitals, hard-edged red and black bands, stamps, slight rotation, no rounded corners.
- **Signature: composure.** The interface reacts to danger. As the three meters rise, the composed surface gives way (each theme in its own way, see below): the ticker speeds up and grows louder, banners appear, and near the limit the screen trembles. A player should be able to feel how the run is going from the whole screen, with the numbers hidden.

## Themes

Five themes with identical token names, chosen at build time by `EXPO_PUBLIC_THEME` (`blueprint`, `hazard`, `candy`, and the retired `paper` and `night`; unset or anything else gives the default, `blueprint`, `DEFAULT_THEME` in `src/ui/theme.ts`). A theme is three things, all in `src/ui/theme.ts` and nowhere else:

- a **palette** (`palettes`): every colour token, including the theme-only ones (`grid`, `gridMajor`, `stripeA`, `stripeB`, `outline`, `shadow`, `mark`, `drain`, `chrome`);
- a **shape language** (`shapes`): corner radii, line weights, flat shadow offset, button depth, clipped-corner size, and which decoration panels, tree tiles, the ground, the composure overlays and the mascot use (`panel`, `tile`, `ground`, `composure`, `mascot`, `stamp`), plus how rival colours are kept apart from the player (`rivalHue`, `rivalLift`);
- a **type pairing** (`themeFontFaces`, `voice`).

Components stay shared: they read these tokens (and draw decoration through `src/ui/components/Deco.tsx`: crop marks, clipped corners, hazard stripes, the drafting grid, rubber stamps) instead of branching on the theme name. Only the active theme's fonts are bundled and loaded (`src/ui/fonts.ts`).

**Default: `blueprint`.** Chosen on distinctiveness first and phone legibility second. A saturated cobalt drawing with white linework and one signal-yellow lab is unlike any strategy or tycoon game we could name (those lean dark navy, parchment or black-and-yellow), and one screenshot without a logo is recognisable: the drafting grid, the crop-marked panels and the title block carry the identity even when the map is quiet. On a phone the yellow player territory is the only warm colour on the map, so it reads at a glance; white and pale-cyan text on cobalt is above 7:1 (labels above 4.5:1). `hazard` is the runner-up (the most legible, but black and safety yellow is a familiar industrial trope); `candy` is the most surprising but its pale map is the weakest at a glance.

**`paper` is retired from the default** (and `night` with it): warm cream, a burnt-orange accent, a display serif and a rounded orange mascot read as the house style of an AI assistant product, not as a game. Both still build with `EXPO_PUBLIC_THEME=paper` / `night` for comparison.

| | blueprint | hazard | candy |
| --- | --- | --- | --- |
| Idea | An engineer's drawing of the lab | A warning label | The over-friendly startup |
| Ground (`bg`) | `#1149C9` saturated cobalt with a drafting grid of translucent white lines (`grid` / `gridMajor` `#E6F3FF` at 8 % / 13 %, a major line every 5 cells), so the grid stays when the sheet floods | `#0E0F11` cool near-black | `#E4D8FF` soft lilac |
| Surfaces | `surface` `#0B3CA6` (darker sheet), `raised` `#0F43B5`, `chrome` `#0B3CA6` | `#17191C`, `#23262B`, chrome `#17191C` | mint `#CFF7E6`, peach `#FFDCC8`, chrome = ground |
| Lines | `border` `#7DB6FF` pale cyan, `outline` `#E6F3FF` white linework | `border` `#3B3F46`, `outline` `#F4F4F0` | `border` = `outline` = ink `#1E1440` |
| Text / dim | `#FFFFFF` / `#BDE0FF` | `#F4F4F0` / `#A3A8B0` | `#1E1440` / `#544873` |
| Player (accent) | signal yellow `#FFD400`, ink on it `#06215F` | safety yellow `#FFD000`, ink `#0E0F11` | hot magenta `#F0107F`, white on it (`playerText` `#B80064`) |
| good / bad / info | `#86F2BE` / `#FFC2C2` / `#A6EBFF` | `#4FE08F` / `#FF6A5E` / `#6CC8FF` | `#0E9F6A` (`goodText` `#00704A`) / `#B3002A` / `#2347C4` |
| Alarm, marks | red pencil `#FF3B3B`, flood `drain` `#A3162B` | `#FF2A1F` beacons | `#E8003A`, ground drains to `#CFCDD6` |
| Map dots | rest `#3F76E3`, banned `#082F86`; rivals lifted to light tints | rest `#2C3036`, banned `#050506` | rest `#C6B4F2`, banned `#3A2E5C`; rivals darkened |
| News | white paper, navy ink `#081634`, red `#D9142B`; deep-blue cast shadow | white, black, red `#D90A00`; yellow under the choices | stark white, black, red `#D40000`; heavier black shadow |
| Corners | square (all radii 0) | square, 9-point clipped corners on panels and tiles | round (8 / 14 / 22, pill buttons) |
| Lines and depth | 1-point hairlines, no shadows, no button depth | 1.5 / 2-point chunky borders, 4-point button edge | 2 / 2.5-point ink outlines, 3-point flat offset shadows (sticker look) |
| Panels | outlined sheets with crop marks at the corners; the lab name sits in a title block | plates; a hazard-stripe band under the top strip and over the side panel | stickers: outlined, shadowed, the top strip's resources and meters are two stickers |
| Tree tiles | schematic components: outlined boxes with a pin stub on each side, names in plain grotesque; owned = tinted, not filled | bolted plates: three rivets and a clipped corner | stickers |
| Mascot | a signal-yellow schematic chip: square body, three pin stubs a side, a pin-1 notch, the face in navy ink | a warning triangle with a face | a magenta sticker blob, ink outline, flat shadow, slightly askew |

Rival colours come from the pack and are never edited there. `readableLabColor` (via `readableOn` in `src/ui/color.ts`) adjusts them per theme: rivals are lifted towards white or ink by `rivalLift`, rotated at least `rivalHue` degrees away from the player's hue (on candy the pink rival would otherwise pass for the magenta player), and finally stepped until they reach 3:1 on the theme's ground. A test checks contrast, distance from the player and distance between rivals on every theme.

`paper` and `night` keep their original palette (cream `#F4EFE6` / near-black `#11100E`, vermilion `#E4572E` / `#FF6B3D`) and the soft shape language (radius 3 / 8 / 14, hairlines, a 3-point button edge).

## Type

Every face is an open-licence (SIL OFL 1.1) Google font, bundled through its `@expo-google-fonts/*` package; only the weights listed are imported and only the active theme's are loaded. Roles: `heading` (lab name, headings, endings), `number` (resources, meters, tabular), `label` (small captions), `body` / `bodyBold` (running text, buttons, tile names), `news` / `newsHeavy` (the loud voice). The `voice` presets (`calmHeading`, `calmNumber`, `calmLabel`, `body`, `bodyStrong`, `loudKicker`, `loudHeadline`, `loudBody`) carry them; components never set font families themselves.

| Role | blueprint | hazard | candy | paper / night (retired) |
| --- | --- | --- | --- | --- |
| heading | B612 Bold, capitals | Big Shoulders Black, capitals | Fredoka Bold | Fraunces SemiBold |
| number | B612 Regular (tabular) | Big Shoulders Stencil ExtraBold (stencil numerals) | Fredoka SemiBold | Fraunces Medium |
| label | B612 Mono Regular, capitals | Barlow SemiBold, capitals, tracked | Fredoka SemiBold, lower case | system sans |
| body / bold | Hanken Grotesk Regular / SemiBold | Barlow Medium / Bold | Fredoka Medium / SemiBold | system sans |
| news | Sofia Sans Extra Condensed Bold / ExtraBold | Big Shoulders Bold / Black | Anton | Barlow Condensed Bold / ExtraBold |

The loud voice is always uppercase, condensed and heavy; numbers that change use tabular figures.

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

A small original face for the player's model, used in the top strip, on the start screen and later as the app icon: two eyes and a short mouth on a body that belongs to the theme (`shape.mascot`): a yellow schematic chip with pin stubs (blueprint), a warning triangle (hazard), a magenta sticker blob (candy), the soft accent square (paper, night). None resembles an existing brand mark or mascot. Moods: calm, pleased (after good news or a purchase), smug (leading the race), uneasy, sweating, panicking, and asleep while paused. Built from simple shapes and animated with small transforms; it blinks.

## Feedback

- Resource numbers count to their new value; a gain pops slightly, a loss dips.
- Buying a node sends a pulse along its connectors.
- Event cards drop in with a slight rotation and a thud (haptic), stamped with a kicker ("BREAKING", "EXCLUSIVE", "DEVELOPING").
- Buttons depress; primary actions have weight.
- Every animation eases out, lasts under 400 ms unless it is ambient, and respects reduced motion.
