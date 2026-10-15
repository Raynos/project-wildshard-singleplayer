# Disk and boot-temp audit, 2026-10-15 11:05

The localai `ssd-monitor` agent wrote this read-only audit. It changed and deleted nothing. Background:
`~/projects/dotfiles/disk/README.md` (the boot hang, the build mirror, the storage policy) and
`docs/process/MACHINE.md`. This file covers only what is still open after this morning's fixes.

## State right now

| | Value | Verdict |
|---|---|---|
| SSD | 1.9 TiB used, 1.8 TiB free (52%) | Fine. Space is not the problem |
| Boot purge (`/private/tmp` + `$TMPDIR`) | **50,991 files** (9.7k + 41.3k) | Under the 500k warning, but it is growing again (finding 1) |
| `~/.cache/wildshard/generate` | **354 GB, 1,153,713 files** | Not swept at boot. It is the biggest single thing on the SSD (finding 3) |

Uptime at the time of the audit: 5h24m. So everything in `$TMPDIR` below was written since this morning's boot.

## 1. Vitest leaks about 2,700 files into `$TMPDIR` per run (OPEN, the main boot risk)

`$TMPDIR` held 35 directories named like nanoids (`2Oad3Lqp4fBXn0o3PUupS`, 21 chars). Each holds `ssr/` (sometimes
also `client/`) with SHA1-named files of Vite-SSR-transformed wildshard modules, e.g. `__vite_ssr_exportName__("DRIFTWOOD_TERRAIN" …`.
Each one is up to about 2,670 files and 71 MB.

- **Source:** `node_modules/vitest` **5.0.1**, `dist/chunks/index.DzobfTyw.js`. The project class sets
  `this.tmpDir = join(tmpdir(), nanoid())` (line 12021) and the top-level Vitest class sets
  `_tmpDir = join(tmpdir(), nanoid())` (line 20431). Both are passed to `createFetchModuleFunction` as its module cache.
  The only `rm` is `await rm(this.tmpDir, …)` for the project dir (line 12288). Nothing removes the top-level `_tmpDir`.
  A killed or timed-out run leaks the project dir too.
- **They are orphans:** `pgrep -f vitest` found 0 live Vitest processes, and 35 directories were on disk.
- **Rate, by the hour each directory was last written:**

  | Hour | Dirs | Files |
  |---|---|---|
  | 06 | 3 | 0 |
  | 07 | 6 | 1,580 |
  | 08 | 7 | 5,489 |
  | 09 | 2 | 2,666 |
  | 10 | 17 | **19,783** |

  That is about 30k files in 5 hours, about 20k of them in the last hour. With seven Codex agents and two Claude
  agents running tests, this reaches the 500k warning in about a day at the last hour's rate (about 3 days at the 5-hour average) and millions within a week. That is the same failure
  as before; the source has moved from tar exports to Vitest.
- **Fix (the repo rule already says scratch goes under `./tmp`):** run Vitest with `TMPDIR="$PWD/tmp/vitest"`.
  Node's `os.tmpdir()` reads `TMPDIR` at call time. **It has to be set before Vitest starts**: both `_tmpDir`
  fields are class-field initializers, evaluated when Vitest constructs, which is before `vitest.config.*` loads.
  Setting `process.env.TMPDIR` inside the config is therefore too late for the top-level dir. Put it in the
  `package.json` test scripts, or in a `scripts/vitest` wrapper that agents are told to use. Bare `npx vitest`
  bypasses both, so also:
  - sweep `./tmp/vitest` entries older than an hour from the pre-commit hook (it is now in-repo and cheap), and
  - file it upstream: the top-level `_tmpDir` is never removed.
- rockhop is on Vitest **3.2.7**, so check it separately before copying this fix there.

## 2. Node compile cache: now the biggest live writer (OPEN; found 11:48)

At 11:05 `$TMPDIR/node-compile-cache` held 9,399 files. **At 11:48 it held 284,105**, and 33,244 of them were written in
the last 5 minutes. That is about **400k files an hour**, and it put the boot purge at 369,676 files in total.

