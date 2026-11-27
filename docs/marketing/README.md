# Launch kit

Everything for a zero-budget launch that can be prepared without an account: a free browser demo for itch.io, store and page texts, posts, clip ideas and recorded clips, screenshots and a press kit. Nothing here has been posted, uploaded or signed up for.

| File | What |
| --- | --- |
| [NAME.md](NAME.md) | The chosen name (Benchmaxxing) and the research behind it |
| [STORE.md](STORE.md) | App Store listing in English and Turkish (name, subtitle, promotional text, description, keywords, what's new), expected age rating, privacy label, itch.io page text and tags |
| [POSTS.md](POSTS.md) | Six build-in-public posts for X and LinkedIn, Reddit posts for three communities with their rules, a Show HN post, Turkish posts and a message for Turkish creators |
| [CLIPS.md](CLIPS.md) | Twelve short-video ideas with hooks, shots, captions (six with Turkish captions) and how to make vertical versions |
| [PRESSKIT.md](PRESSKIT.md) | One-page press kit: descriptions, fact sheet, features, how it was built |
| screenshots/ | App Store screenshots, English and Turkish, at 2622x1206 and 2688x1242 (seven scenes each) |
| clips/ | Three recorded clips (MP4, 1920x1080, H.264, 30 fps, no audio) and three frames from each in clips/frames/ |

The demo itself is built by `npm run demo` (code in src/ui/demo and scripts/demo; see "The demo" below).

## What the owner does by hand, in order

1. **The name is chosen: Benchmaxxing** (store title "Benchmaxxing: AI Lab Race"). Still to do by hand: search the App Store, Google Play and the trademark registers (USPTO, EUIPO, TÜRKPATENT) for it, and take the handles in both spellings (benchmaxxing and benchmaxing).
2. **Create the accounts** (free): itch.io, X, LinkedIn (you have one), TikTok, Instagram, YouTube, Reddit, Discord, and a free form service for the waitlist. Use the same handle everywhere if you can.
3. **Set up the waitlist**: a free form (for example a Google Form or any free newsletter service's signup page) that asks for an email address only, says what it is for ("one email when the game is out") and how to unsubscribe. Keep the list private and use it only for that.
4. **Create the Discord server**: a few channels are enough (#announcements, #feedback, #bugs, #turkce). Make an invite link that does not expire.
5. **Fill the three link constants** in `src/ui/demo/links.ts`: `DEMO_URL` (the itch.io page, known once the page exists in draft), `WAITLIST_URL` and `DISCORD_URL`. If another task has added a link constant under `src/ui/share`, point `WAITLIST_URL` at it instead of copying. `npm run demo` warns while any link is still a placeholder (example.com).
6. **Build the demo**: `npm run demo`, then `npm run demo:check` (plays the zip from a sub-folder in headless Chrome). Upload `dist-demo/ai-race-demo.zip`.
7. **Create the itch.io page** (Dashboard → Create new project). Settings, from itch.io's HTML5 documentation ([itch.io: uploading HTML5 games](https://itch.io/docs/creators/html5)) and its update notes:
   - **Kind of project:** HTML. Upload the zip and tick **"This file will be played in the browser"** on the uploaded file (the checkbox the brief names; the part of itch's docs I could read only says to choose the HTML kind, so confirm the label on the upload form).
   - The zip must have `index.html` at its root (it does), at most 1,000 files, 500 MB in total, 200 MB per file, paths up to 240 characters ([itch.io HTML5 docs](https://itch.io/docs/creators/html5)). The build script checks these and prints the numbers (273 files, longest path 148 characters at the time of writing).
   - **Embed options:** "Embed in page", viewport **960 × 480** (a landscape box; the demo letterboxes itself inside any size). On mobile, itch launches HTML games fullscreen and "lock[s] orientation based on the dimension of the game", so a landscape viewport gives landscape on phones ([itch.io: better support for mobile HTML games](https://itch.io/updates/better-support-for-mobile-html-games-more)).
   - **Fullscreen button:** on (itch draws it bottom right in embed mode; the demo has none of its own) ([itch.io HTML5 docs](https://itch.io/docs/creators/html5)).
   - **Mobile friendly:** on (the demo was built for phones; without it, phones show a compatibility warning) ([itch.io: more embed options](https://itch.io/updates/more-embed-options-for-html5-games)).
   - **Scrollbars:** off (the default). **Click to launch:** leave on (the default; starting automatically can mute audio in some browsers).
   - **Pricing:** No payments (free). **Genre:** Strategy. **Tags and text:** paste from STORE.md ("itch.io page"). **Screenshots:** three to five from screenshots/en/2622x1206; the cover image can be cropped from 01-map.jpg (use the size the cover field asks for).
   - Visibility: **Draft** first. Open the page, play a Sprint to the end on a laptop and on a phone, then make it public.
8. **Post in order**, a few days apart: build-in-public post 1 on X and LinkedIn → the r/WebGames post → Feedback Friday on r/incremental_games → Show HN (on a weekday, when you can answer comments for a few hours) → the rest of the build-in-public posts weekly. Reddit and HN rules are summarised in POSTS.md; read them again on the day. Never ask anyone to upvote.
9. **Clips**: start with the three recorded clips (see CLIPS.md for captions and the vertical version). Add music from the platform's licensed library or the game's sounds.
10. **Turkish creators**: send the message in POSTS.md one at a time, personalised, to small channels that cover indie or strategy games.
11. **App Store**, when the iOS build is ready: paste STORE.md, upload screenshots/{en,tr}/2622x1206 and 2688x1242, answer the age rating questions as in STORE.md, and fill the privacy label as STORE.md describes (redo it when ads or a vendor analytics provider are added).

## The demo

- `npm run demo` exports the web build with `EXPO_PUBLIC_DEMO=1` into `dist-demo/site/game`, makes every path relative so it runs from any folder and inside an iframe, adds a letterbox page as `dist-demo/site/index.html`, and zips the site to `dist-demo/ai-race-demo.zip`. The full game is unchanged when the variable is absent.
- In the demo: the Sprint run on the two easier levels and the first two Garage stages. The harder levels, the full run and later Garage stages stay visible and open an "In the full game" card with the waitlist button. A "Join the waitlist" button sits on the start screen and the end screen.
- Browser fit: the game runs in a phone-shaped landscape frame (aspect between 16:9 and 2.17:1, scaled up to 2x on big screens) centred on the dark background; phones get the whole screen and a "turn your phone" hint when upright; space pauses, 1/2/3 set the speed, the mouse wheel zooms the map; no text selection or scroll bounce.
- Analytics: `demo_cta_tap {where}` and `demo_gate_seen {feature}`, on the device like every other event (docs/ANALYTICS.md).
- Size at the time of writing: zip 2.2 MB; the first load fetches about 5.8 MB as served without compression (about 2.2 MB if the host compresses), and the start screen is interactive after about 1 s from a local server and about 4.8 s on a throttled 10 Mbit/s, 40 ms connection (`npm run demo:check` prints these).

## Regenerating the media

Both scripts use the **full** game's web build in `dist/` (not the demo); they build it if it is missing (`REBUILD=1` forces a fresh build).

```sh
npm run marketing:shots    # docs/marketing/screenshots/{en,tr}/{2622x1206,2688x1242}/*.jpg
LANGS=tr SIZES=2622x1206 npm run marketing:shots   # a subset
npm run marketing:clips    # docs/marketing/clips/*.mp4 and clips/frames/*.jpg
CLIPS=garage npm run marketing:clips               # one clip
```

- Screenshots: seven scenes (map mid-run, event card, upgrade trees, a won end screen, the Garage at its first stage, the Office stage, the founder step), with the build stamp, toasts, ad offers, launch banners and debug overlays hidden by CSS. They are JPEG without alpha, as Apple requires. The Garage art is being redrawn by another task: rerun after it lands. Look at every image before uploading.
- Clips: frames are captured from headless Chrome at 960×540 CSS px and 2x, driven by the `?debug=1` hooks (time-lapse parts advance the game a fixed step per frame), and assembled by ffmpeg at 30 fps; the script raises the compression until each file is under 8 MB and prints ffprobe's duration, size and frame rate. No audio.
