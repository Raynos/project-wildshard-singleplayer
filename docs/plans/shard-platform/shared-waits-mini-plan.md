# Shared waits: mini plan (G666)

**State:** `open` 2026-10-23 — first reading by a plan-agent subagent (read-only); rows SW1–SW6 open, D1–D2 for
Jake. Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(parked, G659: H1 pre-commit snapshot, P1/C4/S3 reds, K1/K2 generated inputs, M1–M3 mirror and quiet).

## Latest reading (2026-10-23 09:20, last 24 h)

Ten agents: Opus sp-o1..o5 (sp-o2 and sp-o5 stopped ~02:30 at the G605 50 % step), Codex five building lanes plus
sp-x7, the coordinator and the plan agent. 906 commits.

| Shared resource | Held or waited, 24 h | Who was blocked | Worst wait | 10-21 audit |
|---|---|---|---|---|
| Push gate (one push loop) | gate ran 4.0 h (3.7 h of the 9.3 h since 00:00: median 44 s, p90 58 s); 46 red of 774 runs (6 %) | nobody directly: commit → origin median 0.7 min, p90 2.3 min | 14.5 min to origin (held by quiet) | 33.5 of 72 h held, 52 % red |
| CI and red main | **red 17.0 of 24 h**: 19 red windows, 12 longer than G620's 30 min, longest 160 min (00:00–02:40); 84 of 113 finished runs red; 478 of 593 cancelled; **0 reverts** | release (live waits for green), the owning lanes, sp-x7 | 160 min red | — |
| Build mirror (check..check5, ruler) | **Opus lanes 22.9 h of command time in mirror runs** (sp-o1 5.0, o2 5.8, o3 5.5, o4 5.6, o5 1.0; ~750 runs, median 46 s, p90 5.4 min); Codex 0.3 h | four Opus lanes | 2 pool timeouts at 5 min; 22 runs hit the 10-min tool cap | slot queue waited 25–30 min |
| Heavy-lane builds (3 leases) | 14 five-minute timeouts + 3 serve-build preview-room timeouts; 21 builds queued over 60 s (0.9 h) | Codex lanes 12 timeouts, Opus 5 | 268 s queued, then 5-min fails | ~16 timeouts in 4 h (G620) |
| Full-test lane | CI only (SF74 W1); no lane full suites | — | — | — |
| Simulator | 1 lease all day; sim-queue S8, S9 open, the rest dropped (G561) | — | 0 timeouts | — |
| Browsers (4 slots) | 0 admission timeouts; 8 reaps (6 expired previews, one 20-min probe) | — | — | — |
| Quiet window | **29 windows, 2.8 h**; taken 76 times by sp-o4 (42), sp-o3 (19), sp-o5 (15) with their own `tmp/*/quiet.sh`; push loop held 183 ticks | up to 9 lanes read/edit only | 20 min (10-22 10:34) | — |
| Commit lock (commit.sh) | 0 lock timeouts, 0 "shared index busy"; Opus source commits ~19 s each (pre-commit checks); 68 typed-check deferrals | — | — | 12.2 s average commit |
| One index / tree | 37 changed paths (662 at 02:55, G662) | — | — | — |
| Generated inputs | push gate skipped typed checks (`ci-cache-miss`) on 351 of 682 pushes (35 % since 00:00); CI `generated-inputs` red in 29 runs; per preview build gen ~81 s, shardfiles ~72 s | push gate, CI | — | gen median 136 s |
| Machine | load 15.6 on 18 cores, 28 % idle; **swap 29.5 of 30.7 GB**, 43 GB compressed, 10 GB free; **fseventsd 175 % CPU, 17.5 GB** (up 2 d 17 h); mds_stores 61 %; Logitech updater 58 %; /private/tmp 76k files, $TMPDIR 214k; 1.5 TB free; repo `tmp/` 80 GB | everyone, a little | — | load ~86, 0 % idle |
| Budgets | **Claude weekly 62 %** (7 % at 10-22 12:05, ~2 points an hour): G605 steps to 2 Opus at 70 % (~13:00), 1 at 80 % (~18:00), 0 at 90 % (tonight) until Tue 10-27 13:00. Opus lanes are 82 % of Claude cache reads (o3 23 %, o1 20 %, o4 17 %, o5 13 %, o2 9 %), coordinator 11 %. Codex weekly 48 % (resets 10-29), 51.9k credits | Opus capacity | — | Claude 50 % at day 1.9 |

