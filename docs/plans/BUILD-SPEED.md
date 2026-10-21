# Build speed: mini plan in waves and phases (E491)

Jake, 2026-10-21 (E491): *"I need a mini plan into waves and phases, broken down with lots of details per wave and
phase. I need to approve and veto each approach inside each wave and phase, and then we can build it wave and phase at
a time."* Earlier the same morning: *"I think we have resource contention as a bottleneck but I might be wrong"*,
*"What's the simplest cleanest way to fix this and delete as much over engineered tooling as possible? DRY KISS"*,
*"I do want one checkout, everyone working on main, everyone committing early and often"*, *"The git repo is too
fucking heavy for worktrees until we fix the size of the repo which is its own plan"*, *"I don't have a second Mac for
the simulator lol. Can we partition this one MacBook with containers or virtualization?"*

**State:** `open` 2026-10-21 — plan written from the 72 h audit; Wave 1 rulings asked (question tool, 10-21); nothing
built. Owner: one Opus lane, unassigned; each phase is one commit at a lane boundary (G492).

Audit: [Wildshard Build Speed Audit](https://claude.ai/artifact/FDEUjZcmiBxQ8uPTVajAVB) (review page
`docs/reviews/build-speed-audit.md`). The numbers every wave is measured against: 1,613 commits in 72 h, 723 with no
source; Codex lanes 31.5 of 48 tool-hours in wait()/sleep() polls; the push gate held 33.5 of 72 h, 52 % red, gen
136 s median; 0 % idle on 18 cores from the lanes' own jobs (up to 18 vitest workers at once, 6 per focused run);
green builds 30 s median under load 50 and 42 s above it; the coordinator session 27 % of Claude cache reads;
Claude 50 % and Codex 54 % of the week used at day 1.9 and 1.3; `scripts/` 33 → 1,101 tracked files in 30 days,
113 coordination scripts, 118 lock files, 27 scripts between a commit and origin.

## How this plan runs

- **Waves are sequential.** A wave is built only after Jake has ruled on every approach in it: approve, pick an
  alternative, or veto. Rulings come through the question tool one wave at a time (option 1 is always Skip). A vetoed
  approach is dropped; its phase is re-planned or skipped. The Decisions table records every ruling with its date.
- **A phase is one builder commit** (or a short series). Its **Verify** numbers go into `build-speed/STATE.md` before
  the next phase starts. Wave N+1 is asked when Wave N's Verify is in.
- **No lane is interrupted** (G492): lanes adopt a change at their next task boundary.
- **Constraints** (Jake, 10-21): one checkout, main only, small frequent commits; no worktrees until
  [REPO-WEIGHT](REPO-WEIGHT.md) (tracked art 2 GB + progress 1.9 GB on a 5.9 GB pack); one MacBook (M5 Max, 6 Super +
  12 Performance cores, 128 GB, macOS 26.7.1); no cloud VMs; fix-forward (10-15): CI runs everything on every push and
  the deploy ships only the newest CI-green commit.

## Not doing, and why

- **Worktrees:** after REPO-WEIGHT. The design below does not need them.
- **A macOS VM for the Simulator:** the guest GPU is paravirtualized over the same physical GPU; numbers would match
  neither this Mac nor the phone, and Apple allows two guests.
- **cancel-in-progress on CI pushes:** the deploy workflow already runs one concurrency group per SHA, so pushes never
  queue behind each other. The first draft of this plan had this row; it was wrong.
- **Reaping MCP servers:** all 50 context7 / playwright-mcp / chrome-devtools processes belong to live Claude sessions
  (0 orphaned). The fix is configuration (Phase 1.3), not a reaper.
- **A second Mac, cloud runners, or more lanes.**

## Decisions

