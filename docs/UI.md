# UI conventions

Target: phone, **landscape** (decided after the first build: the world map is wide, and a later desktop version is landscape too). Design and test at 844×390; the app is locked to landscape on devices. A narrow portrait window on web must stay usable but need not be polished. Placeholder art only in milestone 1: flat shapes, no images.

## Landscape layout

"Wide" means width > height and width ≥ 600 (`useLayoutMode()` returns `'wide' | 'narrow'`). In wide mode:

- **Left rail** (about 56 wide, inside the left safe area): the tabs (Map, Trees, News) stacked vertically.
- **Top strip** (about 40 high): lab name and day, then Hype, Cash, Compute and Model tier as compact inline pills, then the three meters as compact inline bars, then the speed control at the right.
- **Main area:** everything else. The map is full-bleed and by default shows the whole world fitted to the area. Trees and News replace the main area.
- **Ticker:** a slim strip (about 28 high) along the bottom of the main area.
- **Sheet:** the shared `Sheet` is a right-hand side panel in wide mode (width about 360, full height of the main area, slides in from the right, its content scrolls). The map stays visible and usable beside it. In narrow mode it remains a bottom sheet.
- **ModalCard:** centred, up to about 640 wide, at most the screen height minus margins, content scrolls if needed. Event cards use two columns in wide mode: text on the left, choices on the right.

Vertical space is scarce (390 minus safe areas), so nothing important may need vertical scrolling of the whole screen; panels scroll internally.

**Safe areas.** Insets come from one hook, `useInsets()` (src/ui/hooks), and are applied explicitly; there are no nested `SafeAreaView`s. The wide shell is computed in one place, `wideShellLayout()` (src/ui/shell/shellLayout.ts): rail width = left inset + 56 (its background runs under the inset, its tabs sit inside it), the main column starts at the rail's right edge and ends at the right inset (iOS reports the side inset on both sides in landscape), and the ticker band reaches the bottom edge with its text above the bottom inset. Start, end, the side panel, ModalCard, the event card and toasts all keep their content inside the insets. To check on web, add `?insets=top,right,bottom,left` to the URL (debug only), e.g. `?insets=0,59,21,59` at 859×396 for an iPhone with a Dynamic Island in landscape; `scripts/screens/native.js` takes the screenshots in docs/screenshots/native.

**Overlays, never native `Modal`.** The event card, `ModalCard`, toasts and the tutorial are in-tree layers (`Overlay` in src/ui/components) mounted at the root of the screen, stacked by `layer` in theme.ts: sheets < toasts < tutorial < event card < error screen. On iOS a native Modal whose orientations miss the (landscape-only) interface, or that is presented while another is presenting, throws a native exception that closes the app with no JS error. Android back goes to `onRequestClose` (swallowed when omitted); web keeps focus inside the top overlay.

**Native safety.** Looping animation runs on one shared clock (`AmbientProvider`, src/ui/motion) that stops while paused, after the run, in the background and in unfocused tabs; components derive their pulse from it in worklets instead of starting their own `withRepeat`. Numbers and paths passed to react-native-svg go through src/ui/map/svgSafe.ts. Crash visibility: a root error boundary, `[AI-RACE ERROR]` lines for uncaught errors and rejections, and `[AI-RACE]` lifecycle lines in development builds (src/ui/diagnostics).

**Tutorial.** src/ui/tutorial: a pure state machine (`machine.ts`), one host (`TutorialHost`, mounted in app/game/_layout.tsx) and targets registered with `useTutorialTarget(id)` (tabs `tab.*`, `shell.*` in the strip and ticker, `map.home`, `tree.picker`, `node:<id>`, `node.buy:<id>`, `region.build:<id>`, `event.choices`). It runs on the first run (flag in AsyncStorage through `storage.ts`, memory fallback), can be skipped at any step and replayed from the shell's "?" button or the start screen's How to play. It only observes the store and pauses or resumes the run. Captions live in src/ui/strings/tutorial.en.json. Web debug pages (`?debug=1`) skip it unless the URL has `tutorial=1`; `scripts/screens/tutorial.js` captures every step into docs/screenshots/tutorial.

## Routes (expo-router)

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `app/index.tsx` | Start: lab name, founder, home region, Found the lab |
| `/game` | `app/game/_layout.tsx` | Game shell: top bar, meters, tab content, ticker, tab bar, event modal host, game loop |
| `/game` | `app/game/index.tsx` | Map tab |
| `/game/trees` | `app/game/trees.tsx` | Trees tab |
| `/game/news` | `app/game/news.tsx` | News log tab |
| `/end` | `app/end.tsx` | Ending: result, score, run summary, play again |

Shell layout in narrow mode, top to bottom: **TopBar** (lab name, day counter, speed control: pause / 1x / 2x / 3x) → **ResourceRow** (Hype, Cash with income per day, Compute, Model tier) → **MeterRow** (Regulation, Backlash, Rival as labelled bars; a bar pulses above 75) → tab content → **Ticker** (latest headline, tap opens News) → **TabBar** (Map, Trees, News). The event card is a modal over everything and cannot be dismissed without choosing.

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
- All text through `t()`. Theme-neutral captions (button labels, tab names, failure reasons) live in `src/ui/strings/en.json` under `ui.*`. Theme words come from the pack under `term.*` (`term.hype`, `term.cash`, `term.compute`, `term.capability`, `term.regulation`, `term.backlash`, `term.rival`, `term.dataCentre`, `term.tree.capability`, `term.tree.reach`, `term.tree.shadow`, `term.users`). `t()` looks in the pack first, then in the UI strings.
- The player's colour is a UI decision (`theme.player`); rivals use their `LabState.color`. Use the `labColor(lab)` helper. Ignore lab flags starting with `$` (engine internals).
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
