# E357 job F2b — Row F2 steps 5–6 of `02-foundations.md` § F2: `scripts/parity.mjs` + `scripts/parity/*.mjs`, the routes' `gate: true`, the plants, `test/parity-compare.test.ts` + `test/fixtures/parity/`, `test/parity/ambient-info.json`, and the `.vercelignore` / `.gitignore` lines of step 7

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Read 03-harness-gate.md §0–§12 in full: the CLI, outputs, comparison rules, bands, renames, baselines, pending, determinism proof, runtime budget, flake policy. Build exactly that CLI.
- Lift code from the scripts step 5 names (scorecard, physics-baseline, nalati-boot-check, bench-load, test-facade-instancing, pine-hollow-perf-lap); don't reinvent.
- The probe (`window.__wildshard`) is being written in parallel by F2a against 03 §2; code against 03 §2's shapes (F2a's `scripts/types/wildshard-probe.d.ts` lands during your run; `git log --oneline -5` shows it).
- Every run uses `scripts/browser-lane.sh`, `--mute-audio`, ANGLE Metal, a build served by `scripts/serve-build.sh` or the export `vite build` + preview (03 §1); never vite dev.
- **One smoke run allowed**, only after F2a's probe commit is in `git log`: `scripts/browser-lane.sh --max 10 node scripts/parity.mjs --record --runs=1 --lane=m5 --tiers=phone --shards=pine-hollow --out=<a scratch dir>` (or the CLI's equivalent), to shake out crashes. Nothing longer: the full record / prove runs are the lead's; report them as `queued:` lines.
- Done when: `test/parity-compare.test.ts` passes, `pnpm exec tsc --noEmit -p scripts` and oxlint exit 0, and the smoke (if F2a landed in time) reached a written report.

## Who else is building right now (same working tree; never touch their files)
- **F1a** (sol-f1a): `lint/wildshard-plugin.js`, `scripts/check-paths.mjs` + `.allow.json`, `test/alias.test.ts`, `test/check-paths.test.ts`, the 8 glob test files of 02 F1 step 6.
- **F1b** (sol-f1b): `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/engine/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**`.
- **F2a** (sol-f2a): `src/engine/debug/probe.ts`, `src/engine/core/harnessTap.ts`, the tap call sites in `src/` (Game.ts, registry.ts, Animal.ts, AnimalManager.ts, TrainingArena.ts, HUD.ts, the 9 sound modules, Audio.ts), `src/main.ts`, `scripts/types/**`, its tests.
- **F2b** (sol-f2b): `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `test/fixtures/parity/**`, `test/parity-compare.test.ts`, `.vercelignore`, `.gitignore`.
- **F5** (sol-f5): `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `test/coverage-ratchet.*`, `.github/workflows/deploy.yml`.
- **The lead** already landed every `package.json` change (imports map, `test`, `typecheck`, `test:coverage`, the dev deps) and F1's alias spike (`src/engine|game|kit/index.ts`, `src/engine/aliasFixture.{ts,webp}`, the two voided imports in `src/main.ts`; commits a26bad51, 5b7d6093). **Nobody edits `package.json`**; if you need a change there, say so in your report.