What got better since 10-21: the push gate (11 h a day → 4 h, 52 % → 6 % red), commits reach origin in under a
minute, the load fell from ~86 to ~16, the dirty tree is 37 paths, the Simulator and browsers have no queue, and Codex
polling fell from 66 % to 23 % of tool time (`agent-time.py`; 49 % counting `write_stdin` follow-ups).

Measurement gaps: the mirror writes no log, and `~/.wildshard-heavy-lanes/build-day.log` stopped at 10-21 19:45 by
design (it records 24 h, then never again), so build-lease numbers above are a lower bound from the lanes' transcripts.
`.git/push-gate-steps.jsonl` and `.git/push-timings.jsonl` stopped 10-21 too; `.git/push.log` is the live one.

## Top 5 losses (lane-hours, 24 h)

1. **Pre-land probes in the build mirror: 22.9 lane-h.** Opus lanes apply their patch to HEAD in a mirror slot and run
   checks there (`tmp/t1/stack_probe.py`, `tmp/g571/probe_patch.py`, `tmp/*/check.sh`, `check-mine.sh`): 51 % of all
   Opus command time. G612 D5 and `lanes/common.md:11` already forbid it ("land on types, lint and focused tests").
   They also feed the build-lease timeouts and the file churn, and every probe is several paid Claude turns.
2. **Quiet windows: ~8 lane-h (2.8 h × 9 lanes = 25 lane-h exposed).** Mostly Chromium grid captures and A/B probes,
   not Simulator readings; the other lanes may only read and edit, and pushes stop.
3. **Red main: ~5 lane-h, and live 17 h of 24 behind.** 36 `fix(ci|test|gate)` commits chasing reds; G620's revert
   after 30 minutes did not happen once. Most reds are `behaviour` shards (108 shard failures), then typecheck-lint
   (37) and generated-inputs (29, some checkout infra).
4. **Build-lease waits: ~3.5 lane-h.** 0.9 h queued, 17 five-minute timeouts (1.4 h), plus the rebuilt previews.
5. **Codex waiting on its own long commands: 2.4 h** (`write_stdin` / wait on running vitest and checks). Not a
   shared lock; BUILD-SPEED 1.4 A1 already owns it (10-min yields, `proof-run.sh`).

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main (`git merge-base --is-ancestor`); `build-mirror.mjs run` keeps only serve-build's own re-exec (the ruler imports `openMirror`); delete the lines that teach `build-mirror.mjs run <rev> -- <cmd>` (AGENTS.md:122, GIT.md:175 and :189, MACHINE.md:131). The coordinator tells each Opus lane at its next boundary (G492): land on types, lint, `vitest related` (G612 D5) and delete its own probe scripts. Makes TOOLING-PERF M2 (ruler + 2 slots) safe sooner. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts, Claude turns | two readings in a row under 2 h of Opus mirror runs; `git grep 'build-mirror.mjs run'` finds only serve-build |
| **SW2** | **Quiet only for official Simulator readings (D1).** Chromium and agent-browser captures, A/B probes and diagnostics take no quiet (G415: similar, not identical); MACHINE.md's quiet section says so; lanes delete their `tmp/*/quiet.sh` wrappers. Then BUILD-SPEED 3.4 measures quiet vs not once and 3.5 deletes or keeps the rest. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day; commits reach origin without 20-min holds | under 30 min of `quiet` ticks a day in `.git/push.log` |
| **SW3** | **G620's revert, for real.** At 30 minutes red, sp-x7 bisects the red range on the failing file and reverts the culprit; the owner re-lands. The reading counts reverts against red windows over 30 min. Deeper fixes stay TOOLING-PERF P1 (recently red first), C4 (fail fast) and S3 (repeat reds). | sp-x7 | XS | ~3–5 lane-h a day; live within the hour | no red window over 45 min in a reading |
| **SW4** | **Stop the file churn (D2).** Un-park TOOLING-PERF H1 as a SHARD-PLATFORM extra: pre-commit stops writing 7,461 files / 101 MB to `tmp/commit-source-*` on every commit (~6.8 M files a day at 906 commits), the main feed of fseventsd's 175 % CPU and 17.5 GB. Jake, optional, one click: quit the Logitech Options+ updater (58 % CPU for 8 days). | Codex; Jake | S | ~2–3 cores back, swap headroom; 2–4 s a commit | fseventsd under 50 % CPU in a reading |
| **SW5** | **The reading is one command.** `scripts/agent-time.py` reads `.git/push.log` instead of the two dead files and prints the table above: 5-min timeouts and queue lines from the transcripts, Opus mirror hours, CI red windows and reverts, quiet ticks, machine sample, `openusage`. heavy-lane keeps `build-day.log` without the 24 h expiry. Read-only, no schedule (G585). | Codex | S | ~0.5 h per reading; readings comparable | `python3 scripts/agent-time.py --hours 12` prints every row of the table |
| **SW6** | **Delete the dead locks and logs.** `.git/{auto-push,push,commit-message,commit-ratchet,sweep-ledger}.lock`, `.git/next-index-25186.lock`, `.git/{auto-push,push-launchd,ci-watch-launchd,commit-ratchet,sweep-ledger}.log`, `.git/{gate-timings,commit-hook-times,push-gate-steps,push-timings}.jsonl` (after SW5), `.git/sp-x1-*push*.log`, `.git/c6-*.log`; ~100 stale `~/.browser-lane/got.*`; the ~99 `~/.sim-lane/*.drive.lock` of deleted devices. Each one checked unreferenced (`git grep`) first. | Codex | XS | 0 h; no false holders in a status check | the paths are gone and nothing names them |

