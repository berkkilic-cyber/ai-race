# AI Race: project brief

Paste this into a Claude Project's instructions, or point a new session at this file. It tells a
fresh session what the game is, how the code is organised, what the rules are, and how several
sessions work on it at once without colliding. As of 25 Nov 2026.

## What it is

"AI Race" (working title; the final name is not chosen) is a satirical mobile game about running a
frontier AI lab. Owner: Berk (GitHub `berkkilic-cyber`, Expo account `bullgrinder`). It is built
by Berk directing AI agents: an orchestrator session writes briefs, developer agents work in
parallel branches, the orchestrator merges and verifies.

Two modes that feed each other:

- **The race.** Structured like Plague Inc: a world map, a run with an ending, three upgrade
  routes (capability, reach, shadow), four rival labs, events, news headlines, tappable moments,
  six endings. Run lengths: Sprint (8 to 10 min) and Full (20 to 25 min). Four difficulty levels,
  three founders.
- **The Garage.** An idle game: tap for tokens, buy generators, ship models (prestige). Five
  stages that redraw the room and each add a mechanic (Garage, Office, Data Centre, Company Town,
  Latent Space): training runs, staff allocation, helpers, auto-buy. Pixel-art rooms.
- **Lab Rep** is the account level joining them: the Garage earns small race perks; finishing a
  race rewards the Garage.

Platforms and business: iOS first (Expo), Android later, free with opt-in rewarded ads and
one-time purchases (none wired to real SDKs yet). Soft launch planned in Türkiye. A paid, ad-free
Steam version is planned. English and Turkish.

## Where things are

- Repository: `berkkilic-cyber/ai-race`. The playtest branch everyone pulls is **`task/10-style`**
  (despite its name it is the integration branch). `milestone-1` and `main` are stale.
- Stack: Expo SDK 58, React Native 0.88 (new architecture, React Compiler), React 19, TypeScript
  strict, expo-router, Zustand, react-native-svg, reanimated, expo-audio, Jest, ESLint.
- EAS: project `@bullgrinder/ai-race`, bundle id `com.bullgrinder.airace`, build profiles
  `development`, `preview`, `production` in `eas.json`; over-the-air updates through
  `.github/workflows/eas-update.yml` (needs the `EXPO_TOKEN` repository secret).
- Read first, in this order: `CLAUDE.md` (the rules), `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
  `docs/UI.md`, `docs/DESIGN.md`. Then by topic: `docs/GARAGE.md`, `docs/BALANCE.md`,
  `docs/FEEL.md` (sound), `docs/ANALYTICS.md`, `docs/PERF.md`, `docs/GLOSSARY.tr.md` (Turkish).

## Code map

```
app/                      expo-router screens (thin)
src/engine/               the race simulation: pure, deterministic, theme-agnostic TypeScript
src/engine/types.ts       the shared contract (see rules)
src/idle/                 the Garage simulation: pure, deterministic
src/content/packs/ai-lab  all content, text and numbers (JSON + strings, en and tr)
src/ui/                   everything on screen (map, shell, trees, events, garage, start, end,
                          meta, feel, locale, analytics wiring, ads, tutorial, components)
