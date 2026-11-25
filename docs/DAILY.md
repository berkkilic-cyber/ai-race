# Daily challenge and sharing

Why: a run is fun for an evening but gave no reason to come back tomorrow and nothing to post. The daily challenge is the Wordle habit for a strategy game (the same run for everyone, once a day, with a result to share); the front page is a satirical newspaper of what the player's lab did, made to be screenshotted. Marketing has no budget, so the game makes the posts.

## Code

| Where | What |
| --- | --- |
| `src/content/daily.ts` | The contract: `DailyContent` (epoch, run length, fair home regions, twists), the text key families, `validateDaily`. Outside `ContentPack` on purpose (`src/engine/types.ts` is frozen; the engine never reads it), like the map geometry and the lab names. |
| `src/content/packs/ai-lab/daily.json`, `daily.ts` | The ai-lab theme's daily content; wired into the UI through `PackEntry.daily` (src/ui/packs.ts). Text in the pack's `strings/en.json` and `tr.json`. |
| `src/ui/daily/logic.ts` | Pure: date to setup, the local record (one scored attempt per day, streak, last 30 results). |
| `src/ui/daily/store.ts` | Storage (`ai-race.daily.v1` through the shared storage helper), the clock with a debug "today", starting a daily, recording its end, events for analytics. |
| `src/ui/daily/DailyCard.tsx`, `DailySheet.tsx` | The start screen card and the Daily history sheet. |
| `src/ui/share/` | `link.ts` (**`SHARE_LINK`**, the one link constant; task 33 reuses it), `text.ts` (the share text builder), `share.ts` (platform share), `useShare.ts` (button hook with "Copied"). |
| `src/ui/frontpage/` | `story.ts` (pure run recorder), `recorder.ts` (store wiring and storage, `ai-race.story.v1`), `logic.ts` (the page as data), `FrontPage.tsx` (the overlay). |
| `src/ui/end/EndShare.tsx` | End screen row (daily line, Read the front page, Share result) and the front page mount. |
| `src/ui/meta/logic.ts` | `bonusForSetup({ perksOn, daily: true })` returns no bonus: Lab Rep perks are off in the daily. |
| `scripts/screens/daily.js` | Plays five dailies headless and captures `docs/screenshots/daily`. |

## Date to setup

`dailyFor(dateKey, pack, content)` is the one function that decides a day's challenge. Input: the **UTC** date (`YYYY-MM-DD`, so the daily changes at 00:00 UTC for everyone). Each choice hashes the date with its own salt (FNV-1a, then a mulberry32 generator where a shuffle is needed), so adding a region never changes the twist, and so on:

| Field | Rule |
| --- | --- |
| `number` | Days since `content.epoch` (2026-11-01 = No. 1) plus one. |
| `seed` | `hash(date + ":seed") mod 2^31-1`. |
| `founderId` | `hash(date + ":founder")` over the pack's founders. |
| `homeRegion` | `hash(date + ":home")` over `content.homeRegions` (19 fair starts: no rival home, no Antarctica); without the list, every region no rival calls home. |
| `difficulty` | `content.difficulty`, else the pack default (Frontier). |
| `runLength` | `content.runLength` (Sprint, about 8 minutes). |
| `twist` | Dealt in blocks of `twists.length` days: each block is a shuffle seeded by its block number, so every twist comes once per block and never twice in a row. |
| `rivalIds` | Only for twists with `rivals: n`: n rivals picked by a date-seeded shuffle, kept in pack order. |

