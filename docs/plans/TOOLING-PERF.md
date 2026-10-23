# Plan: TOOLING-PERF — CI, tooling, build, TypeScript, lint and test mega performance

**State:** `draft` 2026-10-23 — the mega audit (G651) is queued for the next free plan-agent subagent slot; named by Jake (*"the CI and tooling and build TypeScript lint test mega performance
plan"*); rows drafted 10-23 by a plan-agent subagent from the CI runs, the push log and the mini plans below. Nothing is
worked under this plan until Jake says go; the SHARD-PLATFORM rows already decided (G609, G610/G612, G620, G627, G628,
G634, G636) keep landing there meanwhile and move here when this plan starts. Decisions stay in
[shard-platform/decisions.md](shard-platform/decisions.md) until this plan has its own. Absorbs
[BUILD-SPEED](BUILD-SPEED.md)'s open waves (3–5) when it starts.

Jake, 2026-10-23: *"We probably need a separate plan for just like fucking fixing all this shit … a draft plan for the
future."*

## Separate plans it links to (G647, not merged)

- [TypeScript speed](tooling-perf/typescript-mini-plan.md) and its [quick wins](tooling-perf/typescript-quick-wins-mini-plan.md) — open, the builder builds them now.
- [oxlint speed](tooling-perf/oxlint-mini-plan.md) — open, the builder builds it now.
- [No binaries inside JSON](tooling-perf/no-binaries-in-json-mini-plan.md) — open (G649): banned; check, write guard, lint rule, burn-down.
- [Generators spike](tooling-perf/generators-spike-mini-plan.md) — draft (G648): why generators import each other's outputs; standalone generators.
- `pnpm gen` speed — benchmark running; becomes `tooling-perf/gen-mini-plan.md` (pending).
- CI / push gate / pre-commit — decided (G609, G610/G612, G620, G627, G628, G636); building under SHARD-PLATFORM.

**TOOLING-PERF is the mega audit (G651).** The mini plans are zoomed-in fixes for the obvious pain points; this plan
covers **everything else, including what nobody knows about yet**: every lint rule, every custom check script, every
test suite, every GitHub Actions workflow and job, every hook, the push gate, gen, the build, the release, the machine.
Jake, 2026-10-23: *"It's supposed to be an audit review mega plan … the mini plans are just zoomed in focuses on really
obvious pain points. And the tooling perf is everything else … All the lints, all the GitHub actions, all the CI, all the
things that we should be running in pre-commit if they were fast, all the things that we should be running in pre-push if
they were fast."*

## The audit (G651, to be filled by a plan-agent subagent)

1. **Inventory every check:** oxlint built-in rules and each custom `wildshard/*` rule, every `scripts/check-*` / `test-*` /
   guard script, every vitest suite (unit, product, producer, behaviour, Playwright / e2e, Simulator), every workflow and job
   in `.github/workflows/`, every hook (pre-commit, commit-msg, pre-push), the push gate, the ruler, repo-size, ratchets,
   the deploy backstop.
2. **For each:** what it guards, wall time and memory, where it runs today (pre-commit / push gate / CI / nightly /
   nowhere), how often it failed in the last week and whether those were real bugs or flakes, duplicates.
3. **The ladder:** where each check *should* run if it were fast enough: pre-commit (≤ 5 s, staged files), push gate
   (≤ 45 s), CI (≤ 10 min), nightly; and what it would take to move it one rung earlier.
4. **Missing checks:** live reds and CI reds of the last two weeks that no check caught early; what would have.
5. **Dead weight:** checks that never fail, never run, or guard deleted code; delete them.
6. Rows per workstream (below) and decisions for Jake.

## What we know (2026-10-23, ~01:00 Cancun)

Sources: the last 600 `deploy` runs (~28 h), the 30 newest finished push runs (17:14–00:18 Cancun), `.git/push.log`.

- **Push rate:** ~25 pushes an hour; 490 of 600 runs were superseded while pending (G582, no work lost), so about 3 push
  runs finish an hour.
- **CI run wall:** median **17.8 min** (p90 21.7), from 28.4 on 10-22 morning. **Push → the verdict that covers it:
  median 28 min, p90 44** (a push waits for the running run, then its own).
- **Critical path** (median minute from run start): runner pickup 1.5 (p90 5.6) → `generated-inputs` ends 6.7 (`gen.mjs
  --parallel` 3.7 min with the tree-keyed cache restored) → `products` ends 11.5 (`build-shardfiles --reuse` 3.3) →
  16 `behaviour` shards end 17.8 (shard steps 1.5–3.7 min: unbalanced). Off the path: `typecheck-lint` (5 jobs) ends
  10.6; `build-and-deploy` (verify + web build) ends 14.2. Per-job setup (checkout, pnpm, artifacts) ~0.6–1 min × 24 jobs.
- **Red rate:** 32 of 43 finished push runs red since 10-22 noon (74 %). The 24 reds in the newest 30: behaviour only 8,
  behaviour + typecheck-lint 7, generated-inputs 4 (one 11-minute streak), products 3, typecheck-lint only 2. The same
  broken test stays red across several runs while the fix forward lands. 10-21/22 audit: 79 of 122 reds were cheap tests
  ([CI red causes](https://claude.ai/artifact/RR6Lb9JRJ6TeGuLtyW8SQK), G627).
- **Push gate** (since 10-22 noon, 483 ticks): 386 pushed, 7 red, 90 held by the quiet window. Gate time median 3.5 s,
  p90 7.0, 19 over 40 s: **~41 s of the 45 s unused at the median** (G628). **241 of 393 pushes (61 %) carried typed
  checks pre-commit deferred, and the gate could not run them** (`ci-cache-miss`: no verified generated inputs), so CI owns them.
- **Pre-commit:** G636's parallel set is in (`scripts/precommit-inputs.mjs`, 5 s wall); its deferred typed attempt lands
  in the gate's 61 % hole above.
- **Release:** boot smoke ~10.6 min after a green push run (59 of the last 60 skipped: their push run was red); the
  hourly :17 release rebuilds for ~18 min; GitHub ran only 5 scheduled releases in 28 h (the launchd backstop covers).
  Green push → live is 50–110 min at best.
- **Machine:** six mirror slots (check..check5, ruler) = 37 GB in `tmp/build-mirror`; 3 build leases (G620); 5-minute
  fail-fast waits (G612). Local caches `~/.cache/wildshard/generate` 11 GB and `shardfiles` 11 GB; CI keeps its own
  `actions/cache` keyed by the whole tree, so the Mac and CI never share an entry.
- **Tests:** 965 test files under `test/`, 19 in `scripts/`, **0 next to source**; 143 spawn processes, build products or
  drive a browser; `vitest` splits 16 ways by recorded duration. Product tests need `build-shardfiles` (7–75 s each).
- **TypeScript / oxlint:** 62.6 s / 10.2 GB full check; typed lint 47 s / 12.7 GB — owned by the mini plans above.

## Goals (draft, for Jake to confirm)

1. **Push → covering verdict ≤ 10 min median** (so the run itself ≤ ~7 min wall), p90 ≤ 15 (D1).
2. **≤ 20 % of push runs red**, and no red reaches CI that the gate's 45 s could have caught.
3. **The gate uses its 45 s**: median ≥ 30 s of useful checks; `ci-cache-miss` on < 5 % of pushes.
4. **gen and products cached by input hash, locally and in CI:** ≥ 90 % hits, a hit step ≤ 30 s.
5. **Green push → live ≤ 30 min.**
6. No lane waits over 5 minutes (G610); mirror disk ≤ 15 GB; no lane runs a check the gate already runs.
7. TypeScript and lint goals (full typed check warm in seconds, ~2 GB) are the TypeScript and oxlint plans' goals.

## Rows

### C — CI critical path

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| C1 | **Minute-0 jobs:** tests needing no generated inputs or products (S1's list) run as their own shards from checkout, beside `generated-inputs`; only product tests wait for `products` | the post-`products` tail shrinks to product tests: ~−3–4 min | M | most test files finish before `products` does |
| C2 | Rebalance behaviour shards from fresh durations; drop to as many shards as keep the slowest ≤ 2.5 min | ~−1 min; fewer runner pickups | S | slowest shard ≤ 1.3 × the median shard |
| C3 | One setup composite action per job (sparse checkout, pnpm store, artifact restore) and fewer jobs where two fit one runner | ~−0.5 min per job, fewer pickups | S | setup ≤ 30 s per job |
| C4 | Fail fast in CI: a red `generated-inputs` / `products` / first shard cancels the run's other jobs and posts the failing file at once | verdict on a red in ~7 min instead of ~18 | S | red verdict median ≤ 8 min |

### K — Caches by input hash (gen, products, checks)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| K1 | CI restores and saves **per producer** by its input hash (the keys the Mac's `~/.cache/wildshard` already uses), not one snapshot per tree | gen 3.7 → < 0.5 min and products 3.3 → < 0.5 min on a hit: **~−6 min of critical path** | M | ≥ 90 % producer hits over a day of pushes |
| K2 | The push gate has verified generated inputs for every push (D2), so deferred typed checks and product tests run in the gate | closes the 61 % `ci-cache-miss` hole | M | `ci-cache-miss` < 5 % of pushes |
| K3 | CI keeps a warm `tsbuildinfo` and the vitest transform cache by lockfile + prefix | Typecheck 1.5 → ~0.3 min (off path; frees runner time) | S | CI Typecheck step < 30 s on a no-type-change push |
| K4 | Local cache budgets: `generate` and `shardfiles` pruned by age and a size cap | ~−15 GB disk | XS | each ≤ 4 GB |

### S — Test-suite shape (G645; the type-project side is the TypeScript plan's T3)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| S1 | Classify every test file: unit / integration / regression / end-to-end / scenario, and needs-generated / needs-products / spawns (a script over imports; the table goes in the commit message) | makes C1, S2 and P1 possible | S | every file has a class |
| S2 | vitest projects follow the layers: one per workspace for its colocated unit and integration tests (moved under T3), one `scenario` project for regression, end-to-end and scenario tests; CI shards by project | minute-0 shards; per-layer `vitest related` | M–L | no unit test under `test/`; CI jobs map to projects |
| S3 | **Repeat reds:** the 20 most-failed files of the last week are fixed or deleted (G416: trash fragile tests) | red rate down by the bulk of behaviour-only reds | M | no file red in 3+ runs in a week |
| S4 | Slow tests: any file over 30 s gets faster or moves to `scenario` | shorter shards and gate runs | S | no unit/integration file over 30 s |

### P — Push gate fills its 45 s (G628; what G627/G628 do not already build)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| P1 | **Recently red first:** files CI failed on in the last 24 h always run in the gate, before related tests | repeat reds stop at the gate | S | no CI red on a file the gate ran green in the same push |
| P2 | The full typed check runs in the gate once the TypeScript plan's T5 lands (warm `tsbuildinfo`, ≤ 45 s; over budget → CI per its D2) | type reds stop reaching CI (7 of 24 reds had typecheck-lint) | S after T5 | typecheck-lint reds < 1 a day |
| P3 | Each push-log line records the time per gate step and what was skipped for budget | shows where the 45 s goes; no new files | XS | `push.log` has the steps |

### M — Machine: slots and leases (BUILD-SPEED Wave 3)

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| M1 | Previews from the live tree into `tmp/<lane>/dist` (BUILD-SPEED 3.1 A); exact-SHA previews keep a mirror slot | preview < 3 min; fewer slot holds | S | lane previews take no mirror slot |
| M2 | Mirror down to ruler + 2 check slots once M1 and K2 land (D5) | ~−18 GB disk | S | three slots; no 5-min timeouts in a day |
| M3 | Quiet vs not measured once, then the quiet machinery kept or deleted (BUILD-SPEED 3.4/3.5) | 90 of 483 ticks held today | S | numbers in the commit; one path left |
| M4 | Linux container for CPU work only if the Mac still drops under 10 % idle (BUILD-SPEED 3.2) | — | M | triggered or struck |

### B — Build and R — Release path

| Row | What | Expected win | Size | Done when |
|---|---|---|---|---|
| B1 | `vercel build` stops rerunning gen, tsc and shardfiles: the release builds from the push run's verified products | release 18 → ~4 min | M | release job ≤ 5 min |
| R1 | Boot smoke starts on `build-and-deploy`'s `boot-dist` (minute ~14) beside the behaviour shards; release needs both green | **~−10 min to deployable** | S–M | smoke verdict ≤ 2 min after the push run's |
| R2 | Release cadence per D3 | push → live ≤ 30 min | XS | measured over a day |

### Absorbed from BUILD-SPEED Waves 4–5 (open, not yet ruled)

| Phase | Today | Here |
|---|---|---|
| 4.1 coordinator as a launchd script | conflicts with G585 (no new automation) | D4 |
| 4.2 session hygiene, 4.3 budget pacing, 4.4 state batching | 4.4 partly done (one docs commit an hour) | kept as written, asked with this plan |
| 5.1 one-page AGENTS.md, 5.3 receipts | untouched | kept as written |
| 5.2 lint trim | overlaps the oxlint plan | the oxlint plan owns lint rules; ratchet deletion asked here |
| 5.4 budget estimate before commit | untouched | kept as written |

## Decisions for Jake

1. **D1 What "CI ≤ 10 min" measures:** push → the verdict that covers it, median (recommended; the run itself then
   needs ≤ ~7 min) / the run's own wall time.
2. **D2 Where the gate gets generated inputs:** incremental gen in the gate from the shared per-producer cache, once the
   gen plan lands (recommended; no new service) / download CI's outputs by input hash / leave those checks to CI.
3. **D3 Release cadence:** release whenever a newer green, boot-smoked commit exists, at most every 20 min (recommended)
   / keep hourly.
4. **D4 BUILD-SPEED 4.1 (coordinator as a launchd script):** drop it under G585 (recommended) / keep it.
5. **D5 Mirror slots after M1/K2:** ruler + 2 check slots (recommended) / delete the mirror (BUILD-SPEED 3.3) / keep six.
6. **D6 Larger paid GitHub runners:** not now; K1 and C1 first, revisit if the run is still over 7 min (recommended) /
   try 8-core runners for gen and products now.

## Order

1. Red rate first, cheap: S3, P1, C4, R1 (each S).
2. CI time: K1 → S1 → C1 → C2, C3; K3.
3. Gate: K2 (after the gen plan) → P2 (after TypeScript T5); P3 any time.
4. Release: B1, R2.
5. Shape and machine: S2 with TypeScript T3, S4; M1 → M2, M3, M4 if triggered; K4; the BUILD-SPEED 4–5 phases last.