| # | Decision | Ruling |
|---|---|---|
| D1 | **CI is the only gate.** The local push gate and the build mirror's gate slot are deleted; "done" = pushed and CI green, fix-forward. A red main is visible for about 25 min and never ships. | needs pick; Wave 2 waits on it |
| D2 | Commits go through one wrapper, `scripts/commit.sh "<msg>" -- <paths>`: `git add -N` for new files, a one-second `lockf` on `.git/commit.lock`, a pathspec commit. A pathspec commit never reads the shared index, so the shared-index guards go. | with Phase 2.1 |
| D3 | If Wave 1 caps are not enough, CPU-only lane work runs in a Linux container with hard caps; the host keeps the Super cores, the GPU, git, the agents, the Simulator and GPU captures. The GPU cannot be partitioned; GPU captures get a schedule. | with Phase 3.2 |
| D4 | Measurement stays on the host. | decided (10-21) |
| D5 | Polling is forbidden for both agent kinds. | decided (10-21); Phase 1.4 |

## Wave 1: stop the bleeding (nothing deleted, every step reversible in minutes)

### Phase 1.1 CPU: cap what each lane may start

**Why.** Every focused vitest run spawns up to 6 workers and focused runs are unrestricted; the 08:35 sample had 18
workers from three runs plus 6 vite builds, 9 mirror syncs and 12 measurement scripts, at 0 % idle. Builds take a
third longer at the median above load 50, and a third of builds start there.

- **Approach A (recommended):** `scripts/vitest-lane.ts` `vitestMaxWorkers()` returns 2 instead of 6 when
  `WS_VITEST_MAX_WORKERS` is unset outside CI. One line; CI keeps Vitest's default.
- **B:** 3 workers.
- **C:** keep 6 per run but allow at most 3 concurrent vitest runs machine-wide through a `lockf` slot (more tooling).
- **Deletes:** nothing. **Risk:** none; focused runs get slower per run, faster overall. **Effort:** 10 min.
- **Verify:** `ps` during a lane test window shows ≤ 2 workers per run; host idle during lane tests, median over an
  hour; gate `vitest` median (today 138 s). **Rollback:** revert the line.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 1.2 Priority: lane jobs yield to measurement

**Why.** The Simulator and the measurement lane compete on equal terms with 20 lane jobs. macOS schedules
lower-QoS work onto the lower core tier and lets default-priority work win contests.

- **Approach A (recommended):** two lines. `scripts/heavy-lane.py` runs its child under `taskpolicy -c utility`;
  `vitestMaxWorkers()`'s module calls `os.setPriority(10)` for lane runs (workers inherit). The measurement lane,
  frame-floor and the Simulator stay at default priority. Browser captures are left alone (some are the measurement).
- **B:** `nice` only, no QoS class. **C:** skip; rely on 1.1.
- **Deletes:** nothing. **Risk:** low; utility work throttles harder under thermal pressure, which is the point.
  **Effort:** 20 min.
- **Verify:** one frame-floor milestone run on the Simulator during full lane load, drive p95 compared with the last
  quiet reading at the same SHA (Phase 3.4 is the full protocol). **Rollback:** revert.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 1.3 Memory and indexing hygiene

**Why.** Spotlight indexes `tmp/` (491k files; confirmed with `mdfind`) and sat at about one core; `fseventsd` hit
99 % for 16 h. 50 MCP server processes (5 per Claude session) hold 1.5 GB nobody uses in a lane. One agent-browser
Chrome is 4 days old. Swap is 3 of 4 GB.

- **A1 (recommended):** exclude `tmp/`, `node_modules/`, `dist/` and `.git/` from Spotlight: the Privacy pane, or
  one sudo line Jake runs as a `!` command. Verify: `mdfind -onlyin tmp -name package.json | wc -l` → 0; `mds`
  CPU in `top`.
  **A1-alt:** rename to `tmp.noindex` with a `tmp` symlink (no sudo; a few scripts compare real paths).
- **A2 (recommended):** lane sessions stop loading MCP servers they never call (context7, playwright-mcp,
  chrome-devtools): move them from the global Claude config to opt-in for the sessions that use them. Verify: MCP
  process count ≈ sessions that use them; 1.5 GB back.
