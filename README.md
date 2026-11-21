# AI Race

A satirical mobile strategy game built with Expo and TypeScript. See [docs/SPEC.md](docs/SPEC.md) for the game and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code layout.

## Prerequisites

- Node.js 22 and npm
- For phones: the **Expo Go** app (iOS App Store or Google Play), on the same Wi-Fi network as your computer

## Run on a phone (Expo Go)

```sh
npm install
npm start
```

Scan the QR code shown in the terminal: with the Camera app on iOS, or from inside Expo Go on Android. The app reloads when you save a file.

## Run in a browser

```sh
npm install
npm run web
```

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (expo lint), including layer import rules
npm test            # Jest
npm run test:engine # engine tests only
```

## Over-the-air updates (EAS Update)

The playtest build is a `preview` build (`eas build --profile preview --platform ios`) on the
`preview` channel. Every push to `task/10-style` publishes an update through
`.github/workflows/eas-update.yml` (needs the `EXPO_TOKEN` repository secret). By hand:

```
eas update --channel preview --environment preview --message "what changed"
```

Updates carry JavaScript and assets only. A new native library, or a change of `version` in
`app.json` (the runtime version follows it), needs a new build. `expo-updates` is the one
dependency this adds.
