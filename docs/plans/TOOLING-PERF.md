# Plan: TOOLING-PERF — the CI, tooling, build, TypeScript, lint and test mega audit

**State:** `parked` (G659) — a draft in the same bucket as SHARD-PLATFORM-NEXT and WASM-HOST: nothing is worked until Jake says when; its picks (G657) are recorded. The zoomed-in mini plans it links (TypeScript, oxlint, no binaries in JSON, generators) are not parked: they run as SHARD-PLATFORM extras (G647). 2026-10-23 — G651 audit done (plan-agent subagent, from 7 days of GitHub runs, 147 red-run logs,
`.git/push.log`, the hooks, workflows and every check script; cheap checks timed at load ~30, the rest marked est.).
Nothing is worked here until Jake says go; decided SHARD-PLATFORM tooling rows (G609, G610/G612, G620, G627, G628, G634,
G636) keep landing there and move here when it starts; decisions stay in [decisions.md](shard-platform/decisions.md);
absorbs [BUILD-SPEED](BUILD-SPEED.md) waves 3–5. Jake, G651: *"the tooling perf is everything else. Like, everything that
I don't know about yet … all the things that we should be running in pre-commit if they were fast, all the things that we
should be running in pre-push if they were fast."*

## Separate plans it links to (G647, never copied here)

[TypeScript speed](tooling-perf/typescript-mini-plan.md) + [quick wins](tooling-perf/typescript-quick-wins-mini-plan.md) and
[oxlint speed](tooling-perf/oxlint-mini-plan.md) (open, the builder builds them); [no binaries in JSON](tooling-perf/no-binaries-in-json-mini-plan.md)
(open, G649); [generators spike / redesign](tooling-perf/generators-spike-mini-plan.md) (draft, G648/G650); `pnpm gen` speed
(benchmark running → `tooling-perf/gen-mini-plan.md`); [fail fast](../../project/archive/2026-10-27-fail-fast.md) and G627/G628/G636
(building under SHARD-PLATFORM).

## What we know (2026-10-23)

- **CI wall** (8,423 commits in 14 days, ~25 pushes an hour; current shape, 41 runs): median **19.1 min**, p90 24.6; jobs
  end at `generated-inputs` 6.8 → `typecheck-lint` 10.5 → `products` 12.5 → `build-and-deploy` 15.5 → 16 `behaviour`
  shards 17.8 (vitest 1.9–3.4 min a shard). Push → covering verdict: median 28 min, p90 44.
- **Red:** **481 of 568 push runs red in 7 days (85 %)**; 10-16/17 295 of 297 red, so no boot smoke ran for two days.
- **Push gate since G627/G628 (10-23 00:00):** median **43.6 s** (was 3.5); its 7 reds since 10-22 noon are all `tests`,
  all after 00:00, so it catches now. Still **63 % `ci-cache-miss`**; every tick and prefix recheck first materialises
  the whole source tree.
- **Pre-commit:** every commit, docs-only too, writes **7,461 files / 101 MB** of staged text to `tmp/commit-source-*` and
  regex-scans it before any check, then runs closed-components and the staged ratchet. d7255f9638 made the 5 s overrun a
  deferral, but a timed-out ratchet with no source staged defers *nothing* (`defer()` returns early): a silent skip.
- **Release:** 38 scheduled releases in 168 h (23 %), 47 hand dispatches; the launchd backstop is **not installed** (log
  ends 10-14). Green push → live 50–110 min. **Machine:** mirror 34 GB; caches `shardfiles` 11 GB, `generate` 3.4 GB; CI's
  tree-keyed cache never shares an entry with the Mac.
- **Tooling churn:** ~110 `fix(ci|push|git|gate|deploy|hooks|smoke|lint)` commits in 7 days; c2ff69dd04 broke *every*
  commit with ENOBUFS (2.7 MB `ls-files --stage` into a 1 MB buffer) and no test caught it: hook tests use toy repos.
- **819a36b8d4 (10-13, G416/G417) deleted** `gpu-gate.yml`, `coverage.yml`, `generation-*`, `script-conformance.yml` and
  cut `test:checks` from 11 commands to `check-graph`: the whole-repo lint ratchet, `bake-check`, `audit-assets`,
  `check-model-sources`, `webgpu-inventory`, `liveness` have run nowhere since. AGENTS.md still promises a nightly
  gpu-gate and a passing `test-facade-instancing.mjs`; nothing runs either.

