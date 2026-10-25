# Shared waits: mini plan (G666)

**State:** `open` 2026-10-24 — fifth reading 17:28 Cancun (4.5 h since 13:00). SW1, SW2, SW5, SW6, SW8 done; SW9's
bar met (fbb51b9602 reported behaviour 7 and 9 in one run); SW4's and SW10's bars met once in a short window; SW3 open
(one red window open 155 min at 17:28, 9 causes in a row); SW11 new (CF1's commit cost, ~4 lane-h a day).
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-24 17:28 Cancun: 13:00 → 17:28, 4.5 h; rates per hour to compare with 13:00)

Read with `python3 scripts/agent-time.py --hours 4`, `gh run list` (push runs with every check only) plus the jobs and
failed logs of every red run, `.git/push.log`, the six Codex transcripts (read only; commit.sh calls timed from their
command records), `herdr agent list` and `openusage`. Lanes active: Codex sp-x1, x2, x6, x8, x9 and sp-x7; no Opus
(G605 at 95 %). 207 commits by 17:20 (48/h; 17/h at 13:00): Codex-trailer lanes 92, sp-x8 49, sp-x2 42, Claude 29.

| Shared resource | Held or waited, 4.5 h | Who was blocked | Worst wait | Change vs 13:00 (per hour) |
|---|---|---|---|---|
| Push gate (one push loop) | 326 ticks: 144 pushed, 20 red, 17 quiet, 145 idle; gate median 12 s, p90 18 s, max 39 s. Red: 4 streaks (`deleted-paths` 14:35, `guards` 14:56–15:00, `ratchet` 16:24–16:30, `deleted-paths` 16:41–16:51), ~16 min blocked | every push: commit → origin median 33 s, p90 72 s | 9.1 min to origin | gate 7.5 → 12 s; origin median 21 → 33 s; blocked 1.5 → 3.6 min/h |
| CI and red main | The 11:53 red ended 12:58 (65 min, a4cb1fc8f2). Then 2 windows: 13:47 41 min (typed lint `scripts/shard-phone-memory.mjs`; green 911a9fe570 14:28) and **14:53 still open at 17:28 (155 min)** with 9 causes in a row, each landed on red main during the freeze sweep: stale Nalati generated files (generated-inputs, 5 runs 15:02–15:16 at 2 min each), `.mjs` under a shard `blender/` (shard-sandbox lint), `script-v2-strip` ENOENT after 6d46eeb66a, `gen-docs` after c904b7a0ef / 326950c025, `grid-home-policy` TS2345 after 22a21f4b0c, `scripts/vitest-module-cache.ts` typed lint (d7071daebb, 15:58), the closed-component lock `colliders.ts#placedGeometryCollider` (16:35), `src/sdk/*` error-typed lint (17:00), behaviour 7 and 9 on fbb51b9602 (17:16). Red 196 of 268 min (73 %), 1 window over 45 min (G692); push runs 5 green, 18 red, 79 cancelled (77 %); 0 reverts | release: TB1 hold lifted 13:22 (3bea488858); lattice hold d0d481b807 15:26 → lifted 63cf947c11 15:34 (8 min); that release skipped 3f99852c91 (its smoke was cancelled), so live is e6627ba522 (14:22) and nothing newer can ship while red | 155 min, open | red share 46 → 73 %; median ~45 min → one 155-min window |
| CI verdict time (CF3, 1f76530a1d 14:01) | Green push → last job 15.5, 22.2, 20.9 min (n=3, median 20.9; 10 greens 09:29–13:22 median 26.0, audit 19); first job → last 15.8 (16.9 before). Red verdicts median 12.6 min (7 full red runs 15:15–17:00; audit 17). Queue to the first job 0–5 min sets the spread | every lane's verdict | 22.2 min green | red verdict ~17 → 12.6 min; green ≤ 13 min not met (n=3) |
| Build mirror (check..check5, ruler) | 0 `build-mirror.mjs run`, 0 `tmp/*/check.sh`; ~30 `serve-build --rev` previews by Codex lanes, all landed SHAs (the guard); 0 pool timeouts | — | 0 | Opus 0.09 → 0 h/h (no Opus lanes) |
| Heavy-lane builds (3 leases) | 35 builds, 0 s queued, median 40 s, p90 164 s, max 228 s; 0 transcript queues over 60 s | — | 0 | 10 → 8 builds/h; same 0 queue |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | 0 reaps; sim-queue S8 and S9 still open; lanes ran `sim-quiet.py status` dozens of times waiting for "CPU release" | sp-x9, sp-x6 sleeps | — | same |
| Browsers (4 slots) | 0 admission timeouts, 0 reaps; 2 Playwright Chromium live at 17:25 | — | — | same |
| Quiet window | 17 quiet ticks (~17 min), all through `sim-quiet.py` (D1) | the push loop | — | 12 → ~4 min/h |
| Commit lock (commit.sh) | 0 lock timeouts. **CF1 (f4465ac4ab 14:16) made commit.sh slow:** wall median 3.1 s (09:00–14:16, n=41) → 23 s (n=98), p90 22 → 76 s, max 126 s; 79 calls after 14:16 took 50 min. A one-suite run costs 15–24 s (Vitest start); a hub file selects 100–324 suites and runs 60–125 s (the 60 s cap is not a wall cap). 0 commits refused on a failing test; ~13 deferred to CI; 2 sp-x7 commits refused by "Commit index changed during related checks" | every committer | 126 s | new: ~0.17 lane-h/h |
| One index / tree | 108 changed paths (Driftwood baked plans and assets untracked) | — | — | 120 → 108 |
| Generated inputs | every push typed `ci`; CI's generated-inputs red 5 runs in a row (15:02–15:16), 2 min each | — | — | same |
| Machine | load 6.7–9.9 on 18 cores, 51–68 % idle; **swap files shrank to 7.0 GB (0.9 free), 60 GB RAM unused**; **fseventsd restarted ~13:18, 0 % CPU, 20 MB**; **a runaway `grep` from the 13:00 reading's own subagent held one core for 4.5 h** (backtracking regex over transcripts; sp-x1 inspected it at 13:30 while waiting for CPU), killed by PID 17:26; Logitech updater 53 %; /private/tmp 85k, $TMPDIR 131k; 1.7 TB free; up 9 days | sp-x1's CPU waits | — | fseventsd 187 → 0 %; swap 0.8 GB free of 74.8 → 0.9 of 7.0 |
| Budgets | **Claude weekly 95 %**: G605 0 Opus until Tue 10-27 13:00 Cancun. **Codex weekly 74 %** (58 % at 13:00, ~3.6 points an hour: 100 % ~00:40 Sun 10-25, then 51.9k credits; resets 10-30). Codex sleep 1.72 h (sp-x9 0.96, sp-x6 0.37, sp-x1 0.31, sp-x8 0.06, sp-x7 0.02) | Opus capacity; Codex | — | Claude 91 → 95 %; Codex 2.2 → 3.6 points/h; sleep 0.36 → 0.38 h/h |
| Lane idle | building lanes idle 0.76 lane-h (task end → next prompt over 5 min): sp-x9 0.32, sp-x2 0.19, sp-x6 0.15, sp-x1 0.10, sp-x8 0; sp-x7 (pusher) 1.92 h; 2 "no actionable unclaimed row" replies (sp-x1). At 17:28 sp-x7 idle, the rest working | the plan | — | building idle 0.67 → 0.17 lane-h/h; replies ~6/h → 0.4/h |

