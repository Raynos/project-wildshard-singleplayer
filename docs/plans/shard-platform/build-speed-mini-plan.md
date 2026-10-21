# Build speed: mini plan for the builder (G548)

Jake, 2026-10-20 ~19:15 Cancun: *"why did the build take so long? … We can just cut the build wall clock time down 10
times, down 90%"*. Benchmark by the plan agent's subagent on 8042d30ab3 (`check` slot, under the build lease; samples and
logs were in the session scratchpad and are not kept). Goes with G547 (2 builds at a time, 5 check slots).

## What the benchmark found

The ruler command (`node scripts/shard-platform.mjs --json --source-progress`) took 204 s and then 282 s of real work on
the same commit, and almost none of it was cached: all 11 shards rebuilt one at a time in both runs, and generation re-ran
17 and then 123 of 242 jobs. CPU contention is only 10–25 % of it: per-shard times barely changed between load 14 and
load 80, and the build never used more than 1.8 of 18 cores. The real waits tonight were the queue for the single build
lease (9–22 min) and serve-builds ahead of the ruler rebuilding everything too.

| Phase | Wall s (run 1 / run 2) | Cached? |
|---|---|---|
| `gen.mjs --proof` | 70 / 148 | No: 17 / 123 of 242 jobs re-ran; checking the hits cost 57 / 207 job-s of hashing |
| `build-shardfiles` (11 shards) | 114 / 112 | No: 0 of 11 reused; serial, one node process (blender-template 17–20 s, nine 17 s, others 6–10 s) |
| Measurement (`countOutput`) | 18 / 18 | No: the parse cache is never switched on |

## Rows

| Row | What | Code | Saves (est.) |
|---|---|---|---|
| **B1** | **Reuse shard products.** Key each shard only on the files its build actually reads, not every shared file (150 of 171 commits in 6 h touched shared code). Use one set of flags everywhere: the ruler's `--copy-runtime` for the 7 closed shards means serve-build and gate products never serve it. Commit gen's three always-stale outputs (`budgets/ceiling-sources.json`, `lint/ask-ids.json`, `src/game/shard/slugs.generated.ts`). Keep the ~2.4k untracked generated files out of the key | `scripts/build-shardfiles.mjs:74`, `:88`; `shardfile-cache.mjs` `treeHashes` / `shardfileKey` | ~105 s |
| **B2** | **Build shards in parallel**: a pool of ~6 child processes instead of awaiting one shard at a time (108 s becomes about the slowest shard, ~20 s) | `scripts/build-shardfiles.mjs:57` | ~85 s whenever any shard misses |
| **B3** | **Generation keys and hashing.** One in-process memo of input hashes, plus a stat memo like `treeHashes`, instead of reading and SHA-256-ing every input twice (~178k reads, 11 GB per `gen`, doubled). Leave other jobs' registered outputs out of a job's whole-folder inputs (162 jobs take `src/sdk`, `src/engine`, `src/game` or `src/shards/<slug>`) and key on the upstream jobs' keys instead, so a key doesn't depend on what the slot built before. Find why the driftwood chain (driftwood-trail-specimens alone is 25 s) regenerates on every `gen` | `scripts/generate.mjs:64-78`, `scripts/generation-cache.mjs:41-43` | 65–145 s |
| **B4** | **Measure once**: share one parse across the three `countOutput` calls (Lines and Inventory differ only in `includeSources`), and set `WS_SHARD_PARSE_CACHE` | `shard-output-report.mjs:50`, `:52`; `shard-platform-cli.mjs:37`; `shard-platform.mjs:667` | ~13 s |
| **B5** | Run the leased build at nice 0, not `nice -n 10` (worth 10–25 % under heavy load). Spotlight: Jake is excluding all of `~/projects/games` (the `.metadata_never_index` file no longer works on recent macOS) | `scripts/heavy-lane.py:323` | a few s to 25 % |
| **B6** | Acceptance: on a commit that touches neither `src/sdk` nor `src/format`, the ruler command runs in ≤ 15 s of wall time; on one that does, ≤ 35 s; a no-change rerun regenerates 0 jobs and rebuilds 0 shards. Report both numbers to the plan agent | | |

**Floor:** B1 + B3 + B4 give about 10–20 s (10–20x) for the ~80 % of commits that don't touch `src/sdk` or `src/format`.
A real SDK or format change must rebuild all 11 shards, so with B2 the floor is ~30 s (~7x). Getting below that means
profiling the slowest shard builds themselves (blender-template, nine-dragon-stack), which the benchmark didn't do.
