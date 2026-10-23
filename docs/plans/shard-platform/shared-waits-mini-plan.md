# Shared waits: mini plan (G666)

**State:** `open` 2026-10-23 — third reading 17:20 Cancun. SW1, SW2, SW5, SW6, SW8 done; SW7's guards held two
readings running, but the card is still not in every brief; SW3 open (main red 11 h, live 10 h behind); SW4's fseventsd
bar not met; SW9 new, with D6 for Jake.
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-23 17:20 Cancun: 11:20–17:20, 6 h; 12 h numbers 05:20–17:20 where the source has them)

Read with `python3 scripts/agent-time.py --hours 12` and `--hours 6`, `gh run list` plus the job conclusions of every red
run, `.git/push.log`, the lanes' transcripts (read only) and `openusage`. Lanes active: Opus sp-o3, sp-o4 (sp-o1 done at
16:27, sp-o2 and sp-o5 idle; G605's two at 70 %); Codex sp-x1, x2, x6, x8, x9 and sp-x7. 282 commits in 6 h (533 in
12 h); by lane: sp-o3 49, sp-x8 46, sp-x1 40, sp-x9 33, sp-x6 29, sp-x2 28, sp-o4 22, sp-x7 12, sp-o1 7.

| Shared resource | Held or waited, 6 h (12 h) | Who was blocked | Worst wait | Change vs 11:20 |
|---|---|---|---|---|
| Push gate (one push loop) | 176 pushes. **SW8 landed at 12:45**: gate median 65 s → 11 s (p90 108 → 35 s, max 63 s); `ci-budget` 41 of 44 pushes before, 2 of 190 after. The 55 red ticks after 12:45 are 7 streaks of the steps SW8 kept: `ratchet` 5, `deleted-paths` 2 (15:04–15:15, 16:58–17:09), 42 min blocked, 6 `chore(ratchet)` follow-ups (12 h: 411 ticks, 61 red, median 43 s) | every push: commit → origin median 53 s, p90 3.9 min (12 h: 76 s / 3.2 min) | 12 min to origin, in a `deleted-paths` streak | gate 6× faster; origin median 1.5 → 0.9 min, p90 2.8 → 3.9 min (red streaks and quiet) |
| CI and red main | **red the whole window, and the red window is 11 h, not 3**: the last fully green push run is 2281da69f3 (started 06:09, green 06:28); red since 06:14, still open at 17:20 = **666 min**. 6 h: 47 red, 0 green, 129 cancelled. Causes in order: `gen.mjs` in generated-inputs 06:12–08:29; typed lint + behaviour 3/12 08:28–09:29; `build-shardfiles` "Shard build exited 1" with no cause 09:27–16:58 (Nalati's JSON node cap, then gen import breaks; CI printed the stderr only after 628d618205 at 14:14); from 13:09 one behaviour shard per run (16, 3, 6, 14, 8, 2, 6, 2, 14, 11, 1, 13, 13), every other shard cancelled by C4. G676 (97f3db9d72, 14:41): sp-x7 landed 11 fixes 15:17–17:20, still red. 0 reverts (12 h: 2 red windows, 11.7 of 12 h red, longest 669 min) | release: live on ff45b6a24 since 07:29 (9 h 50 min), and a release HOLD since 15:30 (6d1b8ba1cc) until sp-x1's warm-reload check; sp-x7; owners | 666 min, still open | 157 → 666 min (start corrected from 08:42 to 06:14); worse |
| Build mirror (check..check5, ruler) | Opus 0.24 h, all previews of landed SHAs (`serve-build --rev`/`--head`: sp-o3 31, sp-o4 25, sp-o1 7); **the guard refused both `build-mirror.mjs run` attempts** (sp-o3 11:26, sp-o1 11:33, landed SHAs); 0 runs went through (12 h: Opus 1.75 h, mostly before 09:40) | — | 0 real pool timeouts | 0.3 h in 2 h → 0.24 h in 6 h |
| Heavy-lane builds (3 leases) | 135 builds, 0 s queued, build median 60 s, p90 159 s, max 215 s; 0 real 5-minute timeouts (every script hit is a source read) (12 h: 150 builds, 0 queued) | — | 0 | same; median build 213 → 60 s |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | official `sim-grid-entry` readings by sp-o3 (12:27), sp-o4 (15:16), sp-x1 (16:00–16:57), sp-x8 (loading); 0 reaps; 2 open sim-queue rows | sp-x1 and sp-x8 slept 0.77 h on their own readings | — | 1 lease → 4 readers |
| Browsers (4 slots) | 0 admission timeouts, 1 preview reap (17:06, expired) (12 h: 1) | — | — | same |
| Quiet window | **54 quiet ticks, ~44 min of the push loop paused** (12:11–12:30, 13:16, 15:18–16:57), all through `sim-quiet.py` for official Simulator readings (D1); sp-x2 disclosed one overlap at 16:19 (12 h: 92 ticks) | the push loop only | 6 min | 0 → 54 ticks, now legitimate |
| Commit lock (commit.sh) | 0 lock timeouts | — | — | same |
| One index / tree | 66 changed paths | — | — | 58 → 66 |
| Generated inputs | `ci-budget` gone after SW8 (41 → 2); the gen import breaks were fixed by sp-x8 (721a3fcec0 … 941c2278f3, 13:28–14:03) | CI | — | budget share 99 % → 1 % |
| Machine | load 8–14 on 18 cores, 62–83 % idle; **swap 56.8 of 58.4 GB used, 1.5 GB free**; fseventsd 100 % CPU, 20.9 GB; Logitech updater 56 %; /private/tmp 91k files, $TMPDIR 95k; 1.7 TB free | everyone, a little | — | idle 70 → 80 %; swap free 0.5 → 1.5 GB; fseventsd 19.7 → 20.9 GB; $TMPDIR 245k → 95k |
| Budgets | **Claude weekly 79 %** (~2 points an hour): G605's two Opus since ~13:00, one at 80 % (~17:45), none at 90 % (~23:00) until Tue 10-27 13:00 Cancun. Codex weekly 15 % (a reset was applied; now resets 10-30), 51.9k credits; Codex poll share 35 % (sleep 0.94 h in 6 h: sp-x1 0.51, sp-x8 0.26) | Opus capacity; Codex waiting on its own readings | — | Claude 67 → 79 %; Codex 54 → 15 %; Codex polling 8 → 35 % |

**Rules broken in the window (SW7 (4)):** none went through. The guard refused 2 `build-mirror.mjs run` attempts of landed
SHAs (sp-o3 11:26, `heavy-lane build -- build-mirror.mjs run 07b38cc8d4 -- gen.mjs --proof`; sp-o1 11:33,
`build-mirror.mjs run 3d1de4c40d -- build-shardfiles`): rule 3 tried, not broken. Quiet was taken only by `sim-quiet.py`.
No red was fixed within 30 minutes while products failed silently (09:27–14:14); since G676 each red is fixed in
~15–40 min, but there is always another. The coordinator's prompts carried the card text in 7 of 209 since 11:20.

Measurement notes: the 11:20 reading's "red since 08:42" counted deploy-only runs (`schedule` / `workflow_dispatch`,
every check skipped, the pinned ff45 redeployed) as green; `agent-time.py` already skips them (669 min). Its
five-minute-wait and admission counts are still all source reads (SW5's left-over). Red-main lane-hours are estimated
from the fix commits and sp-x7's transcript, not measured.

## Top 5 losses (lane-hours, 6 h, with the 24 h pace)

1. **Red main: ~9.5 lane-h (~38 a day); live 9 h 50 min behind.** sp-x7 ~5.5 h (all of it after G676), sp-x9 ~1.5 h
   on the silent Nalati build (node cap, stderr tail 628d618205, 4724b9b77c), sp-x8 ~1.2 h on gen import breaks
   (13:28–14:20), sp-x2 and sp-x8 ~0.5 h on the docs step (23e671d1fc, cf27a3f9a7), test and ratchet follow-ups by
   sp-x1, sp-x6, sp-x9 ~0.8 h. Products failed with no cause printed for ~5 h; then C4 showed one red per run.
2. **C4 hides every red but the first: part of 1, ~2–4 lane-h a day.** Since 13:09 thirteen runs each named one
   behaviour shard; shard 2 failed at 15:03 and again at 15:40, shard 14 at 14:15 and 15:55, with other reds shown in
   between: concurrent reds are found one 12–15-minute CI cycle at a time (SW9, D6).
3. **The push gate's kept steps go red: ~0.6 lane-h, 42 min of the push loop blocked.** 7 `ratchet` / `deleted-paths`
   streaks after SW8, 6 `chore(ratchet)` commits; worst commit → origin 12 min.
4. **Codex sleeping on its own readings: ~0.9 lane-h** (poll share 8 → 35 %); BUILD-SPEED 1.4 A1 owns it. Quiet paused
   the push loop ~44 min for legitimate Simulator readings (~0 lane-h).
5. **Machine swap at 97 %: unmeasured.** fseventsd at 100 % CPU and 20.9 GB; 1.5 GB swap free (0.5 at 11:20). Nothing
   has failed yet.

Total: ~11.5 lane-h in 6 h (~1.9 an hour) against ~1.8 in 2 h at 11:20 (~0.9 an hour): 2× worse per hour, all of it red
main; without red main ~1.5 lane-h in 6 h (0.25 an hour against 0.15).

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h → 0.24 h in 6 h; the 17:20 reading saw the guard refuse both `run` attempts. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; second clean reading 17:20 |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed, S3 in progress; G676 (97f3db9d72, 14:41) makes sp-x7 reproduce and fix every red itself, and CI now prints a dead shard build's stderr (628d618205). Open: the 17:20 reading found one 666-minute red (06:14, still open), products silent for ~5 h, then one red revealed per run (SW9). | owners; sp-x7 | XS | ~3–5 lane-h a day at 11:20, ~38 at 17:20; live within the hour | no red window over 45 min in a reading |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). At 17:20 fseventsd is still at 100 % CPU and 20.9 GB, and swap has 1.5 GB free. Jake, optional, one click: quit the Logitech Options+ updater (56 % CPU for 8 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (D5, G675).** **Done** 97e8dcaeb8 (12:45, source preparation dropped; typed lint and related tests left to CI) and aa1994c3a6: gate median 65 s → 11 s, p90 35 s, `ci-budget` 41 of 44 → 2 of 190. Left: its kept `ratchet` and `deleted-paths` steps blocked the loop 42 min in 7 streaks (top 5, 3). | Codex (sp-x9) | XS | ~16 core-h a day; ≥2 lane-h a day | done 2026-10-23 (gate median 11 s) |
| **SW9** | **CI shows every red in one run (new, D6).** C4's `ci-fail-fast.py` stops every other job on a same-run red, so since 13:09 each run named one behaviour shard and concurrent reds surface one 12–15-minute cycle at a time. Delete C4's cross-job stop for the behaviour matrix (keep `--bail=1` per shard and the cause printing): one red run then lists every failing file. Costs CI minutes only. | sp-x7 (G676) | XS | ~2–4 lane-h a day; hours of live | a red run reports every failing behaviour shard |

After SW1 the build leases show 0 timeouts in 8 h (135 builds in 6 h, 0 s queued), so TOOLING-PERF M1 is not needed.

## Decisions (G670, Jake 2026-10-23 ~10:20)

- **D1** quiet windows only for official Simulator readings (SW2).
- **D2** TOOLING-PERF H1 un-parked as a SHARD-PLATFORM extra (SW4); the rest of TOOLING-PERF stays parked.
- **D3** lanes follow rules by guardrails, not reminders (SW7).
- **D4** (G674): no reverts, fix forward only (Jake: *"reverts sound like a mess"*). SW3 becomes fix-forward speed: the
  owner fixes, and G671's C4, P1 and S3 shorten red windows.
- **D5** resolved by G675 (Jake ~11:40): delete the gate's source preparation; SW8 done.
- **D6** (open, for Jake): C4's cross-job stop turns concurrent reds into serial CI cycles. Recommended: SW9, delete the
  stop for the behaviour shards (G585; saving CI minutes is not a shared wait). Alternative: keep C4 as it is.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator's prompts carried it 7 of 88 times by 11:20 and 7 of 209 since. (4) 17:20 reading: 0 breaks; the guard refused sp-o3's and sp-o1's `build-mirror run` attempts (11:26, 11:33); quiet only through `sim-quiet.py`. | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (2 of 2 for the guards; the card is still not in every brief) |

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
