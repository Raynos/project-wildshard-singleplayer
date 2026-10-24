# Shared waits: mini plan (G666)

**State:** `open` 2026-10-24 — fourth reading 13:00 Cancun (the 10-24 morning one was missed). SW1, SW2, SW5, SW6,
SW8 done; SW9 landed 81095e9a06 at 12:50 (proof on the next red run); SW3 open (the 06:14 red ended at 19:01 10-23
after 767 min; nine windows over 30 min since, one open at 12:50); SW4's fseventsd bar not met; SW10 new (idle lanes).
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-24 13:00 Cancun: 10-23 17:20 → 10-24 12:50, 19.5 h; rates per hour to compare with 17:20)

Read with `python3 scripts/agent-time.py --hours 20`, `gh run list` (push runs with every check only) plus the jobs of
the first green and the open red, `.git/push.log`, `.git/commit-lanes.jsonl`, the lanes' transcripts (read only),
`herdr agent list` and `openusage`. Lanes active: Codex sp-x1, x2, x6, x8, x9 and sp-x7; Opus sp-o3 until 09:03 and
sp-o4 until 18:28 (G605: none at 91 %). 338 ledger commits (17/h; 47/h at 17:20); by lane: sp-x6 55, sp-x2 53, sp-x8
50, sp-x9 48, sp-o3 48, sp-x1 35, wildshard-new 24, sp-x7 16, sp-o4 4.

| Shared resource | Held or waited, 19.5 h | Who was blocked | Worst wait | Change vs 17:20 (per hour) |
|---|---|---|---|---|
| Push gate (one push loop) | 1,380 ticks: 288 pushed, 18 red, 215 quiet, 859 idle; gate median 7.5 s, p90 10.5 s, max 17 s. Red: 4 streaks (`guards` 1 at 17:21, `ratchet` 9 at 19:25–19:38, 4 at 01:59, 4 at 09:00), ~30 min blocked | every push: commit → origin median 21 s, p90 66 s | 12.8 min to origin | gate 11 → 7.5 s; origin median 53 → 21 s, p90 3.9 → 1.1 min; blocked 7 → 1.5 min/h |
| CI and red main | **The 06:14 red ended at 19:01 10-23**: 05437036a8 (started 18:44) was the first push run green on every job; **767 min (12 h 47 min) in all**. Then 10 more windows: 19:38 55, 21:11 29, 23:15 59, 01:07 35, 01:42 39, 02:14 66, 03:38 44, 06:57 32, 09:17 25 min, and **11:53 still open at 12:50 (57 min)**: `types` TS6307 (`test/fake/FakeGame.ts` not in the project list), `products`, `derived-docs` (612f449baa, dd79651974). In the window 542 of 1,170 min red (46 %), 9 windows over 30 min (G620); push runs 46 green, 20 red, 194 cancelled; 0 reverts | release: live stayed on ff45b6a24 until ~01:32 10-24 (18 h; hold 15:30 → 692f9bd22e 01:18), then hourly; 9625ae97ec live since ~11:59, pinned by dd79651974 (TB1 crossing hold) | 101 min of the old red; 66 min new | red share 100 → 46 %; one 12.8 h window → median ~45 min, every one fixed forward |
| Build mirror (check..check5, ruler) | 0 `build-mirror.mjs run`, 0 `tmp/*/check.sh` in any lane; Opus 1.79 command-h, all `serve-build --rev` previews of landed SHAs (sp-o3 ~60 for its O27 census); 0 pool timeouts | — | 0 | 0.04 → 0.09 h/h, still landed SHAs only |
| Heavy-lane builds (3 leases) | 186 builds, 0 s queued, median 56 s, p90 139 s, max 463 s; 0 transcript queues over 60 s | — | 0 | 22 → 10 builds/h; same 0 queue |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | official floors by sp-x1 (b68f, 34aa ×2, 9625, a3fe, 436f, a4cb); 0 reaps; sim-queue S8 and S9 still open (since 10-21/22) | sp-x1 slept 3.1 h on its own floors and on "CPU release" handshakes | — | 4 readers → 1 (sp-x1) |
| Browsers (4 slots) | 0 admission timeouts, 2 expired preview reaps (19:37, 00:39) | — | — | same |
| Quiet window | 215 quiet ticks, ~226 min of the push loop paused in 41 spans, all through `sim-quiet.py` (D1) | the push loop; origin median still 21 s | 12 min | 7 → 12 min/h, legitimate |
| Commit lock (commit.sh) | 0 lock timeouts | — | — | same |
| One index / tree | 120 changed paths (ruler `spans-*.json`, Driftwood baked plans and assets untracked) | — | — | 66 → 120 |
| Generated inputs | every push typed `ci`; no `ci-budget` | — | — | same |
| Machine | load 7–9 on 18 cores, 61 % idle; **swap 74.0 of 74.8 GB, 0.8 GB free**, 478 MB RAM unused, 54 GB compressed; **fseventsd 187 % CPU, 25.2 GB**; Logitech updater 63 %; /private/tmp 82k, $TMPDIR 115k; 1.7 TB free; up 9 days | everyone, a little | — | swap free 1.5 → 0.8 GB; fseventsd 100 → 187 %, 20.9 → 25.2 GB |
| Budgets | **Claude weekly 91 %**: G605 0 Opus until Tue 10-27 13:00 Cancun. **Codex weekly 58 %** (15 % at 17:20, ~2.2 points an hour: 100 % ~08:00 Sun 10-25, then 51.9k credits; resets 10-30). Codex poll share 72 %: sleep 7.0 h (sp-x1 3.1, sp-x7 1.6, sp-x6 1.0, sp-x9 0.7, sp-x8 0.5, sp-x2 0.1) | Opus capacity; Codex on its own readings and CI | — | Claude 79 → 91 %; Codex sleep 0.16 → 0.36 h/h |
| Lane idle (new) | 5 Codex building lanes idle 13 lane-h (task end → next prompt over 5 min): sp-x2 3.2, sp-x8 2.6, sp-x6 2.6, sp-x1 2.5, sp-x9 2.2; ~120 "no actionable unclaimed row" replies and many ack-only turns ("acknowledged … on origin and CPU release"). sp-x7 (pusher) idle 10.3 h. At 12:50 sp-x1, x2, x7 idle | the plan | — | not measured at 17:20 |

