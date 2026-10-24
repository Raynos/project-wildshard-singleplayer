# The shared Mac: browsers, Simulators, servers, scratchpads

Linked from [AGENTS.md](../../AGENTS.md). Ten agents and the local-model jobs share one M5 Max with 128 GB. Every
long-lived dev process gets a machine-wide cap, a timeout or lease, and a reaper for when its owner dies. Don't raise a
cap to "increase concurrency"; free memory first. A new kind of long-running process (an emulator, a proxy) gets the same
treatment.

## Game browsers: at most 4 open machine-wide (E312)

Each open game tab costs ~1.5 cores and ~1 GB for as long as it is open.
- Run every Playwright / Puppeteer script through **`scripts/browser-lane.sh [--max <min>] <cmd…>`**. It waits for a
  free slot for at most five minutes, releases it when the command exits (a crash too) and kills the command after
  `--max` minutes (default 60).
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

## One full suite and three app builds machine-wide (G620)

Ten simultaneous full suites pushed machine load above 150 and timed out real worker proofs. Python 3 and `flock`
now provide one full-test lease and three shared app-build leases (Jake, G620 supersedes G547's two):

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

Run `pnpm lint:fast <files...>` for the same ordinary and custom rules used by
staged fast lint; without paths it uses the normal repository selection. Only
the two approved expensive plugin rules defer, alongside type-aware rules.
The G636 five-second typed attempt in pre-commit remains separate.

Local root TypeScript checks use `pnpm typecheck:root`. The compiler reuses
`node_modules/.cache/ws-root.tsbuildinfo`; CI and GitHub Actions keep the plain
no-emit check. The command propagates compiler failures, including cached ones.

**Per slice (G568, G612): types, lint and focused tests must pass before landing.** No batch checks, exact-commit mirror checks or checks
on unlanded commit objects. Land small source changes; the push gate, CI and exact-SHA boot smoke own the full gate.

**G612/G670 mirror admission:** only commits reachable from `main` are accepted,
including historical main commits for bisects. Bare trees and unlanded commits
refuse before queueing. CLI `run` is private to serve-build re-execution; the
ruler imports `openMirror`, borrowing its slot before its original build lease.
Caller cwd and script paths under `tmp/` refuse. Use the working tree for types,
lint and focused tests.

**Lock order: mirror slot, then heavy lease.** Run serve-build directly; it requests its build
leases inside the mirror. The heavy wrapper hoists an explicit mirror command outside its lease and delegates
self-managed serve commands. A nested or unknown shell wrapper that tries to enter a mirror while holding a
heavy lease refuses before joining the slot queue. Release the outer lease and put heavy-lane inside build-mirror
instead; no build capacity may be held while waiting for a mirror.

The push gate has its **own `push-gate` lease** and consumes one of the three build slots (G620).
One gate runs at a time and takes the next free build slot ahead of queued ordinary builds. Its descendants reuse
the lease. Running older wrappers keep their original locks; an older gate reserves one build slot during migration.
Each child receives a private legacy marker view in `WS_HEAVY_ROOT`; the shared queue remains in
`WS_HEAVY_SCHEDULER_ROOT`. Thus older Vite guards still read their owner's `build.active.json` in either slot,
with the same token and process-ancestor checks. Marker views are removed when their owner finishes.
Ordinary builds remain FIFO; independent full-test and build jobs may overlap. The gate takes its lease for `pnpm build`; its
related-test run is focused and needs no lease (4 workers). Local Vitest defaults to six workers (`WS_VITEST_MAX_WORKERS`
accepts a positive integer); CI keeps its runner default. Foreground generation/build pipelines retain normal QoS
(G668), including previews and waiting lanes. Use `heavy-lane.py build --background -- <command>` for unattended
generation: it and its nested builds retain utility QoS. Ruler builds retain normal QoS. Full-test jobs keep
`nice -n 10` and utility QoS. Waiting is logged separately from the E454 gate time. Do not start a nested build inside a
full-test lease; request `check` up front when one ordinary command needs both resources (`gate` is push priority).

The wrapper continuously writes queue seconds, build seconds, exit code and start/end
load averages to one report-only `~/.wildshard-heavy-lanes/build-day.log` (or `WS_HEAVY_ROOT/build-day.log`). Nested
builds are labelled `inherited`; they take no additional slot. Logging errors never change the build's result.
After a needed capture, close the owned preview immediately;
previews hold mirror slots for minutes, not hours.
`python3 scripts/agent-time.py --hours 12` prints the read-only shared-waits table,
including current push logs, transcript waits, CI windows, machine state and usage.
Unavailable external readings are named rather than reported as zero.

The default owned-command deadline is 30 minutes (`--max <minutes>`); queue time is separate. Signals and deadlines
stop only the wrapper's own process group. The command inherits the lock descriptors, so killing a wrapper cannot
free capacity while its child remains live. A stale queue PID is pruned; a lock is never stolen on age alone. Use the
recorded PID and command to diagnose a stuck owner, and never kill another lane's processes.

## Measurement quiet windows (SF74 W14)

**G670: only the official Simulator reader takes quiet.** Run
`scripts/sim-lane.sh run --max 45 wildshard-iphone node scripts/sim-grid-entry.mjs --base=<url>`
(or its `--rev=<main-sha>` form) from the checkout. It builds before taking quiet,
then `scripts/sim-quiet.py` drains the current push tick and owns one marker per
reading, released in `finally`. Caller PID, actual script and cwd are verified;
`tmp/` callers and copied Simulator flags refuse. Chromium captures and ad-hoc
wrappers cannot take a quiet window.

For a compiled home reading, add `--shard=sunscar-dunes --runs=1` to the
same official command. It selects the explicit compiled card and refuses a
legacy or different shard route. A local HTTP served build is required for
that mode's independent byte observer. The existing observer injects its
recorder into the first HTML, preserving asset/worker response bytes and
recording both HTML hashes. Per-run output retains loading rows, resource
and worker receipts, declared-byte changes, percentage drops and named
performance measures. Missing counters stay missing; a successful capture
alone does not pass the loading budgets. Controls are observed at 500 ms
intervals. Grid-only reveal/frame checks stay unavailable in compiled mode.

The independent observer retains encoded HTTP body bytes and, separately,
stream-counted content bytes after gzip/brotli/deflate. Corrupt or unsupported
encodings stay unknown. `transportUnits` labels expected content (including
cache hits) separately from network responses (excluding cache hits and
headers); those totals must not be compared as the same unit. No response body
is retained or changed, apart from the already documented HTML fixture.

Compiled readings also inspect existing CacheStorage copies after controls,
without fetching or opening caches. `cachedBodies` reports decoded body sizes,
missing copies and explicit failures, never inferred boot cache hits. It bounds
the URL bank to 1024 and cache count to 16, stops after 8 MiB per body or 64 MiB
total (the last stream chunk may cross the bound), and has a five-second read
deadline. Only metadata survives; no payload is retained. Missing IndexedDB or
browser HTTP-cache bodies remain unknown. This adds no separate Simulator run.

Any failed run stops the cohort and returns failure, with no automatic retry.
The reader closes Safari, its proxy and any preview it opened in `finally`.

The existing `scripts/shard-phone-memory.mjs` accepts `--floor --pin=<sha>`
with a shard, `menu` or `select` target. It samples libproc footprint, V8 heap,
prefetch payload counters and worker URLs at 10/60/120 seconds without forced
GC. Service workers are blocked for the Chromium core-memory comparison.
Core template floors enable the existing device Legacy shard buttons fixture
so the reader can require the explicit SHARDFILE button, with no LEGACY fallback.
A single template reading accepts `--floor --compiled --pin=<sha>` under the
same contract; it does not repeat valid menu/selector floors. Menu and selector
fixtures retain the ordinary single-button deck.
Detailed allocator trees follow the acceptance samples; parent and child sizes
are not additive. `bytes` is effective ownership attribution, while `sizeBytes`
and `allocatedObjectsBytes` retain the allocator's reported size and live
objects. Effective size alone cannot measure retained partition buffers.
A subsequent HTTP-cache clear is a labelled diagnostic only,
leaving CacheStorage intact. Run it through `browser-lane.sh`, then stop its
owned preview. These are Chromium readings, never inferred Safari/phone RAM.

For the C7 milestone, use the same ruler with `core --floor --pin=<full-sha>`
as its target/options under `browser-lane.sh --max 12`. One command measures
menu, SHARD SELECT, Template 1 and Template 2 in separate fresh browsers,
using the real menu and compiled card entry. It prints the original 120-second
renderer + GPU totals against G658 M1's 50/100 MiB targets and fails if a floor
is over target or unavailable. It retains 10/60/120-second samples and the
post-sample scalar owner ledger; cache-clear diagnostics cannot pass a floor.

For a cross-deploy warm grid refusal, use that same official reader with
`--upgrade-from=<old-deploy-origin> --runs=1 --modes=warm` and the new
`--rev=<sha>`. It verifies the old worker controls the title, switches the
same local origin to the new build, checks for the new worker, and taps the
grid without adopting via the pill. Exact script/worker responses stay
unchanged; URL, title, error, pill and controller states ride the existing
poll log. The same installing candidate has at most 120 seconds to become
waiting; replacement, redundancy or timeout refuses rather than reinstalling.
Rejected installers report their exact build and error to the existing page
before preserving the rejection; the reader retains those diagnostics.
Failures and response metadata survive cleanup. An absent or changed old
controller refuses the reading.
After entry, the controller's BUILD reply must match the new deployment;
an installed waiting worker alone cannot pass the update proof.
The worker must also report completed activation. Saved-pose planned updates
skip the descent: that path instead requires actual entered, unpaused HUD,
open gameplay gate, no visible loader, and the matching recorded planned-reload
policy. Its first observed controls time is explicit; unmeasured reveal/frame
statistics remain null. Normal entry still requires its completed reveal.
The official polls retain actual entered/paused HUD state and the single
`wildshard.grid.entry-policy` performance mark (reason, checkpoint presence,
initial-entry policy, grid and arrival mode), without copying save contents.

For the release diagnostic only, `--upgrade-second-tap=1` taps again when
the first entry recovers to a title with `v`. Its separate result cannot
pass the original failed entry. BUILD includes the bounded activation stage
so a responsive controller is not confused with completed activation.

C2's WebKit comparison uses the same official Simulator reader:
`scripts/sim-lane.sh run --max 20 wildshard-iphone node scripts/sim-grid-entry.mjs
--rev=<main-sha> --core-memory=all --out=tmp/core-floors/<label>`. It reads menu,
SHARD SELECT and both explicit compiled templates once, in fresh cold Safari
processes, and reports M1's 50/100 MiB combined targets. `--core-memory=menu`
retains the single-menu comparison. One preview and proxy serve the cohort;
each floor starts Safari fresh and owns the original quiet window. A failure
stops the cohort; the original finally cleanup closes Safari, proxy and preview.
Developer and prefetch stay on; samples at 10/60/120 seconds use the watchdog's native
WebContent and GPU process identities below the owned Simulator's launchd. No
Inspector Network capture, forced GC or phone-GPU inference is involved.

Chromium process-memory tools (`shard-phone-memory`, `grid-ready-chromium`,
`load-mem-probe`, `capture-main-menu-hero`, and `crossroads-rig/desktop-probe`)
use `chromium-memory-browser.mjs`. Its public CDP transport caps response-body
capture at zero for EVERY `Network.enable`, including Playwright's page and
worker sessions. Network events, cache controls and actual app/cache bodies
stay unchanged. Memory runs do not need Inspector's retained response bodies.
The core-memory plan's Chromium readings at `965b2bd1d6` (menu, selector and
templates), earlier grid process totals, and the old hero/load/desktop native
footprints were exposed to Inspector retention. Its desktop default is 200 MB;
the actual inflation depends on captured responses. Do not subtract 200 MB
from historical results or label those changes as game memory savings.
WebKit and Simulator readings are unaffected by this Chromium correction.

