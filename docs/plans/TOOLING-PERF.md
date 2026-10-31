# Plan: TOOLING-PERF — the CI, tooling, build, TypeScript, lint and test mega audit

**State:** `in progress` 2026-10-31 for the Codex lanes (G964, Jake: "tooling perf … great for the Codex lanes"; was `parked`, G659) — a draft in the same bucket as SHARD-PLATFORM-NEXT and WASM-HOST: nothing is worked until Jake says when; its picks (G657) are recorded. The zoomed-in mini plans it links (TypeScript, oxlint, no binaries in JSON, generators) are not parked: they run as SHARD-PLATFORM extras (G647). 2026-10-23 — G651 audit done (plan-agent subagent, from 7 days of GitHub runs, 147 red-run logs,
`.git/push.log`, the hooks, workflows and every check script; cheap checks timed at load ~30, the rest marked est.).
Nothing is worked here until Jake says go; decided SHARD-PLATFORM tooling rows (G609, G610/G612, G620, G627, G628, G634,
G636) keep landing there and move here when it starts; decisions stay in [decisions.md](shard-platform/decisions.md);
absorbs [BUILD-SPEED](../../project/archive/2026-10-28-build-speed.md) waves 3–5. Jake, G651: *"the tooling perf is everything else. Like, everything that
I don't know about yet … all the things that we should be running in pre-commit if they were fast, all the things that we
should be running in pre-push if they were fast."*

## Separate plans it links to (G647, never copied here)

[TypeScript speed](../../project/archive/2026-10-27-typescript-speed.md) + [quick wins](../../project/archive/2026-10-26-typescript-quick-wins.md) and
[oxlint speed](../../project/archive/2026-10-27-oxlint.md) (done 10-27; R4 folded into generators GR12, G796); [no binaries in JSON](../../project/archive/2026-10-27-no-binaries-in-json.md)
(done 10-27, G649; B5 folded into GR6–GR8, G796); [generators spike / redesign](../../project/archive/2026-10-27-generators-spike.md) (done, G815–G817; archived); [`pnpm gen` speed](../../project/archive/2026-10-27-gen-speed.md)
(done 10-27; G1 / G6 / G8 folded into GR12, G796); [lint and typecheck speed](../../project/archive/2026-10-29-lint-speed.md)
(done 10-29, G872: measured partials accepted; plugin caches, one `tsc -b`, one CI lint job); [fail fast](../../project/archive/2026-10-27-fail-fast.md) and G627/G628/G636
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
  10 configured). Speed is the [oxlint plan](../../project/archive/2026-10-27-oxlint.md)'s (archived; R4 lives in generators GR12); nursery at `error` lets an upgrade turn
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
| H2 | **Done (2026-10-31, sp-x6; G964 live-gap scope):** the live `precommitGit` helper captures with an explicit 32 MiB bound. The real index is read without mutation; `wildshard/exec-max-buffer` rejects captured Git inventories/dynamic lists without a bound in `scripts/precommit*.mjs`. Ordinary lint configuration enforces it. Retired snapshots and `push-loop --check` stay retired. | stops the live default-buffer breakage class | S | direct real-index ENOBUFS reproduction, live-source omission mutant red, original hook controls green |
| H3 | **Superseded by G769/DL3 (2026-10-31 audit):** old `defer()` and staged ratchet/closed jobs are retired; current storage/typed timeouts explicitly name CI ownership. No retired gate handoff is revived. | closes the obsolete silent-deferral row | XS | 10 current deadline/refusal/cleanup controls pass; see hourly reconciliation |
| H4 | **Done (`5fc27d4e6e`, rechecked 2026-10-31):** commit-msg no longer invokes `check-lock`; helper/declaration and `.github/lock.json` are absent. Conventions, tile debt and legacy checks remain. | dead process already removed | XS | files and caller gone |

