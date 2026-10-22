# The shared Mac: browsers, Simulators, servers, scratchpads

Linked from [AGENTS.md](../../AGENTS.md). Ten agents and the local-model jobs share one M5 Max with 128 GB. Every
long-lived dev process gets a machine-wide cap, a timeout or lease, and a reaper for when its owner dies. Don't raise a
cap to "increase concurrency"; free memory first. A new kind of long-running process (an emulator, a proxy) gets the same
treatment.

## Game browsers: at most 4 open machine-wide (E312)

Each open game tab costs ~1.5 cores and ~1 GB for as long as it is open.
- Run every Playwright / Puppeteer script through **`scripts/browser-lane.sh [--max <min>] <cmd…>`**. It waits for a
  free slot, releases it when the command exits (a crash too) and kills the command after `--max` minutes (default 60).
- Before a new agent-browser session: `scripts/browser-lane.sh wait && agent-browser --session <s> open …`. Reusing
  your open session is fine; `close` it the moment you're done, and always before you report (idle sessions also close
  after 5 min).
- The push gate has **one reserved slot of its own** on top of the 4 (SF74 W19): its WebKit smoke waited 125-277 s behind
  the agents' slots. Only a run under the live push-gate lease can take it; agents keep 4.
- `.claude/hooks/guard-browser-lane.sh` blocks an unwrapped browser-launching script and a new session while the lane is
  full. Rare escape: `SKIP_BROWSER_LANE=1`.
- The reaper (`scripts/browser-lane.sh reap`) kills headless Chromiums whose parent died or that are older than 90 min,
  and old scratchpad vite servers. It runs before every lane wait and from the SessionStart / Stop / SubagentStop hooks.
  `status` shows who holds what; the log is `~/.browser-lane/reap.log`.
- **Mute every test browser** (`--mute-audio`, and `mute=1` on game URLs). Headless Chromium plays the game's audio
  out of the Mac's speakers while Jake works.
- **Capture as the phone:** `agent-browser set device "iPhone 16 Pro"` (402×874, 3×) with `touch&tier=phone`. A 1×
  capture looks blurry and misjudges sharpness.
- Render on the GPU: agent-browser does by default, and Playwright scripts pass `--use-angle=metal`. SwiftShader only
  when Jake asks for it (~3 cores per page). No `--disable-frame-rate-limit`. One Android emulator at a time, killed
  when the run ends.

## One full suite and two app builds machine-wide (G547)

Ten simultaneous full suites pushed machine load above 150 and timed out real worker proofs. Python 3 and `flock`
now provide one full-test lease and two shared app-build leases:

- `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run` (coverage and sharded full runs also take this lane).
  **Lanes don't run full suites** (SF74 W1): `full-test` and `check` (so `pnpm test`, `pnpm test:coverage`) refuse
  outside CI unless `WS_FULL_SUITE=1` (the coordinator); CI runs the full suite on every push, and the push gate runs
  only the tests related to the pushed change (GIT.md).
  Run your focused tests: `pnpm exec vitest run test/<file>.test.ts` or `pnpm exec vitest related --run <src files>`.
- `python3 scripts/heavy-lane.py build -- <command…>` for a whole app build pipeline, including generation.
- `python3 scripts/heavy-lane.py status` shows active owners, commands and FIFO tickets.

`pnpm test`, `pnpm build`, native builds, preview builds, parity builds and CI use the wrapper. Direct full Vitest
and app Vite builds refuse an absent or copied lease before workers start. Focused file or directory filters remain
unrestricted; `--project`, `--shard` and reporter flags alone are still full runs. Listing tests needs no lease.
An SDK package build that includes its app clients also runs through the build wrapper.

**Per slice (G568, G612): types, lint and focused tests.** No batch checks, exact-commit mirror checks or checks
on unlanded commit objects. Land small source changes; the push gate, CI and exact-SHA boot smoke own the full gate.

**Lock order: mirror slot, then heavy lease.** Run serve-build directly; it requests its build
leases inside the mirror. The heavy wrapper hoists an explicit mirror command outside its lease and delegates
self-managed serve commands. A nested or unknown shell wrapper that tries to enter a mirror while holding a
heavy lease refuses before joining the slot queue. Release the outer lease and put heavy-lane inside build-mirror
instead; no build capacity may be held while waiting for a mirror.

