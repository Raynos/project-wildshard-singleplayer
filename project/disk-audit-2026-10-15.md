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

## 2. Node compile cache: now the biggest live writer (FIXED in a53e2ac231; found 11:48)

> **2026-10-21 12:47 update.** The stop-gap symlink is gone. At 11:03 something removed
> `$TMPDIR/node-compile-cache` and a real directory replaced it. At 12:47 it held 2.4k files (458 MB), which is fine,
> because `generate.mjs` (a53e2ac231) and the SDK copy tests set `NODE_DISABLE_COMPILE_CACHE=1`, and `vitest-tmp.ts`
> points the cache into its own run dir. Even so, the parked copy at `~/Library/Caches/node-compile-cache-from-tmpdir`
> had grown from 312k files at the move to **473k files (30 GB)** by today: writers other than generation kept filling
> it. Nothing writes there any more, so it can be deleted (Jake's job). The 4-hourly check now tracks the new
> `$TMPDIR/node-compile-cache` directly.

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

## 6. 2026-10-17 16:47 check: wildshard `./tmp` +11 GB in 4 h, `$TMPDIR` 7.2 → 13 GB (OPEN)

The boot purge is fine at 153k files. These are disk findings.

- **`wildshard-generation-*` copies leak into `$TMPDIR`:** there are **70** of them (4.6 GB, 42k files; there were 2 on
  10-15). They are spread from 10-16 21:00 to 10-17 14:00, none are held open, and no `scripts/generate` process is alive.
  `generate.mjs` removes the copy in a `finally` (line 191), so these come from jobs that were **killed** (SIGKILL or an
  outer timeout skips `finally`). Fix: put the copy under `./tmp/generation/` (the repo's scratch rule) and have
  `generate.mjs` sweep its own `wildshard-generation-*` entries older than an hour at startup when no lock holds them.
- **Instruments traces in `$TMPDIR`: 5.9 GB** in 6 `instruments*.ktrace` files (3.3 GB, 1.2 GB, 945 MB, …, 10:54–16:37).
  They come from the frame-floor xctrace runs (`progress/frame-floor/sim-road-part6/7-2026-10-17`). No xctrace is running,
  so these are leftovers. Few files, so no boot cost, but xctrace leaves its raw `.ktrace` behind after exporting.
  Delete it after each recording, or record with `--output` under `./tmp/<task>`.
- **`./tmp` 25 → 36 GB (222k files):** `build-mirror` 26 GB (`check2` grew 4.7 → **7.7 GB**; all 5 slots `check`,
  `check2`, `check3`, `commit` and `gate` are still present). New per-agent scratch over 1 GB: `sp-x5-z2` **2.5 GB**,
  `elites-cold-generation-20261017T153442-44564` 1.7 GB, `sp-x1-road8` 1.6 GB, `sp-x7-deploy` 1.3 GB, `sp-x7-ci8` 1.1 GB.
  They are in the right place, but nothing deletes them when the task ends.

## 7. 2026-10-18 00:47 check: `./tmp` 36 → 56 GB in 4 h, from preview builds (OPEN)

The boot purge is fine at 171k files. `./tmp` went 240k → 313k files and the repo went 55 → 75 GB.

- **`serve-build` previews are the growth: about 22 builds of roughly 1.5 GB each, about 25 GB in total.**
  - Top-level `tmp/serve/`: 7 builds, 10.5 GB (`20261017-225022-4403` … `20261018-004547-4402`).
  - **Nested inside mirror slots:** `tmp/build-mirror/check/tree/tmp/serve/` has 12 builds (**9.6 GB**) and
    `check3/tree/tmp/serve/` has 3 (5.5 GB). A preview started from inside a mirror slot resolves `./tmp` to the
    *slot's* tree, and the slot's `git read-tree -u` sync never removes untracked files. So they pile up out of sight,
    and that is why `check` doubled from 7.6 to 14 GB.
- **9 `vite preview` servers are alive** (ports 4400–4410), one per build. About 13 of the 22 builds have no server.
  Nothing stops a server or deletes its build when the agent that started it moves on.
- `check3/tree/tmp/vitest` holds 276 MB: the Vitest TMPDIR fix also writes inside the slot when tests run there.
- **Fix:**
  1. Resolve serve and scratch output against the **main checkout's** `./tmp`, never a slot's tree.
  2. Have `serve-build` keep at most N builds (say 3), stop the server and delete the build of any older one, and
     delete builds whose port has no listener.
  3. Have the mirror sync clean ignored scratch (`tmp/`) inside each slot tree before reuse.

## 8. 2026-10-21 00:47 check: `./tmp` 37 → 61 GB in 8 h, from 12 lanes at once (OPEN)

The boot purge is fine at 93k files. Since 10-20 16:47, `./tmp` went 233k → 407k files and the repo went 65 → 82 GB.
Load average was 193 at the time of the check. Twelve agents were live: `sp-x1`, `x6`–`x9`, `sp-o1`–`o5`, `wildshard-new`
and `wildshard-v`.

- **Fixes 1 and 2 from section 7 look landed.** No serve builds are nested inside slot trees, and `serve-build` evicts
  per session. Concurrency still adds up: 6 previews were in flight at once (4 serving, 2 building), about 1.9 GB each,
  so `tmp/serve` was 7.7 GB and would reach about 11.5 GB.
- **Mirror slots: 7 (G547), 33 GB in total.** `check4` and `check5` were created at 19:38 and 19:55 on 10-20, and each is
  already 3 GB. The heaviest are `gate` at 7.1 GB and `check3` at 6.8 GB.
- **New: private cache copies per lane.** `tmp/sp-x6-cache/sdk-case-5d228d/` (3.6 GB, 24k files, created 10-20 20:04)
  holds its own `generation-cache/` (1.9 GB) and `product-cache/` (1.2 GB) for a single `src/sdk/sourceReader.ts` case.
  It duplicates `~/.cache/wildshard/generate` and nothing evicts it. `tmp/o12/dev` (2.0 GB, created 22:55) is a
  similar per-lane dev output, written by `tmp/o12/pine-gl.sh` and `serve-build --name o12-pine` on slot `check5`.
- **`$TMPDIR` is still leaking generation copies:** 99 `wildshard-generation-*` directories (up from 78 on 10-20), with
  no generate job running.
- **Fix:** put lane scratch under a lane folder that is deleted when the lane closes, and give lane caches a size cap,
  or point them at the shared cache. The killed-job `finally` gap in section 6 is still open.
- **04:47 follow-up: `tmp/sp-x6-cache` 3.6 → 17.8 GB.** It now holds one `sdk-case-<rev>/` folder per revision
  tested against `src/sdk/sourceReader.ts`: 7 so far (10-20 23:57 to 10-21 03:17), each 1.8–3.2 GB, with its own
  generation and product caches. No tracked script makes them (`grep sdk-case scripts` is empty), so this is the lane's
  own tooling. Nothing deletes an old revision's folder, so the lane's `./tmp` grows by about 2.5 GB per revision.
  Overall, `./tmp` went 61 → 80 GB and 407k → 534k files, and the repo is now 102 GB. Disk still has 1.7 TB free.
  **Fix:** keep only the newest `sdk-case` per lane, or share one cache across revisions; the store is content-addressed.

## 9. 2026-10-22 00:47 check: nested serve builds are back, `check2` 5 → 23 GB (OPEN)

The boot purge is fine at 148k files. Since 10-21 20:47, `./tmp` went 72 → 92 GB and 507k → 607k files, and the repo
went 94 → 112 GB.

- **`tmp/build-mirror/check2/tree/tmp/serve/` holds 13 serve builds, 17.6 GB in total.** They were built between 10-21
  21:28 and 10-22 00:11, about 1.4 GB each. **None of them is served or held open**: both live `vite preview` servers
  serve from the main `tmp/serve`, and `lsof` finds nothing inside the nested directory. So section 7's fix 1 holds for
  some callers but not this one.
- **Cause:** `scripts/serve-build.sh:26` sets `REPO="$(cd "$(dirname "$0")/.." && pwd)"`, and line 33 builds `BASE` from
  it, defaulting to `$REPO/tmp/serve`. A caller that runs the **slot tree's own copy** (`scripts/serve-build.sh`
  relative to a `check2/tree` cwd, as `build-mirror run … --slot check2 -- bash scripts/serve-build.sh` does) gets the
  slot tree as `REPO`. The eviction on line 61 only removes `"$REPO"/tmp/serve/?*` and runs per invocation, so builds in
  a slot tree are never evicted by a run from the main checkout, and the slot's own runs don't clean them up either.
  The build logs show the `heavy-lane` queue and generation, which matches an `sp-o5` lane (`tree/tmp/gen-sp-o5.log`).
- **Fix:** have `serve-build.sh` resolve `BASE` to the **main checkout** even when it runs from a mirror tree. For
  example, `build-mirror run` could export `SERVE_BUILD_DIR=<main>/tmp/serve`, or the script could detect
  `*/tmp/build-mirror/*/tree` and step out. Also make the mirror sync clean `tree/tmp/` (section 7 fix 3, still open).
- Section 8 is unchanged: `tmp/sp-x6-cache` is still 18 GB, and `$TMPDIR` holds 107 leaked `wildshard-generation-*`
  copies.
- **04:47 follow-up: still leaking.** `check2` is now **38 GB** with **21** nested builds; the newest is
  `20261022-034307-4400`. That is 8 more since 00:47, at about 1.9 GB each, or roughly 4 GB per hour. `./tmp` is now
  103 GB and 681k files, and the repo is 125 GB. At the time of the check no `serve-build` or `build-mirror run`
  process was alive, and no lane's recent herdr output names `--slot check2`, so the caller is a lane's own loop. Its
  build logs show `heavy-lane` tickets 10177 → 10297.
- **10-22 ~12:00:** Jake deleted `check2/tree/tmp/serve`, which had grown to 45 GB by then, along with 80 generation
  copies older than a day and the 10-17 `.ktrace` files. After that the boot purge was at 113k files and `./tmp` at 72 GB.
- **10-23 00:47: the nested builds are back, now in four slots.** `check` has 1, `check2` 2, `check3` 3 (5.1 GB) and
  `check4` 2: 8 builds, about 10.5 GB. `./tmp` went 73 → 85 GB (+67k files) in 4 h, made up of these nested builds, 5
  live previews in `tmp/serve` (9.3 GB), and `tmp/o27` (2.1 GB of `cross/` and `dmem/` lane scratch since 10-22 09:32).
  The `serve-build.sh:26` fix is still the one that matters.
- **The compile cache is growing again, slowly.** `$TMPDIR/node-compile-cache` held 17.2k files: the main
  `v24.18.1-arm64-…` folder had 13.6k (5.1 GB, up from 3k on 10-21) and the new `generation-portable/` folder 3.6k
  (d609db4b36, `scripts/generation-node-cache.mjs`). The portable cache uses relative paths, so it should stay bounded.
  The main folder is the one to watch.

## 10. 2026-10-23 04:47 check: the Vitest `$TMPDIR` leak is back, via lane-private configs (OPEN)

The boot purge was at **212k files**, up 45k in 4 h and closing on the 250k investigation line. `$TMPDIR` alone held
146k.

- **There are 192 nanoid-named `ssr/` and `client/` dirs in `$TMPDIR`, with 56k files in total** (finding 1's
  signature). By creation day: 2 dirs on 10-20, 19 on 10-21, **89 on 10-22 (25k files), and 48 on 10-23 by 04:42 (25k
  files)**.
- **Writer, caught live:** a watcher listed the vitest processes alive each time a new dir appeared (05:07:52, 05:07:58,
  05:20:57). Every hit included a `pnpm exec vitest run --config tmp/o28/vitest.<name>.mjs` run, using `warm`, `t7` and
  `pgp`. Lane **o28** has written **20 private configs** (`tmp/o28/vitest.*.mjs`, from 10-22 23:21 on), and **none of
  them imports `../../vitest.config` or `vitestTmpRoot`**. They are bare
  `{ resolve: { alias: rapierAlias }, test: { include: [...] } }` objects, so Vitest 5.0.1 roots its tmp dirs in the
  real `$TMPDIR` again. Runs through the repo config (`vitest related …`, `scripts/vitest-push*.config.ts`, which spread
  `base`) keep the plugin.
- **Fix:**
  1. Make the redirect independent of which config a run loads. Options: a repo `vitest` wrapper or package script that
     sets `TMPDIR=./tmp/vitest/<pid>` before Vitest starts, or a guard (lint or pre-run) that rejects a Vitest config not
     built from `vitest.config.ts`.
  2. Tell lanes to build ad-hoc configs as `{ ...base, test: { ...base.test, include } }`, as
     `scripts/vitest-push-guards.config.ts` does.
  3. Belt and braces: have the sweep (`boot-temp-warn.sh` / dotfiles `cleanup-temp`) delete nanoid-named
     `ssr/`/`client/` dirs in `$TMPDIR` older than 1 h.
- **08:47 follow-up: the boot purge is at 263k (over 250k).** Vitest dirs went 192 → **255**, and their files 56k →
  **96k**: about 10k files an hour, so the purge reaches 500k in about a day at this rate. o28 had **27** private
  configs by 08:12, the newest `vitest.cc.mjs`. Other lanes do the same: `tmp/sp-x6-pack` (7), `sp-x6-support-bank`,
  `sp-x6-whirl-gate`, `sp-x8-elite-projection` and `r10b` (1 each). Only 11 of the 38 lane configs build on the repo
  config. No commit since 04:47 changes `vitest.config.ts`, `scripts/vitest-tmp.ts` or the sweep.
- Also growing: `$TMPDIR/node-compile-cache/v24.18.1-arm64-…` went 13.6k → 27.3k files in a day. In `/private/tmp`,
  `claude-501/bash-edit-diff` holds 61k files in 12 dirs; that is Claude Code's own scratch, not a lane's.

## 11. 2026-10-23 16:47 check: `./tmp` 44 → 53 GB and 407k → 509k files in 4 h; the `tmp/vitest` sweep is gone (OPEN)

- **What grew:** `tmp/vitest` went 3.3 → **7.7 GB**, **111k files** in 28 `<pid>` dirs. 17 dirs are new since 12:47.
  Only one belongs to a live process. The others are 0.1–0.75 GB each: about 2.8 GB / 46k files of
  `node-compile-cache`, and the rest Vitest's `ssr/`/`client/` module copies. These are not boot-purged, so they cost
  disk only. The redirect from section 1 works.
- **Why nothing removes them:** `scripts/vitest-tmp.ts` deletes its dir on `process.once('exit')`. A run killed by a
  signal (a lane timeout or `kill`) never emits `exit`, so its dir stays. The fallback was the sweep in
  `scripts/boot-temp-warn.sh --count` (dead pid, nothing changed for an hour). That sweep ran from `.githooks/pre-commit`
  until **013a31e5c2** (10-21 20:03, "refactor(git): use one short commit path", G585). That commit removed the hook
  line along with the "guard and sweep machinery". `tmp/.boot-temp-count` was last written 10-21 19:51. 26 of the 28
  dirs are sweepable by the script's own rule right now. This reverses the "pre-commit sweep of `./tmp/vitest`" in
  Jake's 10-15 decisions below.
- **Fix:** put the sweep back on a path that still runs. Either restore `scripts/boot-temp-warn.sh` (warning plus
  sweep, backgrounded) in `.githooks/pre-commit` or `scripts/commit.sh`, or call `sweep_vitest` from `vitestTmpRoot()`
  at start-up so every run cleans up after the killed ones. Also clean up on `SIGTERM`/`SIGINT` in `vitest-tmp.ts`.
- Boot purge: 200k (up 23k). `$TMPDIR` Vitest dirs from lane-private configs (section 10) went 36 → 60, and
  `$TMPDIR/node-compile-cache` reached 49k files. The new top-level slot `tmp/build-mirror/ruler` is 3.3 GB and outside
  G547's seven slots.

## 12. 2026-10-28 14:56 check: `./tmp` 60 → 100 GB and 550k → 908k files since 10-24 (OPEN)

- The Mac rebooted on 10-26 at about 18:48. The boot purge is now **78k** files, and `/cores` is empty: Jake deleted 426 GB of
  core dumps, caused by `ulimit -c unlimited` in `~/.bashrc:12`, which is still set.
- **No single writer.** 2,109 top-level `tmp` entries are new since 10-24 12:47 (2,635 in all), and together they hold
  37 GB. These are lane scratch dirs: `sp-x6*` 44, `sp-x9*` 41, `sp-x8*` 23, and so on. The biggest by file count is
  `sp-x9-loading-g804` (91k files, 2.8 GB). `commit-source-*`: 17 dirs, 1 GB, the newest from 10-27.
- `tmp/serve` went 1.8 → **13.3 GB** (211 entries, 8 live builds). `build-mirror` is 30 GB / 339k files. `tmp/vitest`
  is 4.3 GB / 125k files.
- **Fix:** lanes need an owner-side sweep of their own `tmp/<lane>*` dirs when a task ends. Alternatively,
  `scripts/commit.sh` could warn when `./tmp` passes a size limit, which the removed `boot-temp-warn.sh` used to do
  for the boot-purged folders.
- **Outside the repo:** `~/Library/Caches/node-compile-cache` refilled from 0 to **47 GB** in 2 days (about 23 GB a
  day). The cause is the dotfiles' global `NODE_COMPILE_CACHE` (section 2). `.git/commit-vitest-cache` (87a1387349) is
  back to 1.4 GB after Jake cleared it.

## 13. 2026-11-03 20:47 check: `tmp/vitest` refilled to 3.6 GB / 115k files in one day; a node OOM wrote a second core (OPEN)

- **`tmp/vitest`:** 0 at 11-02 22:16, then **3.6 GB / 115k files** by 11-03 20:47, which is this check's whole
  +114k-file jump. The cause is the same as section 11: eight `tmp/vitest/<pid>` dirs, each from a run that was
  killed, so `scripts/vitest-tmp.ts` never got its `exit` cleanup. They were made 01:04, 08:19, 08:41, 08:47, 09:17,
  13:27, 17:55 and 19:06, each 7.6k–19.7k files and 265–690 MB, and none of the pids is alive. Section 11's fix is
  still not wired: `sweep_vitest` exists in `scripts/boot-temp-warn.sh:20`, but nothing in `.githooks/` calls it.
- **`tmp/serve`** swings between 4 and 21 GB as previews come and go. That is one build (about 2.1 GB) per port on
  4400–4410, all with a live listener at 08:47, so it is bounded. **`tmp/build-mirror/ruler`** (3.2 GB, last written
  10-24) is a leftover: `scripts/build-mirror.mjs:203` now pools `check`..`check5` only.
- **Lane scratch over 2 GB:** `sp-ci-deploy-qa-refresh` 2.7 GB (born 10-29, still written; the biggest files are
  `*-watch.log` and `nine-p1-*`) and `sp-x8-z6` 2.1 GB (born 11-03 10:55; goldens; the lane pushed at 15:17).
- **`/cores`:** `core.39665` (11 GB, 11-03 00:51) joins `core.45892` (19 GB, 10-31). Both are node V8
  `FatalProcessOutOfMemory` SIGABRTs started from an iTerm2 shell (`~/Library/Logs/DiagnosticReports/node-2026-11-03-005157.ips`).
  `ulimit -c unlimited` in Jake's `~/.bashrc` turns every node OOM into a heap-sized core; that is Jake's call.
  A third, `core.75239` (11 GB, 11-03 21:18, `Retired/node-2026-11-03-211850.ips`, the same OOM, parent bash), took
  `/cores` to 41 GB. It launched 21:17:58, two minutes after `tmp/sim-boost-lap` was created (21:16; `nine-*` pack and
  shardfile builds, 4.3 GB). That timing is the only link to it.
  **11-04 11:55: two more**, `core.77823` and `core.79556` (12 GB each, 22 s apart, `node-2026-11-04-1155*.ips`).
  `/cores` is now 65 GB in five cores. These two differ: each is a **node child of a node parent** (pids 77813 and
  79453, both gone by 12:47), and each ran about 19 s before OOM. That fits a worker pool (Vitest forks, or a
  build/bake worker) that was retried once. Same day, `./tmp` passed **1.0M files / 102 GB** with `tmp/vitest` at 7.5 GB
  (12 run dirs created 11-04). `tmp/goldens` (born 11-03 09:26; dated `2026-11-04-*` pack and ktx2 golden sets) passed
  2 GB at 2.7 GB.
- `~/Library/Caches/node-compile-cache` was 3.6 GB at 11-02 22:16 and **29 GB** at 11-03 20:47 (about 1.3 GB an hour).
- **11-05 16:47: `./tmp` 110 → 148 GB and 1.03M → 1.72M files in 4 h.** Nearly all of it is `tmp/ci-lane` (30 GB /
  634k files, born 16:12, still written). `tmp/ci-lane/fprobe.sh` is a hand-rolled bisect: each probed sha gets its own
  `tmp/ci-lane/f/<sha>` with a `git archive` tree, its own `pnpm install` and a `build-shardfiles`, so each sha costs
  **2.3 GB / about 40k files**, 13 shas so far. Nothing removes `f/<sha>` when a probe ends. The `b` and `m` dirs add
  3.4 GB / 111k files. `tmp/lane4/deploy` (2.6 GB, 15:14–15:40, finished) also passed 2 GB. This is repo `./tmp`, so it
  costs disk only and is not boot-purged. **Fix:** a per-sha probe should remove `f/<sha>` after its `RESULT` lines.
  By 20:47 `tmp/ci-lane` had been cleaned to 11 MB.
- **11-05 20:47: `test/cook-worker.test.ts:113` very likely writes a 6.5 GB core on every run (OPEN).** Its "reports a
  crash" case runs `job('crash.mjs', 'process.abort();')`, the only `process.abort` in `scripts`, `src`, `test` or
  `.githooks`. Three cores match it: `core.61969` (20:32), `core.84234` (20:35) and `core.3440` (20:39), each 6.5 GB,
  each a node child of a node parent that lived about 2 s, with the main thread in `node::Abort` during ESM module
  evaluation, not an OOM. All three predate f7cdaf49fb (20:41), which committed the test, so every Vitest run of the
  file from now on should add another 6.5 GB under Jake's `ulimit -c unlimited`. **Fix:** have the test's job launcher
  run with `ulimit -c 0`, or crash the job with `process.kill(process.pid, 'SIGKILL')`, which macOS does not core-dump.
  The launcher needs fixing either way if `runJob` can hit a real abort in production.
- **11-05 20:48:** `core.71145` (27 GB) is another OOM: a node child of bash that ran 30 s
  (`node-2026-11-05-204827.ips`). No writer found. `/cores` is now **110 GB in nine cores**.
- `tmp/c1` (11 GB / 36k files, born 20:03, still written) is a lane's cold-boot proof: `c2`, `cooked` and `base` at
  about 2.7 GB each plus `tars2`, run through `scripts/shardfile-cold-boot.mjs --dist=tmp/c1/c2`. `tmp/worker-proof`
  (2.6 GB, finished 18:16) and `tmp/loading-flow` (2.6 GB, finished 17:57) also passed 2 GB.

## 14. 2026-11-06 00:47 check: boot purge 135k → **4.14M files**, `/private/tmp` 2.8 → 172 GB (OPEN, the boot-hang risk)

- **This is the original boot hang coming back: a reboot now makes dirhelper empty 4.1M files before login.**
- **Writer:** Claude Code session `f5d26423-372a-4862-81cd-516e29cd300e` (project `project-wildshard-meta`), live at
  00:54. Its session scratchpad is `/private/tmp/claude-501/-Users-raynos-projects-games-project-wildshard-meta/f5d26423-372a-4862-81cd-516e29cd300e/scratchpad`.
  Per-run build output, not repo copies (the first reading of this section was wrong): `p4p5/` has 35 run dirs (`c1`..,
  `f1`.., `r2`..), each holding its own `shard-templates` (28k files), `sharddev` (19k) and `.stage` copies. The session
  had 103 related processes at 00:54.
- **11-06 04:47: 5.01M files, `/private/tmp` 250 GB.** File counts are lower bounds (each `find` was capped at 25 s):
  `p4p5` 1.56M+ / 86 GB (last written 00:47), `lift` 862k+ / 58 GB (01:06), `l2` 649k+ / 60 GB (02:39), `l-left` 180k+
  (02:55), `p3s` 150k+ (still written at 04:55), `e7` 58k+ (02:51). The session is still live.
- **Why it is worse than `tmp/ci-lane` (section 13):** a session scratchpad lives in `/private/tmp`, so every file
  counts against the boot purge. The same output under the repo's `./tmp` costs disk only. `scripts/boot-temp-warn.sh`
  no longer warns (section 11), so nothing told the session.
- **Fix:** per-run build output belongs in `./tmp/<lane>`, never in a session scratchpad, and each run removes it once
  its result is written. Jake decides on deleting these; do not reboot before they are gone.
- **`/cores` 110 → 206 GB in 22 cores.** 13 are the 6.5 GB `process.abort` size (section 13), ten of them new since
  20:47, so that test is running often and is still in the tree at `test/cook-worker.test.ts:119`.
- `./tmp` 143 → 187 GB and 1.18M → 1.48M files: `tmp/serve` 23 GB, `c3-finish` 14 GB, `flip` 9.2 GB, `ci-d` 8.9 GB,
  `size-baseline` 8.6 GB (the worktree `step.sh` measures in), `ci-lane-2` 3 GB. Free disk 1,535 → 1,269 GB.
- **11-06 04:47:** `./tmp` 187 → **239 GB** / 1.86M files: new `flip-save` 31 GB (born 04:02), `lane-save` 25 GB (00:35),
  `flip-dress` 14 GB (02:52), `ci-e` 7.9 GB (03:41). `node-compile-cache` is 110 GB. Free disk **1,062 GB, down 207 GB
  in 4 h**. (This entry first said about 21 hours to empty. That was wrong: the rate did not hold, and most of the
  loss was `/cores` and `node-compile-cache`, which Jake has since cleared.)
- **11-06, log stamp 16:49:** the scan took about 5 hours under load, so these figures are from about 21:45, not 16:49.
  Boot purge 5.12M, `/private/tmp` 258 GB. `./tmp` 264 GB / 2.0M files: new `lane-dl23` 16 GB, `s1-debt` 9.1 GB.
  `/cores` emptied (212 GB freed) and `node-compile-cache` deleted by Jake. Free disk 1,309 GB and rising.
- **11-07 00:47:** boot purge **5.16M** (+43k), `/private/tmp` 260 GB, `$TMPDIR` 6.3 GB. The scan took 3 minutes this time.
  The session scratchpad is still in use, so do not delete it yet (Jake). `./tmp` 264 → **297 GB**, 2.0M → **2.52M
  files**. Free disk 1,296 GB, `node-compile-cache` 4.7 GB.
- **`tmp/ci-f` is that whole `./tmp` growth: 32 GB / 512k files in under 3 hours.** Lane CI-F's `gate.sh` makes one
  full tree per commit it checks, at `tmp/ci-f/trees/<sha>-<time>`, 3.6 GB and about 57k files each. Nine trees so far,
  from 22:17 to 00:44, and none of its scripts removes one. At that pace it adds about 13 GB an hour while the lane runs.
  **Fix:** the lane removes a tree once its verdict is written, as the `fprobe.sh` bisect's lane did (section 13).
- **`/cores` is refilling:** `core.58621`, 6.5 GB, 11-06 23:51. `lldb` shows `abort` called from
  `node::Abort` on a JS call, which is what `process.abort()` does and matches the 6.5 GB size, so
  `test/cook-worker.test.ts:119` is now close to confirmed (section 13). `ulimit -c unlimited` is still at `~/.bashrc:12`.
- **11-07 04:47:** boot purge **5.21M** (+44k), `/private/tmp` 262 GB, `$TMPDIR` 6.3 → 7.2 GB and 167k → 196k files.
  `./tmp` 297 → **271 GB**, 2.52M → 2.02M files: the CI-F lane removed its trees (`tmp/ci-f` 11 MB, no trees), so the
  fix above is done by hand for now, though no script does it. `tmp/serve` 2.8 GB → 62 MB. No new core. Free disk 1,318 GB.
- **New, smaller `$TMPDIR` writer:** 428 folders with 21-character random names, oldest 10-26, about 1,400–1,800 files
  each, holding `client/` and `ssr/` files named by hash. The contents are `__vite_ssr_exportName__` module code, so this
  is very likely Vite or Vitest transform output left by runs that did not clean up (not traced to a process). It is
  the Vitest `TMPDIR` finding (finding 1) in a new form: it counts against the boot purge, where `./tmp/vitest` would not.
- `tmp/sweep` 6.2 GB (born 03:59, live, from `tmp/sweep/chain.sh` running `scripts/loading-flow/sweep.sh` against production) and
  `tmp/worker-proof/deploy` 2.7 GB (written 02:56, read by `scripts/worker-proof-page.mjs`) are both lane output.
- **11-07 11:16:** boot purge **5.37M** (+162k in 6.5 h), `/private/tmp` **286 GB** (+24 GB), `$TMPDIR` 8.1 GB. The session
  scratchpad's `e7` is the live growth, 205k files / 30 GB, with full repo trees `e7/engine` 14 GB and `e7/flip` 12 GB.
  Its `p4p5` is really 2.86M files, not the 1.56M lower bound above. `./tmp` 277 GB / 2.09M files (+6 GB, +72k), mostly
  `tmp/serve` back to 8 GB. `tmp/ci-f` 3.7 GB, so its trees are starting again. Free disk 1,318 → 1,262 GB.
- **`/cores` 13 GB, two dumps:** `core.3105` (11-07 07:33) has the same `node::Abort` stack and 6.5 GB size as `core.58621`.
- **`node-compile-cache` is regrowing:** 4.7 → 15 GB in under 11 hours since Jake deleted it. Nothing evicts it.

## 15. 2026-11-07 12:15 hygiene pass: 268 GB cleared; `gen` is 98% duplicate bytes (`gen` OPEN)

Lane HYGIENE, at Jake's request. Sizes are `du` figures. Free disk is 1,625 GB, which also counts the session scratchpad
folders the coordinator cleared in the same hour.

| Cleared | GB | Files |
|---|---|---|
| `~/.cache/wildshard/p45` | 90.5 | 1.57M |
| `tmp/`: 2,024 stale entries, plus `flip/export` | 151 | 700k |
| `tmp/vitest`: dead run dirs | 9.6 | 300k |
| `node-compile-cache`, capped once | 12.4 | 202k |
| `$TMPDIR`: 314 Vitest folders proven by their contents | 5.2 | 167k |

Readings of 232 cited folders are in `tmp/keep/<name>/` (1.1 GB). Left on purpose: `p45/freeze3/tree/.git` (6.4 GB; a
`git lg` pager on `ttys019` holds its pack, by hardlink). `$TMPDIR` keeps 91 `tmp*.ply` meshes (2 GB) and the `sides-`,
`freeze-`, `receipts-` folders, none proven to be Wildshard's.

- **`gen` is the main finding: 463 GB holds 11 GB of distinct bytes.** A build at `main` reads 238 of its 91,435 keys,
  1.2 GB. `pine-material-sources` has 816 keys and 3 distinct outputs. The step key in
  `src/sharddev/projectGeneration.ts:160` includes `programHash`, the shard's whole author program, so any edit in that
  program's import closure rekeys and reruns every step, and each key stores its own full copy. The writers are the
  per-shard build and every per-commit tree (9,425 commits since `gen` began on 10-23, d19af9d060).
- **Nothing evicts `gen` on this Mac.** `trimGenerationCache` runs only on the hosted Linux runner
  (`scripts/ci-product-cache.mjs:44`), and it refuses here: main's generation receipt is not current, and a mirror's
  checkout root differs. G430 (cap 20 GB, newest 3 per job) was written for the old store and did not move with the jobs.
- **`generate` went 354 GB → 906 MB** because K4 (a1ae66679c, 10-23) prunes it after every generation to a day and 4 GiB,
  and its jobs moved into `gen` the same day. The bytes moved; they did not go away.
- **Proposed rule for `gen`, nothing done yet:** (1) store each blob once, `gen/blobs/<sha256>`, with a key holding only its
  `index.json`. Blob names are already content hashes, so hardlinking in place frees about 450 GB with no cold rebuild.
  (2) Evict as G430 says, keeping every key a current receipt names. A hit must touch its key, since nothing updates mtime.
  (3) Key a step on its own inputs and generator, not the whole program, which also removes most of the reruns.
- **`node-compile-cache`:** `NODE_COMPILE_CACHE` comes from `~/.bash_profile:16` and `~/.profile:23` (G430, moved out of
  `$TMPDIR`). Node never evicts it and files each script by absolute path: the same source at a second path adds an entry,
  and a rerun at the same path adds none. So every fresh tree (`tmp/ci-*/trees/<sha>`, `p4p5/run*`, rehearsal rings) adds a
  full set. `scripts/temp-janitor.mjs` now caps it at a day and 4 GiB.
- **Test leftovers:** `push-config-*`, `sim-readiness-test-*`, `author-module-*` and the nine fixtures all clean up in a
  `finally` or `addCleanup`. Only killed runs leak. The janitor (1d9c456852) runs from each Vitest start, at most every 10
  minutes. `sp-*` is lane scratch made by hand, which no script owns, so it still needs a rule.
- **`test/cook-worker.test.ts`:** fixed in 42c8182da0, a real SIGABRT with `RLIMIT_CORE` 0.
- **11-07 12:47 check:** boot purge 5.37M → **273k**, `/private/tmp` 30 GB, `$TMPDIR` 3.2 GB. `e7` is most of what's left and
  is still in the session scratchpad, so do not reboot until it moves. `./tmp` **116 GB** / 1.05M files, repo 143 GB, free
  disk 1,588 GB. New `tmp/e7-phones` 5.9 GB (two 2.7 GB builds, live).
- **`/cores` is still filling after that fix: 44 GB in 5 dumps, three of them in the 35 minutes to 12:48.** All four node
  dumps hold the `crash.mjs` path, which now proves the cook-worker cause. The two after the fix ran from trees without
  it: `core.47740` (10 GB, 12:15) from `~/.cache/wildshard/lift-work/d2/first/engine`, and `core.87654` (6.5 GB, 12:43) from
  `lift-work/real/engine`, whose `test/cook-worker.test.ts:119` still has the old line (import at 65925fa862).
  **Fix:** the lift lane takes 42c8182da0, or `~/.bashrc:12` drops `ulimit -c unlimited`.
- **New source, `core.3860` (14 GB, 12:48):** the Android emulator, `qemu-system-aarch64-headless`, crashed in
  `AppleMetalOpenGLRenderer` while the E7 phone work was running. Each emulator crash can cost this much. Only the
  `ulimit` change stops this one.

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