### C — CI critical path

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| C1 | **Minute-0 jobs:** tests needing no generated inputs or products (S1's list) run from checkout beside `generated-inputs`; only product tests wait for `products` | −3–4 min of tail | M | most test files finish before `products` |
| C2 | Rebalance behaviour from fresh durations (prune the 1,483 stale rows, add the 46 missing); as few shards as keep the slowest ≤ 2.5 min | ~−1 min; fewer pickups | S | slowest shard ≤ 1.3 × median |
| C3 | One setup composite (sparse checkout, pnpm store, artifacts); merge jobs that fit one runner (typecheck-lint 5 → 2) | ~−0.5 min per job | S | setup ≤ 30 s per job |
| C4 | **Done for live cause reporting (`9da5b1a773`, 2026-10-31); cancellation superseded by G678:** jobs retain independent verdicts, and a bounded primary-path set survives verbose output beyond the 2000-line tail. Producer dependencies and every case remain. | retains the actual red cause; no claimed eight-minute verdict | S | two red-before real-child regressions, 20 Python controls and the maintained wrapper pass; see hourly reconciliation |
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
| S3 | **In flight (2026-10-31, sp-x6), bounded audit accepted:** historical causes have defining fixes; no current unowned reproduction. No further work needed now. | keeps valid tests and every cap | M | weekly no-3-red bar remains open until a complete week is evidenced |
| S4 | Any file over 20 s gets faster or moves to `scenario` (15 today) | shorter shards and gate runs | S | none over 20 s in unit/integration |

### P — Push gate (G627/G628 landed; what they do not build)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| P1 | **Superseded by G768/G769/DL3 (2026-10-31 audit):** the live committed-only tick does not call dormant recent-CI collection or test selection. | preserves current fast-publication policy | S | four current policy controls pass; no retired CF1 gate revived |
| P2 | Full typed check in the gate once TypeScript T5 lands; test files join the typed importer set | type reds stop reaching CI (12 runs this week) | S after T5 | typecheck-lint reds < 1 a day |
| P3 | **Done (`e675bc2db6`, audited 2026-10-31):** checked ticks record candidate, per-phase seconds/outcome/reason, upload seconds and residual overhead. | shows where the 45 s goes | XS | 40 retained checked pushes reconcile; current prefix/budget/refusal controls pass |
| P4 | One materialised snapshot per tip, reused by prefix rechecks and the next tick (or a sparse one: changed files + importers) | ~5–15 s of the 45 s back for checks (est.) | S | snapshot ≤ 3 s in P3's numbers |

### L — Lint rules and policies (new; speed stays the oxlint plan's)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| L1 | **Done (`8da7f94de2`; scope fix `b962e7fee7`, 2026-10-31):** seven debt rules enforce existing ceilings under real `src/**/*`; raw census and hard classification stay unchanged. | restores missing enforcement without another pass | S | 15 current controls, draft typed lint and root types pass; ordinary containing scope-fix qualification remains open |
| L2 | Ratchet-only rules with zero debt become plain `error` in `.oxlintrc.json` (then fast lint checks them at commit) | 2 AGENTS.md guards back at pre-commit | XS each | each rule moved or its debt listed |
| L3 | Policy JSON hygiene: delete the empty / unread files; each policy names its reader and its guard test | fewer stale guards | XS | every `lint/*.json` has a live reader |
| L4 | Pin the oxlint version and keep `nursery` rules off main until they graduate (or `warn` in a weekly report) | no upgrade-only reds | XS | config changed |

### X — Dead weight

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| X1 | **G860 TP1 done (2026-10-28, sp-x6; `50463322f5`):** 16 dormant script/declaration files retired, no maintained caller; docs keeps API/host writers. Six separation regressions, scripts types, typed lint and actual docs generation pass. Live gpu/deploy/facade checks and AGENTS.md preserved. **TP3 done (2026-10-28, sp-x6; `83441ad9c4` plus this correction):** all12 orphan Node suites run once (60PASS/1 stale-history failure); eleven live suites move to normal Vitest (53 cases). The failed history suite retires. Escape helper has a real art/ golden caller (missed by the first audit), restored in `7e7259e96f`; its complete trusted-input assertion is now maintained in Vitest; no scripts/*.test.mjs remains. Broader D8 scope stays open. One deletion commit for the Delete list above, plus the AGENTS.md lines that promise a nightly gpu-gate and `test-facade-instancing` | fewer false promises; ~40 files | S | list gone; AGENTS.md true |
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
| R1 | **Done (2026-10-31, accepted):** exact-run prepared inputs feed SIX beside behaviour; merged ship requires both. `fa13b9fce6` / `93bd4ce2ba`; no retired workflow revived. | parallel smoke wiring implemented; no isolated speed claim | S–M | original 44 controls pass; SIX finishes before the required wave on 6a84 /60e /82b9 |
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

## H2: live hook capture boundary (G964)

The old H2 wording described the retired full-source snapshot and push-loop
self-test. G964 narrows this landing to the current helper and a focused
rule. `precommit-inputs` now uses one exported internal Git reader with
an explicit **32 MiB** capture limit, retaining the same commands, index,
staged selection, storage checks, typed lint and five-second wall budget.
No dry-run interface or new hook worker is introduced.

The regression reads the **real current index**, not a toy substitute:
**2,948,712 bytes /29,381 entries** at measurement. The original Node
default fails with `ENOBUFS`; the helper captures the complete NUL-ended
output. This is read-only Git inventory, with no staging, snapshot or
source materialization. A future smaller index remains valid.

The syntax-only rule recognizes imported Node synchronous Git captures,
including named aliases, namespace calls and shell inventory commands.
It accepts explicit bounds and noncapturing stdio, and does not require
a large buffer for bounded control queries such as `rev-parse`. Activation
is deliberately the **live precommit helper family**, rather than a new
whole-tooling migration or debt allowance. The existing push fast-lint
phase sees the same configured rule; no push-loop recursion or extra
required test batch is added.

Controls run the installed oxlint/plugin: **11** default/invalid/captured
forms refuse, **9** bounded/control/noncapturing forms pass, and the
actual live helper passes while removing its `maxBuffer` property refuses.
The existing source-selection/named-export and docs/test-only hook cases
remain green: **6 tests /2 files**, direct Vitest **5.91 s**. Root and
scripts types and named typed lint pass. The linked archived TypeScript,
oxlint, binary-JSON and generator plans remain done; this change does not
reopen them or promise an unmeasured hook speedup.

## Hourly reconciliation: H3 / H4 / L1 / C4 (2026-10-31)

This is one batch of the current code evidence, rather than one plan
commit per row. Historical G651 timings and snapshots above describe the
old system; they are not fresh measurements of the current pipeline.

- **H3 — superseded by G769/DL3.** `.githooks/pre-commit` invokes the
  current `precommit-inputs.mjs`, which runs storage and eligible staged
  typed lint within one five-second deadline. The old `defer()` and
  precommit ratchet/closed-component jobs are absent. Every unfinished
  current result prints its named `unfinished; CI owns it` verdict.
  `test/precommit-checks.test.ts` passes **10 cases /1.21 s**, including
  deadline/refusal retention, spawn errors and owned descendant cleanup.
  No retired source snapshot, gate handoff or timeout retry is revived.
- **H4 — done by `5fc27d4e6e`.** `check-lock.mjs`, its declaration and
  `.github/lock.json` are gone. The live commit-message hook runs message
  conventions, tile-debt policy and the legacy message check. There is no
  lock process left to delete; no new speed claim or code change follows.
- **L1 — done in `8da7f94de2`.** The **seven** remaining nonzero migration
  rules enforce their recorded per-file ceilings in the existing ordinary
  lint AST pass: raw randomness/time, shard sandbox, game imports, game
  plugins, generator imports, engine imports and SDK facades. The former
  five-rule inventory was stale; public-index and shard-services are
  already hard. No second lint pass, job or heavy gate is added. Raw
  census visitors, hard rules, exact frozen/test scope, policy bytes and
  global budget checks remain unchanged. No persistent coverage receipt
  substitutes for actual lint execution.

L1's seven real rules each accept their recorded first site and refuse a
second, while raw census mode still reports the first. Missing file rows
allow zero; malformed counts refuse. The selected **4,560** actual source
files produce zero growth. The related **14 controls /3 files** pass in
**8.90 s**, with a final **8-case** touched-rule run passing in 5.08 s;
root types and named typed lint pass. Its normal publication gate passes
in **9.85 s**. These local results qualify the code boundary, not a new
ordinary containing CI verdict or isolated CI timing improvement.

### C4: independent verdicts retain their actual cause

**G678 supersedes the original cross-job cancellation design.** Running
push jobs finish and list every red; a failed producer blocks dependents
through the existing job dependencies. Matrices keep `fail-fast: false`
and cases retain `--bail=0`. The wrapper never queries peer status or
cancels another job. The old median-eight-minute cancellation target is
not claimed and is not restored as an implementation requirement.

The remaining live reporting gap is fixed in **`9da5b1a773`**. The
wrapper's 2,000-line output tail could discard an early actual `FAIL`
path after verbose draining, then incorrectly attribute an informational
path in the tail. It now retains at most **16 primary failure paths**
while continuing to drain and print all command output. Later primary
messages cannot evict that first bounded set. Warning/informational
mentions cannot replace it; a successful command still emits no failure
annotations. The original exit code, paths-only metadata, exact path
normalization/escaping and owned process-group cleanup remain.

Two real-child regressions fail before the fix: an actual failure followed
by **2,500** drain lines, and more than 16 early failures followed by a
later primary failure. The maintained Vitest wrapper then passes both
tests, including all **20 Python controls**, in **2.86 s**. Python compile
and root types pass. The existing owned sibling cleanup check is inside
one command's process ownership; it does not cancel peer CI jobs.

C4's live cause-reporting contract is done. Its former timing target is
superseded by the independent-job policy; the separate CI9 end-to-end bar
remains open. No workflow, admission group, deadline, coverage or worker
count changes; no dispatch, CI fetch, app build or native proof was run.

The H2 configured-rule test remains valid. Clarification: its installed
linter refuses the actual buffer-omission mutant, and ordinary CI lint
uses that configuration. The current local push gate can mark fast lint
as `CI`; no claim is made that every local push ran that optional phase.


## G964: live B2 JSON writer boundary

The zoomed-in TypeScript, oxlint, binary-JSON and generator plans are
archived with their operative rows complete. Their historical partials,
folded GR12 work and explicitly dropped full-check push gate are not
reopened. This maintenance fixes a reproduced gap in the **current B2
writer contract**, separate from sp-x6's ordered S3 work.

`assertJsonRows` used realm-local `instanceof` checks for raw ArrayBuffer
and SharedArrayBuffer. Native values returned by an isolated Node VM
passed those checks and `jsonBytes` silently serialized them as `{}`.
The host guard now also uses Node's native `isAnyArrayBuffer` brand
check. Existing realm, typed-view and explicit Buffer-JSON refusals
remain; ordinary numeric rows, serialization, exact-path debt and the
binary sibling publication path are unchanged. No compiler, scheduler,
policy allowance, JSON type erasure or retired gate is introduced.

The real VM regression is red before this change. It refuses raw and
shared buffers, Uint8/Uint8Clamped/Float64 views and DataView before an
output can exist; ordinary foreign authored rows still publish identical
JSON bytes. **33 controls /2 focused suites pass in 11.10 s**, including
original writer, path/debt and generator publication refusals. Script
project types, named typed lint and whitespace checks pass. This is a
correctness fix; no isolated tooling or CI speedup is claimed. No app
build, browser, native proof, full suite or heavy gate was run.


## Hourly reconciliation: R1 / S3 / P1 / P3 and L1 scope

**2026-10-31, sp-x6.** This batch preserves the B2 maintenance above.
R1's original 44 controls pass in 3.04 s. Retained SIX finishes
222 /56 /75 s before the required wave on 6a84 /60e /82b9; the late
82b9 status is merged-ship admission, not a serial smoke build.

S3's scratch 122-run census reconstructs 17 repeated files, not the
original 147-run /22-file cohort. Immutable `881a0731df` records a later
202-failed-run recount with 31 repeated files. All 31 remain present
and their test bytes equal fully green `1dae75e945`; this does not prove
unchanged dependencies or a clean rolling week at HEAD. Defining fixes
include `881a0731df` (presenting clock/unrelated night pins), `c53cc17b9f`
(practice course frame) and `17dcca7241` (complete native compiler inputs,
original module bound/deadline). Current focused 12 files /95 cases pass:
3 /14 in 19.80 s and 9 /81 in 48.87 s. No tests or valid assertions are
deleted. Current required failures remain with their actual owners:
project ownership (`b13ad77350`), L1 scope (`b962e7fee7`) and x2's boot
transport investigation. Local checks and containing green qualification
are distinct. S3 is accepted as bounded; the weekly bar stays open.

P1's helper survives only in dormant CF1 tooling and its tests. The live
push tick has no caller; four current G768 policy controls pass in
0.940 s. P3 is live: 40 checked ticks from 10:55:33–13:43:51 local time
have complete step/candidate/status fields, explicit skip reasons,
separate upload time and reconciled overhead. Four current prefix,
budget, guard and no-subset controls pass in 1.150 s. No old test gate,
CI collector, source snapshot or dormant phase is revived.

L1's global activation wrongly reached `drafts/src/walk.ts`. Scope fix
`b962e7fee7` confines the seven ceilings to `src/**/*`, preserving the
separate hard `src/**` classification and every policy count. Actual
config controls reject top-level/nested real-source clocks and preserve
the prior draft/admin/site scope. Fifteen controls, actual draft typed
lint and root types pass; ordinary containing qualification stays open.

## Hourly reconciliation: remaining ordered main-list findings

**2026-10-31, sp-x6; accepted G964 audit.** No live implementation gap
remains in this plan's main list. V1 is done at `11dab8826d`: the original
composited-phone black-frame predicate refuses its real fixture; 20
controls in three suites pass in 430 ms. V2 folds into T1's Driftwood /
Sky retirement milestone, retaining all five measured returns and native
memory/ghost checks. G710's settled R4-to-R5 growth is 10,616,832 B with
zero ghosts; its old warm-baseline failure remains a failure. Nine
current controls pass in 137 ms. This does not add a per-push journey.

K1's nested producer input caches exist; its literal per-producer CI
transport proposal is superseded by CI9's approved aggregate admitted
input identity. All24-reused observations do not establish its daily
90% hit bar, and an exact-hit save skip after the latest key repair
remains separately qualified. S1 folds into completed T3 classification
and the existing source-colocated, root tooling/regression/scenario and
cross-layer ownership contracts. No scheduler is revived.

C1 is superseded by G918/G920's one prepare followed by one complete
product/product-free wave. C2 folds into CI7's measured complete-module
planner, retaining 24x2 and exact inventory; remote timing bars remain
source-specific. C3 folds into LS8's single complete forced type/lint
job (`8d0c752b02`), shared prepare artifacts and merged publisher; no
30 s setup result is asserted. C4 retains its completed live-cause
reporting; G678 supersedes cross-job cancellation. C5 is implemented by
`fa13b9fce6` /`93bd4ce2ba`, with six ordinary journeys and no old
boot-smoke workflow_run chain. C6's native-input detector and conditional
build already exist. K3's transform cache remains, and **the full forced
type solution keeps --force as designed**. No warm-typecache timing bar
is claimed. Archived or dropped experiments stay retired; CI9 owns the
next work, while timing and weekly acceptance bars stay explicit.