- **A3 (recommended):** `browser-lane.sh reap` also closes agent-browser Chromes older than 24 h (today only lane
  browsers over 90 min). Verify: no browser older than a day in `ps`.
- **Deletes:** nothing. **Risk:** none. **Effort:** 30 min plus Jake's one line.
- **Jake:** ☐ A1 ☐ A1-alt ☐ A2 ☐ A3 ☐ veto

### Phase 1.4 Agents: stop the polling and the receipts

**Why.** Codex lanes spent 31.5 of 48 tool-hours in `wait()` and `sleep()` calls against 50–60 s exec yields, 3,746
polling turns, each a paid model turn, and most of the Codex budget. Claude has `guard-polling.sh`; Codex has nothing.
Receipts under `.git/proofs` (13.8k files) and `progress/` (11.8k) keep growing against G506.

- **A1 (recommended):** the Codex lane brief says: a 10 min exec yield (`yield_time_ms`) for builds and tests;
  `scripts/proof-run.sh` for anything longer, which pings the pane on exit; never a `sleep` or `wait` poll. Re-briefed
  at each lane's next task boundary. Verify: wait/sleep share of Codex tool time per day, from 66 % to under 10 %.
- **A2 (recommended):** no new receipts: nothing written under `.git/proofs` or `progress/` as proof of work; the
  numbers go in the commit message. Verify: both file counts flat for a week.
- **A3 (optional; more tooling, Jake may veto):** `scripts/agent-time.py`, one read-only file that prints the audit
  numbers on demand (tool-hours by category and agent kind, poll share, gate medians, commits by kind) so every
  wave's Verify is one command instead of a session of ad-hoc parsing.
- **Deletes:** nothing. **Risk:** none. **Effort:** 30 min, plus 1 h for A3.
- **Jake:** ☐ A1 ☐ A2 ☐ A3 ☐ veto

### Phase 1.5 CI: make the red shards green

**Why.** 17 of 41 deploy runs failed on the same two full-suite failures the local gate never runs: `test/quest`
"Unbound quest cable pine" and a Driftwood retained-pin assertion. Every red run costs the hourly deploy a slot and
the pusher lane a round.

- **Approach A (recommended):** the owning lanes fix both at their next boundary; any file that flakes twice in a
  week is quarantined with a `skip` and a plan row naming it.
- **Deletes:** nothing. **Risk:** low. **Effort:** about 1 h each.
- **Verify:** two consecutive green deploy runs; red shards per day from the deploy workflow.
- **Jake:** ☐ A ☐ veto

**Wave 1 Verify, before Wave 2 is asked:** host idle during lane tests above 20 % median; Codex poll share under 10 %;
MCP processes ≤ one set per session that uses them; two green deploys in a row; receipt counts flat.

## Wave 2: the commit and push path (CI is the gate; waits on D1)

### Phase 2.1 One way to commit (D2)

**Why.** The shared index is why commit-message-lock, check-commit-index, index-hygiene and the private-index
procedure exist. A commit given a pathspec builds a temporary index from HEAD plus the named paths and never reads the
shared one. The two files git still touches, `index.lock` and `COMMIT_EDITMSG`, need about one second of exclusion.

- **Approach A (recommended):** `scripts/commit.sh`, the only way to commit:

  ```bash
  #!/usr/bin/env bash
  # commit.sh "<subject and body>" -- <paths…>   (GIT.md: the one way to commit)
  set -euo pipefail
  msg=$1; shift; [ "${1:-}" = -- ] && shift
  for p in "$@"; do git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 || git add -N -- "$p"; done
  exec lockf -k -t 120 .git/commit.lock git commit -q -m "$msg" -- "$@"
  ```

  `guard-bash-safety.sh` refuses a `git commit` that is not this script and any `git add -A` or `git add .`. The
  message still ends with the `Assisted-by` trailer; the commit-msg hook is unchanged. Intent-to-add entries left in
  the shared index are harmless to other lanes' pathspec commits.
