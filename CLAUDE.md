# AI Race

Mobile strategy game (Expo + TypeScript). Read `docs/SPEC.md` for what the game is and `docs/ARCHITECTURE.md` for how the code is organised before changing anything.

## Rules

- **Layering:** `src/engine/` is pure, deterministic TypeScript and imports nothing outside itself. `src/content/` holds theme packs. UI lives in `src/ui/` and `app/`. Game rules never go in UI code.
- **Contract:** `src/engine/types.ts` is shared by every task. Do not edit it in a task branch. If it needs to change, stop and report what and why.
- **Theme-agnostic engine:** no AI-lab names, numbers or text in `src/engine/` or shared UI. Tunable numbers go in `BalanceConfig`; content and text go in the pack.
- **Text:** every user-visible string comes from the pack's `strings` via its key. English and Turkish: English is complete, Turkish sits beside it (`*.tr.json`, `strings/tr.json`) and falls back to English per key; follow `docs/GLOSSARY.tr.md`.
- **Parody only:** no real companies, products, models or people anywhere in content.
- **Stay in your lane:** change only the folders your task owns. Do not reformat or refactor other code.
- **No new dependencies** without a stated reason in the task report.

## Commands

```
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # jest
npm run web          # run in a browser
npm start            # Expo dev server (scan the QR code with Expo Go)
```

All three checks must pass before a task is reported as done. Every engine rule needs a unit test; every content file is covered by the validation test.

## Git

- Integration branch: `milestone-1`. Each task works on its own branch `task/<n>-<name>` and is merged by the orchestrator.
- Small commits with clear messages. Never commit secrets, `node_modules`, or build output.
