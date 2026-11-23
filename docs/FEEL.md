# Feel: sound and haptics

Every tap is answered with a sound, a haptic and motion. Sounds are short synth blips in the neon look: clean, slightly retro-terminal, quiet enough for the hundredth play. All of it lives in `src/ui/feel/`; the files are generated in the repo by `scripts/sfx/generate.js`.

## Game moment → sound → haptic

All files are 16-bit mono 44.1 kHz WAV, peak normalised to -6 dBFS (loudness differences are set at play time in `src/ui/feel/sounds.ts`). "Existing" haptic means the feature already buzzes there on its own (through the unified helpers), so the sound adds none.

| Moment | Cue | Sound (file) | ms | Haptic | How it is synthesised |
| --- | --- | --- | --- | --- | --- |
| Press of a shared `Button` | `tap` | `ui-tap` | 45 | light | 25 % pulse wave 2.2 → 1.9 kHz, 6 ms noise click on the attack, low pass 6 kHz |
| Sheet closed (✕, outside tap, Android back) | `back` | `ui-back` | 80 | light | two falling triangle steps (1320, 880 Hz) |
| Switch between game tabs | `tab` | `tab` | 55 | selection | square chirp 1.2 → 1.8 kHz through a 3.5 kHz low pass |
| Node bought, data centre upgraded, rival bought out | `buy` | `buy` | 150 | medium | two 25 % pulse notes a fifth apart (E6, B6) |
| Cannot afford (failed dispatch: not enough Hype / Cash; failed Garage buy) | `deny` / `garageDeny` | `deny` | 160 | light | soft low double bump: triangle 233 → 207 Hz, then 207 → 185 Hz, low pass 1.6 kHz |
| Region launched (player action) | `regionLaunch` | `region-launch` | 270 | medium | saw sweep 330 → 1320 Hz over a noise whoosh, filter opening 600 Hz → 6 kHz, short slap echo |
| Data centre built | `dataCentre` | `datacentre-built` | 300 | heavy | sine thunk 160 → 60 Hz, a noise click, then a low-passed square A3+E4 hum |
| Own model launched (new tier) | `modelLaunch` | `model-launch` | 620 | success | rising arpeggio C5 E5 G5 C6 in detuned pulse pairs, top note held, echo |
| Event card shown | `eventOpen` | `event-open` | 260 | existing (event card, by tone) | three band-passed noise "teletype" clicks, then a two-tone square alert (A5, D6) |
| Event choice confirmed | `eventConfirm` | `event-confirm` | 160 | existing (choice press) | noise thud + sine kick (a stamp) under a G5+D6 triangle blip |
| Moment collected (boost) | `momentBoost` | `moment-boost` | 200 | light | fast triangle triad up (E6, G♯6, B6) with a slap echo |
| Moment collected (threat averted) | `momentAverted` | `moment-averted` | 210 | medium | "shield": sine 700 → 250 Hz with noise through a closing filter, then a clean A5 tick |
| Rival model launched | `rivalLaunch` | `rival-launch` | 360 | warning | low two-tone siren, saw alternating 415 / 311 Hz, low pass 1.4 kHz |
| Composure level rises (a meter crosses 40 / 65 / 85) | `meterWarning` | `meter-warning` | 300 | warning | square 196 Hz with a 16 Hz tremolo, band limited 120 Hz – 1.1 kHz |
| Run won | `win` | `win-sting` | 900 | success | pulse arpeggio C5 → E6 into a held detuned saw chord, echo |
| Run lost | `lose` | `lose-sting` | 900 | error | falling pulse notes E5 C5 A4, then a saw dyad drooping a fourth, filter closing 4 kHz → 700 Hz |
| Achievement (race or Garage) | `achievement` | `achievement` | 460 | success | bell: sine partials at 1, 2.76 and 5.4 × on B5 then E6, short echo |
| Garage tap | `garageTap` | `garage-tap` | 30 | existing (Garage) | triangle 1050 → 900 Hz with a 4 ms click; pitch rises with the tap combo (rate 1.00 + 0.01 per combo tap, max 1.30) |
| Garage buy (generator or upgrade) | `garageBuy` | `garage-buy` | 120 | existing (Garage) | square double blip a fourth apart (B5, E6) |
| Garage golden moment or crate | `garageGolden` | `garage-golden` | 420 | existing (Garage) | shimmering triangle run C6 → E7 with slight vibrato and a long echo |
| Garage incident fixed | `momentAverted` | `moment-averted` | 210 | existing (Garage) | as above |
| Garage ship (prestige) | `garageShip` | `garage-ship` | 700 | existing (Garage) | rocket: noise through a band pass rising 400 Hz → 3.5 kHz, a saw sweep up, ending on a G5 B5 D6 pulse chord |

