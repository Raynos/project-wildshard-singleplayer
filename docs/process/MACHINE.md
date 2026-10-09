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

## Full suites and app builds: one of each machine-wide (E435 SF62)

Ten simultaneous full suites pushed machine load above 150 and timed out real worker proofs. Python 3 and `flock`
now provide separate full-test and build lanes across working trees and clean exports:

- `python3 scripts/heavy-lane.py full-test -- pnpm exec vitest run` (coverage and sharded full runs also take this lane).
  **Lanes don't run full suites** (SF74 W1): `full-test` and `check` (so `pnpm test`, `pnpm test:coverage`) refuse
  outside CI unless `WS_FULL_SUITE=1` (the nightly, the coordinator); the push gate runs the full suite in its own lease.
  Run your focused tests: `pnpm exec vitest run test/<file>.test.ts` or `pnpm exec vitest related --run <src files>`.
- `python3 scripts/heavy-lane.py build -- <command…>` for a whole app build pipeline, including generation.
- `python3 scripts/heavy-lane.py status` shows active owners, commands and FIFO tickets.

`pnpm test`, `pnpm build`, native builds, preview builds, parity builds and CI use the wrapper. Direct full Vitest
and app Vite builds refuse an absent or copied lease before workers start. Focused file or directory filters remain
unrestricted; `--project`, `--shard` and reporter flags alone are still full runs. Listing tests needs no lease.
An SDK package build that includes its app clients also runs through the build wrapper.

The push gate has its **own `push-gate` lease** (process audit 2026-10-09: a lane's suite held pushes a median 115 s):
one gate at a time, running beside lanes' suites and builds, and its lease covers both guards for its descendants. Otherwise each lane is FIFO; independent test and build jobs may overlap. The gate retains its existing
internal parallel steps. Waiting is logged separately from the E454 gate time. Do not start a nested build inside a
full-test lease; request `check` up front when one ordinary command needs both resources (`gate` is push priority).

The default owned-command deadline is 30 minutes (`--max <minutes>`); queue time is separate. Signals and deadlines
stop only the wrapper's own process group. The command inherits the lock descriptors, so killing a wrapper cannot
free capacity while its child remains live. A stale queue PID is pruned; a lock is never stolen on age alone. Use the
recorded PID and command to diagnose a stuck owner, and never kill another lane's processes.

## Long proofs: start detached, don't poll (SF74 W5)

`scripts/proof-run.sh <label> -- <command…>` starts a soak, frame floor, boot smoke or Simulator run in its own session
and returns at once; when it ends, `.git/proofs/<id>.json` holds the verdict (state, rc, times, log) and herdr types
one line with it into the pane that started it. Keep working meanwhile; never `sleep`-and-`tail` a log (~11 agent-hours
of polling in the 12 h audit). The command still takes its own lanes (browser-lane, sim-lane, heavy-lane);
`scripts/proof-run.sh status [<id>]` lists results. `.claude/hooks/guard-polling.sh` (SF74 W21) refuses a Bash `while` / `until` loop that
sleeps, a `for` loop sleeping over 60 s in total and a bare `sleep` over 60 s (allowed: `run_in_background`, a tool timeout
≤ 60 s, a leading `timeout ≤60`; escape `SKIP_POLL_GUARD=1`).

## No vite dev servers (Jake, E317: "Vite dev sucks")

Serve a build: `scripts/serve-build.sh [--head] [--hours <h>] [--name <label>]` (≈ 10 s) prints the URL;
`scripts/serve-build.sh stop <port>` when done. `pnpm dev` runs it too. The hook blocks `vite` dev. The reaper stops a
preview past its `--hours` (default 4), an unregistered one after 6 h and any dev server after 2 h.
- **Start previews from your session scratchpad, not the repo root.** Its "all mine" eviction keys on the caller's
  folder, so repo-root previews get killed or reused by other agents. Read `/version.json` on your port before each
  capture batch.
- Each preview starts in its own session; its registered PID is also its PGID. `serve-build.sh stop <port>` and expiry
  reap that whole owned process group, including pnpm/vite descendants. The registry, expiry and preview log stay the same.

## iOS Simulators: at most 1 booted (E316)

Through `scripts/sim-lane.sh`: `run [--max <min>] <device> <cmd…>` boots, runs and shuts down; `lease <device> [<min>]`
holds it while you drive it; `release` shuts it down. The hook blocks a raw `simctl boot`. How to drive one:
`.claude/skills/ios-simulator/SKILL.md`. The Simulator runs on the Mac GPU: it cannot show the iPhone's memory limit,
GPU cost or throttling.
The reaper quits Simulator.app once nothing is booted: one AppleScript quit, then one SIGTERM on a later reap if the app
ignored it, each logged once per app PID (`~/.sim-lane/app-quit.<pid>`); it used to retry from every hook, 2,024 times in 12 h.

## Local models: one at a time

Every model load runs under `lockf -k ~/projects/localai/.model.lock` ([LOCAL-MODELS.md](LOCAL-MODELS.md)).
`pgrep -fl "lockf -k"` shows the queue. `~/projects/localai/bin/evict.sh` unloads every LLM server, including other
agents'.

## Scratchpads (Jake, 2026-10-02)

The session scratchpads once grew to 1.6 TB and filled the 4 TB disk (333 throwaway checkouts, 190 GB of frames, folders
renamed `trash/` instead of deleted). Nothing else cleans a scratchpad.
- **Delete a throwaway as soon as you have its result**: an export once its gates are read, frames once the board is
  written, logs, dumps, model outputs you didn't pick. Delete with a literal path (`rm -rf <scratchpad>/m1/gate-3a4d9187`).
- **Never rename aside instead of deleting** (`trash/`, `old-*`, `*.old-<ts>`, `/tmp/delete-me-*`). If a delete is
  blocked, say so in your report.
- **Reuse, don't multiply:** one export dir per job, emptied and refilled. Symlink `node_modules` into an export; never
  `pnpm install` into a scratch copy.
- **What you keep goes in the repo** (`progress/` or `art/<subject>/round-<n>-<label>/`, as JPEG): summaries, boards and
  the numbers, never raw soak / census / receipt archives (`.gz` / `.br` / raw `.jsonl`; the pre-commit hook refuses new ones under `progress/`), which stay in the scratchpad (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`). A tool you will
  reuse goes in the repo too, not the scratchpad.
- **Logs and captures go in the scratchpad**, never loose in the repo root.
- `du -sh <scratchpad>` over ~10 GB means something should already be gone.

## Other agents (herdr)

- `herdr agent list` shows only this server's agents. Jake runs several herdr servers (`herdr session list`);
  reach another with `HERDR_SOCKET_PATH=~/.config/herdr/sessions/<name>/herdr.sock herdr agent prompt <pane> "…"`.
- `herdr agent prompt` types into the target pane and presses Enter: it can answer another session's open question
  pop-up. Send it only when your message needs to reach that agent (HUD changes, agent-to-agent requests).
- To find who owns a process, walk up its parent PIDs to a `claude` process and check its cwd (`lsof -d cwd`).