## The audit (G651)

### A. Hooks and the push gate (local)

| Check | Guards | Cost (measured) | Runs | Finding |
|---|---|---|---|---|
| `pre-commit` → `precommit-inputs.mjs` | storage, fast lint, typed lint attempt, closed components, staged ratchet, deleted paths, inventory guards | 5 s wall cap; snapshot of 7,461 files first | every commit | snapshot + closed/ratchet run with no source staged (H1) |
| · `repo-size --index` | STORAGE.md budgets | 1.0 s | pre-commit | keep |
| · fast oxlint (staged) / typed oxlint attempt | lint; type-aware rules | <1 s / usually >5 s | pre-commit | 61 % of pushes carry a typed deferral (oxlint R1–R3) |
| · closed components / staged ratchet | component locks, custom-rule counts | ~1–3 s each (est.) | pre-commit when ratchet.json exists | gate only on src or ratchet.json staged (H1) |
| · deleted paths, inventory guards | dangling refs; host-callbacks, boundaries, chargebacks, manifest, schema ref | 0.1–8 s | pre-commit when inputs staged | keep |
| `commit-msg`: conventions / `legacy-shards --commit-message` | subject, trailer; frozen legacy | 0.03 s / 0.15 s | every commit | keep |
| `commit-msg`: `check-lock.mjs` + `.github/lock.json` | the E357 lock | 0.03 s | every commit | **dead**: lock lifted 10-01 (`locked: false`) |
| `post-commit` / `pre-push` | lane ledger / the 45 s gate for a hand `git push` | ~0.05 s / ≤ 45 s | every commit / hand pushes | keep |
| push gate (`push-loop.py` + `live-prepush.py`) | snapshot → deleted paths → 4–5 guard tests → related tests → importer typed lint | median 43.6 s, p90 ~45 | every minute | full-tree snapshot per tick and per prefix recheck (P4); 63 % cache-miss (K2) |

### B. GitHub workflows (7 days)

| Workflow / job | Trigger | Wall (med/p90) | Runs · red | Finding |
|---|---|---|---|---|
| `deploy` / `generated-inputs` | push | 5.1/6.4 min (`gen --parallel` 3.7) | 41 · 4 | tree-keyed cache; critical path (K1) |
| `deploy` / `products` | push | 12.2/18.3 min (`build-shardfiles --reuse` 3.5) | 137 · 33 | critical path (K1); also runs closed-components (dup of pre-commit) |
| `deploy` / `typecheck-lint` ×5 | push | 4.7/7.3 min (tsc 1.5, lint 2.7) | 483 jobs · 43 | 8 `tsc` invocations (TS T2); ~1 min setup ×5 |
| `deploy` / `build-and-deploy` (push) | push | 12.8/23.9 min | 137 · 32 | web build + `check-graph` + CSS + **native build 2.8 min** whose output nothing on push reads (C6) |
| `deploy` / `behaviour` ×16 | push | 4.7/6.8 min (vitest 2.8) | 1,096 jobs · 109 | 0.6–2.6 min artifact download per shard; stale durations (C2) |
| `deploy` release (`build-and-deploy`) | :17 cron, dispatch | 18.6/21.8 min | 85 · 3 | `vercel build` redoes gen + tsc + shardfiles + vite (B1) |
| `boot-smoke` (build + 5 macOS legs + verdict + release) | `workflow_run` of deploy | legs 6–8/14 min | 76 · 16 (+8 red dispatches) | only after a fully green run (R1); **1,138 skipped runs** a week from `workflow_run` (C5) |
| `storage` | every push | 0.2/0.65 min | 1,384 · **0** | never failed; keep as the bypass backstop (12 s) |
| `admin-deploy` / `site-deploy` | :47 cron / `site/**` | 7.7/15.7 min / — | 162 · 71 / 0 | admin reds were 10-16/17, green since hourly (10-21); site path-triggered |
| `ota-promote` | dispatch | — | **never ran** | gates on a `gpu-gate` status nothing posts since 10-13 (X1) |

