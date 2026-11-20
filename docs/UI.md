# UI conventions

Target: phone, portrait, one-handed. Must also run in a browser (`npm run web`) at 390×844 for testing. Placeholder art only in milestone 1: flat shapes, no images.

## Routes (expo-router)

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `app/index.tsx` | Start: lab name, founder, home region, Found the lab |
| `/game` | `app/game/_layout.tsx` | Game shell: top bar, meters, tab content, ticker, tab bar, event modal host, game loop |
| `/game` | `app/game/index.tsx` | Map tab |
| `/game/trees` | `app/game/trees.tsx` | Trees tab |
| `/game/news` | `app/game/news.tsx` | News log tab |
| `/end` | `app/end.tsx` | Ending: result, score, run summary, play again |

Shell layout, top to bottom: **TopBar** (lab name, day counter, speed control: pause / 1x / 2x / 3x) → **ResourceRow** (Hype, Cash with income per day, Compute, Model tier) → **MeterRow** (Regulation, Backlash, Rival as labelled bars; a bar pulses above 75) → tab content → **Ticker** (latest headline, tap opens News) → **TabBar** (Map, Trees, News). The event card is a modal over everything and cannot be dismissed without choosing.

## Code layout

```
src/ui/theme.ts            colours, spacing, radius, type sizes
src/ui/i18n.ts             t(key, params), labName(lab), regionName(id)
src/ui/format.ts           fmtCash (cash is in millions: $850M, $1.2B), fmtCompact, fmtPct, fmtDay
src/ui/store/game.ts       Zustand store: pack, state, speed, newGame(setup), dispatch(action), tick(), setSpeed()
src/ui/hooks/              useGameLoop, usePlayer, useMeters ...
src/ui/components/         shared: Button, Card, Meter, ResourcePill, Sheet, ModalCard, Pips
src/ui/map/                map rendering
src/ui/trees/, events/, news/, start/, end/   one folder per feature
```

- Screens read state through the store and engine selectors and change it only by `dispatch(action)`. No game rules in UI code: costs, availability and failure reasons come from `canApply`, `getNodeCost` and the other selectors.
- All text through `t()`. UI-only labels (button captions, tab names) live in the pack strings under `ui.*`; add the keys you need to `src/content/packs/ai-lab/strings/en.json` and register the prefix so content validation accepts them.
- Game loop: one tick every `500 / speed` ms; stopped when speed is 0, an event is pending, the run has ended, or the app is in the background. When `state.status === 'ended'`, navigate to `/end`.
- Colours and sizes only from `theme.ts`. Minimum touch target 44×44. Respect safe areas.

## Theme

Background `#0B1620`, surface `#132434`, raised surface `#1B3246`, border `#26435A`, text `#EAF2F8`, dim text `#8CA3B5`, player and primary accent `#F2B544` (dark text on it), good `#4ADE80`, bad `#F87171`, info `#5CC8FF`. Spacing 4 / 8 / 12 / 16 / 24. Radius 10 / 16 / pill. Type 11 / 13 / 15 / 18 / 24, system font, tabular figures for numbers that change.

## Map

- Geometry is generated, never hand-edited: `scripts/map/build-geometry.js` merges the countries of each region (from `world-atlas`, using `regions.json` and the no-id country list in the pack's `map.json`) into one simplified SVG path per region, with a centroid and bounding box, and writes `src/content/packs/ai-lab/geometry.json`.
- Rendered with `react-native-svg`. Pan and pinch-zoom on touch; drag and wheel-zoom on web. Double-tap or a button resets the view.
- Region fill: untouched regions use the raised-surface colour. Otherwise the colour of the leading lab there, with opacity rising with total adoption. The player's colour comes from the player's `LabState.color`.
- Banned regions (for the player) get a red outline. When a news item with a `regionId` arrives, that region flashes red (bad) or green (good) for about 1.5 seconds.
- Data centres: a small glowing dot per site near the region centroid, gently pulsing; grey when offline.
- Tapping a region opens the **region sheet** (bottom sheet): name, population, the player's adoption, a share bar per lab, attributes as 1 to 5 pips (wealth, openness, strictness, power cost), and actions with costs: Launch here, Build data centre, Upgrade. A disabled action shows why, mapped from `ActionFailure`.
