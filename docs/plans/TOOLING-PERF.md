# Plan: TOOLING-PERF — CI, tooling, build, TypeScript, lint and test mega performance

**State:** `draft` 2026-10-23 — named by Jake (*"the CI and tooling and build TypeScript lint test mega performance
plan"*); a skeleton from the plan agent, to be filled by a drafting subagent from the benchmarks below. Nothing is worked
under this plan until Jake says go; the SHARD-PLATFORM rows already decided (G609, G610/G612, G620, G627, G628, G634)
keep landing there meanwhile and move here when this plan starts. Decisions stay in
[shard-platform/decisions.md](shard-platform/decisions.md) until this plan has its own. Absorbs
[BUILD-SPEED](BUILD-SPEED.md)'s open waves (3–5) when it starts.

Jake, 2026-10-23: *"We probably need a separate plan for just like fucking fixing all this shit … a draft plan for the
future."*

## What we know (2026-10-22/23)

- **CI** (deploy workflow): job time median 25.6 → 16.9 min after G609 work; push → verdict ~19 min; target ≤ 10.
  22 of 28 afternoon runs red; 122 red runs in 48 h, at least 79 of them cheap tests a working push gate would catch
  ([CI red causes](https://claude.ai/artifact/RR6Lb9JRJ6TeGuLtyW8SQK), G627).
- **Push gate** (45 s): median 3.6 s used; 67 % of pushes skip tests (no generated inputs); the liveTests filter excludes
  18 of the 20 most-failed files (G627 fixes; G628: fill the 45 s).
- **Pre-commit**: type-aware oxlint on staged files capped at 5 s, 759 files deferred; G634: fast lint only.
- **TypeScript 7.0.2** (Go) already in use: full check 62.6 s, **10.2 GB** peak; incremental re-checks nearly everything
  (49 s / 10.2 GB after a one-file shard edit); the shards project is 4,755 files / 2.57 M lines (~2.8 GB to load);
  the layered build fails with 7 TS2589 errors at HEAD. Benchmark running.
- **oxlint 1.83 + oxlint-tsgolint 7** (type-aware lint builds its own TS program): CI ~11 runner-minutes. Benchmark running.
- **Build / machine**: `pnpm gen` ~134 s in a mirror; 3 build leases and shared previews (G620); 5-minute fail-fast waits,
  pooled check slots, batch-check deleted (G610/G612); build leases were the afternoon bottleneck.
- **Tests**: behaviour tests split 10–16 ways on CI; product/producer tests need `build-shardfiles` (7–75 s each).

## Goals (draft, for Jake to confirm)

1. Full TypeScript **and** typed lint of the whole repo before push, inside the gate, warm (G627 D4).
2. TypeScript under ~2 GB and ~15 s warm locally; fast lint (no types) in seconds, always on pre-commit.
3. CI ≤ 10 min push → verdict, green main (fix forward 30 min, then revert, G620).
4. `pnpm gen` and product builds cached by input hash, locally and in CI.
5. No lane waits more than 5 minutes for anything (G610), and no lane runs checks the gate already runs.

## Rows (to be drafted)

Filled from the TypeScript benchmark (program composition, generated files, project references, isolatedDeclarations,
incremental per workspace), the oxlint benchmark (fast vs typed commands, expensive rules, pre-commit), the CI red-causes
audit and the 4-hour impact audit ([pipeline impact audit](https://claude.ai/artifact/DmiASsv71UjtkEeac8p9pH)).

## Mini plans inside this plan (G634)

- **TypeScript speed** — benchmark running (TS 7.0.2 already: 62.6 s / 10.2 GB full; incremental re-checks nearly
  everything; shards project 4,755 files / 2.57 M lines, mostly generated). Becomes `tooling-perf/typescript-mini-plan.md`
  with Jake's picks: generated data out of the type program, per-workspace project references + real incremental,
  isolatedDeclarations / explicit boundary types (**approved, G644**: add the engine's 786 explicit types and turn it on, then the other layers), the 7 TS2589 sites, generated JSON never read (G643).
- **oxlint speed** — benchmark running (typed full lint 47 s / 12.7 GB; a 1-file typed run 4.1 s / 3.1 GB; 5 files 5.1 s).
  Becomes `tooling-perf/oxlint-mini-plan.md`: `lint:fast` (no types) always — pre-commit on affected files (G636) and the
  push gate; `lint:typed` at the push gate (changed files + importers) and CI; expensive rules dropped or moved to CI.
- **`pnpm gen` speed** (Jake, 2026-10-23: *"a separate mini plan, audit, benchmarks, pnpm gen"*) — benchmark running (gen took 134 / 312 / 775 s in mirror slots; 229 generated JSON = 106 MB, 86 generated .ts). Becomes `tooling-perf/gen-mini-plan.md`: per-job input-hash cache shared across slots and CI, parallel jobs, drop unread outputs, typed .d.json.ts next to big JSON. Targets: warm no-change ≤ 5 s, one-shard change ≤ 20 s, cold ≤ 90 s.
- **CI / push gate / pre-commit** — decided (G609, G610/G612, G620, G627, G628, G636); building under SHARD-PLATFORM now.