**Rules broken in the window (SW7 (4)):** none. No mirror run or `tmp/*/check.sh` probe, quiet only through
`sim-quiet.py`, 0 reverts (G674). G620 broken nine times (red over 30 min), the current red open at 57 min. The card
count in the coordinator's prompts was not re-measured.

Measurement notes: a red window starts at the first red push run's creation and ends at the next all-green push run's
completion; deploy-only runs are ignored; 01:07 and 01:42 touch (f62917679d green between). `agent-time.py`'s 61
five-minute waits are source and log reads; a scan of tool outputs found 0. Red-main lane-hours are estimated from
sp-x7's busy time; idle is measured from Codex transcripts only (Opus lanes stopped by G605).

## Top 5 losses (lane-hours, 19.5 h, with the 24 h pace)

1. **Idle Codex lanes: ~13 lane-h (~16 a day), new.** The queue ran dry, not a lock: ~120 "no actionable unclaimed
   row" replies, and turns spent acknowledging other lanes' "on origin / CPU release" pings while Codex is at 58 %
   (SW10).
2. **Red main: ~6 lane-h (~7 a day), estimated.** The 06:14 red closed at 19:01 (767 min in all); then 10 windows, 9
   over 30 min, each fixed forward in 25–66 min by sp-x7 and the owners; one open at 12:50 (TB1 types). SW9 landed at
   12:50, so concurrent reds should now show in one run.
3. **Codex sleeping: ~5.4 lane-h outside sp-x7 (~6.6 a day).** sp-x1 3.1 h on its seven Simulator floors and on
   waiting for "CPU release"; sp-x6 1.0, sp-x9 0.7; BUILD-SPEED 1.4 A1 owns it.
