# E357 job F1b — Row F1 step 7 of `02-foundations.md` § F1 (bakers compare bytes, never fingerprints; `bake-check.mjs`; the one-time re-stamp)

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Every baker named in step 7 bakes in memory, compares with the committed bytes, writes only what differs; `--check` exits 1 naming files; no digest skip, no `--force`, no timestamps or run-varying values in the JSON; `hash` = sha of the output bytes.
- `src/engine/world/BakedTerrain.ts`'s runtime fingerprint check goes; `vite.config.ts` stops calling the GPU bakers' `--check`.
- `scripts/bake-check.mjs` (replace the lead's stub), `tex-tiers.mjs --check`, `bake-ktx2.mjs --check`, the skip lines where Metal / magick / basisu are missing (CI must pass: detect, don't fail).
- Run the node bakers (`bake-chunk`, `bake-sky`, `bake-navmesh`) yourself to make the re-stamp and commit it (it is the accepted one-time re-download, 13-lead-resolutions 04#5). **The GPU bakers (`bake-cards`, `bake-textures`) need a browser: you may run each once through `scripts/browser-lane.sh` if it finishes in < 4 min; otherwise report `queued: <command>`.**
- Prove "a no-op source edit changes no byte" and "a real edit re-bakes" with the node bakers as step 7's done-when says (scratch edits, restored).
- Done when: two `node scripts/bake-check.mjs` runs in a row exit 0 with nothing written (or only the queued GPU part left); `pnpm test` exits 0; the greps in F1's done-when print nothing.

## Who else is building right now (same working tree; never touch their files)
- **F1a** (sol-f1a): `lint/wildshard-plugin.js`, `scripts/check-paths.mjs` + `.allow.json`, `test/alias.test.ts`, `test/check-paths.test.ts`, the 8 glob test files of 02 F1 step 6.
- **F1b** (sol-f1b): `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/engine/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**`.
- **F2a** (sol-f2a): `src/engine/debug/probe.ts`, `src/engine/core/harnessTap.ts`, the tap call sites in `src/` (Game.ts, registry.ts, Animal.ts, AnimalManager.ts, TrainingArena.ts, HUD.ts, the 9 sound modules, Audio.ts), `src/main.ts`, `scripts/types/**`, its tests.
- **F2b** (sol-f2b): `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `test/fixtures/parity/**`, `test/parity-compare.test.ts`, `.vercelignore`, `.gitignore`.
- **F5** (sol-f5): `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `test/coverage-ratchet.*`, `.github/workflows/deploy.yml`.
- **The lead** already landed every `package.json` change (imports map, `test`, `typecheck`, `test:coverage`, the dev deps) and F1's alias spike (`src/engine|game|kit/index.ts`, `src/engine/aliasFixture.{ts,webp}`, the two voided imports in `src/main.ts`; commits a26bad51, 5b7d6093). **Nobody edits `package.json`**; if you need a change there, say so in your report.