- **Who turns it on:** `vite`, `vitest`, `typescript` (tsc) and `rolldown` in wildshard's `node_modules` all call
  `module.enableCompileCache()` (also npm and corepack globally). With no `NODE_COMPILE_CACHE` set, Node uses
  `$TMPDIR/node-compile-cache/v24.18.1-arm64-…`.
- **Why so many:** Node keys the cache by file path. `scripts/generate.mjs:143` copies the source into a fresh
  `mkdtemp($TMPDIR/wildshard-generation-XXXXXX)` for **every generation job**, so every job compiles every module at a
  never-seen path and writes a full set of entries that are never read again. There were 46 `generating-*` jobs live at
  11:48. (`scripts/generation-clean-room.mjs:39` does the same with `wildshard-clean-room-`.)
- **Why today's fix hasn't helped yet:** dotfiles `918fa2d` (10:59) sets
  `NODE_COMPILE_CACHE=$HOME/Library/Caches/node-compile-cache`. But every agent started before 10:59, and every child
  it spawns, still has the old environment: the new folder had **0** files at 11:48. Even when it does take effect,
  this churn then fills `~/Library/Caches` at the same rate. That doesn't block boot, but it is still 400k files an hour.
- **Fix in wildshard (the real one):** set `NODE_DISABLE_COMPILE_CACHE=1` in the environment of every child that
  `generate.mjs` / `generation-clean-room.mjs` run inside a throwaway copy. A cache keyed on a path that is used once
  can only miss. Tools run from the stable checkout or the mirror slots can keep it.
- **Stop-gap for the machine (needs Jake; dcg blocks agents from `mv` under `/var` and `$HOME`):** move the existing
  folder out of the boot purge and leave a symlink, so running writers follow it without a restart. **Done 12:04:**
  `$TMPDIR/node-compile-cache -> ~/Library/Caches/node-compile-cache-from-tmpdir`. The boot purge fell from 389k to
  70k files, and new writes land in the target (9k in the first minute). The churn itself goes on until
  `NODE_DISABLE_COMPILE_CACHE` lands; it now fills `~/Library/Caches` instead. Delete that folder once agents have
  restarted.

## 3. `~/.cache/wildshard/generate`: what it is, and can it be nuked

**What it is:** the content-addressed output store of `scripts/generation-cache.mjs`
(`WILDSHARD_GENERATE_CACHE`, default `~/.cache/wildshard/generate`; see `docs/process/GENERATION.md`).
The layout is `<job>/<sha256 key>/` plus `public/` and/or `src/…`. That is the job's **output** tree, e.g.
`src/shards/nine-dragon-stack/assets/<hash>`, not a source copy. The key hashes every input file, the tool identity
and the Node version, so **every edit to any input of a job makes a brand new full-size entry**, and
`generation-cache.mjs` has **no eviction**: its only `rmSync`s are for locks and staging.

| Job | Size | Entries |
|---|---|---|
| `nine-layout` | **225 GB** | 1,285 (about 180 MB each) |
| `driftwood-fixed-models` | 27 GB | 742 |
| `pine-coat-pages` | 23 GB | 858 |
| `pine-timber-world` | 21 GB | |
| `pine-cabins` | 7.4 GB | |
| `nalati-bodies` | 6.5 GB | |
| `pine-crags` | 6.4 GB | |
| `driftwood-island-dressing` | 5.7 GB | |

`nine-layout` entries by day: 2 on 10-10, **764 on 10-13**, 489 on 10-14, 30 on 10-15. That is iteration churn from the
Nine Dragon tile work (`sp-x8`).

**Can it be nuked? For correctness, yes. Not right now, and not wholesale.**
- It is a cache. A cold job regenerates in isolation, admitted `buildOutputs` carry pinned SHA256s, and the
  clean-room check rebuilds "with runtime/legacy/cache/all-output deleted" (GENERATION.md lines 8-12, 155-158).
  Nothing in git depends on a specific old entry.
- **Not now:** 18 `generating-*` staging dirs are live, so jobs are writing into it at this moment. Deleting
  under them makes those jobs fail.