- **B:** no wrapper: the rule "`git add -N` new files, then `git commit -- <paths>`", keeping commit-message-lock
  for the `COMMIT_EDITMSG` race.
- **Deletes:** `guard-git-add-all.sh` (folded into bash-safety), the private-index procedure and its memory rules.
- **Risk:** medium; every lane changes how it commits, at a boundary. **Effort:** 0.5 day.
- **Verify:** one day of lane commits with zero `index.lock` or stale-staged-tree errors; commit wall time under 2 s
  average (today 12.2 s). **Rollback:** lanes return to `git commit -- <paths>`.
- **Jake:** ☐ A ☐ B ☐ veto

### Phase 2.2 The pre-commit diet

**Why.** Pre-commit runs six scripts and averages 12 s; under load more. Only two things need the commit itself: the
message convention and the storage policy on the staged blobs.

- **Approach A (recommended):** pre-commit = `scripts/repo-size.mjs --index` (storage policy, about 1 s);
  commit-msg = `commit-msg-conventions` as today; post-commit = five lines that append the commit and lane to
  `.git/commit-lanes.jsonl` (the map the CI watcher needs, written by post-commit today).
- **Deletes:** `commit-message-lock.py`, `check-commit-index.py`, `index-hygiene.mjs`, `precommit-inputs.mjs`,
  `boot-temp-warn.sh`, `commit-sweep-ledger.py`, `check-lock.mjs`, and their hook lines.
- **Risk:** medium (hooks change for everyone). **Effort:** 0.5 day.
- **Verify:** commit time; `repo-size` still refuses a 2 MB blob (one test commit, then reset). **Rollback:** revert.
- **Jake:** ☐ A ☐ veto

### Phase 2.3 Push loop and CI watcher

**Why.** 280 pushes in 72 h took 7 min median because each carried the gate; batches of 11, up to 102 commits; a
red batch held every lane. A single pusher process needs no lock and never blocks a commit.

- **Approach A (recommended):** launchd `com.wildshard.push` every 60 s: when `git rev-list -n1 origin/main..main`
  is non-empty, `git push -q origin main`, one log line in `.git/push.log`. launchd `com.wildshard.ci-watch` every
  5 min: `gh run list --workflow deploy --limit 10 --json headSha,conclusion`; for the newest red SHA not yet pinged,
  map the commits in `<last green>..<red>` to lanes through `.git/commit-lanes.jsonl` and herdr-prompt the first
  lane one line naming the failing job; mark it pinged. About 40 lines in all. A slow uplink only delays the next
  loop; the storage policy already caps binary per push.
- **B:** post-commit pushes inline (holds the commit lock through the upload). **C:** keep `push-main.sh` with the
  gate stripped out.
- **Deletes:** `push-main.sh`, `auto-push.sh`, `green-prefix.mjs`, `push-refusal.mjs`, `.git/push.lock` and the
  "leave local" protocol.
- **Risk:** medium. **Effort:** 0.5 day.
- **Verify:** commit-to-origin median under 2 min for a day; `origin/main == main` within 2 min at every check.
  **Rollback:** revert; the old scripts come back from git.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 2.4 Delete the local gate (D1)

**Why.** The gate duplicates CI, which already typechecks, lints in 4 shards, tests in 10 shards, builds products
and builds the app on every push. Locally it held the push lock 47 % of the clock, went red 52 % of the time, and its
`gen` step alone cost 12.5 h in 72 h.

- **Approach A (recommended):** remove `local-gate.py`, `local-gate-checks.mjs`, `vercel-tree-gate.sh`,
  `gate-cache.mjs`, `gate-trace.mjs`, `gate-related-tests.mjs`, `gate-jobs.sh`, `gate-test-products.json` and the
  `push-gate` heavy-lane slot; pre-push keeps `repo-size.mjs` for the outgoing budget. A red commit reaches origin,
  the watcher pings its lane, the lane fixes forward within the hour, and the deploy ships the newest green.
