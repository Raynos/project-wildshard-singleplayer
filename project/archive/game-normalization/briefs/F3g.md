# E357 job F3g — Row F3.2 steps 1–3 of `02-foundations.md` § F3 (the GPU gate's files)

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Read 03-harness-gate.md §10 (runtime budget), §11 (the gate: 11.1–11.6 in full), §12 (flake policy), and ci-gpu-options (`docs/design/engine-fit-v2/ci-gpu-options.md`).
- Write `.github/workflows/gpu-probe.yml` (workflow_dispatch only), `.github/workflows/gpu-gate.yml` exactly as 03 §11.1, `scripts/gpu-gate/matrix.mjs` (+ a vitest test of its job list in `test/gpu-gate-matrix.test.ts`), the Linux `asset-case` job and `scripts/check-asset-case.mjs` (+ `test/check-asset-case.test.ts` on a fixture), and step 3's `channel: 'chromium'` port of `scripts/test-facade-instancing.mjs`.
- Validate YAML (`ruby -ryaml -e 'YAML.load_file(ARGV[0])' <file>`) and run `node scripts/check-asset-case.mjs` locally on the real tree (it should pass; if it finds a real wrong-case URL, report it, don't fix assets).
- **Don't dispatch any workflow and don't push**: the lead dispatches the probe run after F2 lands. Report the exact `gh workflow run` commands as `queued:` lines (the probe run, then step 4's record run, step 6's proof).
- Done when: the files exist, YAML parses, the two tests pass, tsc (`-p .` and `-p scripts`) and oxlint are clean on your files.
- Owns: `.github/workflows/gpu-probe.yml`, `.github/workflows/gpu-gate.yml`, `scripts/gpu-gate/**`, `scripts/check-asset-case.mjs`, `scripts/test-facade-instancing.mjs`, `test/gpu-gate-matrix.test.ts`, `test/check-asset-case.test.ts`, `test/fixtures/asset-case/**`.

## Who else is building right now (same working tree; never touch their files)
- F1a `lint/wildshard-plugin.js`, `scripts/check-paths.mjs`, `test/alias.test.ts`, `test/check-paths.test.ts`, glob tests · F1b `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/engine/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**` · F2a the probe (`src/engine/debug/probe.ts`, `harnessTap.ts`, tap sites, `src/main.ts`, `scripts/types/**`) · F2b `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `.vercelignore`, `.gitignore` · F5 `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `.github/workflows/deploy.yml` · F3g / F3n: the two F3.2 jobs below, disjoint from each other.
- `scripts/parity.mjs` (F2b) is being written right now against 03 §1's CLI: call it by that CLI, don't edit it. If its CLI lacks something you need, say so in your report.
- **Nobody edits `package.json`** (the lead does; ask in your report).