`dailyGameSetup(def, labName)` turns it into a `GameSetup` (the twist's `bonus` and `rivalIds` are the only levers). The run's store setup carries a tag `daily: { key, number, scored }` (`RunPerks` in src/ui/store/game.ts), which the run save keeps.

## Twists

Every twist uses only what `GameSetup` already offers: `bonus` (start Hype and Cash, modifiers on the player's lab only) and `rivalIds`. Sizes were tuned with the sensible bot on the daily setup (Frontier, Sprint): 150 consecutive dailies per twist, so every founder and home region mix is covered. Baseline without a twist: 26% wins.

| Id | Twist | Levers | Bot win rate |
| --- | --- | --- | --- |
| `cheap-money` | Cheap money: Cash income +50% | `cashIncome ×1.5` | 27% |
| `hype-cycle` | Hype cycle: Hype +5%, Cash −15% | `hypeIncome ×1.05`, `cashIncome ×0.85` | 39% |
| `watchdog` | Watchdog week: Regulation +30%, start +$30M | `regulationGain ×1.3`, `startCash +30` | 24% |
| `outrage` | Outrage season: Backlash +30%, spread +15% | `backlashGain ×1.3`, `spreadRate ×1.15` | 27% |
| `duel` | Duel with {rival}: one rival; meters +60%; buyouts ×2 | `rivals: 1`, `regulationGain`/`backlashGain ×1.6`, `acquireCost ×2` | 41% |
| `small-field` | Small field: two rivals; meters +25% | `rivals: 2`, `regulationGain`/`backlashGain ×1.25` | 37% |
| `gpu-glut` | GPU glut: data centres −25% to build and run | `dataCentreCost`, `dataCentreUpkeep ×0.75` | 34% |
| `chip-shortage` | Chip shortage: data centres +30%, AGI +4% | `dataCentreCost ×1.3`, `agiRate ×1.04` | 28% |
| `bootstrapped` | Bootstrapped: start −$40M, spread +20% | `startCash −40`, `spreadRate ×1.2` | 25% |
| `fire-sale` | Fire sale: buyouts −35% | `acquireCost ×0.65` | 27% |
| `moonshot` | Moonshot: AGI +8%, Backlash +20% | `agiRate ×1.08`, `backlashGain ×1.2` | 35% |
| `word-of-mouth` | Word of mouth: seeding +40%, launches +20% | `seedChance ×1.4`, `launchCost ×1.2` | 29% |
| `friendly-courts` | Friendly courts: bans half as long, risks +30% | `banDuration ×0.5`, `riskChance ×1.3` | 28% |

The bot finds Hype far more valuable than Cash (a +30% Hype twist won 81%, a −20% one 4%), so the income twists are lopsided on purpose. A single rival is easy (83% before the meter penalty: a lone rival often eliminates itself), so the duel is a "survive the regulators" day instead.

**Not built** (each would need a new engine rule or a `types.ts` change; `GameSetup` has no way in):

- *A named rival starts ahead* (a head start, more Cash, an earlier entry): `StartBonus` applies to the player's lab only, and rivals' start and `entryTick` come from the pack and `BalanceConfig`.
- *Moments appear more often* / *event cards come faster* / *rivals research faster*: these are `BalanceConfig` values (`momentInterval*`, `eventInterval*`, `aiAgiFactor`), and `GameSetup` takes no balance override. A `GameSetup.balance?: Partial<BalanceConfig>` layer (merged after the run length) would unlock them.
- *A region starts banned* or *start with an upgrade owned*: no setup field for initial bans or nodes.
- *A twist on the AI's personality* (aggressive rivals): rival personalities are pack data.

## One scored attempt, streak and history

The record (`DailyRecord`, storage key `ai-race.daily.v1`): `history` (oldest first, the last 30 `DailyResult`s), `started` (the scored attempt in progress), `streak { last, count }` and `best`.

- The attempt **counts from the start**: `startAttempt` writes `started`, and `canPlayScored` is false from then on. The card's Play button starts the scored run only when it is available, else practice.
- It **ends** with the run's ending (`finishAttempt`, once per day; a later ending for the same day never overwrites it), or is **abandoned**: Abandon in the run menu, Restart (the new run is practice), founding a new lab over the saved daily, or a started attempt that is neither saved nor in the store when the start screen loads. Each of the three player actions shows a warning first (`ui.daily.warn.*`). An abandoned day counts as played, with no score.
- Save and quit keeps it: the card shows "Continue the daily".
- Rematch from the end screen replays the daily as practice (`asPractice`). Practice runs are never recorded.
- **Streak**: recording day K sets `count + 1` when the last day played was K − 1, else 1; `best` keeps the maximum. Shown as of today: the count while the last day played is today or yesterday, else 0 ("Play today to start a streak", with the best next to it: no guilt wording). A daily finished after midnight counts for the day it started. The count keeps going past the 30 kept results.

## Share text

`buildShareText` (src/ui/share/text.ts), five short lines, no emoji, no spoilers of the day's events (the run's events, twist effects and rivals are not named):

```
AI Race Daily #25              <- pack.title + "Daily #n" (only for the scored daily)
Reached AGI first · day 212    <- share.ending.<trigger> (pack) + days survived
AGI race ■■□■■                 <- one square per fifth of the run: filled = you led the AGI race, hollow = a rival did, · = unknown
Score 4,210 · Streak 3         <- after a normal run: "Score 980"
https://ai-race.example/play   <- SHARE_LINK
```

Turkish: `AI Race Günlük #25`, `AGI'ya ilk biz ulaştık · 212. gün`, `AGI yarışı ■■□■■`, `Skor 4.210 · Seri 3`. About 110 characters: fits a tweet, a WhatsApp message and a Discord post; the squares are plain Unicode geometric shapes (U+25A0, U+25A1) that every platform draws.

Who led comes from the run story: every 5 ticks the recorder notes whether the player's AGI progress is above every active rival's (ties: world share). Sharing uses React Native's `Share` on iOS and Android; on web `navigator.share` when present, else the clipboard (`navigator.clipboard`, then a hidden textarea) with "Copied: paste it anywhere".

## Front page

`buildFrontPage(state, pack, story)` (src/ui/frontpage/logic.ts) gives the page as data; `FrontPage.tsx` lays it out as a broadsheet: ears (edition, price), the masthead, a dateline (in-game day, home region edition), one huge headline, a subheadline, then three columns (a map "photo" with a caption and the market weather box; the lead story; a second story above a market share box), and a footer with the game title and the link. Close, Share and "Screenshot to share" sit outside the paper. Type: the platform serif (Georgia on iOS and web, Noto Serif on Android) for masthead and stories, the theme's heavy condensed news face for headlines; no font file added. Headlines keep their written case, since upper-casing in Turkish would put dotted capitals into English lab names.

**Templates** live in the pack strings (`front.*`, see the header of src/content/daily.ts), numbered from 1. `validateDaily` requires at least three variants of each headline and subheadline per ending family (`agi`, `dependence`, `monopoly`, `banned`, `revolt`, `rivalAgi`), of each side-story type and of the paper names; checks the placeholders each family may use, lengths, and that Turkish never glues a suffix to a placeholder. Choices are deterministic: variant = `hash(seed + ":" + salt) mod count`, so the same run prints the same page.

**Side stories** come from the run story (`story.ts`, fed by the store subscription in `recorder.ts` and by `runHeadless`'s `onTick` in tests; written to storage every 120 ticks of play, in the background and when the run leaves the store, so a resumed run keeps its history): the first model launch, the rival launch that put a rival furthest ahead (tier 2 or better), the first rival bought, the first ban, the worst meter peak (a crisis story from 50%, never the meter the headline is about), the most notable event choice (the first whose risk fired, else the latest), and the home region. The page leads with the most newsworthy one (a buyout, a rival launch, a crisis), then a seeded shuffle of the rest.

The lab name is typed by the player and printed on the page; it never goes to analytics (`scripts/screens/daily.js` checks the stored log).

Adding a theme: give its `PackEntry` a `daily` and write the same key families in its strings; the validator lists what is missing.

## Analytics

`daily_start {day}` and `daily_end {day, ending, score, streak}` for the scored attempt, `share_tap {kind: daily|run|frontpage, where: start|end|frontpage}`, `frontpage_open`, and `daily: boolean` on `run_start` / `run_end` (true for the scored attempt only; practice is false). See docs/ANALYTICS.md.

## A server leaderboard later

Nothing here needs a server, and nothing has to change for one:

1. **Same daily everywhere** already: the date key, the number and the seed are the identity of a day (`dailyFor`). A server only needs the same function (it is pure TypeScript with no UI imports apart from types) or the published `{key, seed, twist}` per day.
2. **Submit** a `DailyResult` (`key`, `number`, `twist`, `ending`, `trigger`, `won`, `score`, `days`, `race`) plus the install id and the build, from the daily store's end subscription, next to `finishAttempt`. Queue it in storage while offline (the record is already there) and send on the next launch.
3. **Trust**: a score is checkable because the engine is deterministic: also send the run's action log (actions with their tick) and let the server replay `createGame(dailyGameSetup(...))` + `applyAction` to confirm the ending and score. Recording actions is a store `onGameAction` listener; no engine change.
4. **Show** a "Today" tab in the Daily sheet (rank, percentile, the distribution of endings) beside the local history; the share text could add "Top 12%".
5. **Names**: the lab name is player-typed text; a leaderboard needs a moderated display name or anonymous ranks, and a privacy note.