**Rules broken in the window (SW7 (4)):** none. No mirror run or `tmp/*/check.sh` probe, previews only of landed SHAs,
quiet only through `sim-quiet.py`, 0 reverts (G674). G692's 45-minute cap broken once (the 14:53 red, 155 min and open).

Measurement notes: a red window starts at the first red push run's creation and ends at the next all-green push run's
completion; deploy-only runs (13:23, 14:23, 14:32, 15:35) are not green. Red-main lane-hours use the 13:00 reading's
rate (~0.66 lane-h per red hour). Idle and sleep are from Codex transcripts; `agent-time.py`'s 31 five-minute waits are
source and fixture reads (0 real in the command records). CF1's cost compares commit.sh walls before and after 14:16.

## Top 5 losses (lane-hours, 4.5 h, with the 24 h pace)

1. **Red main: ~2.2 lane-h (~12 a day), estimated.** One window open 155 min at 17:28 with 9 causes landed in a row
   during the freeze sweep; 4 of the 9 are typed lint, which only CI runs. CF4 named d7071daebb (sp-x2) on the typed
   lint run, but printed "culprit report unavailable: RuntimeError" on two behaviour runs. `ci-fail-fast.py` still stops
   products and the typecheck shards on a peer's red (6 of 18 red runs), so a hidden red costs one more ~13-min cycle.