- **B:** keep a 20 s pre-push of types and oxlint on the changed files, nothing else.
- **Deletes:** eight scripts, the gate stamps under `.git`, 27 → 2 scripts between a commit and origin.
- **Risk:** medium: red main is visible for about 25 min at a time. **Effort:** 0.5 day.
- **Verify:** red-main minutes per day from CI under 2 h; the hourly deploy keeps shipping. **Rollback:** one
  `git revert` restores the files and hook lines.
- **Jake:** ☐ A ☐ B ☐ veto

### Phase 2.5 Retire the pusher lane; write it down

- **Approach A:** `sp-x7` ends at its current task boundary and is not restarted; GIT.md and AGENTS.md say "done =
  pushed and CI green, fix-forward; commit with `commit.sh`"; the gate and leave-local paragraphs go.
- **Deletes:** one Codex lane's purpose; about 60 lines of GIT.md. **Effort:** 1 h.
- **Jake:** ☐ A ☐ veto

**Wave 2 Verify:** commit under 2 s; commit-to-origin under 2 min median; red-main under 2 h/day; zero index errors;
one lane freed.

## Wave 3: partition the Mac; builds and tests in the live tree

### Phase 3.1 Previews without the mirror

**Why.** `serve-build.sh` syncs an exact commit into one of seven mirror slots (31 GB, 41k files each) to build a
preview. Lanes already run focused tests in the live tree; previews can come from it too (G415: similar, not
identical). Exact-SHA readings are the measurement lane's need only.

- **Approach A (recommended):** `serve-build.sh` runs `vite build --outDir tmp/<lane>/dist` from the live tree and
  `vite preview` on it; two build slots through two `lockf` files tried in order. Exact-SHA previews (`--rev`) keep
  one mirror slot, `check`, until REPO-WEIGHT shrinks the tree; the other six slots go (26 GB).
- **B:** no mirror at all; exact-SHA builds use a scoped export of `src public scripts` into `./tmp/rev-<sha>`
  (about 900 MB, 15k files, deleted after; not the `/tmp` whole-tree export of 10-15).
- **C:** measure the live tree only, recording HEAD and the dirty paths in the receipt.
- **Deletes:** six mirror slots and the mirror path of `serve-build.sh`. **Risk:** low. **Effort:** 0.5 day.
- **Verify:** a preview is up within 3 min of the request; disk back 26 GB. **Rollback:** revert.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 3.2 A Linux container for the CPU-only work (only if Wave 1 was not enough)

**Trigger.** After Wave 1, the host still falls under 10 % idle during lane tests, or Phase 3.4 shows quiet and
non-quiet readings disagree for CPU reasons. If Wave 1's caps hold, this phase is skipped.

- **Approach A (recommended if triggered):** Docker Desktop, already installed, set to 12 CPUs, 32 GB, virtiofs.
  `compose.yml` with one service `work` from `node:24-bookworm` (host is 24.18.1), the repo bind-mounted at the same
  absolute path, and five named volumes over the workspace `node_modules` dirs (root, `src/commons`, `src/game`,
  `src/sdk`, `src/format`) because five packages ship darwin-arm64 natives (sharp, oxlint, rolldown, lightningcss,
  fsevents). `scripts/in-linux.sh <cmd>` = `docker compose exec -w "$PWD" work bash -lc "$*"`.
  `pnpm install --frozen-lockfile` inside once and after lockfile changes. `pnpm test`, `pnpm build`, gen, tsc and
  oxlint run through it. The 2 browser-driving test files and the 11 macOS-only scripts stay on the host. Local tests
  then run on Linux like CI's ubuntu runners.
- **B:** Apple's `container` CLI (macOS 26 native, `brew install container`): one lightweight VM per container with
  its own CPU and memory flags, no Docker Desktop. **C:** skip.