The Chromium grid census opens the official `mute=1&nolock=1&sw=0` benchmark
route and enters through the original `hud.enterNow()` operation. A reveal
already fading behind live controls is not a click target. Readiness and
reveal-completion waits still finish before any measurement window starts.

The existing frame-floor reader can also take quiet with `--surface=sim --quiet`.
Only its exact official Sim worker may hold it, after the preview builds; desktop,
parent orchestration and scratch callers refuse. It releases in worker cleanup,
with the same ten-minute cap and no measurement or threshold changes.
For a no-quiet attribution diagnostic, `--webkit-timeline=<existing scratch dir>`
keeps the bounded raw Inspector timeline, page-clock anchors and hook/frame times
for each grid drive. It uses no GL timer wrappers or CPU profiler; its timings
have no frame-floor acceptance credit. Unknown gaps remain unproven when the
existing timeline coverage or clock checks fail. Add `--wasm-constructors=<existing scratch dir>`
to retain bounded native Memory/Module/Instance durations and original frame-clock
reads. It injects before app modules, collects stacks outside each native timed
segment, and saves on existing Inspector evaluations; no extra watcher or rAF.
Constructor and timeline observations are diagnostic, with no floor timing credit.

For one steady function-sampling diagnostic, add `--safari-profile=<existing
scratch dir> --safari-steady=grid-nalati-interior` to a Simulator grid travel
run. Original drives and standing measurements finish first; only the selected
entered interior is then sampled for twenty seconds. Other sampling windows
are suppressed. Replaced or paused controls refuse, and the frame watcher and
deadline are released on completion or failure. Self/inclusive sample counts
are attribution, not function milliseconds or frame-floor acceptance.
Alternatively, `--safari-drive=pine-interior` selects only that original drive
and extends its profile through twenty subsequent entered-play seconds. Its
raw record retains separate drive and early-play page ranges; standing and
other drive profiles are suppressed. Combining both selection flags is allowed
only for a matching route and `grid-<route>` pose: this records the original
drive and a separate twenty-second steady profile after its standing sample.
The gap remains unprofiled; no zero Inspector timestamps are used to partition
the two workloads.

