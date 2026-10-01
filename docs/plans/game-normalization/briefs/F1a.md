# E357 job F1a — Row F1 steps 2 (the consumer tests only: tsc/vite/oxlint already pass), 3, 4 and 6 of `02-foundations.md` § F1

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Step 2: `test/alias.test.ts` exactly as specified (vitest imports through `#engine`, `#game`, `#kit`, `#engine/aliasFixture`, `#engine/aliasFixture.webp`; the baker check through `node --import ./scripts/bake-loader.mjs`; the lint resolver through the exported `importedConst`). If `bake-loader.mjs` does not resolve `#` specifiers, add the `#` branch described in step 2's fallback to `scripts/bake-loader.mjs` (you own it too).
- Step 3: the `#` branch in `lint/wildshard-plugin.js`'s `importedConst`, exported as a named export.
- Step 4: `scripts/check-paths.mjs` (replace the lead's stub) + `scripts/check-paths.allow.json`; `test/check-paths.test.ts`. Fix or allowlist (with a `why`) every real hit it finds today; a dead path in a script you don't own goes in the allowlist with `why: "pre-existing, F7 deletes or ports"` only if F7's delete list (02 F7) covers that script, else fix the string.
- Step 6: the non-empty asserts in the 8 test files.
- Done when: `pnpm test` (it runs check-paths) and `pnpm exec tsc --noEmit -p .` and `pnpm exec oxlint` exit 0; `test/alias.test.ts` and `test/check-paths.test.ts` pass.
- Report: the chosen alias form (the lead writes it into 01 §0).

## Who else is building right now (same working tree; never touch their files)
- **F1a** (sol-f1a): `lint/wildshard-plugin.js`, `scripts/check-paths.mjs` + `.allow.json`, `test/alias.test.ts`, `test/check-paths.test.ts`, the 8 glob test files of 02 F1 step 6.
- **F1b** (sol-f1b): `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/engine/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**`.
- **F2a** (sol-f2a): `src/engine/debug/probe.ts`, `src/engine/core/harnessTap.ts`, the tap call sites in `src/` (Game.ts, registry.ts, Animal.ts, AnimalManager.ts, TrainingArena.ts, HUD.ts, the 9 sound modules, Audio.ts), `src/main.ts`, `scripts/types/**`, its tests.
- **F2b** (sol-f2b): `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `test/fixtures/parity/**`, `test/parity-compare.test.ts`, `.vercelignore`, `.gitignore`.
- **F5** (sol-f5): `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `test/coverage-ratchet.*`, `.github/workflows/deploy.yml`.
- **The lead** already landed every `package.json` change (imports map, `test`, `typecheck`, `test:coverage`, the dev deps) and F1's alias spike (`src/engine|game|kit/index.ts`, `src/engine/aliasFixture.{ts,webp}`, the two voided imports in `src/main.ts`; commits a26bad51, 5b7d6093). **Nobody edits `package.json`**; if you need a change there, say so in your report.