- **Deletes:** the heavy-lane prefix from `package.json` scripts. **Risk:** medium: virtiofs is slower on a 600k-file
  tree; the volumes keep `node_modules` and `tmp` native. **Effort:** 1 day.
- **Verify:** full suite in the container within 1.5× of CI's time; host idle during a lane full suite above 30 %;
  frame-floor noise during lane load within the quiet baseline. **Rollback:** stop the container; nothing else changes.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 3.3 Delete the mirror and heavy-lane

- **Approach A:** after 3.1 and 3.2 (or 3.2 skipped): `build-mirror.mjs` and its slots (all, or all but `check` per
  3.1-A), `heavy-lane.py`, `heavy-lane-lease.mjs`, `test_lease_order.py`, the mirror queues and locks; the two-slot
  build `lockf` from 3.1 is the only build limiter.
- **Deletes:** about 60 KB of scripts, 26–31 GB on disk, 3 lock domains. **Risk:** low. **Effort:** 0.5 day.
- **Verify:** no "queued" or "mirror slot" waits in lane logs; build median unchanged or better.
- **Jake:** ☐ A ☐ veto

### Phase 3.4 Measure: quiet versus not

- **Protocol:** the measurement lane, one SHA, `frame-floor.mjs --grid-scenario=milestone --surface=sim
  --ktx2-probe=skip`, two runs inside a quiet window and two outside under normal lane load with Wave 1's caps live.
  "Agree" = drive p95 and p99 within 10 % and on the same side of the 35 ms target. **Effort:** 1 h.
- **Jake:** ☐ run it ☐ veto

### Phase 3.5 The quiet machinery, by 3.4's answer

- **A (if they agree):** delete `quiet-cli.mjs`, `quiet_logs.py`, `.git/quiet` and `lanes/sim-queue.md`; the
  measurement lane runs rows whenever it has one; `sim-lane.sh` shrinks to boot, lease and shutdown (the 99 drive
  locks go).
- **B (if they disagree):** the gap is GPU captures. `browser-lane` drops to 2 slots while a measurement runs (a flag
  file the measurement lane sets), or GPU-heavy captures keep a ten-past-the-hour convention. The quiet file survives
  only as that flag.
- **Deletes:** A: 4 files and a plan table; B: nothing yet. **Risk:** low. **Effort:** 0.5 day.
- **Jake:** ☐ A ☐ B ☐ veto

**Wave 3 Verify:** disk back; preview under 3 min; no queue waits; quiet-vs-not numbers on record.

## Wave 4: coordination

### Phase 4.1 The coordinator is a script

**Why.** One Claude session (`wildshard-new`) did 6,942 turns at about 950k context, sent about 3,800 herdr prompts
and ran 1,088 ad-hoc python snippets: 27 % of all Claude tokens in 72 h, for work a script does.

- **Approach A (recommended):** `scripts/coordinate.mjs`, at most 150 lines, run by launchd every 2 min: read the
  ready-queue rows marked `ready`; `herdr agent list` for idle lanes; hand one row per idle lane as a one-line brief,
  after checking the pane has no open question (the one rule from `herdr-prompt.sh` that survives); mark the row in
  flight; mark it done when a commit subject carries its id; write STATE.md once an hour from the table. The
  coordinator session stops. The plan agent (`wildshard-v`) stays for Jake's picks and plans.
- **B:** keep an LLM coordinator, restarted daily under 200k context, forbidden to poll. **C:** as is.
- **Deletes:** `lane-watchdog.mjs`, `herdr-prompt.sh`, `herdr-question-open.sh`, the hourly report plumbing.
- **Risk:** medium. **Effort:** 1 day.
- **Verify:** Claude cache-read per hour down a quarter; a row assigned within 2 min of a lane going idle; STATE
  commits ≤ 24 a day. **Rollback:** restart the session.
- **Jake:** ☐ A ☐ B ☐ C ☐ veto