The push gate has its **own `push-gate` lease** and consumes one of the two build slots (G547).
One gate runs at a time and takes the next free build slot ahead of queued ordinary builds. Its descendants reuse
the lease. Running older wrappers keep their original locks; an older gate reserves one build slot during migration.
Each child receives a private legacy marker view in `WS_HEAVY_ROOT`; the shared queue remains in
`WS_HEAVY_SCHEDULER_ROOT`. Thus older Vite guards still read their owner's `build.active.json` in either slot,
with the same token and process-ancestor checks. Marker views are removed when their owner finishes.
Ordinary builds remain FIFO; independent full-test and build jobs may overlap. The gate takes its lease for `pnpm build`; its
related-test run is focused and needs no lease (4 workers). Local Vitest defaults to six workers (`WS_VITEST_MAX_WORKERS`
accepts a positive integer); CI keeps its runner default. Owned heavy commands run under `nice -n 10`, inherited by
nested wrappers. Waiting is logged separately from the E454 gate time. Do not start a nested build inside a
full-test lease; request `check` up front when one ordinary command needs both resources (`gate` is push priority).

For 24 hours from the first observed build, the wrapper writes queue seconds, build seconds, exit code and start/end
load averages to one report-only `~/.wildshard-heavy-lanes/build-day.log` (or `WS_HEAVY_ROOT/build-day.log`). Nested
builds are labelled `inherited`; they take no additional slot. An expired log stops collecting automatically, and
logging errors never change the build's result. After a needed capture, close the owned preview immediately;
previews hold mirror slots for minutes, not hours.

The default owned-command deadline is 30 minutes (`--max <minutes>`); queue time is separate. Signals and deadlines
stop only the wrapper's own process group. The command inherits the lock descriptors, so killing a wrapper cannot
free capacity while its child remains live. A stale queue PID is pruned; a lock is never stolen on age alone. Use the
recorded PID and command to diagnose a stuck owner, and never kill another lane's processes.

## Measurement quiet windows (SF74 W14)

Before every command, check `test -e .git/quiet`. While another lane owns that file, **read and edit only**:
no Vitest (focused tests included), tsc / strict typechecks, oxlint, builds, bakes, generators, clean rooms,
browsers, Simulator, previews or captures. Commits whose hooks start that work also wait.
After an explicit CPU hold, resume only when the owner announces the **BOTH-surface release**; a deadline or
the file disappearing does not end that hold (wildshard-new, 2026-10-11, after two contaminated Simulator samples).

The quiet owner must wait for an existing push to finish before sampling: check the authoritative push lock,
the parent pusher and its snapshot / regeneration descendants. Auto-push checks quiet before starting a push;
an already-running snapshot may finish several gate rounds. Never kill or bypass another lane's job.

## Long proofs: start detached, don't poll (SF74 W5)

`scripts/proof-run.sh <label> -- <command…>` starts a soak, frame floor, boot smoke or Simulator run in its own session
and returns at once; when it ends, `.git/proofs/<id>.json` holds the verdict (state, rc, times, log) and herdr types
one line with it into the pane that started it. Keep working meanwhile; never `sleep`-and-`tail` a log (~11 agent-hours
of polling in the 12 h audit). The command still takes its own lanes (browser-lane, sim-lane, heavy-lane);
`scripts/proof-run.sh status [<id>]` lists results. `.claude/hooks/guard-polling.sh` (SF74 W21) refuses a Bash `while` / `until` loop that
sleeps, a `for` loop sleeping over 60 s in total and a bare `sleep` over 60 s (allowed: `run_in_background`, a tool timeout
≤ 60 s, a leading `timeout ≤60`; escape `SKIP_POLL_GUARD=1`).

## No vite dev servers (Jake, E317: "Vite dev sucks")

