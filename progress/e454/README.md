# E454: fast pre-commit, pre-push and CI (wall clock)

Jake: *"Git push must be fast. Like max 2 minutes the pre push. … All pre push and GitHub actions CI must be fast also
pre commit."* Targets: pre-push ≤ 2 min wall, pre-commit ≈ ≤ 20 s, CI ≤ 5 min to green.

Measured on the shared M5 Max (18 cores) with other agents running (load 7–13), so single numbers carry ±10 %.

## 1. The custom lint rules (commit 1)

Profiling the ratchet's oxlint pass (`node --cpu-prof`) showed 70 % of it in `checkerFor` (`lint/authored-html.mjs`):
the program was built from the files that contain a sink word, but the rule also sends every file with a call named
`write` / `writeln` / `assign` (all of `Object.assign`); such a file was missing from the cached program, so each one
rebuilt the whole TypeScript program. The program now holds every candidate file up front (and a rebuild reparses only
changed files). The next 14 % was `lint/commons-closure.mjs` rereading each file and `package.json` on every import
walk; the caches now validate by size + mtime. Same 426 diagnostics, byte for byte.

| step (wall, s)                                  | before | after |
| ----------------------------------------------- | -----: | ----: |
| ratchet oxlint pass (`lint/ratchet.mjs`)         |   50.7 |   7.9 |
| full type-aware `oxlint`                         |   54   |  15.9 |
| post-commit hook (ratchet on the commit's tree)  |   54   |   9.6 |
| regeneration check (`ratchet.mjs --measure` inside) | 57  |  17.0 |

## 2. The pre-push gate runs its steps in parallel (commit 2)

`scripts/vercel-tree-gate.sh` ran 25 steps one after another. Two fixes:

- the Vercel file list was filtered with `grep -vxFf` over 10 125 ignored paths: **41 s** of BSD grep, now an `awk`
  hash lookup (0.0 s);
- after `platform-ratchets` and `gen` (which write what the rest read), every independent step starts at once; the
  build chain (shardfiles → vite build → check-devserver → check-chunks → shard-platform) is one ordered job (vite
  build writes nothing in the tree after gen: checked with `find -newer`). The generated-outputs check runs beside the
  export instead of before it.

Every check still runs; none moved to CI. Per-step wall seconds (`run` prints them). "Before" is commit 0 (`771adbf80`,
serial, before §1); "after" is `134b418c1` + this gate, parallel (each step's time includes contention with the others).

| step                    | before (serial) | after (parallel) |
| ----------------------- | --------------: | ---------------: |
| generated-outputs check |              57 |               39 |
| export (file list)      |             ~43 |               ~1 |
| platform-ratchets + gen |               1 |                2 |
| check-css · gen-check · shard-coupling |   3 |             1–4 |
| typecheck ×4            |               5 |              0–4 |
| oxlint                  |              54 |               34 |
| ratchet                 |              57 |               33 |
| audits + liveness       |               2 |                4 |
| bake-check              |              23 |               50 |
| vitest (full, 783 files) |             ~56 |               60 |
| script-conformance      |               1 |                3 |
| shardfiles → vite build → checks → shard-platform | 8 | 17 |
| **gate wall**           |     **~300** (+57 check) |      **64** |

Pre-push total = the regeneration in `push-main.sh` (~17 s) + the upload + the gate (64 s): **~1.4 min**, down from
~6–7 min idle and 12–15 min under load. The critical path is now the full vitest run (60 s).

## 3. Pre-commit

Measured on a one-file `src/` commit through a private index:

| hook                                   | before | after |
| -------------------------------------- | -----: | ----: |
| pre-commit (generated, graph, asks, architecture guards) | 2.6 | 2.6 |
| post-commit ratchet (blocks the commit until it returns) | 54 | 9.6 |
| **commit overhead**                    | **~57** | **~12** |