Shared `Button`s also squeeze their content to 94 % while held (React Native `Animated` with the native driver: runs on the UI thread, no React state per frame).

## Where the sounds come from (chokepoints)

- **Presses:** `Button` (src/ui/components) wraps `onPress` in `pressFeedback`; `Sheet` wraps `onClose` with the back cue. A press that itself causes a sound (a buy, a deny) drops its tap so the two never stack.
- **Race store** (`src/ui/feel/raceSounds.ts`, pure, tested): sounds are derived from discrete changes between two states, never per tick. Player actions are counters or sets that grew while the tick stayed the same (nodes bought, data centres, a new region, moments collected, events resolved); world events come from new news items (`kind: 'launch'`, `'achievement'`), a new pending event, the player's composure level rising (`src/ui/composure` levels, each level at most once per 120 ticks) and the run ending (only the sting plays).
- **Garage store** (`src/ui/feel/garageSounds.ts`): one small file mapping Garage counters (taps, generators and upgrades bought, golden caught, crates, incidents fixed, models shipped, achievements) to cues. Extend it there when the Garage gains new mechanics.
- **Deny:** `installFeel` wraps the race store's `dispatch` and the Garage store's `buy` / `buyUpgrade`, so a "cannot afford" failure plays the deny cue without editing the stores. Most buy buttons are disabled when unaffordable, so it is rare.
- **Tabs:** `useFeelRoutes()` in the root layout plays the tab cue when the route moves between two `/game` tabs.
- `installFeel()` runs once from `app/_layout.tsx`.

## Rate limits

- The same sound starts at most once per **50 ms** (`SAME_SOUND_GAP_MS`); a repeat inside it is dropped, not queued.
- At most **4** sounds start in any **120 ms** window (`BURST_LIMIT`, `BURST_WINDOW_MS`).
- One state change plays at most its **2** highest-priority cues (`MAX_CUES_PER_CHANGE`; e.g. the ending sting beats everything).
- Voice pools are small (1 voice, 2 for UI tap / buy / moments, 3 for the Garage tap): an idle voice is reused, otherwise the oldest restarts. 10+ Garage taps a second cost one property write and a `play()` each.
- Haptics closer than **40 ms** merge into one unless the later one is stronger (`HAPTIC_GAP_MS`).
- `src/ui/feel/__tests__/wiring.test.ts` proves 1,000 ticks with no player action in a quiet world make no sound, and that a full world stays far below one sound per ten ticks.

## Platform behaviour

- **expo-audio** is loaded lazily inside try/catch (`src/ui/feel/backend.ts`), so a build without the native module, Jest, or any load error runs silently instead of crashing. It is a native module: it plays only in a **new native build** (EAS build / dev client). Over-the-air updates to an older build keep running, silently.
- The audio session is set with `playsInSilentMode: false` (the iPhone silent switch mutes the game) and `interruptionMode: 'mixWithOthers'` (the player's own music keeps playing). No config plugin is needed (it only adds microphone and background-audio permissions, which the game does not use).
- Pitch follows the playback rate (`shouldCorrectPitch = false`; `preservesPitch = false` on web).
- Haptics are skipped on web.

## Settings

One persisted store, `useFeelSettings` (`src/ui/feel/settings.ts`, key `feel.settings`): `sound`, `haptics`, and a reserved `music` flag (no music yet). The Garage's old haptics flag (`garage.settings`) is adopted once if nothing else is saved; the Garage store's `settings.haptics` and `setHaptics` now mirror and delegate to it. `SoundSettingsRows` (exported from `src/ui/feel`) draws the two switches; it is mounted in the Garage settings sheet and is meant for the race's run menu too.

## Debug and checks

- Web with `?debug=1`: `window.__feel.log()` lists the sounds played (names, oldest first), `entries()` adds time and rate, `settings` is the store.
- `node scripts/sfx/feelcheck.js` (after `npx expo export --platform web`) plays part of a run and some Garage taps in headless Chrome and prints the log.

## Regenerate

```
npm run sfx                              # rewrites assets/sfx/*.wav, prints duration, peak, RMS, size per file
node scripts/sfx/generate.js --check     # only checks the committed files
```

The synth is deterministic (seeded noise, no clock): the same script writes byte-identical files. Add a sound by adding a recipe to `SOUNDS` in the script, its `require` in `src/ui/feel/sounds.ts` (a test checks both lists match), a cue in `src/ui/feel/cues.ts`, and a row here. Budget: most sounds under 300 ms, all files together under 700 KB (now 578 KB).