4. **Push loop: ~0.3 lane-h.** 30 min blocked in 4 `ratchet` / `guards` streaks; 226 min quiet for official readings;
   origin median 21 s, worst 12.8 min.
5. **Machine swap at 99 %: unmeasured, worsening.** 0.8 GB swap free (1.5 at 17:20), fseventsd 187 % CPU and 25.2 GB
   (SW4). Nothing has failed yet.

Total: ~24.7 lane-h in 19.5 h (~1.3 an hour). On 17:20's basis (no idle row): ~11.7 lane-h (0.6 an hour against 1.9),
3× better; without red main 0.29 an hour against 0.25.

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h → 0.24 h in 6 h; the 17:20 reading saw the guard refuse both `run` attempts. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; second clean reading 17:20 |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed, S3 in progress; G676 (97f3db9d72, 14:41) makes sp-x7 reproduce and fix every red itself, and CI now prints a dead shard build's stderr (628d618205). Open: the 17:20 reading found one 666-minute red (06:14, still open), products silent for ~5 h, then one red revealed per run (SW9). 10-24 13:00: that red ended at 19:01 10-23 (767 min); 10 windows since, median ~45 min, longest 66, one open at 12:50 (57 min). | owners; sp-x7 | XS | ~3–5 lane-h a day at 11:20, ~38 at 17:20; live within the hour | no red window over 45 min in a reading |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). At 10-24 13:00 fseventsd is at 187 % CPU and 25.2 GB, and swap has 0.8 GB free of 74.8 GB. Jake, optional, one click: quit the Logitech Options+ updater (56 % CPU for 8 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (D5, G675).** **Done** 97e8dcaeb8 (12:45, source preparation dropped; typed lint and related tests left to CI) and aa1994c3a6: gate median 65 s → 11 s, p90 35 s, `ci-budget` 41 of 44 → 2 of 190. Left: its kept `ratchet` and `deleted-paths` steps blocked the loop 42 min in 7 streaks (top 5, 3). | Codex (sp-x9) | XS | ~16 core-h a day; ≥2 lane-h a day | done 2026-10-23 (gate median 11 s) |
| **SW9** | **CI shows every red in one run (D6, G678).** **Landed** 81095e9a06 (12:50 10-24, sp-x7): the behaviour matrix no longer cancels siblings or watches peers; each shard keeps its bail, diagnostics and red exit. C4's `ci-fail-fast.py` stops every other job on a same-run red, so since 13:09 each run named one behaviour shard and concurrent reds surface one 12–15-minute cycle at a time. Delete C4's cross-job stop for the behaviour matrix (keep `--bail=1` per shard and the cause printing): one red run then lists every failing file. Costs CI minutes only. | sp-x7 (G676) | XS | ~2–4 lane-h a day; hours of live | a red run reports every failing behaviour shard |
| **SW10** | **Idle lanes take the next row (new).** The 10-24 reading found 5 Codex building lanes idle 13 lane-h in 19.5 h, ~120 "no actionable unclaimed row" replies and turns spent acking "on origin / CPU release" pings. Delete first: lanes stop waiting on and sending those acks (the Simulator's quiet is the only CPU lock, D1; origin is in `git log`), and the coordinator keeps one claimable row per live lane in the queue, or stops the lane. | coordinator | XS | ~10–16 lane-h a day | building lanes idle under 1 lane-h in a reading |

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
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator's prompts carried it 7 of 88 times by 11:20 and 7 of 209 since. (4) 17:20 reading: 0 breaks; the guard refused sp-o3's and sp-o1's `build-mirror run` attempts (11:26, 11:33); quiet only through `sim-quiet.py`. 10-24 13:00: 0 breaks, no mirror run or probe attempted; quiet only through `sim-quiet.py` (third clean reading for the guards). | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (3 of 3 for the guards; the card not re-counted) |

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
