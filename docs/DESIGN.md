# Visual direction: "calm lab, loud world"

The current look (dark navy, gold accent, rounded cards) is a placeholder and resembles other tycoon games. This document defines the game's own identity. It must stay original: do not imitate the branding, logo, colours or typography of any specific real company or game.

## The idea

- **The lab is calm.** The player's own interface (shell, trees, panels, start screen) looks like the brand of a serene, trustworthy research lab: warm paper, ink, one confident accent, elegant serif headings, generous spacing, thin rules instead of heavy boxes.
- **The world is loud.** Everything that comes from outside (event cards, headlines, the ticker, bans, rival moves) arrives as tabloid news: condensed bold capitals, hard-edged red and black bands, stamps, slight rotation, no rounded corners.
- **Signature: composure.** The interface reacts to danger. As the three meters rise, the calm surface gives way: the palette warms, the ticker speeds up and grows louder, banners appear, and near the limit the screen trembles. A player should be able to feel how the run is going from the whole screen, with the numbers hidden.

## Themes

Two palettes with identical token names, chosen at build time by `EXPO_PUBLIC_THEME` (`paper` is the default, `night` is the alternative). All colours stay in `src/ui/theme.ts`.

| Token | paper | night |
| --- | --- | --- |
| bg | `#F4EFE6` warm paper | `#11100E` warm near-black |
| surface | `#FBF8F2` | `#1A1815` |
| raised | `#EAE3D6` | `#25221D` |
| border | `#D8CFBF` | `#37322A` |
| text | `#1D1B18` ink | `#F1EBDD` |
| dim | `#7A7368` | `#9A9284` |
| player / accent | `#E4572E` vermilion | `#FF6B3D` |
| onPlayer | `#FFFFFF` | `#11100E` |
| good | `#2F8F5B` | `#5BC98A` |
| bad / alarm | `#C8102E` | `#FF4D5E` |
| info | `#2C5FA8` | `#7FB2F5` |
| newsInk (tabloid black) | `#111111` | `#000000` |
| newsPaper (tabloid white) | `#FFFFFF` | `#FFFFFF` |

Rival colours come from the pack and must read on both themes; if one fails contrast on paper, darken it in the UI with a helper, not in the pack.

## Type

- **Calm voice:** a display serif for the lab name, headings, big numbers and endings (bundle one open-licence serif such as Fraunces or Newsreader through its `@expo-google-fonts/*` npm package and `expo-font`). Body text in the system sans.
- **Loud voice:** a condensed heavy sans for news (for example Barlow Condensed or Archivo Narrow, same way), always uppercase for kickers and headlines, tight tracking.
- Numbers that change use tabular figures.

## Composure

`useComposure()` returns a level from the highest of the three meters: 0 calm (< 40), 1 uneasy (40 to 64), 2 tense (65 to 84), 3 critical (≥ 85), plus which meter drives it.

| Level | What changes |
| --- | --- |
| 0 | Paper, slow ticker, mascot calm |
| 1 | Accent rule under the top strip turns amber; ticker 1.3× speed; mascot glances sideways |
| 2 | A thin alarm-coloured frame around the main area; the driving meter's label gets a tabloid tag ("REGULATORS CIRCLING"); ticker 1.7×, bolder; background tint shifts warm; mascot sweats |
| 3 | "BREAKING" band slides across the top of the main area naming the danger; the frame pulses; the shell trembles a little every few seconds (1 to 2 px, never continuous, off when the OS asks for reduced motion); ticker 2.2×; mascot panics |

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

A small original face for the player's model, used in the top strip, on the start screen and later as the app icon: a soft rounded square in the accent colour with two dot eyes and a short line mouth, nothing else. Moods: calm, pleased (after good news or a purchase), smug (leading the race), uneasy, sweating, panicking, and asleep while paused. Built from simple shapes and animated with small transforms; it blinks.

## Feedback

- Resource numbers count to their new value; a gain pops slightly, a loss dips.
- Buying a node sends a pulse along its connectors.
- Event cards drop in with a slight rotation and a thud (haptic), stamped with a kicker ("BREAKING", "EXCLUSIVE", "DEVELOPING").
- Buttons depress; primary actions have weight.
- Every animation eases out, lasts under 400 ms unless it is ambient, and respects reduced motion.