### Phase 4.2 Session hygiene

- **Approach A:** every lane brief: restart past 300k context at a task boundary; Codex runs one task per session
  with a five-line handoff kept in the row; `session-brief.sh` shrinks to 10 lines (open asks count, live SHA, plan
  pointer). **Deletes:** most of `session-brief.sh` (19 KB). **Effort:** 0.5 day.
- **Verify:** compactions per day; max context per session.
- **Jake:** ☐ A ☐ veto

### Phase 4.3 Budget pacing

- **Approach A:** `coordinate.mjs` reads `openusage` and stops handing out rows when either weekly budget projects
  past 100 % before its reset; the pace is one line in STATE. **Effort:** 2 h.
- **Verify:** no zero-budget day in the week.
- **Jake:** ☐ A ☐ veto

### Phase 4.4 Plan-state batching

- **Approach A:** STATE.md and the ready queue are written once an hour by the script; `decisions.md` by the plan
  agent only. (164 + 93 commits to those two files in 72 h.) **Effort:** with 4.1.
- **Verify:** plan-file commits per day from about 140 to 30 or fewer.
- **Jake:** ☐ A ☐ veto

## Wave 5: rulebook, lint, receipts, budgets (lowest risk, last)

### Phase 5.1 One-page AGENTS.md

- **Approach A:** about 15 rules: the layers, no barrels, no URL switches, Debug rows, the commit wrapper, storage
  limits, how Jake plays and judges, the question-tool rule. The 80 incident citations move to
  `docs/process/CHANGELOG.md`. `docs/process` keeps GIT.md, MACHINE.md, JAKE.md, DEBUG-TOGGLES.md and STORAGE.md,
  trimmed; the rest archives. Jake reads the page before it lands (review page). **Effort:** 1 day.
- **Deletes:** 58 rule bullets, most of 19 process docs.
- **Jake:** ☐ A ☐ veto

### Phase 5.2 Lint trim

- **Approach A:** keep `layer`, `public-index`, `no-reexport`, `no-url-switch`, `engine-words`, `shard-names`,
  `shard-sandbox`, `no-shard-branch`. Delete the ratchet (`lint/ratchet.json`, 2,384 lines, and its rule),
  ask-ids (`gen-ask-ids`, `lint/ask-ids.json`), `platform-pending-users.json`, `check-platform-ratchets.mjs`;
  `url-params.json` stays only if `no-url-switch` needs an allowlist. **Effort:** 0.5 day.
- **Jake:** ☐ A ☐ veto

### Phase 5.3 Receipts

- **Approach A:** remove `.git/proofs` (13.8k files) and `.git/command-logs` (698); `progress/` takes no new
  receipts; the existing 1.9 GB is REPO-WEIGHT's. **Effort:** 1 h.
- **Jake:** ☐ A ☐ veto

### Phase 5.4 Budget estimate before commit

**Why.** Eight commits in 72 h reverted admitted work after a memory or size budget failed post-landing.

- **Approach A:** the memory and size budget check runs on the diff before commit, lane-side and unserialized, and
  the ready-queue row shows the remaining headroom before a lane starts. Target: zero build-then-revert commits a
  week. **Effort:** 0.5 day.
- **Jake:** ☐ A ☐ veto

## After all five waves

| Surface | Today | After |
|---|---|---|
| Coordination scripts | 113 | about 25 |
| Git hooks / Claude hooks | 5 / 7 | 2 / 3 |
| Lock domains | 5 | 2: the commit lock and the build lock |
| Scripts between a commit and origin | 27 | 2 |
| Copies of the tree on disk | 8 | 1 or 2 |
| Rules in AGENTS.md | 73 | about 15 |

What stays untouched: gen, bake, shardfiles, the layer lint, the host-bar tests, deploy-pin `newest-ci-green`, CI as
it is, browser-lane as a plain slot cap, the herdr guard that protects Jake's open questions, the commit-msg
conventions, repo-size.
