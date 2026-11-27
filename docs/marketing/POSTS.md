# Posts, ready to paste

Placeholders: `[DEMO_URL]` the itch.io page, `[WAITLIST_URL]` the waitlist form, `[DISCORD_URL]` the Discord invite, `[TOOLS]` the AI tools Berk used (optional: leave the sentence out to stay generic). Every fact below comes from this brief or the repository (git log, docs/BALANCE.md, docs/GARAGE.md, the test run); nothing is invented. Numbers that will change (tests, commits) are as of 25 November 2026.

## Platform limits used

- **X**: 280 characters per post for most accounts; every link counts as 23 characters whatever its length; emoji count as 2 ([X developer docs: counting characters](https://docs.x.com/resources/fundamentals/counting-characters)). Longer posts need a paid subscription ([Typefully help: X posting limitations](https://support.typefully.com/en/articles/8717699-twitter-x-posting-limitations)). Each X post below was counted with links at 23 and stays under 280.
- **LinkedIn**: up to 3,000 characters per post, with only the first lines shown before "see more" (third-party guides, e.g. [Buffer's developer guide to character limits](https://developers.buffer.com/guides/character-limits.md); LinkedIn's own help page could not be opened from here). The versions below are 700 to 1,300 characters, with the point in the first two lines.

Media for each post is in docs/marketing/screenshots and docs/marketing/clips.

---

## (a) Build in public: six posts

### 1. The start

**Attach:** clips/sprint-run.mp4 (or screenshots/en/2622x1206/01-map.jpg).

X:

```
I've never made a game. I'm making one anyway: a satirical strategy game where you run a fictional AI lab and race four rivals to AGI on a world map.

I'm not writing it alone. I'm directing a team of AI agents.

Free browser demo: [DEMO_URL]
```

LinkedIn:

```
I have never made a game before. For the last while I've been making one: a satirical strategy game about running a fictional AI lab.

You found a lab in a garage, ship models, spread across a living world map, and race four rival labs to AGI while keeping three meters out of the red: Regulation, public Backlash and the Rival AGI race. Event cards ask you what to do when a man in a hoodie offers you 400 GPUs in a parking lot, or when your model tries blackmail in a safety test.

The part I find most interesting is how it is being built. I'm one person, and I'm not writing the code by hand. I'm directing a team of AI agents: one model writes the task briefs and merges the work, and up to ten developer agents build features in parallel, each in its own branch. [TOOLS]

I'll share what works, what breaks and what it costs, as honestly as I can. There's a free browser demo, ten minutes per run: [DEMO_URL]
```

### 2. How the team works

**Attach:** a screenshot of the git history or task board (Berk's own), or screenshots/en/2622x1206/03-trees.jpg.

X:

```
How a one-person game studio with AI agents works, in practice:

One orchestrator model writes the briefs.
Up to ten developer agents work at once, each in its own git branch.
The orchestrator merges.
I decide what the game is and say no a lot.
```

LinkedIn:

```
"Directing AI agents" sounds vague, so here is what it means on my project.

There is one orchestrator model. I tell it what the game needs next; it turns that into written task briefs with rules: which folders a task may touch, what must be tested, what "done" means.

Then up to ten developer agents work in parallel, each in its own git branch, each on one brief. When they finish, the orchestrator reviews and merges them into the main branch.

My job is the part that does not parallelise: deciding what the game is, playing every build, and saying "no, that's not fun" or "it's too blue" (a real note I gave about an early colour scheme).

The rules matter more than the prompts. The game engine is pure code with no screens in it, and a shared contract file that no task branch is allowed to edit. That one rule prevents most of the chaos you would expect from ten agents in one codebase. [TOOLS]
```

### 3. The tests

**Attach:** a screen recording of `npm test` finishing (Berk's own terminal), or screenshots/en/2622x1206/02-event.jpg.

X:

```
The thing that makes AI agents usable on a real project isn't the prompt. It's the tests.

My game has about 1,300 automated tests. Every rule in the simulation needs one before a task counts as done. When an agent breaks something, a test says so before I ever see it.
```

LinkedIn:

```
People ask how I trust code written by AI agents. Mostly I don't. I trust the tests.

The game currently has about 1,300 automated tests (1,347 in the last run). The project rules say every rule in the simulation needs a unit test, every piece of content goes through a validation test, and a task is not done until type checking, linting and the full test suite pass.

That turns "did the agent break something?" from a feeling into a red line in a terminal. Agents are fast and confident, and sometimes confidently wrong; a test suite is the only reviewer that reads every line, every time, without getting tired.

It also changes what I spend time on. I write fewer instructions about how to code and more about what must stay true.
```

### 4. Pixel art drawn in code

**Attach:** screenshots/en/2622x1206/05-garage.jpg and 06-office.jpg (the Garage at two stages), or clips/garage-fill.mp4.

X:

```
Every pixel in this little lab was placed by code, not drawn by hand: a script lays out the sprites, palettes and rooms and writes the images.

Watch it fill up as you buy interns and GPUs. It's the idle mode of my AI lab satire game.
```

LinkedIn:

```
I can't draw, so the pixel art in my game is drawn in code.

The idle mode, the Garage, shows your lab as a pixel-art room that fills up as you hire interns and rent GPUs, then moves into an office. Each sprite, palette and room is described in a script, and a build step writes out the images. The rules are written down too: a fixed grid, light from the top left, one-pixel outlines, no gradients, whole pixels at every phone size.

The upside of art as code is the same as for everything else on this project: an agent can change it in a branch, a script regenerates the screenshots, and I look at them before anything is merged. The downside is that "make the intern look more tired" is a surprisingly long brief.

Attached: the same lab at two stages. [DEMO_URL]
```

### 5. The evening ten agents hit the limit

**Attach:** a screenshot of the usage-limit message (Berk's own, crop out account details) or of ten branches at once.

X:

```
One evening I ran ten AI developer agents at once on my game.

They all hit the usage limit at the same time and stopped, mid-sentence, in ten branches.

Lesson: parallel is fast until it isn't. Now I stagger them.
```

LinkedIn:

```
A small lesson about running AI agents in parallel.

One evening I had ten developer agents working on my game at once, each on its own task in its own branch. It felt like a studio. Then all ten hit the usage limit together and stopped mid-task.

Nothing was lost: every agent works in its own branch, so half-finished work just sat there until the limit reset. But it was a useful reminder that "ten at once" shares one budget, and that the bottleneck moves: first it's how fast the agents write, then it's the limit, then it's how fast I can review what they wrote.

Now I stagger the work: fewer agents at a time, the big tasks first, and small tasks in the gaps. [TOOLS]
```

(Berk: add the real cost or time figures only if you want to share them; none are stated here.)

### 6. The dominant strategy

**Attach:** screenshots/en/2622x1206/03-trees.jpg (the upgrade trees) or 04-end.jpg.

X:

```
I found the best strategy in my game before any player did, by letting bots play thousands of runs.

The shady route (lobbying, buying out rivals) won 88% of them. A game with one right answer is a spreadsheet. So it got nerfed, several times.
```

LinkedIn:

```
Before any player found the best strategy in my game, a simulation did.

The game has three upgrade routes: Capability (bigger models), Reach (products and partnerships) and Shadow (benchmark tuning, lobbying and buying out rivals). A balance script plays the game headless with bots that each follow one route, across founders, home regions and difficulty levels, thousands of runs at a time.

At one point the Shadow bot won 88% of its runs, mostly by buying out every rival: buy-outs were cheap and each one paid for the next. A later pass still had Shadow winning 54 to 61% on the default level against 32 to 35% for mixed play. A strategy that wins that often kills replay value.

The fixes were boring and effective: buy-outs cost more and hand over less, antitrust scrutiny makes Regulation climb faster for a lab that buys its rivals, and Shadow's quick Hype now carries a standing Backlash cost. The single-route bots now win within 7 points of each other on the default level (they were 36 points apart), and Shadow is the route that blows up when it goes wrong, which feels right for the theme.

Numbers and before/after tables are in the project's balance notes. [DEMO_URL]
```

---

## (b) Communities

Read each community's rules again on the day: rules change, and the summaries below were read through third-party mirrors because reddit.com could not be opened from here. **Post as yourself, say you made it, answer comments, and never ask anyone to upvote.**

### r/incremental_games

**The rule that applies:** developers may post about their game only when it is playable, and at most one new post every 30 days ("Rule 1D goes to 30 days between new posts, and posts must refer to playable content"); between posts, use the weekly **Feedback Friday** thread, which explicitly welcomes developers and unfinished games. Source: the subreddit's mod announcement as shown on a mirror ([redlib mirror of r/incremental_games](https://redlib.hackliberty.org/r/incremental_games)); also check the rules on [reddit.com/r/incremental_games](https://www.reddit.com/r/incremental_games/).

**Plan:** first post in Feedback Friday (about the Garage, which is the incremental part), then a normal post 30 days later at the earliest.

Feedback Friday comment:

```
Benchmaxxing (browser demo): an idle lab inside a strategy game. Feedback welcome.

I'm the developer. The game is a satirical AI-lab strategy game, but it has an idle mode, the Garage: tap your model for tokens, buy ten tiers of generators (interns, rented GPUs, server closets...), hit milestones, and "ship" a model to reset with permanent Hype. Stages change the room and switch on new mechanics (training runs, staff, helpers, auto-buy).

The demo has the first two stages: [DEMO_URL]

What I'd like to know: does the first ten minutes pull you in, and at what point does it start to feel slow? Numbers and pacing are all open to change.
```

Post (no earlier than 30 days after the first):

Title: `I made an idle lab that feeds a strategy game: Benchmaxxing (browser demo, free)`

```
Hi, I'm the developer (one person, first game).

Benchmaxxing has two modes. The Garage is an incremental game: tap your model, buy ten generator tiers with milestone multipliers, ship models to prestige into permanent Hype, and move through stages that each switch on a mechanic (training runs that roll model candidates you keep or scrap, staff lanes, helpers that collect for you, auto-buy). Progress in the Garage earns small perks for the other mode, a ten-minute strategy run on a world map.

The browser demo has the first two Garage stages and the short strategy run: [DEMO_URL]

Since the last Feedback Friday I changed: [WHAT CHANGED]. Happy to answer anything about the numbers.
```

### r/WebGames

**The rule that applies:** the game must be playable in a web browser without downloading; owners of a site with only their own games may post at most once a week; a game posted in the last three months may not be posted again; no advertising your site in the title, though tags like `[HTML5]` are allowed (flair preferred); no referral links. Source: the subreddit wiki via a mirror ([redlib mirror of the r/WebGames wiki](https://axebps-redlib.hf.space/r/WebGames/wiki/index)); check [reddit.com/r/WebGames](https://www.reddit.com/r/WebGames/) on the day.

**Plan:** one post, linking straight to the itch.io page, once. The demo needs no account, which this community expects.

Title: `[HTML5] Benchmaxxing: found a fictional AI lab and race four rivals to AGI on a world map`

First comment (from the developer):

```
I made this. It's a satirical strategy game: pick a founder and a home region, spread your model across 40 regions, answer event cards (GPUs for sale in a parking lot, a model that tries blackmail in a safety test), and keep Regulation, Backlash and the Rival AGI race below 100%. A run in the demo takes about ten minutes.

Space pauses, 1/2/3 set the speed, the wheel zooms the map. It runs on phones too, in landscape.

Every lab and person in it is made up. Feedback on the first two minutes is the most useful thing you could give me.
```

### r/iosgaming

**The rule that applies:** developers must identify themselves, use the "Developer" flair and a `[Dev]` tag in the title, and may self-promote **only on Saturdays, and only when the pinned self-promotion post is up**; links go straight to the store or the developer's site. Source: the subreddit sidebar via a mirror ([redlib mirror of the r/iosgaming sidebar](https://axebps-redlib.hf.space/r/iosgaming/wiki/config/sidebar)); check [reddit.com/r/iosgaming](https://www.reddit.com/r/iosgaming/) on the day.

**Plan:** post when the iOS version is on the App Store (or a public TestFlight, if the rules allow it then), on a Saturday with the pinned post up.

Title: `[Dev] Benchmaxxing: a satirical strategy game about running an AI lab (iPhone, landscape)`

```
Hi, I'm the developer. Benchmaxxing is a strategy game where you found a fictional AI lab and race four rival labs to AGI on a living world map. You spread across 40 regions, buy upgrades on three routes (bigger models, more reach, or shadier tactics), answer event cards, and try to keep Regulation, public Backlash and the Rival AGI race under 100%.

Runs are about ten minutes (Sprint) or twenty-five (full). There's also an idle mode, the Garage, for the minutes in between. Plays offline, no account, English and Turkish.

App Store: [APP_STORE_URL]

I made it alone, directing a team of AI agents. Happy to answer questions about either.
```

### Hacker News: Show HN

**The rules that apply:** Show HN is "for something you've made that other people can play with"; the title starts with "Show HN"; make it easy to try "ideally without barriers such as signups or emails"; no landing pages or fundraisers; "Don't post quickly-generated one-offs"; you must be around to discuss it; "Please don't ask friends to upvote or comment." Source: the Show HN guidelines ([news.ycombinator.com/showhn.html](https://news.ycombinator.com/showhn.html); read here through a mirror copy because the official page could not be opened from this environment). The guidelines have no rule about a first comment; a short one from the maker is the usual practice.

**Link to post:** the itch.io demo page (playable, no signup). Do not link the waitlist.

Title (HN titles are short; this is 72 characters):

```
Show HN: A satirical AI-lab strategy game I built by directing AI agents
```

First comment:

```
Hi HN. This is a strategy game for phones (it also runs in the browser): you found a fictional AI lab, spread across a world map, and race four rival labs to AGI while Regulation, public Backlash and the rivals' progress threaten to end the run. The demo is the ten-minute "Sprint" run and the first part of an idle mode.

I'd never made a game. I built this as one person directing AI agents: an orchestrator model writes task briefs and merges, and up to ten developer agents work in parallel, each in its own git branch. [TOOLS]

Things that made that workable:
- A pure, deterministic TypeScript engine with no UI, behind a contract file that task branches may not edit.
- About 1,300 tests; every simulation rule needs one before a task counts as done.
- A headless balance simulator that plays thousands of bot runs per change. It found the dominant strategy before players did: the lobbying-and-buy-outs route won 88% of bot runs at one point, and it took several passes to bring the routes level.
- Pixel art generated by scripts, and screenshot scripts that regenerate every screen for review.

Things that didn't: ten agents at once share one usage limit (they all stopped together one evening), and reviewing their output is now the bottleneck.

Expo + React Native + TypeScript; the browser build is the same code. Happy to go into any of it.
```

---

## (c) Turkish

### Post 1 in Turkish (X)

```
Daha önce hiç oyun yapmadım. Yine de yapıyorum: hayali bir AI lab'ını yönettiğin, dünya haritasında dört rakiple AGI'ya yarıştığın hicivli bir strateji oyunu.

Tek başıma yazmıyorum: bir yapay zekâ ajanları ekibini yönetiyorum.

Ücretsiz tarayıcı demosu: [DEMO_URL]
```

### Post 6 in Turkish (X)

```
Oyunumdaki en iyi stratejiyi oyunculardan önce buldum: botlara binlerce oyun oynattım.

Gölge yolu (lobi, rakipleri satın alma) oyunların %88'ini kazandı. Tek doğru cevabı olan oyun, oyun değil tablo olur. Birkaç turda dengelendi.
```

### Post 1 in Turkish (LinkedIn)

```
Daha önce hiç oyun yapmadım. Bir süredir bir tane yapıyorum: hayali bir AI lab'ını yönettiğin hicivli bir strateji oyunu.

Garajda bir lab kuruyorsun, modeller yayınlıyorsun, yaşayan bir dünya haritasına yayılıyorsun ve dört rakip lab'la AGI'ya yarışırken üç göstergeyi kırmızıdan uzak tutmaya çalışıyorsun: Denetim, kamuoyu Tepkisi ve Rakip AGI. Olay kartları sana otoparkta 400 GPU satan kapüşonlu adama ya da güvenlik testinde şantaj deneyen modeline ne yapacağını soruyor.

Benim için en ilginç kısmı, nasıl yapıldığı. Tek kişiyim ve kodu elle yazmıyorum. Bir yapay zekâ ajanları ekibini yönetiyorum: bir model görev tanımlarını yazıyor ve işleri birleştiriyor, en fazla on geliştirici ajan da her biri kendi dalında paralel çalışıyor.

Neyin işe yaradığını, neyin bozulduğunu ve neye mal olduğunu elimden geldiğince dürüstçe paylaşacağım. Ücretsiz tarayıcı demosu, bir oyun on dakika: [DEMO_URL]
```

### Message to a small Turkish gaming YouTuber

Send only to creators who cover indie or strategy games, one at a time, by their listed business email or DM. Early access means a key or TestFlight invite, nothing else; no payment is offered, and if they make a video they should mark it as they normally would for a free copy.

```
Merhaba [İSİM],

Ben Berk, Benchmaxxing adında hicivli bir strateji oyunu yapıyorum: hayali bir AI lab'ı kurup dünya haritasında dört rakip lab'la AGI'ya yarışıyorsun; denetçiler, kamuoyu tepkisi ve rakipler seni durdurmaya çalışıyor. Bir oyun 10 dakika sürüyor, Türkçe tam çeviriyle geliyor ve ilk olarak Türkiye'de çıkacak.

Kanalında [VİDEO ADI] videosunu izledim; [KISA, GERÇEK BİR YORUM]. Oyunun tarzına uyabileceğini düşündüm.

İstersen çıkmadan önce oynaman için erken erişim gönderebilirim (iOS TestFlight ya da tarayıcı sürümü). Video yapma zorunluluğu yok; oynayıp fikrini söylemen bile çok işime yarar. Ücretsiz tarayıcı demosu burada: [DEMO_URL]

Teşekkürler,
Berk
[E-POSTA] · [DISCORD_URL]
```
