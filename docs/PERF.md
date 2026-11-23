# Performance

The owner reported that the race "lags a little sometimes" on an iPhone 13 Pro Max in Expo Go (development mode). There is no iOS device here, so this pass measures the web export in headless Chrome with the CPU throttled 6x at 926x428, measures the engine alone in Node, reasons about what differs on Hermes and native, and adds an on-screen readout so real numbers can come from the phone.

## Method

- `npx expo export --platform web`, then `node scripts/screens/perf.js` (see its header). Scenarios, mid-game after the bot plays 200 days (seed 7):
  - **startup**: cold load of the start screen and of `/?autostart=1` (first frame with the screen in place), JS loaded (KB, modules), font files loaded.
  - **run**: 300 ticks at 3x. Frame times (rAF deltas), long tasks, React commits per tick, per-tick timings (store `tick()`, and tick start to React commit), main-thread CPU time from a trace.
  - **pan**: wheel zoom and three drags on the map for about 5 s while running.
  - **trees**: open the Trees tab and come back.
  - **svg**: SVG elements and DOM nodes on the map screen.
  - **soak** (opt-in): 10 minutes at 3x, JS heap after a forced GC every 30 s. `SOAK_LOOP=1` rewinds the run to its first state every 30 s, so the screen replays the same content and a trend means a leak, not a bigger game.
  - **engine**: the public `step()` per tick in Node over three full bot runs played the way the UI plays them.
- `LIVE=1` adds three moment bubbles, a route and a launch banner before each scenario. `PREVISIT=1,2,3` visits Trees, News and Race first (as a player does), so their frozen screens are mounted. `RENDERS=1` lists components rendered per tick, the *render roots* (what the store or a timer woke up) and the largest commits. `PROFILE=1|2`, `PROFILE_FOCUS=<fn>` and `TRACE=1` give CPU profiles and main-thread breakdowns (use an unminified export, `--no-minify --output-dir /tmp/x` with `DIST=/tmp/x`, for names).
- **The machine is shared** (2 cores, load average 3 to 14 while five other tasks ran). Frame times and long tasks move by 2x between identical runs, so before and after builds were run interleaved, twice each, and the robust numbers are the ones that do not depend on wall time: commits per tick, render counts, the engine in Node over many runs, and the heap.

## Before and after

Before = `37f5843` (branch start), after = this branch. Two interleaved rounds each (r1 / r2), CPU 6x, 926x428, insets 0,47,21,47.

| Scenario | Metric | Before r1 / r2 | After r1 / r2 |
| --- | --- | --- | --- |
| run | frame p95 ms | 66.7 / 33.4 | 50 / 50 |
| run | long tasks > 100 ms (longest ms) | 3 (136) / 1 (122) | 4 (131) / 1 (189) |
| run | store tick() median / p95 ms | 11.3 / 29.8 · 6.2 / 15.4 | 7.3 / 21.2 · 6.2 / 21.7 |
| run | React commits per tick | 1.65 / 1.78 | 1.71 / 1.74 |
| run, LIVE | frame p95 ms | 49.9 / 66.7 | 33.4 / 50 |
| run, LIVE | long tasks > 100 ms (longest ms) | 3 (180) / 10 (156) | 0 (72) / 5 (130) |
| run, LIVE | store tick() median ms | 6.8 / 11.6 | 5.8 / 6.5 |
| run, Trees+News+Race visited | React commits per tick | **4.72** | **1.65** |
| pan | frame p95 ms (long tasks > 100) | 50 (0) / 33.4 (0) | 83.3 (0) / 66.7 (0) |
| pan, LIVE | frame p95 ms (long tasks > 100) | 66.6 (0) / 83.4 (1) | 33.4 (0) / 66.7 (0) |
| trees | open ms | 1121 / 758 | 1327 / 1004 |
| trees, LIVE | open ms | 623 / 1405 | 741 / 982 |
| svg | SVG elements in page (map SVG roots) | 757-802 (46-52) | 757-802 (46-52), unchanged |
| startup | start screen first frame ms | 2674 / 2693 | 2690 / 2296 |
| startup | game (autostart) first frame ms | 5437 / 4454 | 6110 / 5188 |
| startup | JS before first frame | 3395 KB, 1646 modules | 3400 KB, 1650 modules |
| startup | fonts before first frame | 6 files, 428 KB (neon only) | same |
| engine (Node) | step() mean, 16 runs, JIT | 0.52 ms | 0.38 ms (-27%) |
| engine (Node) | step() mean, 16 runs, `--jitless` (closer to Hermes) | 1.58 ms | 0.78 ms (-50%) |
| engine (Node) | step() median / p95 per tick, after | | 0.09 / 0.29 ms (early 0.07 / 0.30, late 0.10 / 0.22) |
| soak 10 min | heap trend after minute 2 (growing game) | +0.113 MB/min, DOM 1046 -> 1378 | +0.127 MB/min, DOM 1046 -> 1288 |
| soak 10 min, SOAK_LOOP | heap trend after minute 2 (same content) | | +0.074 MB/min, DOM flat |