### C. Lint and policies

- **oxlint 1.83:** all seven categories at `error`, **nursery** included → **~420 built-in rules**, 54 type-aware (91 off,
  10 configured). Speed is the [oxlint plan](tooling-perf/oxlint-mini-plan.md)'s; nursery at `error` lets an upgrade turn
  main red with no code change (L4).
- **`wildshard/*`, 40 custom rules** (1,121 + 1,368 lines): 30 `error` in `src/**`, 1 in tests, 4 `off` but counted, and
  **5 only in `.oxlintrc.ratchet.json`** (`public-index`, `no-raw-random-time`, `shard-sandbox`, `shard-services`,
  `shard-game-imports`). The whole-repo ratchet runs nowhere since 10-13, so those 5 (two are AGENTS.md guards) are
  checked only on staged files inside pre-commit's best-effort 5 s (L1, L2).
- **`lint/*.json`:** 25 committed policies (0.8 MB; `runtime-performance` 305 KB, `ratchet` 147 KB, `legacy-shards` 128
  KB); `sim-closure.json` and `sim-schema-leaves.json` are empty (L3); `api-surface.json` and the 15 MB host catalogue are
  generated and ignored.

### D. Check, guard and census scripts (595 files in `scripts/`; 66 named check/test/guard/audit/ci/gate)

| Where it runs | Scripts |
|---|---|
| Pre-commit / gate | `repo-size`, `precommit-*`, `push-checks` (deleted, importers), `gate-related-tests`, `push-inputs`, `guard-counts`, `check-closed-components`, `check-platform-ratchets` (staged) |
| CI push | `ci-checks` → `check-graph --source-only` (0.7 s), `check-css` (0.8 s), `check-devserver`, `lint-all`, `ci-products.py`, `ci-product-cache`, `check-closed-components` |
| Via vitest only | `check-custom-section-growth`, `check-headless-assemblies`, `check-models`, `check-staged-inputs`, `host-callbacks`, `shardfile-boundaries`, `platform-chargebacks`, `runtime-files`, `sim-closure`, 8 of 9 `test_*.py` |
| Manual / milestone | `frame-floor*` (12 files), `physics-baseline` / `physics-walk`, `soak/`, `scorecard`, `shard-platform` (the hourly ruler census), `check-grid-containment` (browser audit), `bench-load`, `gpu-texmem` |
| **Nowhere** | whole-repo `lint/ratchet.mjs`, `bake-check` + `check-cheap-bakes` (~110 s), `audit-assets`, `check-model-sources`, `check-asset-case` (2.0 s, green), `check-row-data` (**crashes at HEAD**: stale export), `check-shards` CLI (**red at HEAD**: requires a Nalati `plugin.ts` and Nine `roster.ts` that no longer exist), `check-paths` CLI (red without gen), `test-facade-instancing`, `test-template-gate`, `test-sdk-*` (5), `test-nine-*` (4), `test-author-*` (2), `test-oneshot-browser`, `test-ios-*` (2), `test-grid-nalati-entry`, `audit-animation-models`, `normalize/liveness`, `webgpu-inventory`, `gpu-gate/`, `test_ci_products.py`, **11 `node:test` files** under `scripts/` (soak ×8, parity, progress-trailer, frame-floor-native) |

### E. Test suites

- **vitest, one project:** 983 files (972 flat in `test/`, 0 next to source), 1,421 s of test time; 65 spawn, 234 read
  `*.generated.*`, 13 need products; 15 files ≥ 20 s (`shard-headless` 146 s). `test/durations.json` holds **1,483 stale
  rows of 2,420 (61 %)** and misses 46 live files, so the 16-way packing is skewed (C2).
- **Playwright** only in boot smoke; **Simulator, soak, frame floor, physics walk, gpu-gate parity** manual or per
  milestone (the gpu-gate and coverage workflows are gone).
- **Reds, 147 red push runs since 10-20 noon:** 71 test files, 209 file-reds; **22 files red in ≥ 3 runs carry 120 (57 %)**
  (`place-live-split` 16, `nine-practice-law` 11, `nalati-night-decisions` 9, `shardfile-boundaries` 7, `host-callbacks` 7
  (both gate guards since G627), `driftwood-quest-content-product` 7); `tsc` reds in 12 runs (TS2589 family 5 files,
  TS2307 tests importing deleted modules 6). Boot-smoke legs red: public 9, hover-webkit 8, hover-chromium 6, grid 5,
  developer 3 (at least one transfer flake, 03a1cd81e6).

