# pnpm gen speed: mini plan (TOOLING-PERF mini plan; runs as a SHARD-PLATFORM extra, G647)

**State:** `draft` 2026-10-23 — audit + benchmark by a plan-agent subagent; decisions for Jake below. The [generators redesign](generators-spike-mini-plan.md) (G654: one program per shard, catalogue deleted) replaces the job graph long term; rows here that only tune today's catalogue (G5–G7, G10) shrink to what still applies once GR2 lands. G1, G2 and G9 are quick wins regardless. G8 is covered by G654/GR0 and G649.

Jake, 2026-10-23: *"a separate mini plan, audit, benchmarks, pnpm gen"*. Benchmark 2026-10-23 00:44–01:45 Cancun on
`7c8e3b33a2`, mirror slots check2 (warm) / check3 (cold), every run under `heavy-lane build` (taskpolicy utility),
machine load 19–31 on 18 cores. Harness (scratch, `harness/` next to this file) = a step-timed copy of
`scripts/gen.mjs` (same steps, same order), a 1 s process-tree CPU sampler, `/usr/bin/time -l`.

## Inventory

`scripts/gen.mjs` runs, in order: discovery refresh; 4 starter tables + decision policies (<0.01 s); **generation**
(`prepareGeneration`: 268 catalogued jobs, 250 admitted = run by gen; portable 213 / native 44 / darwin 7; 6 browser);
format JSON schemas; `genShards` (discovery/closure tables, run twice); ask ids; boot tables (`vite/gen.ts`); budgets;
then derived docs only in full mode: `gen-api` (docs/api, full TS program), `gen-host-catalogue` (TS program, writes
the 15 MB `lint/host-catalogue.generated.json`), `webgpu-inventory`, `liveness --readme`, `generator-inventory`; then
`push-post-inputs` sealing (hashes every tracked source + copies every generated table into `.cache/push-post-blobs`).

Caching that already exists: per-job content-addressed cache `~/.cache/wildshard/generate` (8.1 GB, shared by slots;
CI restores it via actions/cache), observed-read narrowing (`.reads-v1`, keyed by a "recipe" that includes the full
input-file inventory), a per-slot phase snapshot (`.cache/generation-phase.json`, all-or-nothing), a stat memo of input
hashes, the Node portable compile cache. Concurrency: **plain `pnpm gen` = 1**; `--parallel/--proof/--build-inputs` = 4;
hard cap 4. Nothing after the generation step is cached.

Who reads outputs: build/runtime read the admitted build outputs (2,874 files) and the boot/shard tables; typecheck reads
every `*.generated.ts` and every statically imported `*.generated.json` (463 import sites, 454 of them in
`src/shards/*/generators/`, 8 shard runtime, 1 game; 224 distinct files, 127 MB); tests read both; **docs/api, scripts/
README.md, webgpu inventory, generator-inventory.md and lint/host-catalogue.generated.json are read by no code** (humans
and agents only).

## Benchmark (concurrency 1 unless noted; seconds)

| Run | Wall | Jobs regenerated (job-s) | Generation | Tail after generation |
|---|---|---|---|---|
| A slot as found (0 outputs, shared cache warm) | 286 | 19 (152) | 161 | 125: host-catalogue 38, api-docs 34, generator-inventory 20, boot 11, push seal 7 |
| B no change, right after A | **67** | 0, phase snapshot | 1.1 | 65: generator-inventory 23, host-catalogue 18, api-docs 7, push seal 7, boot 4 |
| C one Nalati generator file edited | 250 | 66 (210) | 215 | 35 |
| B2 same file restored to exact bytes | 233 | 13 (162), nalati-map-assembly 83 | 175 | 58 |
| D one engine file read by 33 jobs (core/noise.ts) | 421 | 99 (384) | 395 | 26 |
| D2 engine file no generator should need (ui/Loading.ts) | 209 | 34 (135): nine + driftwood | 139 | 70 |
| B3 no change | 53 | 0, phase snapshot | 1 | 52 |
| F slot memos deleted, shared cache warm, c4 (after the cold runs) | 427 | 164 (1,511) | 391 | 36 |
| E cold, concurrency 4 (fresh caches) | **626** | 250 (1,840) | 486 | 140 |
| E cold, concurrency 12 (cap patched) | 503 | 250 (4,229 inflated by waits) | 446 | 57 |
| CI generated-inputs (4 vCPU, --parallel, 05:21 run) | 197 | 141 of 249 (648) | 169 | 22 |

