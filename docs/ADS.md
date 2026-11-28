# Ads (AdMob)

Rewarded ads only, always opt-in: the player presses a button that states the reward. What each ad pays, its cooldown and daily cap are Garage content (docs/GARAGE.md, "Offers"); this layer only shows the ad and reports whether the reward was earned.

## What runs where

| Build | Ad source |
| --- | --- |
| Browser (and the itch.io demo), Expo Go, Jest | the built-in test ad (`mockProvider.ts`, a 5-second countdown) |
| A development or store build (EAS) | AdMob (`admobProvider.ts`), started by `installAds()` in `app/_layout.tsx` |

A store build never shows the built-in test ad. If AdMob cannot start, the ad buttons are unavailable (`noAdsProvider`).

Start-up order in a real build (`src/ui/ads/installAds.ts`): Apple's tracking prompt (iOS) → Google's consent form where the law asks for one (`AdsConsent.gatherConsent`) → `mobileAds().initialize()` → the first rewarded ad loads. One ad is kept loaded and shared by all placements; after it closes or fails the next is requested, with retries at 5, 15, 30 and 60 seconds.

## Ids: still Google's samples

Until the owner's ids are filled in, the build uses Google's public sample ids and shows **test ads only** (no revenue, and safe to tap).

| What | Where | Looks like |
| --- | --- | --- |
| iOS app id, Android app id | `app.json` → plugins → `react-native-google-mobile-ads` (`iosAppId`, `androidAppId`) | `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` |
| Rewarded ad unit id, per platform | `src/ui/ads/admobIds.ts` | `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ` |

In AdMob: Apps → Add app (iOS, "not yet published"), then Ad units → Add ad unit → Rewarded. One rewarded unit per platform is enough. Changing an app id needs a new native build; a unit id can go out as an update.

Never tap live ads in your own app: AdMob can suspend the account. While developing, keep the sample ids or register the phone as a test device in AdMob.

## Dependencies added (and why)

- `react-native-google-mobile-ads` 17.4.0: the AdMob SDK wrapper; there is no way to show AdMob ads without native code.
- `expo-tracking-transparency`: Apple requires its permission prompt before an app uses the advertising identifier.

Both are native: they need an EAS build and do nothing in Expo Go.

## Not done yet

- A "privacy options" entry in settings for players in Europe (Google's consent rules ask for a way to change the choice later).
- The full SKAdNetwork id list from Google (only Google's own id is set).
- `app-ads.txt`, which needs a developer website.
- Turkish text for the tracking prompt.
- None of this has run on a phone: it needs the first EAS build.