After SW1, re-read the build leases: if more than five 5-minute timeouts a day remain, the fix is TOOLING-PERF M1
(previews from the live tree), which needs Jake to un-park it.

## Decisions (G670, Jake 2026-10-23 ~10:20)

- **D1** quiet windows only for official Simulator readings (SW2).
- **D2** TOOLING-PERF H1 un-parked as a SHARD-PLATFORM extra (SW4); the rest of TOOLING-PERF stays parked.
- **D3** lanes follow rules by guardrails, not reminders (SW7).
- **D4** (G674): no reverts, fix forward only (Jake: *"reverts sound like a mess"*). SW3 becomes fix-forward speed: the
  owner fixes, and G671's C4, P1 and S3 shorten red windows.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **SW7** | **Guardrails (D3).** (1) SW1's refusal plus: quiet is taken only by the official Simulator reading script, and neither quiet nor the mirror accepts a caller under `tmp/`. (2) Delete the doc lines that teach a banned move (AGENTS.md:122, GIT.md:175/:189, MACHINE.md:131) in the same commits. (3) `lanes/common.md` gains a 5-rule card of the rules broken in the latest reading; the coordinator pastes it into every new task brief at the boundary. (4) The twice-daily reading counts broken rules by lane; a repeat offender gets the card again at its next boundary. | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief |

## Twice-daily review (~10:45 and ~16:45 Cancun, 15 minutes, one subagent)

Window: the 12 h since the last reading. Fill the same table, compare with the last reading, rewrite "Latest reading"
and the top 5, and add a row only for a new loss over 2 lane-hours a day. No new scripts: until SW5 lands, read:

1. **Push loop:** `.git/push.log` (statuses, `gateSeconds`, `types`, `quiet` ticks); commit → origin from
   `.git/commit-lanes.jsonl` against the pushed tips.
2. **CI:** `gh run list --workflow deploy --limit 600 --created ">=<start>" --json conclusion,createdAt,headSha` → red
   windows, the longest, how many over 30 min; `git log --since=12.hours --oneline | grep -ci revert`.
3. **Waits in the lanes' transcripts** (Claude `~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/*.jsonl`,
   Codex `~/.codex/sessions/2026/10/<day>/rollout-*.jsonl`, read only): count "timed out after 5 min waiting",
   "admission timed out", "heavy-lane: acquired … after Ns queue" over 60 s; Opus Bash time in commands that name
   `build-mirror.mjs`, `serve-build.sh --rev` or a `tmp/*/check.sh`.
4. **Simulator and browsers:** `~/.sim-lane/reap.log`, `~/.browser-lane/reap.log`, open rows in `lanes/sim-queue.md`.
5. **Machine:** `uptime`; `top -l 2 -n 0 | grep 'CPU usage'`; `sysctl vm.swapusage`; `ps -Ao pcpu,rss,etime,comm -r | head`;
   file counts of `/private/tmp` and `$TMPDIR`; `df -h /`; `git status --porcelain | wc -l`.
6. **Budgets:** `openusage` (Claude and Codex weekly) against G605's steps.
