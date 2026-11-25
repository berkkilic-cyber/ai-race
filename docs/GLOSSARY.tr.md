# Turkish glossary (Türkçe sözlük)

Every Turkish string follows this table. If a term changes, change it here first, then everywhere.

## Big decisions

- **Hype stays "Hype".** Turkish tech press, startup Twitter and gamers all say "hype" ("hype'landı", "hype treni"). No Turkish word means the same thing: "heyecan" is excitement, "ilgi" is attention, and neither is a currency you spend. It is also short enough for the top strip. Suffixes go after an apostrophe: Hype'ı, Hype'la.
- **Cash becomes "Nakit".** It is the everyday word ("nakit akışı", "nakit sıkıntısı"), it is as short as the English, and "Cash" is not used in Turkish.
- **Compute becomes "İşlem gücü".** That is what Turkish tech people say for compute capacity ("işlem gücü kiralamak"). AI researchers sometimes say "compute" in English, but players would not. Where a label is very tight it can be written "İşlem".
- **AGI stays "AGI".** "YGZ" (yapay genel zekâ) exists but almost nobody uses it. "AGI" is what Turkish news and tech people write. Suffixes take an apostrophe: AGI'ya.
- **"Lab" stays "lab"** in running text (Turkish tech people say "AI lab'ları"). "Laboratuvar" is too long for labels.
- **The player is "sen".** Informal, second person singular, everywhere: buttons are imperatives ("Kur", "Satın al", "Yayınla").
- **Parody names are never translated.** MVIDIA, NopenAI, Zlaude, Germini, ChatJPT, DeepSleek, Llamarama, LeaderBored, the rival labs and the brands keep their exact spelling. Suffixes go after an apostrophe: MVIDIA'nın.
- **Placeholders** ({lab}, {region}, {model} ...) are kept exactly. Turkish puts case suffixes on nouns, and we cannot know what a variable's last vowel will be. So we write around them: "{lab} lab'ı" or "{region} bölgesinde" instead of "{region}'da", or we put the variable where it needs no suffix (as the subject, or before a colon or dash).
- **Casing:** text shown in capitals is upper-cased in code with the Turkish rules (i → İ, ı → I), through `src/ui/locale/casing.ts`. Never write capitals into the strings to get that effect. Any Text whose style changes the case (the theme's voice presets, `textTransform`) is the locale Text (`src/ui/locale/Text.tsx`), which does this in JS and switches the style's transform off; a test fails if a file renders React Native's Text under such a style.

## Core terms

| English | Türkçe | Note |
| --- | --- | --- |
| Hype | Hype | Kept. See above |
| Cash | Nakit | |
| Compute | İşlem gücü | "İşlem" where very tight |
| Model (tier) | Model | "Model 3", "Kademe" for tier where needed |
| Tier | Seviye | "Seviye {tier}"; "Sv. {tier}" in the top strip |
| Regulation (meter) | Denetim | Shorter and more natural than "regülasyon"; regulators = "düzenleyiciler" / "denetçiler" |
| Backlash (meter) | Tepki | Public backlash = "kamuoyu tepkisi" |
| Rival AGI (meter) | Rakip AGI | |
| Rival labs | Rakip lablar | |
| Data centre | Veri merkezi | |
| Users | Kullanıcı | "{amount} kullanıcı" (Turkish counts take the singular) |
| Region | Bölge | |
| Home region | Merkez bölge | |
| Market share | Pazar payı | |
| World share | Dünya payı | |
| Ban / banned | Yasak / yasaklandı | Map stamp: YASAK |
| Event (card) | Olay | |
| Headline | Manşet | |
| BREAKING | SON DAKİKA | |
| EXCLUSIVE | ÖZEL HABER | |
| DEVELOPING | GELİŞME VAR | |
| Moment (tap bubble) | Balon | The bubbles on the map; a good one is a "fırsat", a bad one a "tehdit". "An" (moment) is avoided: "ana dokun" reads as "touch mother" |
| Achievement | Başarım | Standard in Turkish games |
| Score | Skor | |
| Day | Gün | "Gün 12" |
| Speed / Pause | Hız / Duraklat | |
| Tutorial / How to play | Eğitim / Nasıl oynanır | |
| Benchmark | benchmark | Left in English, as Turkish tech people say it |
| GPU, token, prompt | GPU, token, prompt | Left in English |
| Open weights | Açık ağırlıklar | |
| Alignment / safety | Hizalama / güvenlik | |
| Lobbying | Lobi | |

## The three routes (trees)

| English | Türkçe | Note |
| --- | --- | --- |
| Trees (tab) | Ağaç | The rail label fits five or six letters; "Ağaçlar" in running text |
| Capability | Yetenek | |
| Reach | Erişim | |
| Shadow | Gölge | |
| Node / upgrade | Geliştirme | |
| Requires | Gerekli | |

## Endings

| English | Türkçe |
| --- | --- |
| AGI (win) | AGI |
| Monopoly | Tekel |
| Dependence ("the world runs on you") | Bağımlılık |
| Banned worldwide | Dünya çapında yasak |
| Public revolt | Halk isyanı |
| Rival reached AGI | Rakip AGI'ya ulaştı |

## Founders

| English | Türkçe | Note |
| --- | --- | --- |
| The Researcher | Araştırmacı | |
| The Hustler | Uyanık | The Turkish word for a street-smart operator, with the same mix of admiration and warning |
| The Insider | İçeriden Biri | |

## Difficulty

The level cards fit about nine capitals, so the names are short game words rather than translations.

| English | Türkçe | Note |
| --- | --- | --- |
| Sandbox | Çaylak | "Rookie": the usual Turkish game word for the easiest level ("Kum Havuzu" did not fit) |
| Frontier | Öncü | As in "öncü lab" (frontier lab) |
| Arms Race | Kapışma | "Showdown"; "Silahlanma Yarışı" did not fit |
| Hard Takeoff | Kıyamet | "Doomsday": the hardest level; "Sert Kalkış" (the AI-safety term) did not fit |
| Difficulty | Zorluk | |

## Garage (idle mode)

| English | Türkçe | Note |
| --- | --- | --- |
| Garage | Garaj | |
| Race (mode) | Yarış | |
| Modes | Modlar | |
| tokens | token | Kept, as Turkish AI people say it |
| Tap | Dokun | |
| Build (tab) | Kur | |
| Upgrades | Geliştirmeler | |
| Ship (a model) | Yayınla | "Ship it" = "Yayınla!" |
| Generation / next model | Nesil / sonraki model | |
| Lab Rep | Lab İtibarı | "İtibar" for short |
| Perk | Avantaj | |
| Combo | Kombo | |
| Golden moment | Altın an | |
| Away earnings | Uzaktayken kazanç | |
| Owned | Sahip olunan | "{count} adet" in tight rows |
| Stage (where the lab lives) | Aşama | "{stage} aşamasında açılır": the suffix goes on "aşama", never on the stage name |
| The Garage / The Office / The Data Centre | Garaj / Ofis / Veri Merkezi | Stage names, no article |
| The Company Town | Şirket Kasabası | |
| Latent Space | Gizil Uzay | The term Turkish ML papers use for "latent space" |
| Training run | Eğitim turu | "Eğitim turları" as a title. Only in Garage, where the tutorial ("Eğitim") never appears |
| Candidate (model) | Aday | "{count} aday" |
| Slot | Slot | As Turkish gamers say it ("boş slot") |
| Keep / Swap in / Scrap | Tut / Değiştir / Çöpe at | |
| Rarity: Weekend Project / Series A / Frontier / Allegedly Sentient | Hafta Sonu Projesi / A Serisi / Öncü / Sözde Bilinçli | "A Serisi" as in startup funding; "Öncü" as in the difficulty |
| Staff | Ekip | |
| Research / Product / Safety (lanes) | Araştırma / Ürün / Güvenlik | |
| Helpers / townsfolk | Yardımcılar / kasabalılar | |
| Auto-buy | Otomatik alım | |
| Lab happening | Lab olayı | "Olay" alone where the context is clear |
| Incident | Arıza | Also "onarılan arıza" in the stats |
| Ship day | Yayın günü | The three steps: Benchmark günü, Son dakika, Lansman günü |
| Launch (plan) | Lansman (planı) | |
| Hype it / Play it safe / Open the weights | Hype'la / Garantiye oyna / Ağırlıkları aç | |
| Milestone | Eşik | "{count} adette ×{mult}" |
| Model names (VibeOracle 3.5 ...) | Unchanged | English puns built from prefix + suffix: never translated |
| Away storage | Çevrimdışı depo | "Depo" alone in the header chip; built on "çevrimdışı kazanç", which Turkish idle games use. "Depo doldu" = storage full |
| Daily mission(s) | Günlük görev(ler) | "Görevler" on the button |
| Claim (a reward) | Al | Button "Al"; done state "Alındı". "Ödülü al" in running text |
| Daily crate | Günlük sandık | As the existing "Bonus sandık" |
| Streak | Seri | "{count} günlük seri"; best = "En iyi" |
| Day off | İzin günü | "Dün izin gününle kapandı" (yesterday is covered by your day off) |
| Paradigm Shift | Paradigma Kayması | Verb: "paradigmayı kaydır"; the button "{gain} Hendek için kaydır" |
| Moats (the Paradigm currency) | Hendek | Singular after a number ("6 Hendek"); capitalised as a currency, like Hype |
| Paradigm tree | Paradigma ağacı | |

## Numbers

Formatted by hand in `src/ui/format.ts` (no `Intl`, no `toLocaleString`): it is on hot paths.

| What | English | Türkçe | Note |
| --- | --- | --- | --- |
| Decimal | 0.5 | 0,5 | |
| Thousands | 2,526 | 2.526 | |
| Percent | 43% | %43 | Sign in front: "+%6", "−%20" |
| Thousand / million / billion / trillion | K / M / B / T | B / Mn / Mr / Tn | "2,5 Mn", "1,2 Mr". The Unicode CLDR short forms for Turkish, and what YouTube, Instagram and the Turkish app stores show. Written with a no-break space before the unit |
| Bigger (idle) | Qa, Qi, Sx ... | Qa, Qi, Sx ... | Turkish has no short forms past trilyon; the idle-game letters stay |
| Cash (dollars) | $850M, $1.2B | 850 Mn $, 1,2 Mr $ | Dollar sign after the amount, as Turkish news write "1,2 milyar $" and as CLDR places it in short amounts; small amounts too ("0,5 Mn $") |
| Hours, minutes, seconds | 3h 12m, 4m 05s | 3 sa 12 dk, 4 dk 05 sn | |
| Days (durations) | 2d 4h | 2 gün 4 sa | |