src/analytics/            typed events, local retention maths (sends nothing over the network)
scripts/balance           headless simulators (npm run balance, npm run balance:garage)
scripts/screens           headless-Chrome checks and screenshots against the web export
scripts/pixel, scripts/sfx   generators for the pixel art and the sound effects
```

## Rules every session follows

1. `CLAUDE.md` is binding. In short: the engine imports nothing outside itself; game rules never
   live in UI code; no AI-lab names or numbers in the engine; all visible text comes from strings
   files, in English and Turkish; parody only (no real companies, products, models or people);
   no new dependencies without a stated reason.
2. `src/engine/types.ts` is the contract. Only the orchestrator session changes it, additively.
   If you need a change, say what and why and stop that part.
3. All three checks pass before anything is called done: `npm run typecheck`, `npm run lint`,
   `npm test`. After UI changes also `npx expo export --platform web` and the relevant
   `node scripts/screens/*.js` (they need Chrome; they rewrite `docs/screenshots`, so restore
   files you did not mean to change).
4. Rules learned from bugs on a real iPhone: no native `Modal` (use the in-tree Overlay,
   ModalCard, Sheet); no `SafeAreaView` (use `useInsets()`); no react-native-gesture-handler on
   the map; no per-frame React state (animations run on the shared ambient clock or the UI
   thread); guard NaN and Infinity before anything reaches SVG or layout; the app is landscape
   only.
5. Text: upper-casing styles must render through `Text` from `src/ui/locale/Text`; never call
   `toUpperCase`/`toLowerCase` on visible text; numbers shown to players go through
   `src/ui/format.ts`. Tests enforce the first two.
6. Honest reporting: say what was verified and how, and what was not. Nothing has been confirmed
   on a physical phone unless a note says so.

## Working side by side

Several sessions may work at once. To stay out of each other's way:

- **Branch from `task/10-style`, never commit to it directly** unless you are the orchestrator
  session. Name branches by lane: `task/<n>-<name>` (orchestrator's agents), `steam/<name>`
  (Steam session). Open a pull request or tell Berk the branch is ready; the orchestrator
  merges, reruns every check and pushes.
- **Own folders, not files in common.** State in your first message which folders you own. If
  you must touch a shared file, keep it to a one-line mount or import and list it in your report.
- **Shared files that conflict most:** `src/ui/i18n.ts` (register a strings file with exactly one
  import and one spread per language), `package.json`, `app.json`, `app/_layout.tsx`,
  `src/ui/store/game.ts`, `src/ui/start/StartScreen.tsx`, `src/ui/end/EndScreen.tsx`,
  `src/ui/garage/GarageScreen.tsx`.
- **Rebase or merge `task/10-style` into your branch before handing over**, and rerun the checks.
- Commit messages are small and clear. Never commit secrets, `node_modules` or build output.

### In progress in the orchestrator session (25 Nov)

| Branch | Lane |
| --- | --- |
| `task/30-art-rooms` | Pixel art for the last three Garage rooms; `scripts/pixel`, `assets/garage`, room components |
| `task/31-daily-share` | Daily challenge, share text, end-of-run front page; `src/ui/daily`, `src/ui/frontpage`, `src/ui/share` |
| `task/32-habits-storage` | Away storage, daily missions, streak, second prestige layer; `src/idle`, Garage content, `src/ui/missions` |
| `task/33-demo-launch-kit` | Browser demo build (`npm run demo`, `src/ui/demo`) and `docs/marketing` |

### The Steam session

Goal: a paid, ad-free desktop version on Steam built from the same code.

- **Own:** a new top-level folder for the desktop shell (for example `desktop/`), `steam/`
  branches, `docs/STEAM.md`, Steam store page text and assets.
- **Starting point:** the game already exports to the web (`npx expo export --platform web`) and
  runs in a browser with mouse input; task 33 adds a letterboxed desktop layout, keyboard
  shortcuts and a build-time demo switch in `src/ui/demo`. A desktop shell around the web build
  is the shortest path. Check what task 33 delivers before building a second switch.
- **Needs from the shared code (ask the orchestrator rather than editing):** a build-time
  "platform: steam" switch read in one module, so that ads are replaced by free in-game boosts,
  purchases are off, and saves use a file. The ad layer already has a provider interface in
  `src/ui/ads` and storage goes through one helper, so both are plug points.
- **Do not change** game rules, balance or content from the Steam branch. If Steam needs a
  different number (for example no ad speed-up), ask for it as a content override.
- **Open decisions for Berk:** paying the Steam Direct fee, the price, whether the demo goes on
  Steam, achievements and cloud saves in the first version.

## State of the game (25 Nov 2026)

- Build on `task/10-style`: `4f11503`. About 1,330 tests pass; browser checks pass in English and
  Turkish. Berk has played it in the iOS simulator; nothing since the sound, Garage rework and
  art has been confirmed on a physical phone.
- Not built yet: real ad and purchase SDKs, an analytics service (events stay on the device),
  notifications, scenarios beyond the main one, multiplayer, an online leaderboard.
- Waiting on Berk: the final name; a preview build installed on his phone and the `EXPO_TOKEN`
  secret; ten outside testers; approval of an analytics service; making the repository private.
- Plans (Claude Docs artifacts in Berk's account): "AI Race: Master Plan" and "AI Race:
  Zero-Budget Marketing Plan". The master plan's targets: 40% of players back on day 1, 15% on
  day 7, 6% on day 30, measured in a Türkiye soft launch before any paid marketing.