## The ladder (pre-commit ≤ 5 s staged · gate ≤ 45 s · CI ≤ 10 min · boot-smoke legs · milestone)

| Check | Today | Should | Moving it one rung earlier needs |
|---|---|---|---|
| Staged snapshot | pre-commit, every commit | only staged files + direct inputs | H1 |
| `check-graph` (0.7 s), `check-css` (0.8 s) | CI only | pre-commit when `src/` / `*.css` staged (`--paths` mode exists) | wire into `precommit-checks` |
| Whole-repo ratchet (~69 s CI, 10-09) | nowhere | CI (`typecheck-lint` shard 5); zero-debt rules → plain oxlint → pre-commit | L1, L2 |
| `check-asset-case` (2.0 s) | nowhere | gate when `public/` or asset imports change | X2 |
| Hook self-test on the real index | nowhere | gate when `.githooks/` / `precommit*` / `commit.sh` change | H2 |
| Full `tsc` (1.5 min CI) | CI | gate | TS T5 warm tsbuildinfo + K2 inputs |
| Full lint (4 × 2.7 min CI) | CI | `lint:fast` whole repo in the gate (6–10 s) | oxlint R1 + D2 |
| Product tests, typed importers | CI on 63 % of pushes | gate | K2 |
| gen + products (critical path ~10 min) | CI uncached by input | CI cached per producer; gate incremental | K1, K2 |
| Closed components (products job) | pre-commit + CI | pre-commit only when inputs staged; CI copy goes | H1 |
| Native web build (2.8 min) | every push | push only when `index.html` / `vite.config.ts` / `src/native*` change | C6 |
| Boot smoke (5 legs) | after a fully green run | beside behaviour on `boot-dist` | R1 |
| Crossing memory, Explorer sweep, black frames; physics walk, frame floor | nowhere / manual milestone | boot-smoke legs (the last two when their inputs change) | V1–V3, D6 |
| `bake-check` (~110 s) | nowhere | CI if it catches what products admission does not, else delete | X2 measures once |

## Missing checks: reds of the last two weeks nothing caught early

| Red | What would have caught it | Row |
|---|---|---|
| c2ff69dd04 ENOBUFS broke every commit (10-23) | hook self-test on the real 26 k-entry index; a lint rule for `execFileSync` / `execSync` without `maxBuffer` (17 single-line git calls today) | H2 |
| Grid crash after crossing back, ~170 MB per round trip (live ab93dccfe, 10-22) | headless crossing round trip ×3 with a memory / ghost-world budget | V2 |
| Black Nine placeholder, black SHARD SELECT backdrop (10-22) | boot-smoke frames fail when mostly black at SHARD SELECT and at each grid edge | V1 |
| Pine stopped booting at 75c0ebb06 (10-16); no smoke for two red days | boot smoke on every built dist, not only fully green runs | R1 |
| Stale visited products, release held (2785bbe8ef, 10-20) | load the live build's products and a saved visit with the candidate | V4 |
| Nalati Model Explorer stack overflow (NX1, 10-18) | Explorer sweep per shard as a boot-smoke leg | V3 |
| T3 allocator / template activation regressions (10-21/22); terrain holes from 0e9ffd5c58 | frame floor on the phone routes; physics walk after collider changes (both manual) | D6 |
| TS2307 in tests importing deleted modules (6 runs) | deleted-path grep at pre-commit + gate (landed G627/G636); test files in the typed importer set | P2 |
| 22 repeat-red test files (120 file-reds) | recently-red-first in the gate | P1, S3 |

## Dead weight (delete, or revive into the ladder)