Before CPU work, `python3 scripts/sim-quiet.py status` reports the active official
reading. During it, **read and edit only**: no tests, typechecks, lint, builds,
bakes, generators, browsers, captures or hook-running commits. The marker expires
after ten minutes or reader death. The push loop ignores forged, legacy, expired
and dead-owner markers. Never kill another lane's active job or extend a hold.

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
- **One pinned preview per SHA across lanes (G620).** `--head`/`--rev` resolve the full commit before queueing;
  concurrent requests build once, then verify the registry and exact `/version.json` before sharing the URL.
  The first request builds **all products**, so every later `--shard` subset shares it. The first request fixes the mode;
  an incompatible mode fails clearly instead of serving different bytes under the same SHA. Every caller owns a use;
  `stop <port>` / `stop all-mine` releases only that caller's use, and the last release stops it. Finish each sample and
  release immediately. A shared-preview wait fails once after five minutes, naming lane, slot, PID, command, start and age.
- **Proofs take the fast path by default** (Jake 2026-10-15, *"make each proof quick and cheap"*): `serve-build.sh` runs
  `gen.mjs --proof` (no derived docs, parallel generation) and `build-shardfiles.mjs --reuse`: a shard whose inputs are
  unchanged reuses its product, by content key, from the slot or the shared cache `~/.cache/wildshard/shardfiles`
  (`scripts/shardfile-cache.mjs`; the push gate's full build publishes every shard it builds there). `--shard <slug>`
  filters a working-tree build's products (others stay only if still current, never stale); pinned previews always build
  all products for sharing. `--full` is the old full rebuild.
  The push gate and CI run the full `pnpm build`. The build log prints per-step seconds.
- **Start previews from the checkout (G670).** Caller cwd and script paths under `tmp/` refuse. Preview ownership
  uses the existing session identity; output files may still live under `tmp/`. Read `/version.json` before capture.
- Each preview starts in its own session; its registered PID is also its PGID. `serve-build.sh stop <port>` and expiry
  reap that whole owned process group, including pnpm/vite descendants. The registry, expiry and preview log stay the same.

## iOS Simulators: at most 1 booted (E316)

Through `scripts/sim-lane.sh`: `run [--max <min>] <device> <cmd…>` boots, runs and shuts down; `lease <device> [<min>]`
holds it while you drive it; `release` shuts it down. Admission/lock waits fail after five minutes with holder
status, preserving foreign leases. Startup preserves boot and bootstatus failures, then probes
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
- **Five pooled check slots plus one ruler** (`./tmp/build-mirror`, G612): `check`, `check2`…`check5`
  form one FIFO pool; no slot or any check-slot name takes the first free slot. `ruler` is reserved for the source
  census. `gate` and `commit` are retired. Previews and ordinary builds use the pool, never the ruler.
  Every mirror/lease/lock/queue wait fails at five minutes naming holders; no retry. Never a slot per lane,
  agent or subagent: each slot is a ~2 GB copy of the tree.
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
  files or `./tmp/build-mirror` holds a slot outside the pool and ruler; `scripts/boot-temp-warn.sh --top` lists the biggest
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
