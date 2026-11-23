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
- **Casing:** text shown in capitals is upper-cased in code with the Turkish rules (i → İ, ı → I), through `src/ui/locale/casing.ts`. Never write capitals into the strings to get that effect.

## Core terms

| English | Türkçe | Note |
| --- | --- | --- |
| Hype | Hype | Kept. See above |
| Cash | Nakit | |
| Compute | İşlem gücü | "İşlem" where very tight |
| Model (tier) | Model | "Model 3", "Kademe" for tier where needed |
| Tier | Seviye | "Seviye {tier}" |
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
| Trees (tab) | Ağaçlar | |
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

| English | Türkçe | Note |
| --- | --- | --- |
| Sandbox | Kum Havuzu | The usual Turkish term for sandbox mode |
| Frontier | Öncü | As in "öncü lab" (frontier lab) |
| Arms Race | Silah Yarışı | "Silahlanma yarışı" is the full phrase; shortened to fit 14 characters |
| Hard Takeoff | Sert Kalkış | AI-safety jargon, translated literally as Turkish AI writers do |
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