2. **Codex sleeping: ~1.7 lane-h outside sp-x7 (~9 a day).** sp-x9 0.96 h, sp-x6 0.37, sp-x1 0.31, mostly polling
   `sim-quiet.py status` for "CPU release" (BUILD-SPEED 1.4 A1).
3. **CF1's commit cost: ~0.75 lane-h (~4 a day), new (SW11).** commit.sh median 3 → 23 s, p90 22 → 76 s, max 126 s;
   0 refusals on a failing test in its first 3 h; 3 of the 9 red causes were tests or types on the culprit's files, two
   of them read files by path or spawn a script, which `vitest related` cannot see.
4. **Idle lanes: ~0.8 lane-h building (+1.9 sp-x7) (~4 a day), down from ~16.** 2 "no actionable" replies against
   ~120 at 13:00; SW10's bar met in this short window.
5. **Push loop and machine: ~0.3 lane-h.** 16 min blocked in 4 streaks, origin median 33 s; the reading's own runaway
   `grep` held a core 4.5 h (killed); fseventsd back to 0 %.

Total: ~5.8 lane-h in 4.5 h (~1.3 an hour, same as 13:00). Without idle: ~5.0 (1.1 an hour against 0.6): red main and
CF1 grew, idle fell.

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h → 0.24 h in 6 h; the 17:20 reading saw the guard refuse both `run` attempts. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; second clean reading 17:20 |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed; G676 (97f3db9d72) makes sp-x7 reproduce and fix every red itself; CF3 (1f76530a1d) cut red verdicts ~17 → 12.6 min; CF4 (eafc904ce9) names candidates on typed-lint reds. 10-24 13:00: 10 windows, median ~45 min. **10-24 17:28: the 14:53 red open 155 min with 9 causes landed in a row** (4 typed lint); CF4's culprit report fails with `RuntimeError` on behaviour runs (sp-x7). | owners; sp-x7 | XS | ~3–5 lane-h a day at 11:20, ~12 a day at 17:28 | no red window over 45 min in a reading (30 once CF3's greens show ≤ 13 min, G692) |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). At 10-24 13:00 fseventsd was at 187 % CPU and 25.2 GB with 0.8 GB swap free. **10-24 17:28: bar met without a commit** (fseventsd restarted ~13:18, 0 % and 20 MB; swap files 7 GB, 60 GB RAM unused); re-check at the next 12 h reading. Jake, optional, one click: quit the Logitech Options+ updater (53 % CPU for 9 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading (met 17:28, once) |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (D5, G675).** **Done** 97e8dcaeb8 (12:45, source preparation dropped; typed lint and related tests left to CI) and aa1994c3a6: gate median 65 s → 11 s, p90 35 s, `ci-budget` 41 of 44 → 2 of 190. Left: its kept `ratchet` and `deleted-paths` steps blocked the loop 42 min in 7 streaks (top 5, 3). | Codex (sp-x9) | XS | ~16 core-h a day; ≥2 lane-h a day | done 2026-10-23 (gate median 11 s) |
| **SW9** | **CI shows every red in one run (D6, G678).** **Landed** 81095e9a06 (12:50 10-24, sp-x7); **bar met 17:16**: fbb51b9602's run reported behaviour 7 and 9 together. Left, same D6 logic and deletion only: `ci-fail-fast.py` still stops products and the typecheck shards when a peer is red ("Peer job … stopped this owned command", 6 of 18 red runs in the 17:28 reading), which hid the closed-component lock red until 16:35; delete that stop too, keeping each job's own bail and cause printing. Costs CI minutes only. | sp-x7 (G676) | XS | ~2–4 lane-h a day; hours of live | every failing job of a red run reports its own cause (behaviour part met 17:16) |
| **SW10** | **Idle lanes take the next row.** The 10-24 13:00 reading found 5 Codex building lanes idle 13 lane-h in 19.5 h and ~120 "no actionable unclaimed row" replies. Delete first: lanes stop waiting on and sending "on origin / CPU release" acks (the Simulator's quiet is the only CPU lock, D1; origin is in `git log`), and the coordinator keeps one claimable row per live lane in the queue, or stops the lane. **10-24 17:28: bar met in a 4.5 h window** (0.76 lane-h building idle, 2 replies); the `sim-quiet.py status` polling for "CPU release" goes on (top 5, 2). | coordinator | XS | ~10–16 lane-h a day | building lanes idle under 1 lane-h in a 12 h reading |
| **SW11** | **Make commit-time related tests cheaper, never skipped (G703).** Replace both >20 size deferrals with an always-executed staged/direct plus bounded nearest-importer selection. Keep the single entry-time 60 s budget, staged TS6307 refusal, candidate-index isolation and fatal executed reds. Print the selected and executed suites; prove a red above the old 20-suite line refuses. The old delete-the-run fallback is superseded by G703. | source done (2026-10-24, sp-x8): both size skips removed; all staged tests plus 20 nearest static importers, one batched candidate-object read and printed selection/run counts. Reds over both former 20-file/suite limits now refuse; 38 focused cases, root/scripts types and named typed lint pass. Entry-time 60 s, TS6307, candidate isolation, strict CI products and observed-red-at-deadline refusal remain. p90 reading open | XS | ~3 lane-h a day | commit.sh p90 <= 30 s in a reading; no size-based test skip |

After SW1 the build leases show 0 timeouts in 8 h (135 builds in 6 h, 0 s queued), so TOOLING-PERF M1 is not needed.

## Decisions (G670, Jake 2026-10-23 ~10:20)

- **D1** quiet windows only for official Simulator readings (SW2).
- **D2** TOOLING-PERF H1 un-parked as a SHARD-PLATFORM extra (SW4); the rest of TOOLING-PERF stays parked.
- **D3** lanes follow rules by guardrails, not reminders (SW7).
- **D4** (G674): no reverts, fix forward only (Jake: *"reverts sound like a mess"*). SW3 becomes fix-forward speed: the
  owner fixes, and G671's C4, P1 and S3 shorten red windows.
- **D5** resolved by G675 (Jake ~11:40): delete the gate's source preparation; SW8 done.
- **D6** (G678, Jake 2026-10-23 ~17:45): **delete the cancel.** C4's cross-job stop goes for the behaviour shards (SW9),
  so one red run lists every failing test; extra CI minutes are accepted.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator's prompts carried it 7 of 88 times by 11:20 and 7 of 209 since. (4) 17:20 reading: 0 breaks; the guard refused sp-o3's and sp-o1's `build-mirror run` attempts (11:26, 11:33). 10-24 13:00 and 17:28: 0 breaks, no mirror run or probe, previews only of landed SHAs, quiet only through `sim-quiet.py` (fourth clean reading for the guards). | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (4 of 4 for the guards; the card not re-counted) |

## Twice-daily review (~10:45 and ~16:45 Cancun, 15 minutes, one subagent)

Window: the 12 h since the last reading. Fill the same table, compare with the last reading, rewrite "Latest reading"
and the top 5, and add a row only for a new loss over 2 lane-hours a day. SW5 has landed, so start with
`python3 scripts/agent-time.py --hours 12`; for what it leaves out or over-counts, read:

1. **Push loop:** `.git/push.log` (statuses, `gateSeconds`, `types`, `steps`, `quiet` ticks); commit → origin from
   `.git/commit-lanes.jsonl` against the pushed tips.
2. **CI:** `gh run list --workflow deploy --limit 600 --created ">=<start>" --json conclusion,createdAt,headSha,event` → red
   windows, the longest, how many over 30 min; a deploy-only `schedule` / `workflow_dispatch` run (checks skipped) is
   not green; `git log --since=12.hours --oneline | grep -ci revert`.
3. **Waits in the lanes' transcripts** (Claude `~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/*.jsonl`,
   Codex `~/.codex/sessions/2026/10/<day>/rollout-*.jsonl`, read only): count "timed out after 5 min waiting",
   "admission timed out", "heavy-lane: acquired … after Ns queue" over 60 s; Opus Bash time in commands that name
   `build-mirror.mjs`, `serve-build.sh --rev` or a `tmp/*/check.sh`.
4. **Simulator and browsers:** `~/.sim-lane/reap.log`, `~/.browser-lane/reap.log`, open rows in `lanes/sim-queue.md`.
5. **Machine:** `uptime`; `top -l 2 -n 0 | grep 'CPU usage'`; `sysctl vm.swapusage`; `ps -Ao pcpu,rss,etime,comm -r | head`;
   file counts of `/private/tmp` and `$TMPDIR`; `df -h /`; `git status --porcelain | wc -l`.
6. **Budgets:** `openusage` (Claude and Codex weekly) against G605's steps.
7. **Lane idle:** gaps over 5 minutes between a Codex `task_complete` and the next prompt, per lane, and the count of
   "no actionable row" replies; `herdr agent list` for who is idle now.