- **Delete:** `check-lock.mjs` + `.github/lock.json` + the commit-msg line; `ota-promote.yml` and `scripts/gpu-gate/` unless
  NATIVE-APPS needs them (D8); `check-row-data` (crashes), `normalize/liveness`, `webgpu-inventory`, `audit-animation-models`,
  `test-author-*`, `test-oneshot-browser`, `test-ios-compressed-upload`, `test-nine-*`, `test-sdk-*` not called by a test,
  `test-grid-nalati-entry`, the 11 `node:test` files (or move the live ones into vitest), `test_ci_products.py` (or run it),
  `deploy-backstop/` and `gpu-perf/` (both uninstalled; G585), the 1,483 stale `durations.json` rows.
- **Revive or delete (X2):** whole-repo ratchet, `check-asset-case`, `test-facade-instancing` (an AGENTS.md rule),
  `bake-check`, `check-shards` / `check-paths` CLIs (red at HEAD; tests use their functions), `check-model-sources`,
  `audit-assets`. **Never fails, keep:** `storage.yml` (0 of 1,384; the only check on a hook-bypassing push).

## Goals (draft, for Jake to confirm)

1. **Push → covering verdict ≤ 10 min median** (run ≤ ~7 min), p90 ≤ 15 (D1). 2. **≤ 20 % of push runs red** (85 % now);
no red reaches CI that the gate's 45 s could catch. 3. **Gate:** snapshot ≤ 3 s, `ci-cache-miss` < 5 %. 4. **gen and
products cached by input hash** locally and in CI: ≥ 90 % hits, a hit ≤ 30 s. 5. **Green push → live ≤ 30 min.**
6. **Pre-commit:** docs-only < 1.5 s, 1–3 source files < 3 s at load 30, no silent skips. 7. **Every check runs on a rung
or is deleted;** no tooling commit breaks every commit unnoticed. 8. No wait over 5 min (G610); mirror ≤ 15 GB.

## Rows

### H — Hooks (new)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| H1 | Pre-commit materialises only staged files and the inputs a selected job reads; no snapshot when nothing under `src/ scripts/ test/ lint/` is staged; closed / ratchet only when `src/` or `lint/ratchet.json` is staged | docs-only commit 3.0 s measured at load ~30 (over 5 s at peaks) → < 1 s; source commits −2–4 s | S | a docs-only commit < 1.5 s and a 3-file commit < 3 s at load ≥ 25 |
| H2 | **Tooling self-test on the real repo:** the gate runs `precommit-inputs` (dry run) and `push-loop --check` against the real index when `.githooks/`, `scripts/precommit*`, `push-*`, `live-prepush.py` or `commit.sh` change; lint rule `wildshard/exec-max-buffer` for `scripts/` | the c2ff69dd04 class stops at the gate | S | a fixture reintroducing the 1 MB buffer goes red in the gate |
| H3 | Deferral is never silent: a staged ratchet or closed check that times out is recorded for the gate like typed lint (fix the early `return` in `defer()`) | closes d7255f9638's hole | XS | a timed-out ratchet with no source staged runs at the next tick |
| H4 | commit-msg drops `check-lock.mjs` and `.github/lock.json` | one dead process per commit | XS | files gone |

