# Speed audit: commit, push, CI, release (2026-10-09, 15:45–17:20 local)

Measure-and-rank only; no pipeline changed. Asked by Jake: *"What else can the speed agents do to speed up all the
GitHub Actions, all the local stuff, the pre-commit, the pre-push … finding the best bang-for-buck things"*. It builds on
SF74 (`docs/plans/shard-platform/wall-clock-plan.md`, W0–W16) and the process audit `../audit-2026-10-09/`; rows
already done there are not repeated. A builder lands the fixes from the table below.

**Sources:** `.git/gate-timings.jsonl` (7 gates), `.git/push-timings.jsonl` (12 loops), `.git/auto-push.log` and
`.git/auto-push/*.log` (8 auto-push runs); 200 push runs of `deploy.yml` (10-08 13:27Z → 10-09 21:25Z) with each red
run's failing test files pulled from `--log-failed`; per-step job timings of 3 push runs and 1 boot-smoke run; the
vitest duration cache; `measure.py --hours 4`; Claude transcripts (polling commands, last 4 h); and timings and a CPU
profile taken on a throwaway `git archive` export (no `public/`, 179 MB). **The machine ran at load average 40–120 on
18 cores throughout**, so every local number is a loaded number (the same load the gate sees).

## Fix first (not speed): the hourly release is broken

The 21:45Z scheduled release (run 37995299999, pin `5d4e3b70b`, CI-green) failed at **Native web build**:
`Could not resolve './shard/portShares.generated' in src/game/titleDeck.ts`. A CI-green pin now skips Typecheck, Lint
and Test (W0/W15), and those steps were what ran `pnpm gen`; `pnpm run build:native` (`vite build --mode native`) then
builds without the generated files. **Fix:** run `pnpm gen` before the native build in `deploy.yml` (or call it inside
`build:native`). Effort S. Until then, every CI-green release fails and production stays where it is.

## The headline finding