- **Cost of a full wipe:** the next `pnpm gen` (Vercel, CI and the push gate's export) regenerates every admitted job
  cold (Sky goat/Roc rigs, Nalati bodies, Pine cabins, Signal grain tile) before it can build. That costs time, not
  correctness.
- **The real fix is eviction.** Only the current key per job is ever read again. Add a prune to
  `generation-cache.mjs` (or a `scripts/generation-cache-prune.mjs`) that keeps, per job, the key(s) for the current
  inputs plus the newest N (say 3) and deletes the rest, skipping any key with a live lock. Run it after each
  generation and from cleanup-disk. That alone should take this from 354 GB to a few GB.
- It is **1.15M files**, but it lives in `~/.cache`, which macOS does not sweep at boot. So it is not a boot risk;
  it costs space and makes `du`/Spotlight/backup crawls slow.

Siblings, same idea and smaller: `~/.cache/wildshard-parity` 14 GB, `~/.cache/wildshard-gpu-perf` 3.1 GB.

## 4. Tooling gaps found on the way

- **`audit-disk` / `cleanup-temp` / `cleanup-disk` are not on `$PATH`.** They live in `~/projects/dotfiles/bin`,
  which is not on `$PATH` (`audit-disk: command not found`). `node-global-doctor` works only because it is in
  `~/bin`. The routine in `dotfiles/disk/README.md` (`audit-disk temp` before a restart) fails as written. Either
  put `dotfiles/bin` on `$PATH` or symlink these three into `~/bin`.
- **`cleanup-temp` defaults to `--hours 24`,** so it skips everything from finding 1, which is all under 5 hours old.
  Before a same-day restart, use `cleanup-temp --hours 1`. Its `lsof +D` check already protects live runs. Or have it
  treat `^[A-Za-z0-9_-]{21}$` dirs with `ssr/` inside as Vitest caches, deletable once no `vitest` process is alive.
- **Threshold (decided by Jake, 2026-10-15): the warning is at 500,000 files.** `scripts/boot-temp-warn.sh` already
  uses `limit=500000`. `dotfiles/disk/README.md` and `dotfiles/bin/audit-disk` now say 500,000 too, replacing the
  earlier "keep well under 100,000".

## 5. Where the rest of the SSD goes (context, nothing urgent)

| Path | Size | Note |
|---|---|---|
| `~/projects/weights` | 402 GB | the canonical model byte store (localai) |
| `~/.cache` | 383 GB | 354 GB of it is finding 3 |
| `~/Library` | 283 GB | not broken down in this audit |
| `~/projects/localai` | 77 GB | |
| `~/ml` | 72 GB | |
| `~/.codex` | 56 GB | Codex sessions; several rollouts are 0.5-0.7 GB each |
| `~/projects/game-demos` | 45 GB | |
| `~/projects/house-blender` | 41 GB | "not audited yet" per the dotfiles README |
| `~/projects/games/rockhop` | 39 GB | `.git` 38 GB; Jake's call per the dotfiles README |
| `~/projects/games/wildshard-singleplayer` | 35 GB | |

## Decisions (Jake, 2026-10-15)

- **Boot-purge warning: 500,000 files.**
- **Generation cache:** eviction, which another agent is already building. Do not wipe it.
- **Vitest leak:** set `TMPDIR=./tmp/vitest` in the test scripts / a `scripts/vitest` wrapper, plus a pre-commit sweep
  of `./tmp/vitest` entries older than an hour. Check rockhop's Vitest 3.2.7 before applying it there.
- **Disk tools on `$PATH`:** symlink `audit-disk`, `cleanup-temp` and `cleanup-disk` into `~/bin`. Done by the audit agent.

## Suggested order

1. Vitest `TMPDIR` fix (finding 1). It is the live regression of the boot hang.
2. Generation-cache eviction (finding 3). It is the biggest win in bytes, so run it once while no jobs are generating.
3. Put the dotfiles disk tools on `$PATH`, and make `cleanup-temp` catch same-day Vitest dirs (finding 4).
