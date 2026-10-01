# E357 job F2a — Row F2 steps 1–4 of `02-foundations.md` § F2 (the probe, the taps, the main.ts reorder, the typed `.d.ts`), plus its tests `test/probe-shape.test.ts`, `test/sound-tap.test.ts`, `test/ambient-tick.test.ts`

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Read 03-harness-gate.md §2 (the probe and every fingerprint field), §2.0/§2.3 (sounds), §4 (`used()`), §5 (combat, `harnessHold`, `arena()`), §5.6 (`state()` / `onResume()`), §6 (`window.__wildshardHarness` pins) in full: the probe must return exactly those shapes.
- The probe is **read-only**: no behaviour change. Taps are `null` unless the harness installed them.
- `scripts/types/wildshard-probe.d.ts` declares every member; `pnpm run typecheck` (includes `tsc -p scripts`) must pass.
- `src/main.ts`: only the reorder + `installProbe` call (step 3). Keep the lead's two alias-spike lines.
- Done when: `pnpm run typecheck`, `pnpm exec oxlint`, and your three tests pass; `pnpm test` exits 0. **No browser run**: the lead proves "no behaviour change" (physics-baseline, nalati-boot-check) in its batch.
- Report the probe's final member list and anything 03 §2 left you to guess.

## Who else is building right now (same working tree; never touch their files)
- **F1a** (sol-f1a): `lint/wildshard-plugin.js`, `scripts/check-paths.mjs` + `.allow.json`, `test/alias.test.ts`, `test/check-paths.test.ts`, the 8 glob test files of 02 F1 step 6.
- **F1b** (sol-f1b): `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/engine/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**`.
- **F2a** (sol-f2a): `src/engine/debug/probe.ts`, `src/engine/core/harnessTap.ts`, the tap call sites in `src/` (Game.ts, registry.ts, Animal.ts, AnimalManager.ts, TrainingArena.ts, HUD.ts, the 9 sound modules, Audio.ts), `src/main.ts`, `scripts/types/**`, its tests.
- **F2b** (sol-f2b): `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `test/fixtures/parity/**`, `test/parity-compare.test.ts`, `.vercelignore`, `.gitignore`.
- **F5** (sol-f5): `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `test/coverage-ratchet.*`, `.github/workflows/deploy.yml`.
- **The lead** already landed every `package.json` change (imports map, `test`, `typecheck`, `test:coverage`, the dev deps) and F1's alias spike (`src/engine|game|kit/index.ts`, `src/engine/aliasFixture.{ts,webp}`, the two voided imports in `src/main.ts`; commits a26bad51, 5b7d6093). **Nobody edits `package.json`**; if you need a change there, say so in your report.
