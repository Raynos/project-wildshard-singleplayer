# E357 job F3n — Row F3.2 step 5 of `02-foundations.md` § F3 (the nightly `gpu-perf` poller's files; the lead installs it)

Read `docs/plans/game-normalization/brief-common.md` first: its rules (commits, trailer, no push, no parity, caps, handoff, report) bind you.

## The job
- Read 03-harness-gate.md §14 in full (14.0–14.x: nightly.sh, the plist, install.sh, the Simulator memory run `scripts/sim-memory.mjs`, the soak bot `scripts/soak.mjs`, `--plant=soak-leak`, `--memory-only --sha=`), §10 (budgets), §13.2 (how `deploy-pin.mjs set` reads `gpu-perf/memory`), 13-lead-resolutions G2 / G13 / MW19, and `.claude/skills/ios-simulator/SKILL.md` + `scripts/sim-lane.sh` (every Simulator boot goes through sim-lane).
- Write `scripts/gpu-perf/nightly.sh`, `scripts/gpu-perf/com.wildshard.gpu-perf.plist` (template), `scripts/gpu-perf/install.sh`, `scripts/sim-memory.mjs`, `scripts/soak.mjs`, with a vitest test for any pure part (report parsing, the 10 %-growth and limit rules) in `test/gpu-perf.test.ts`.
- The soak bot needs `window.__wildshard.nav` (03 §14.2): F2a is writing the probe now without `nav`; add `nav` to the probe yourself **only after** F2a's probe commit is in `git log` (then `src/core/probe.ts` and `scripts/types/wildshard-probe.d.ts` are yours for that one addition; check `git diff` on them first).
- **Don't install, don't run a Simulator, don't run the nightly.** `bash -n` your shell scripts, `plutil -lint` the plist, run your tests. Report the install + first-run commands as `queued:` lines.
- Done when: the files exist and lint clean (`bash -n`, `plutil -lint`, tsc `-p scripts` if you add them to its include — you may NOT edit `scripts/tsconfig.json`; ask), tests pass.
- Owns: `scripts/gpu-perf/**`, `scripts/sim-memory.mjs`, `scripts/soak.mjs`, `test/gpu-perf.test.ts`, `test/fixtures/gpu-perf/**`.

## Who else is building right now (same working tree; never touch their files)
- F1a `lint/wildshard-plugin.js`, `scripts/check-paths.mjs`, `test/alias.test.ts`, `test/check-paths.test.ts`, glob tests · F1b `scripts/bake-*.mjs`, `scripts/bake-check.mjs`, `scripts/tex-tiers.mjs`, `src/world/BakedTerrain.ts`, `vite.config.ts`, `public/assets/baked/**` · F2a the probe (`src/core/probe.ts`, `harnessTap.ts`, tap sites, `src/main.ts`, `scripts/types/**`) · F2b `scripts/parity.mjs`, `scripts/parity/**`, `scripts/physics-route.json`, `test/parity/**`, `.vercelignore`, `.gitignore` · F5 `test/fake/**`, `test/actor/**`, `vitest.config.ts`, `scripts/coverage-ratchet.mjs`, `.github/workflows/deploy.yml` · F3g / F3n: the two F3.2 jobs below, disjoint from each other.
- `scripts/parity.mjs` (F2b) is being written right now against 03 §1's CLI: call it by that CLI, don't edit it. If its CLI lacks something you need, say so in your report.
- **Nobody edits `package.json`** (the lead does; ask in your report).