**`lint/wildshard-plugin.js` (oxlint's JS plugin) is ~99 % of every full oxlint run, and five steps run it.** On the
export: native oxlint over the tree takes **0.9 s**; with the JS plugin it takes **95 s** (user 88 s: one thread);
type-aware adds ~40 s (134 s total). A CPU profile of the plugin run:

| Frame (inclusive) | Share |
|---|---|
| `runtimeCommonsClosure` (`lint/commons-closure.mjs`) called from `checkImport` **for every import statement**: a fresh BFS over the transitive import closure each time (only the parse is cached; each visit still `statSync`s and `path.resolve`s) | **~65 %** |
| `authoredHtmlSites` (`lint/authored-html.mjs`): builds a TypeScript checker for each file that mentions an HTML sink | ~16 % |
| `runtimePerformanceViolations` (`lint/runtime-performance.mjs`) | ~3 % |

The same plugin runs inside `lint/ratchet.mjs` (`.oxlintrc.ratchet.json` lists it), so it is paid by: the gate's
oxlint (113–208 s, on the gate's critical path), the gate's `ratchet` (106–196 s) and `generated` (125–216 s) when the
tip is not a stamped regeneration commit, the push-time regeneration (`ratchet.mjs --measure`: **73 s** on the export;
regeneration is 35–182 s per push loop), the post-commit ratchet on every src commit, CI's Lint (92 s) and CI's
`test:checks` ratchet, and every lane's own oxlint / ratchet run (Codex made 640 oxlint calls in the 12 h audit).
**Fix:** memoize the commons reach per resolved file for the whole process (a file's answer depends only on its own
imports, so a DFS with a `Map<file, string|null>` makes it linear), stat each file once per run, and build the
authored-html checker once per program instead of per file. Target: full oxlint ≤ 45 s (type-aware share only), ratchet
measure ≤ 10 s.

## Ranked table (top 10 by saving ÷ effort first)

Frequencies, last 24 h: **680 commits** (389 touch `src/`, `lint/` or the ratchet inputs), **151 origin updates**,
117 regeneration commits, ~100 push CI runs. "Agent-h" = time a lane sits blocked; "lock-min" = time the single push
lock is held (everyone's commits wait behind it).

| # | Item | Measured cost today | Proposed fix | Expected saving | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | **Lint plugin closure walk** (above) | full oxlint 95–208 s, ratchet 73–196 s; paid by gate (oxlint + ratchet + generated), regeneration, post-commit, CI lint + test:checks, lanes | Memoize `runtimeCommonsClosure` per file; one stat per file per run; one authored-html checker per program | **~60–120 s off every push loop** (regen + gate critical path; ~150 loops/day ≈ **2.5–5 lock-h/day**); 20–65 s off each src commit's post-commit (389/day ≈ **2–7 agent-h/day**); CI lint 92 → ~40 s | S | Low: same answers, unit-test the rule on fixtures |
| 2 | **Polling loops still run** | Claude poll/wait **5.8 agent-h in the last 4 h** (231 calls): coordinator `approve_loop.py` waits (~48 calls), `until [ ! -e .git/index.lock ]` loops (12), `while kill -0 <pid>; sleep 20` and `sleep 1800` for pushes | A PreToolUse hook refuses `until/while … sleep` and bare long `sleep` in Bash, naming `scripts/proof-run.sh`, `run_in_background` and Monitor; `git commit` retries index.lock itself (a wrapper with backoff) | ~half of it, **~15 agent-h/day** | S | Low: an escape env var for the rare real need |
| 3 | **Post-commit ratchet blocks the commit** | Synchronous `git archive` + link + full `ratchet.mjs` (plugin) on every src commit: 24 s (W14) to ~70 s under today's load; advisory only, and the regeneration + gate measure the same thing minutes later | Detach it like `auto-push.sh` (result to `.git/ratchet-last.txt` + one herdr line on a rise), or drop it | **~2–7 agent-h/day** (before #1); ~0.5 h/day after #1 | S | None: the push still refuses a rise |
| 4 | **Gate waits for a browser slot** | `webkit-smoke` 14 s uncontended but **125 / 151 / 277 s** in 3 of 7 gates; `script-conformance` 7 s vs 118–131 s; webkit sits at the end of the shardfiles → vite build chain, so it was the gate's critical path in `eef319ac2` (384 s wall) | Give the push gate a reserved 5th slot (both are ≤ 5 min, headless, one at a time under the push-gate lease), or exempt the gate from the 4-browser cap | **~90 s per gate on average** (up to 260 s); ~1–2 lock-h/day | S | Low: one extra small headless browser for ≤ 5 min |
| 5 | **Gate runs inside an open `git push`** | The pre-push hook runs the whole gate while GitHub's SSH session idles: `eef319ac2` logged `Connection to github.com closed by remote host` after a 385 s gate (rc 141). A drop after a green gate repeats the whole gate | `push-main.sh` runs `vercel-tree-gate.sh "$tip"` before `git push`; the pre-push hook then finds the stamp and exits at once | Removes the failure mode (1 of 8 runs today) and 1–7 min per occurrence | S | None |
| 6 | **Layer-edges rises stall the pusher** *(needs Jake)* | 3 of 8 auto-push runs today went red on a missing or stale receipt (`nalati-grasslands → engine` 811 → 813 → 816); origin did not move **15:46 → 16:19 (33 min)**; ~81 of 117 regeneration commits/day record a rise (52 nothing else) | Stop counting standing-approved downward shard → engine/game/sdk imports in `lint/layer-edges.json` (count only upward / cross-shard edges, which are refused anyway) | ~50 regeneration commits/day, every approval stall, the coordinator's approve loop | S | Downward import growth is no longer tracked per shard (it is allowed today anyway) |
| 7 | **Coverage on every push CI run** *(needs Jake)* | Coverage instruments all 8 shards; the headless-runtime timeouts under coverage caused **36 red runs** (10-09 03:41–06:57); the `coverage` job adds a dependent hop (~30 s with queue) | Push CI runs vitest without `--coverage`; the coverage run + ratchet move to the nightly (and a milestone dispatch) | Shards faster (estimate 20–40 %, benchmark below); the timeout class of reds disappears from push CI; push CI −0.5–1.5 min | S | Coverage drops are found nightly, not per push |
| 8 | **Uneven vitest shards** | Shard times 141–354 s over 3 runs; mean 206 s, slowest 276–354 s is push CI's critical path (push CI ~5.8–6.5 min) | Custom sequencer `shard()` that packs files by recorded duration (CI uploads its `results.json`; seed from the local cache), heavy files spread first | Critical path ~276 → ~215 s: **push CI −1–2 min per run** (~100 runs/day) | S–M | Low; falls back to vitest's hash split when no durations |
| 9 | **Linux-only reds the Mac gate cannot see** | Red push CI **87 of 200 runs**; by failing file: `sim-memory-interval` 49, `hunt-brain-oracle` 23, `king-collision` 11, `goat-ram-oracle` 5, `player-board-tape` 2 (Linux x64 floats / Linux-only), plus the 36 timeouts in #7. Red windows 04:04–07:16 and 11:57–19:26 on 10-09: **~10.7 h with no releasable SHA**. `king-collision` is red again now (21:25Z: stale recorded input hash of `physics.baked.json`) | (a) The gate runs the tests that record digests under x64 Node via Rosetta (DEPLOY.md already documents the setup), selected by a `// digest` tag or by `test/proof` + `*-oracle` + `*-tape` names, when vitest selects them. (b) Input-hash records like the King bake's are re-recorded by the pusher beside the witness manifests (or derived at test time) | Push CI green-by-default: most of the 87 reds/day; releases stop stalling for hours | M | x64 Node adds ~1.5–2× to those few tests in the gate |
| 10 | **bake-check all-or-nothing cache** | 131–224 s in 5 of 7 "cached" gates: its single trace has 3,058 inputs, so any touched src file re-runs every bake | Trace and cache per bake (each `bake-*.mjs` / shard keyed by its own inputs), run only the stale ones | bake-check ~150 s → ~10–30 s typical; with #1 and #12 the gate drops toward ~60–90 s | M | A missed input lets a stale bake through to CI (CI runs the full bake-check) |
| 11 | **One red commit blocks every lane** | 5 of 8 auto-push runs today were red; commit → origin **median 20.5 / p90 52.4 min** over the last 4 h (target ≤ 2 / ≤ 5) | On a red gate, the auto-pusher re-gates the parent of the first commit whose lane the failure names (or bisects the batch) and pushes that green prefix; the rest waits for the fix | Most commits stop waiting on someone else's red | M | Pushes a prefix the full batch would have failed; CI is the backstop as today |
| 12 | **"related" vitest runs nearly the whole suite** | Batches of 2–24 commits: related on 88 changed files took 160 s; 540 of 540 files ran in `eef319ac2` (249 s); only 1 of 5 cached gates was small (17 files, 32 s) | Benchmark first: count tests selected per changed file over the last 100 commits to find the hub modules; then cache per test file by the hash of its module closure + fixtures (skip a file green on identical inputs) | Gate vitest ~170 s → ~40–60 s typical | M–L | Same backstop as today (CI full suite) |
| 13 | **Pre-commit holds index.lock 5.5–6.5 s** | 680 commits/day × ~6 s ≈ 68 min/day of index.lock held; the guards `git archive` all of `src` per commit | After #1 the guard oxlint shrinks; extract only the staged files plus what shard-coupling reads, reuse one guard export dir | ~3 s per commit, ~35 lock-min/day, fewer lock collisions | S–M | Low |
| 14 | **boot-smoke builds twice on macOS** | Each leg: checkout 32–36 s + build 57–65 s, then the drive (212 / 307 s); push → boot-green 13.2 min | Push CI's build job uploads `dist` + products as an artifact; both legs download it | ~1 min off push → boot-green; ~2 macOS job-min per push | M | The smoke tests a Linux build rather than a macOS one (same bytes expected) |
| 15 | **CPU oversubscription** | Load 40–120 on 18 cores; `fseventsd` at 110 % CPU (every gate, regeneration, guard and lane export writes ~8,000 files) | Benchmark: a 1 h `ps` sampler summing CPU-s by command; reuse persistent export dirs (update in place) instead of fresh exports | Every local step above runs 2–3× faster when load is near core count | M | Low |
| 16 | CI checkout of `public/` (670 MB of 830 MB) | 20–24 s per job × 11 jobs; the critical path pays it once (~20 s) | Drop `public/` from typecheck-lint's sparse set (and from shards whose tests never read it) | ~10–15 s per job, off the critical path | S | A test reading `public/` fails loudly |
| 17 | tsc incremental (`.tsbuildinfo`) | typecheck 7–14 s, layers 8–14 s, in parallel, never the gate's critical path | Not worth it now; revisit after #1, #10, #12 | — | — | — |
| 18 | Hook node startup | ~6 node processes per commit (4 pre-commit, 2 commit-msg) at ~0.1 s each | Not worth it | — | — | — |

### Already fine (checked)

CI `pnpm install` is 2–3 s per job (pnpm cache works); the coverage merge is 3 s; `heavy-lane` gate queue is ~0 s
since W4; the sim-lane reaper stopped at 13:36 (W7 works; `measure.py`'s 234 count is from before the fix).

## Benchmarks worth running next (cheap, before building 7, 12, 14)

1. One push-CI shard with and without `--coverage` (a `workflow_dispatch` input), to size #7.
2. Hub fan-out: `vitest related --run` dry selection per changed file over the last 100 commits, to size #12.
3. Full oxlint and `ratchet.mjs --measure` before / after #1 on an idle export (the target is ≤ 45 s / ≤ 10 s).
4. The 1 h CPU sampler for #15.

## Needs Jake

- **#6 Layer-edges:** stop counting standing-approved downward shard imports. Recommended: yes.
- **#7 Coverage:** move it from every push to the nightly run and milestone dispatches. Recommended: yes (it changes
  GIT.md's "the per-push CI node checks … coverage").
