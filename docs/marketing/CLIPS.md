# Short-video ideas (15 to 30 seconds)

For TikTok, Instagram Reels, YouTube Shorts and X. Each idea has a hook for the first two seconds, a shot list, the on-screen caption text, and a post caption with a few hashtags. Ideas 1 to 6 also have Turkish captions.

**Recorded already** (docs/marketing/clips, 1920x1080, H.264, 30 fps, no audio): `garage-fill.mp4` (idea 1), `sprint-run.mp4` (idea 2), `event-cards.mp4` (idea 3). The rest need a screen recording from the game (the debug hooks in scripts/marketing/clips.js show how to stage each scene) or a phone capture. Add music or a voice in the editor: the files have no audio track. Use only music the platform licenses for your post, or the game's own sounds.

**Vertical versions.** The game is landscape; vertical feeds are 9:16. The honest way is the landscape clip in the middle of a 1080x1920 frame, with the caption above and the hook below. With ffmpeg:

```sh
ffmpeg -i docs/marketing/clips/sprint-run.mp4 -vf "scale=1080:-2,pad=1080:1920:0:(oh-ih)/2:color=0x1B1C1F" -c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart sprint-run-vertical.mp4
```

(`0x1B1C1F` is the game's background.) Put the text in the editor, not burnt in by ffmpeg, so it can be changed per platform.

**Rules for every clip:** real gameplay only; no fake reviews or quotes on screen; no real company, product, model or person named in captions; say "made by one person with AI agents" only as a plain fact.

---

### 1. The lab fills up (recorded: garage-fill.mp4)

- **Hook (0 to 2 s):** an empty pixel garage. Text: "Day 1 of my AI startup."
- **Shots:** empty garage (1 s) → interns, GPUs and server closets appear in time-lapse (8 s) → the lab moves to an office (1 s) → the office fills with desks and racks (8 s) → a pizza delivery bubble pops (2 s).
- **On-screen captions:** "Day 1 of my AI startup." / "Hired interns. Paid them in exposure." / "Rented GPUs." / "Moved out of the garage." / "Still no product."
- **Post caption:** Every AI company starts in a garage. Mine never left the pixel one. Free demo, link in bio. #indiegame #pixelart #idlegame #gamedev
- **Turkish captions:** "AI girişimimin 1. günü." / "Stajyer aldım. Maaş yerine görünürlük." / "GPU kiraladım." / "Garajdan çıktık." / "Hâlâ ürün yok."
- **Turkish post caption:** Her AI şirketi garajda başlar. Benimki piksel garajdan hiç çıkmadı. Ücretsiz demo profilde. #indieoyun #pikselsanat #oyungeliştirme

### 2. Ten minutes to AGI (recorded: sprint-run.mp4)

- **Hook:** the map lit only at home. Text: "I gave my AI lab 10 minutes to take over the world."
- **Shots:** the start of a Sprint run → time-lapse: the green spreads, rivals light up in their colours, launch banners → the end screen counts up the score.
- **On-screen captions:** "10 minutes." / "4 rival labs." / "3 ways to lose." / "1 boring utopia." (the win screen's ending is "AGI, politely aligned")
- **Post caption:** A whole AI race in ten minutes, in fast forward. Spoiler: the AGI asks before reorganising your calendar. #strategygame #indiegame #gamedev #satire
- **Turkish captions:** "10 dakika." / "4 rakip lab." / "Kaybetmenin 3 yolu." / "1 sıkıcı ütopya."
- **Turkish post caption:** Koca bir AI yarışı on dakikada, hızlandırılmış. Spoiler: AGI takvimini düzenlemeden önce izin istiyor. #stratejioyunu #indieoyun #oyungeliştirme

### 3. Breaking news, your fault (recorded: event-cards.mp4)

- **Hook:** the tabloid card drops in. Text: "Every choice in this game is a bad one."
- **Shots:** event card "GPUs for sale, parking lot B" → pick "Pop the trunk" → result → card "model escapes its sandbox" → spin it → a squirrel takes out the power → a smart toaster demands rights.
- **On-screen captions:** "A man in a hoodie has 400 GPUs." / "Your model left the sandbox." / "A squirrel did this." / "The toaster wants a lawyer."
- **Post caption:** Running an AI lab is mostly answering emails like these. Which would you pick? #indiegame #strategygame #satire #gamedev
- **Turkish captions:** "Kapüşonlu bir adamda 400 GPU var." / "Modelin kum havuzundan kaçtı." / "Bunu bir sincap yaptı." / "Tost makinesi avukat istiyor."
- **Turkish post caption:** AI lab'ı yönetmek çoğunlukla böyle e-postalara cevap vermek. Sen hangisini seçerdin? #indieoyun #stratejioyunu #oyungeliştirme

### 4. The screen panics with you

- **Hook:** a calm map. Text: "Watch the interface lose its composure."
- **Shots:** a calm run (green corner brackets) → Regulation climbs: brackets turn amber, the ticker speeds up → red glow from the edges, figures flicker → "BREAKING" band, the frame pulses, the mascot panics. (Stage it with `window.__game.setMeters` or `forceComposure(0..3)` on the debug build.)
- **On-screen captions:** "Regulation 20%." / "60%." / "85%." / "Please do not look at the ticker."
- **Post caption:** No numbers needed: you can tell how the run is going from the whole screen. #gamedev #uidesign #indiegame #gamedesign
- **Turkish captions:** "Denetim %20." / "%60." / "%85." / "Lütfen alt banda bakma."
- **Turkish post caption:** Rakamlara gerek yok: oyunun gidişatını bütün ekrandan anlıyorsun. #oyuntasarımı #indieoyun #oyungeliştirme

### 5. Pick a founder

- **Hook:** the three founder cards. Text: "Who should run the AI lab?"
- **Shots:** pan across the three founder cards, a beat on each description → pick one → the home region map.
- **On-screen captions:** "The Researcher: famous paper, no idea what a P&L is." / "The Hustler: raised money for nine startups, two of which existed." / "The Insider: used to run the agency that now regulates you."
- **Post caption:** Three founders, one perk each. Comment who you'd hire. #indiegame #strategygame #startup #satire
- **Turkish captions:** "Araştırmacı: ünlü bir makale, bilanço bilgisi yok." / "Uyanık: dokuz girişime para topladı, ikisi gerçekten vardı." / "İçeriden Biri: seni bugün denetleyen kurumun eski başkanı."
- **Turkish post caption:** Üç kurucu, her birinin bir avantajı. Sen hangisini işe alırdın? Yorumlara yaz. #indieoyun #stratejioyunu #girişim

### 6. One person, ten agents

- **Hook:** Berk's screen with many terminals or branches (his own recording). Text: "I've never made a game. So I hired ten AI agents."
- **Shots:** the branch list or task board → a test run going green → the game running → the end screen.
- **On-screen captions:** "1 person." / "Up to 10 AI agents at once." / "About 1,300 tests." / "0 prior games."
- **Post caption:** Building a game as one person directing a team of AI agents. Ask me anything. #buildinpublic #gamedev #indiedev #ai
- **Turkish captions:** "1 kişi." / "Aynı anda en fazla 10 yapay zekâ ajanı." / "Yaklaşık 1.300 test." / "Daha önce yapılmış 0 oyun."
- **Turkish post caption:** Bir yapay zekâ ajanları ekibini yöneterek tek başıma oyun yapıyorum. Ne merak ediyorsan sor. #oyungeliştirme #indiegeliştirici #yapayzeka

### 7. The 88% strategy

- **Hook:** the Shadow tree. Text: "This strategy won 88% of the time. So I killed it."
- **Shots:** the Shadow tree (Benchmark Tuning, Lobbying, M&A Team) → a buy-out → a monopoly ending → cut to the tree after the nerf.
- **On-screen captions:** "Buy every rival." / "Win." / "Repeat." / "Not any more."
- **Post caption:** Bots played thousands of runs and found the dominant strategy before any player did. #gamedesign #gamedev #indiegame

### 8. The ticker

- **Hook:** a close crop of the news ticker. Text: "The headlines in my game write themselves. (They don't. I wrote 77.)"
- **Shots:** slow pan along the ticker with the funniest headlines from a run, map in the background.
- **On-screen captions:** quote two or three headlines from the run as they appear.
- **Post caption:** The news cycle, but every lab is made up. #satire #indiegame #gamedev

### 9. Banned everywhere

- **Hook:** a red "BANNED" stamp hitting a region. Text: "How to get your AI banned in 30 seconds."
- **Shots:** an aggressive run: launches in strict regions → bans flash red one after another → the "banned worldwide" ending.
- **On-screen captions:** "Launch everywhere." / "Ignore the letters." / "Ignore the other letters." / "Oh."
- **Post caption:** There are several ways to lose. This is the fastest. #strategygame #indiegame #satire

### 10. The rival ships first

- **Hook:** a rival's launch banner. Text: "My rival shipped a model 4 days before me."
- **Shots:** the Rival AGI meter climbing past yours → a rival launch banner → the "so close" defeat screen ("It sends the winner a card that says congrats, I guess").
- **On-screen captions:** "They were at 94%." / "I was at 95%." / "Second place is a card."
- **Post caption:** Losing the AI race by four days feels exactly like you'd think. #indiegame #strategygame

### 11. Turkish, properly

- **Hook:** the language toggle from EN to TR. Text: "My game speaks Turkish. Properly: İ and ı included."
- **Shots:** the start screen switching languages → an event card in Turkish → the map in Turkish.
- **On-screen captions:** "Hype stays Hype." / "Cash is Nakit." / "AGI stays AGI."
- **Post caption:** Localised before launch, because it launches in Türkiye first. #gamedev #localization #indiegame

### 12. Garage to perks

- **Hook:** the Garage's ship button. Text: "My idle game makes my strategy game easier."
- **Shots:** ship a model in the Garage → Lab Rep goes up → the "Garage earns race perks" chip on the founder step → a run starting with a small bonus.
- **On-screen captions:** "Tap." / "Ship." / "Bring the perks to the race."
- **Post caption:** Two modes, one lab. The idle side feeds the strategy side. #idlegame #indiegame #gamedesign