Serve a build: `scripts/serve-build.sh [--head | --rev <sha>] [--shard <slug>] [--hours <h>] [--name <label>]` prints the
URL; `scripts/serve-build.sh stop <port>` when done. `pnpm dev` runs it too. The hook blocks `vite` dev. The reaper stops a
preview past its `--hours` (default 4), an unregistered one after 6 h and any dev server after 2 h.
- **Proofs take the fast path by default** (Jake 2026-10-15, *"make each proof quick and cheap"*): `serve-build.sh` runs
  `gen.mjs --proof` (no derived docs, parallel generation) and `build-shardfiles.mjs --reuse`: a shard whose inputs are
  unchanged reuses its product, by content key, from the slot or the shared cache `~/.cache/wildshard/shardfiles`
  (`scripts/shardfile-cache.mjs`; the push gate's full build publishes every shard it builds there). `--shard <slug>`
  builds only that shard's product (others stay only if still current, never stale); `--full` is the old full rebuild.
  A proof without a server: `node scripts/build-mirror.mjs run HEAD -- pnpm build:proof`. The push gate and CI still run
  the full `pnpm build`. The build log prints per-step seconds.
- **Start previews from your session scratchpad, not the repo root.** Its "all mine" eviction keys on the caller's
  folder, so repo-root previews get killed or reused by other agents. Read `/version.json` on your port before each
  capture batch.
- Each preview starts in its own session; its registered PID is also its PGID. `serve-build.sh stop <port>` and expiry
  reap that whole owned process group, including pnpm/vite descendants. The registry, expiry and preview log stay the same.

## iOS Simulators: at most 1 booted (E316)

Through `scripts/sim-lane.sh`: `run [--max <min>] <device> <cmd…>` boots, runs and shuts down; `lease <device> [<min>]`
holds it while you drive it; `release` shuts it down. Startup preserves boot and bootstatus failures, then probes
Safari with `openurl http://127.0.0.1:9/` until it succeeds (120 s wall deadline; `SIM_SAFARI_READY_TIMEOUT` can set 0–600 s,
exclusive of zero). A failed new boot is shut down without handing over or publishing a lease; renewing a valid
manual lease checks bootstatus without navigating its current page. The hook blocks a raw `simctl boot`. How to drive one:
`.claude/skills/ios-simulator/SKILL.md`. The Simulator runs on the Mac GPU: it cannot show the iPhone's memory limit,
GPU cost or throttling.
After changing startup readiness or its probe URL, also run one real Simulator smoke through sim-lane. Command
fixtures verify control flow and failures; they do not verify the runtime's URL-scheme support.
The reaper quits Simulator.app once nothing is booted: one AppleScript quit, then one SIGTERM on a later reap if the app
ignored it, each logged once per app PID (`~/.sim-lane/app-quit.<pid>`); it used to retry from every hook, 2,024 times in 12 h.

## Local models: one at a time

Every model load runs under `lockf -k ~/projects/localai/.model.lock` ([LOCAL-MODELS.md](LOCAL-MODELS.md)).
`pgrep -fl "lockf -k"` shows the queue. `~/projects/localai/bin/evict.sh` unloads every LLM server, including other
agents'.

## Disk and boot: few copies, little temp (Jake, 2026-10-15)

Jake: *"we don't use the SSD as much … we don't waste lots of space with lots of giga clones … be efficient and not
demolish the machine and have as few checkouts as possible and as little space in tmp as possible"*, and *"when the
machine does not boot up cleanly because it has to delete millions of files in tmp as part of boot it causes me a heart
attack."* On 2026-10-15 millions of leftover `git archive` export files in `/tmp` and `$TMPDIR` held the laptop at the
login progress bar for hours: macOS empties both at boot, before login.
- **One checkout.** No exports, clones, worktrees or copies of `public/` assets, ever.
- **At most seven build-mirror slots machine-wide** (`./tmp/build-mirror`, G547): `gate` (push), `commit` (pre-commit)
  and `check`, `check2`…`check5`. Set `WILDSHARD_MIRROR_SLOT` to spread checks across those five shared slots.
  Previews and ordinary builds use a check slot, never `commit` or `gate`. Never a slot per lane, agent or subagent:
  each slot is a ~2 GB copy of the tree.
- **Reuse one served build of HEAD**; rebuild only when your change needs it, and then with the fast path above. Focused tests and quick checks, no repeated
  full rebakes or builds for a small change.
- **Big scratch only under `./tmp/<task>`**, small, deleted with `rm -rf` on its exact path the moment its result is
  committed; commit the downsized board, never keep full-size preview dumps. Never `/tmp`, `$TMPDIR` or a session
  scratchpad (also under `/private/tmp`) for anything big.
- **Vitest's module cache lives in `./tmp/vitest/<pid>`**, not `$TMPDIR` (`vitest.config.ts` → `scripts/vitest-tmp.ts`,
  with the workers' compile cache): removed when the run exits, and a killed run's dir is swept after an hour by the
  `boot-temp-warn.sh` recount. A run that skips `vitest.config.ts` (`--config <other>`) still writes to `$TMPDIR`.
- **Node's compile cache lives in `~/Library/Caches/node-compile-cache`** (`NODE_COMPILE_CACHE`, set in the dotfiles'
  `.bash_profile`), not `$TMPDIR`: it had 110k files there.