Frame and long-task rows differ between identical runs as much as between builds: read them as "no regression", not as gains. The engine, commit and soak rows are the dependable ones. The engine "worst" tick (about 100 ms) moves to a different tick on every run of the same seed: it is the machine or a major GC, not engine work.

**Heap.** A heap snapshot diff over three minutes of replayed play (after the first minute) changes JS self size by -89 KB. What grows is V8 compiled code and Chrome's own performance-timeline entries, not app objects. Neither soak shows a leak. In the plain soak the heap grows with the game (data centres, sites, news; DOM nodes +250 to +330).

## Where the time goes (before, run with LIVE, 6x)

Main-thread CPU by trace event: script 42% (+3% microtasks), compositor layer update 10%, frame commit 6%, style 4%, layout 4%, paint 4%, prepaint 2%, animation scheduling 2%. Within script, from the CPU profile (inclusive): React render and commit 31%, Reanimated mappers and style writes 26% (on web they run on the main thread; on a phone they run on the UI thread), the store `tick()` 22%, rAF loops 15%.

Top ten costs found, and what was done:

| # | Cost | Share | Fix |
| --- | --- | --- | --- |
| 1 | Frozen hidden tabs asked React for a render on every tick once any of their selectors had changed (the render could never commit), and kept computing those selectors | +1.3 to +3 commits per tick per player who visited the tabs; selector time in the race view, node statuses and prices, dot colours | `useTabSelector` / `useTabStore` (src/ui/shell/tabActive.ts): selectors inside a tab hold their last value while it is hidden; the tab slot provides the context. Effects (race trend sampler, moment sync, banners) untouched. 4.72 -> 1.65 commits per tick |
| 2 | Engine: the modifier-table cache was keyed by array identity, and the public `step()` copies every lab each tick, so every tick rebuilt every lab's table and per-region multipliers | 15-20% of `step()`, plus GC | Second cache level that recognises the same lab by content (src/engine/modifiers.ts). Bit-identical results (hash of every 250th state over 16 runs). -27% JIT, -50% interpreted |
| 3 | Store listeners (every mounted selector on every tick) | 61% of `tick()` | Items 1, 4 below. Remaining: reach (`getReachableRegions`) 9%, ring step per bubble 11% with three bubbles, standings 4% |
| 4 | `regionDotColors` for 40 regions every tick | 15% of listeners | Fast path for regions with no or one lab lit, cached strings; ban check only where a ban exists. Same strings (randomised test). -35 to -40% interpreted |
| 5 | Compositor layer update and frame commit | 16% of main thread | Web only (the layers that make panning cheap). Not changed |
| 6 | Reanimated mappers and style writes | 26% of script | Web only: on a phone they run on the UI thread. Already one shared clock; not changed |
| 7 | Moment ring: one `withTiming` per bubble per tick | 11% of listeners with three bubbles | Kept: the drain look depends on it |
| 8 | Large commits when a data centre is built, a headline arrives (Ticker re-renders its copies) or the standings change | 100-225 components in one commit, the "sometimes" spikes | Measured and listed; these are real content changes, already memoised per layer. Not changed |
| 9 | `selectModelStatus` every tick | 8% of listeners | Trees now read it through `useTabStore` (held while hidden); the hook itself is in src/ui/explain (not this task's lane) |
| 10 | Per-tick React renders: day counter, count-ups, Text wrappers | about 1.7 commits per tick | Already at target (2 or fewer); unchanged |

Checked and fine: number formatting is hand-written (no `Intl` / `toLocaleString`); only the active theme's six font files ship and load; nothing large loads at start-up beyond the app bundle; the game loop and the ambient clock stop while paused, during an event, after the run and in the background; no per-frame React state.

## Targets

- **Commits per tick on the map, steady state, 2 or fewer**: met (1.7 to 1.8; 1.65 after visiting every tab, was 4.72).
- **No heap growth after minute 2**: met for app objects (snapshot diff -89 KB; looped soak +0.07 MB/min is V8 code and browser timeline entries).
- **Frame p95 at or under 33 ms and no long task over 100 ms, run and pan at 6x**: met in the quieter runs of both builds, not reliably. In the way: (1) the shared machine (identical runs vary 2x); (2) on web, Reanimated and the compositor run on the same thread as React, about 40% of the main thread, which a phone splits across threads; (3) the occasional big commit (a data centre, a headline, an event card) that alone costs 70-130 ms at 6x. What it would take: measure on a quiet machine or a device; split the Ticker's copies into a memoised row so a headline renders one row; render the sites and objects layers per region so a new data centre renders one region.

## What could not be measured here

- Anything on iOS: Hermes speed, the UI thread, Fabric commits, Expo Go's development mode, real touch. `--jitless` Node is the closest stand-in for Hermes's interpreter (the engine is about 2x slower there than with V8's JIT; the gains above roughly double in relative size).
- React commits in a production web build (no DevTools hook); perf.js installs one.
- GPU and display timing: headless Chrome frame times are rAF deltas, quantised to 16.7 ms.

## What to expect on the iPhone

- **Development mode is much slower** than what players get: React's development build, Hermes running unoptimised bytecode, and every `[AI-RACE]` lifecycle line sent to the Metro terminal. "A little lag sometimes" in Expo Go dev mode is usually this; check a production-like build first (below).
- **On the phone the JS thread carries React, the store and the engine; animations run on the UI thread.** Lag you feel when the map stops following your finger, or numbers stutter, is the JS thread busy: a tick (store and engine), a big commit (data centre, headline, event card) or, before this pass, the hidden-tab renders.
- Reanimated on the new architecture commits animated props through the shadow tree; several continuous animations (bubbles, data-centre pulse, ticker crawl) cost UI-thread time. Expo Go has a fixed native build, so Reanimated's static feature flags (synchronous UI prop updates) can only be tried in a development build (`npx expo run:ios`); worth testing there if the UI thread, not JS, turns out to be the bottleneck.

## For the owner: read real numbers on your phone

1. Start a production-like bundle: `npx expo start --no-dev --minify -c`, open it in Expo Go (development mode is several times slower and not what players get).
2. Start a run and set 3x speed. Long-press the mascot (top left) for 2 seconds: the debug overlay appears with one extra line at the bottom: `fps · slowest ms · commits/s · tick ms (engine) / worst · svg`. Long-press again to hide it.
3. Play for two minutes on the map, then two on Trees, panning and zooming as usual.
4. Send back: the typical `fps` and `slowest ms` while panning, the highest `slowest ms` you see when lag happens (and what just happened: a headline, a data centre, an event), and the `tick ms` figures. `commits/s` shows a dash in a `--no-dev` build (React offers no hook there); for it, repeat step 2 once with plain `npx expo start`.
5. If `slowest ms` stays under about 33 while it still feels laggy, the UI thread is the limit, not JS: say so, and a development build with Reanimated's flags is the next step.