### C — CI critical path

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| C1 | **Minute-0 jobs:** tests needing no generated inputs or products (S1's list) run from checkout beside `generated-inputs`; only product tests wait for `products` | −3–4 min of tail | M | most test files finish before `products` |
| C2 | Rebalance behaviour from fresh durations (prune the 1,483 stale rows, add the 46 missing); as few shards as keep the slowest ≤ 2.5 min | ~−1 min; fewer pickups | S | slowest shard ≤ 1.3 × median |
| C3 | One setup composite (sparse checkout, pnpm store, artifacts); merge jobs that fit one runner (typecheck-lint 5 → 2) | ~−0.5 min per job | S | setup ≤ 30 s per job |
| C4 | Fail fast: a red `generated-inputs` / `products` / first shard cancels the rest and names the file | red verdict ~7 min, not ~18 | S | red verdict median ≤ 8 min |
| C5 | Boot smoke called from deploy (`workflow_call` or a job) instead of `workflow_run` | 1,138 skipped runs a week gone | XS | no skipped boot-smoke runs |
| C6 | Push builds `build:native` only when its inputs change | −2.8 min of runner per push | XS | path filter landed |

### K — Caches by input hash (gen, products, checks)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| K1 | CI restores and saves **per producer** by input hash (the Mac's `~/.cache/wildshard` keys), not one snapshot per tree | gen 3.7 → < 0.5 and products 3.5 → < 0.5 min on a hit: **~−6 min of path** | M | ≥ 90 % producer hits over a day |
| K2 | The gate has verified generated inputs for every push (D2), so deferred typed checks and product tests run there | closes the 63 % `ci-cache-miss` hole | M | `ci-cache-miss` < 5 % |
| K3 | CI keeps a warm `tsbuildinfo` and the vitest transform cache by lockfile + prefix | Typecheck 1.5 → ~0.3 min | S | Typecheck < 30 s on a no-type-change push |
| K4 | Local cache budgets: `generate` and `shardfiles` pruned by age and size | ~−8 GB | XS | each ≤ 4 GB |

### S — Test-suite shape (G645; the type-project side is TypeScript T3)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| S1 | Classify every test file: unit / integration / regression / end-to-end / scenario, and needs-generated / needs-products / spawns (table in the commit message) | enables C1, S2, P1 | S | every file classed |
| S2 | vitest projects follow the layers (colocated unit + integration under T3) plus one `scenario` project; CI shards by project | minute-0 shards; per-layer `vitest related` | M–L | no unit test under `test/` |
| S3 | **Repeat reds:** the 22 files red in ≥ 3 runs are fixed or deleted (G416) | the bulk of behaviour-only reds | M | no file red in 3+ runs in a week |
| S4 | Any file over 20 s gets faster or moves to `scenario` (15 today) | shorter shards and gate runs | S | none over 20 s in unit/integration |

### P — Push gate (G627/G628 landed; what they do not build)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| P1 | **Recently red first:** files CI failed on in the last 24 h run in the gate before related tests | repeat reds stop at the gate | S | no CI red on a file the gate ran green for that push |
| P2 | Full typed check in the gate once TypeScript T5 lands; test files join the typed importer set | type reds stop reaching CI (12 runs this week) | S after T5 | typecheck-lint reds < 1 a day |
| P3 | Each `push.log` line records seconds per gate step and what was skipped for budget | shows where the 45 s goes | XS | `push.log` has the steps |
| P4 | One materialised snapshot per tip, reused by prefix rechecks and the next tick (or a sparse one: changed files + importers) | ~5–15 s of the 45 s back for checks (est.) | S | snapshot ≤ 3 s in P3's numbers |

### L — Lint rules and policies (new; speed stays the oxlint plan's)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| L1 | The whole-repo ratchet runs in CI again (a `typecheck-lint` shard), from verified inputs; first run in a check slot to see today's state | the 5 ratchet-only rules and the counted debt are enforced again | S | CI job green on main |
| L2 | Ratchet-only rules with zero debt become plain `error` in `.oxlintrc.json` (then fast lint checks them at commit) | 2 AGENTS.md guards back at pre-commit | XS each | each rule moved or its debt listed |
| L3 | Policy JSON hygiene: delete the empty / unread files; each policy names its reader and its guard test | fewer stale guards | XS | every `lint/*.json` has a live reader |
| L4 | Pin the oxlint version and keep `nursery` rules off main until they graduate (or `warn` in a weekly report) | no upgrade-only reds | XS | config changed |

### X — Dead weight

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| X1 | One deletion commit for the Delete list above, plus the AGENTS.md lines that promise a nightly gpu-gate and `test-facade-instancing` | fewer false promises; ~40 files | S | list gone; AGENTS.md true |
| X2 | Each Revive-or-delete script is run once in a check slot: green and catching → a ladder rung (vitest or the gate); red or redundant → deleted | every check runs somewhere or is gone | M | no script in the Nowhere row |

### V — Live-red catchers (new; boot-smoke legs, no new schedule)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| V1 | Boot-smoke frames fail when ≥ 90 % black at SHARD SELECT, title and each grid edge | the 10-22 black placeholders stop before live | S | a black-placeholder fixture goes red |
| V2 | Crossing leg: Driftwood → Sky Reach → back ×3 headless; fails on growth past budget or a ghost world (G628 D4) | the crossing crash class | M | leg green after the O18 leak fix; red on its revert |
| V3 | Model Explorer sweep per shard as a leg | NX1 class | S | leg runs every shard |
| V4 | Back-compat leg: the candidate loads production's products and a saved visit | no more held releases for stale lineage | S | fixture of live products in the leg |

### M — Machine (BUILD-SPEED Wave 3), B — Build, R — Release

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| M1 | Previews from the live tree into `tmp/<lane>/dist` (BUILD-SPEED 3.1 A); exact-SHA previews keep a slot | preview < 3 min; fewer slot holds | S | lane previews take no mirror slot |
| M2 | Mirror down to ruler + 2 check slots once M1 and K2 land (D4) | ~−20 GB | S | three slots; no 5-min timeouts in a day |
| M3 | Quiet vs not measured once, then one path kept (BUILD-SPEED 3.4/3.5) | 90 of 483 ticks held on 10-22 | S | numbers in the commit |
| M4 | Linux container for CPU work only if the Mac still drops under 10 % idle (BUILD-SPEED 3.2) | — | M | triggered or struck |
| B1 | `vercel build` stops rerunning gen, tsc and shardfiles: the release builds from the push run's verified products | release 18.6 → ~4 min | M | release job ≤ 5 min |
| R1 | Boot smoke starts on `build-and-deploy`'s `boot-dist` (minute ~15) beside behaviour; release needs both green | **~−10 min to deployable**; smoke even on red-test days | S–M | smoke verdict ≤ 2 min after the run's |
| R2 | Release cadence per D3; delete the uninstalled backstop | push → live ≤ 30 min | XS | measured over a day |

### Absorbed from BUILD-SPEED Waves 4–5 (not yet ruled)

4.1 coordinator as a launchd script → D7; 4.2 session hygiene, 4.3 budget pacing, 4.4 state batching (partly done), 5.1
one-page AGENTS.md, 5.3 receipts, 5.4 budget estimate kept as written; 5.2 lint trim → the oxlint plan (speed) and L1–L4.

## Decisions (decided G657: D1 push → verdict; D2 incremental gen; D3 KEEP HOURLY — fix the schedule and backstop; D4 ruler + 2; D5 no paid runners; D6 boot-smoke legs; D7 drop 4.1; D8 revive useful, delete rest)

1. **D1 What "CI ≤ 10 min" measures:** push → covering verdict, median (recommended) / the run's own wall time.
2. **D2 Where the gate gets generated inputs:** incremental gen from the shared per-producer cache once the gen plan lands (recommended; no new service) / download CI's outputs by input hash / leave those checks to CI.
3. **D3 Release cadence:** release whenever a newer green, boot-smoked commit exists, at most every 20 min, from boot-smoke's `release` job (recommended; the dead backstop and most hand dispatches go) / keep hourly.
4. **D4 Mirror slots after M1/K2:** ruler + 2 check slots (recommended) / delete the mirror (BUILD-SPEED 3.3) / keep six.
5. **D5 Larger paid runners:** not now; K1 and C1 first, revisit if the run is still over 7 min (recommended) / 8-core runners for gen and products now.
6. **D6 Heavy proofs** (crossing memory, Explorer sweep, black frames; physics walk and frame floor when their inputs change): boot-smoke legs on every green push, no new schedule (recommended; fits G585) / a nightly workflow / stay manual per milestone.
7. **D7 BUILD-SPEED 4.1 (coordinator as launchd):** drop under G585 (recommended) / keep.
8. **D8 The checks orphaned by 819a36b8d4:** delete the red or redundant ones and revive the ratchet, asset-case and facade-instancing into the ladder (X1/X2, recommended) / delete all / restore the 10-13 `test:checks` as is.

## Order

1. Stop silent and total breakage (XS–S each): H2, H3, H4, L1, C4, R1. 2. Red rate: S3, P1, P3, V1; V2 after the O18 leak
fix. 3. CI time: K1 → S1 → C1 → C2, C3, C5, C6; K3. 4. Commit and gate time: H1, P4; K2 (after the gen plan) → P2 (after
TypeScript T5). 5. Hygiene: X2 → X1, L2–L4. 6. Release: B1, R2, V3, V4. 7. Shape and machine: S2 with TypeScript T3, S4;
M1 → M2, M3, M4 if triggered; K4; BUILD-SPEED 4–5 last.