Slowest jobs (cold c4): nine-layout 90, open-plots-world 64, nalati-species 53, nalati-rifle-rows 33, driftwood-data-map
32, nine-map-assembly 31, camp-specimen-catalogue 26, pine-data-map 26, nine-casts 24, pine-coat-pages 23. CI: nine-layout
52, open-plots-world 51, nine-casts 21, nalati/pine data-map 21.

Utilisation: the whole process tree averaged **0.3–1.1 cores of 18** in every run (cold c4 104 %, cold c12 110 %, peak
3.9). The parent process alone burned 139–143 CPU-s of the 446–486 s cold generation (synchronous stage copies,
hashing, restores in one event loop). Cold gen stages ~193k file copies / 3.9 GB of tracked inputs into `$TMPDIR` with
plain `copyFileSync` (no APFS clone), median 346 files per job, up to 2,412 files / 114 MB (nalati-dressing-plan).
Cold cache footprint: 1.9 GB for one commit.

## Why 53 s vs 134 vs 775 s

1. **c007 is real and every slot hits it**: all five check slots end with 0 accepted generated outputs. gen rewrites
   two tracked files (`lint/ask-ids.json` gains a line; `public/assets/far-reach/baked/rest-storm.glb` is a committed
   41,636 B blob but its pinned build output is 43,108 B), so build-mirror's release sees a source overlay and clears
   every generated group. The next user re-restores 2.9k outputs and loses the phase snapshot (run A: 286 s).
2. **Plain `pnpm gen` is serial** (concurrency 1, cap 4), and even at 4–12 the tree never passes ~1.1 cores: the
   single-threaded parent stages and hashes synchronously, and the whole tree runs at utility QoS behind default-QoS
   lanes (tail steps got 13–45 % of one core). Load decides the wall time.
3. **Keys are far wider than the reads.** Jobs take whole `src/engine`, `src/game`, `src/sdk`, `src/commons`, shard
   folders and `src/format`; the observed-read recipe includes the *full file inventory*, so any added/removed file
   or any non-code file (package.json exports: `src/format/package.json` changed in 48 commits since 10-21) re-keys
   them. 281–399 recipes per heavy job since 10-20, 6–11 a day. 150 of 1,842 commits since 10-21 touch an every-job
   input (generation-jobs.json 91; only 44 of 264 jobs use catalogue projection). Generators import runtime engine and
   game modules, so a UI edit (Loading.ts) re-ran 34 jobs; a Nalati-only edit re-ran nine-layout (33 s) and
   driftwood-fixed-models, which do not declare Nalati (unexplained: row G6).
4. **Cross-slot cache thrash**: `keep=3` newest entries per job, but 7 slots + main tree + CI on different commits
   make 11 live nalati-map-assembly entries in 10 minutes; restoring exact bytes still regenerated 13 jobs (162 job-s).
5. **Utility QoS costs 2.5–3x**: the same `generate.mjs --job=nine-layout --compare` took 63 / 51 s under
   `taskpolicy -c utility` and 21 / 22 s at default QoS, load ~27, back to back.
6. Suspected non-deterministic producers: run F regenerated 164 jobs against a warm shared cache once the slot held
   freshly generated (cold-run) outputs, consistent with upstream bytes differing run to run and re-keying chains.
7. Lease coalescing: run A sat idle waiting on a serve-build's `gen --proof` producing the same keys.
8. The derived-docs tail (two full TS programs + generator inventory) costs 26–125 s on every full gen, cached never.

## Proposal (rows; "done when" measured on one commit with this harness)