- **The generation cache (`~/.cache/wildshard/generate`) evicts itself** to the newest 3 entries per job and 20 GB
  (G430, GENERATION.md); it reached 376 GB without that.
- **Pre-commit warns** (never refuses) through `scripts/boot-temp-warn.sh` when `/private/tmp` or `$TMPDIR` (two separate counts) passes 500,000
  files or `./tmp/build-mirror` holds a slot beyond the three; `scripts/boot-temp-warn.sh --top` lists the biggest
  folders. Delete your own; ask before touching another agent's.

## Scratchpads (Jake, 2026-10-02)

The session scratchpads once grew to 1.6 TB and filled the 4 TB disk (333 throwaway checkouts, 190 GB of frames, folders
renamed `trash/` instead of deleted). Nothing else cleans a scratchpad.
- **Delete a throwaway as soon as you have its result**: an export once its gates are read, frames once the board is
  written, logs, dumps, model outputs you didn't pick. Delete with a literal path (`rm -rf <scratchpad>/m1/gate-3a4d9187`).
- **Never rename aside instead of deleting** (`trash/`, `old-*`, `*.old-<ts>`, `/tmp/delete-me-*`). If a delete is
  blocked, say so in your report.
- **Reuse, don't multiply:** no exports at all since 2026-10-15; an exact-commit check runs in the shared `check`
  mirror slot (above). Never `pnpm install` into a scratch copy.
- **What you keep goes in the repo** (`progress/` or `art/<subject>/round-<n>-<label>/`, as JPEG): summaries, boards and
  the numbers, never raw soak / census / receipt archives (`.gz` / `.br` / raw `.jsonl`; the storage check in pre-commit and pre-push refuses new ones outside `public/`,
  [STORAGE.md](STORAGE.md)), which stay in the scratchpad (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`). A tool you will
  reuse goes in the repo too, not the scratchpad.
- **Logs and captures go in the scratchpad**, never loose in the repo root.
- `du -sh <scratchpad>` over ~10 GB means something should already be gone.

## Claude usage log (E352)

Every hour at :17, cron runs `~/.claude/usage-log.sh` (source: `~/projects/dotfiles/claude/usage-log.sh`). It reads
`openusage claude` (OpenUsage.app's 5-minute cache) and appends one JSON line to `~/.claude/usage-log/<ISO week>.jsonl`,
never rewriting the file. Each line records the account Claude Code is logged in as (`active_email`, so `/login` swaps
show up) and, for every Claude account OpenUsage tracks, the weekly, 5-hour and Fable % used and when each resets.
History starts 2026-09-30; before that there are only the session logs (`docs/tasks/asks/E352.md`). This week's
burn-down:

    jq -r '[.at, .active_email, (.accounts[] | "\(.name): wk \(.weekly_used)% 5h \(.session_used)%")] | join("  ")' \
      ~/.claude/usage-log/$(date -u +%G-W%V).jsonl

The subagent caps that keep usage down are in [SUBAGENTS.md](SUBAGENTS.md).

## Other agents (herdr)

- `herdr agent list` shows only this server's agents. Jake runs several herdr servers (`herdr session list`);
  reach another with `HERDR_SOCKET_PATH=~/.config/herdr/sessions/<name>/herdr.sock herdr agent prompt <pane> "…"`.
- `herdr agent prompt` types into the target pane and presses Enter: it can answer another session's open question
  pop-up. Send it only when your message needs to reach that agent (HUD changes, agent-to-agent requests).
- To find who owns a process, walk up its parent PIDs to a `claude` process and check its cwd (`lsof -d cwd`).