| Row | What | Done when | Saves |
|---|---|---|---|
| G1 | Stop c007: commit ask-ids/rest-storm or move them out of gen's writes; build-mirror refreshes the index before `diff-files` and clears only groups whose own bytes changed | every slot keeps > 2,800 accepted outputs after a gen | 100–230 s on the next slot user |
| G2 | Move derived docs (api, host-catalogue + its 15 MB JSON, webgpu, liveness README, generator inventory) out of `pnpm gen` into `pnpm docs` (CI builds them) | no-change gen tail ≤ 5 s | 26–125 s every gen |
| G3 | Memoize boot tables, both `genShards` passes and the push seal on the phase snapshot | no-change gen ≤ 5 s (today 53–67) | 10–25 s |
| G4 | Staging: `copyFileSync(…, COPYFILE_FICLONE)` (APFS clone), stage only the traced reads on a probe-hit recipe, move staging/hashing into the worker so the parent never blocks | cold tree CPU ≥ 6 cores at c12 | est. 2–4x cold generation |
| G5 | Concurrency default = cores-4 (cap 16) for every gen, longest-first scheduling (nine-layout, open-plots-world, nalati-species start first) | cold ≤ 90 s at load ≤ 10 | 400 s cold |
| G6 | Narrow keys: drop the file inventory from the recipe (keep the recorder's negative probes), replace whole-layer roots with traced modules, hash only the package.json exports entries a job resolves, catalogue projection for every job; find why nine-layout re-keys on a Nalati edit | a one-shard edit regenerates only that shard's dependants; Loading.ts edit regenerates 0 | C 215→≤20 s, D2 139→~2 s |
| G7 | Cache retention by bytes + recency (24 h, 20 GiB cap), not `keep=3` per job; drop the duplicate alias entry | exact-restore rerun regenerates 0 | B2 175→~2 s |
| G8 | Generated data is files, not TypeScript: base64-in-JSON (lightSpill 52 MB, paintArray 47, castHook 29, nalati physics 2.5 = 131 MB) becomes .bin/.glb; numeric-array JSON (mapAssembly 29/9/6/4, worldRows 3.5, modelCatalogue/rockScenes ~55 % arrays) and instance tables (floorLayout 11, dressing-stone 6, nine layout 7) become typed .bin + small JSON header; generators `readFileSync` + valibot-parse the header at run time; lint bans importing `*.generated.json` | 0 static generated-JSON imports; JSON written per cold gen ≤ 30 MB | base64 +33 % bytes and 130 MB of JSON parse/stringify; TS stops parsing 127 MB |
| G9 | gen keeps normal QoS when a human or the gate waits on it (like G562's ruler) | warm runs stop varying with load | 2.5–3x per job under load (63 → 21 s nine-layout) |
| G10 | Determinism check: regenerate each job twice from one stage and compare bytes; fix or quarantine producers whose outputs differ | 0 jobs differ; run F regenerates 0 | F 391 → ~2 s |

G8 and the job graph: caching does not change. Upstream outputs are already keyed by bytes (281c82ae57) and the
recorder traces `readFileSync` like an import, so keys and the dependency order stay as they are; JSON leaves the
TypeScript program and the module graph. Top chains (catalogue order): Sky `sky-fixed-layouts → sky-rest-scenes →
sky-world → sky-bridge-rest-rows → sky-route-scene → sky-world-rows → sky-data-map` (7); Nalati `nalati-kurgan →
nalati-bodies → nalati-species (5.8 MB) → nalati-boot-metadata → nalati-places → nalati-place-runtime (3.3 MB) →
nalati-balbal-specimen` (7); Nine `nine-layout (6.8 MB) → nine-casts (castHook 29 MB) → castSources`; Pine
`pine-floor-placements (floorLayout 11 MB) → output.ts`. 129 jobs have an explicit upstream job.

Expected after G1–G9: no-change ≤ 5 s (snapshot 1 s + memoized tables); one-shard change ≤ 20 s (G6 + G5: the
shard's critical chain only); cold ≤ 90 s (4,229 job-s inflated → ~1,500 real job-s / 14 cores + nine-layout ~50 s).
CI: G6 + projection should take a typical push from 141 to ~20 regenerated jobs (197 s → ~40 s).

## Decisions for Jake

1. Derived docs leave `pnpm gen` for `pnpm docs` + CI (recommended), or stay and get cached.
2. gen at normal QoS when someone waits on it (recommended), or stays utility and slow under load.
3. Generated JSON imports banned outright, binaries become .bin/.glb (recommended), or only the > 1 MB files move.
4. Default concurrency cores-4 (recommended), or a fixed 8.
