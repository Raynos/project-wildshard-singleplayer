# Shared waits: mini plan (G666)

**State:** `open` 2026-10-25 — sixth reading 10:45 Cancun (run 11:20; 17.8 h since 10-24 17:30). SW1, SW2, SW5, SW6,
SW8, SW10 done; SW4 done (fseventsd 0 % in two readings); SW11 landed (729ff54811, ed647c4859), p90 bar open; SW9's
bar met, peer-stop deletion left; SW3 open and worse by the G692 cap (5 of 8 windows over 45 min, the 14:53 red ran
285 min; a red window opened 10:14 and was still open at 11:20). G708 worked: peer herdr messages 167 -> 39 -> ~17 an
hour, claim/record docs commits 24 -> 0.
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-25 10:45 Cancun, run 11:20: 10-24 17:30 → 10-25 11:20, 17.8 h; rates per hour to compare with 10-24 17:00)

Read with `python3 scripts/agent-time.py --hours 17`, `gh run list` (push runs, cancelled ignored) plus the jobs of every
red run, `.git/push.log`, the six Codex transcripts (read only; only commands that start with the tool count, so a
doc or a herdr message that quotes "timed out" does not), `herdr agent list`, `openusage`. Lanes: Codex sp-x1, x2, x6,
x8, x9 working and sp-x7 (pusher) idle at 11:20; no Opus (Claude weekly 100 %, G605). 531 commits (30/h; 48/h at
17:00): Codex-trailer lanes 287, sp-x2 100, Claude 51, sp-x8 46; 0 reverts (G674).

| Shared resource | Held or waited, 17.8 h | Who was blocked | Worst wait | Change vs 17:00 (per hour) |
|---|---|---|---|---|
| Push gate (one push loop) | 1,320 ticks: 403 pushed, 67 red, 21 quiet, 829 idle; gate median 12 s, p90 17 s, max 27 s. Red: 13 streaks, all `ratchet` (with `deleted-paths` in 3), 52 min blocked (longest 11 min, 04:48) | every push: commit → origin median 32 s, p90 86 s | 11.8 min to origin | gate p90 18 → 17 s; origin median 33 → 32 s; blocked 3.6 → 2.9 min/h |
| CI and red main | 8 red windows (first red push run to the next all-green push run's end): the 14:53 one ended 19:38 (**285 min in all**, 128 in this window; causes: 3 generated-inputs, then typed lint and behaviour reds); 19:52–22:20 148 min; 22:20–00:23 123 min; 02:50–03:15 25; 03:39–04:19 40; 06:01–06:19 18; 07:15–08:47 92; **10:14 open at 11:20 (66 min), four behaviour reds in a row on different shards (10/14, 10/6, 6/1, 1/6)**. Red ~10.6 of 17.8 h (60 %), **5 windows over 45 min (G692)**, 6 over 30. Push runs: 34 green, 41 red, 261 cancelled (77 %). The 41 reds: 16 generated-inputs (2 min each, cheap), about 20 behaviour (shards 5 ×4, 16 ×4, 9 ×2…), 3 typed lint, 2 CSS check, 1 derived-docs, 1 products, 2 build-and-deploy only | every lane's verdict; live | 285 min | red share 73 → 60 %; windows over 45 min 1 → 5 (the long ones are the freeze-sweep tail and two night windows) |
| Release and boot smoke | live is 784ed823 (deploy 10:09, success); a deploy dispatch of 96d0860f58 was running at 11:10. The release hold `c07d91f5c0` (03:29, a 9dc-less candidate barred by wildshard-new) was lifted by `3b77617641` at 03:49, 20 min. boot-smoke: 23 success, 10 failure, 1 cancelled (all `workflow_dispatch`: 22:20, 00:23, 00:35, 02:31, 03:40, 04:19, 04:32, 09:01, 09:42, 10:15) | releases | 20 min hold; smoke reds on newest candidates | holds 8 → 20 min; smoke reds 10 in 17.8 h (red main blocks the dispatch, then a red smoke) |
| CI verdict time (CF3) | Green push → last job median 17.0 min (n=34, max 24.2; 20.9 at 17:00); red verdicts median 13.6 min (n=41, 2-min generated-inputs reds included; 15.7 for the 27 over 6 min; 12.6 at 17:00). Green ≤ 13 min still not met | every lane's verdict | 24.5 min | green 20.9 → 17.0 min; red 12.6 → 15.7 min (full runs) |
| Build mirror (check..check5, ruler) | 0 `build-mirror.mjs run`, 0 `tmp/*/check.sh` in the six Codex transcripts; Opus command hours 0.00; previews only of landed SHAs; 0 pool timeouts | — | 0 | same |
| Heavy-lane builds (3 leases) | 217 builds, 0 s queued, median 28 s, p90 150 s, max 329 s; 0 transcript queues over 60 s | — | 0 | 8 → 12 builds/h; same 0 queue |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | reap log 4 releases (22:38–23:39); sim-queue S8 and S9 still open; `sim-quiet.py status` polled 92 times (sp-x9 44, sp-x8 27, sp-x1 21) | the pollers' sleeps | — | same cause, polls ~10 → 5/h |
| Browsers (4 slots) | 0 reaps; 2 Playwright headless shells live at 11:22 (one at 99 % CPU) | — | — | same |
| Quiet window | 21 quiet ticks (~21 min), 0 writes of `.git/quiet` outside `sim-quiet.py` (D1) | the push loop | — | ~4 → ~1.2 min/h |
| Commit lock (commit.sh), SW11 | 0 lock timeouts (the 5 "timed out after 5 min" hits are source reads, not holds). **Wall time, 156 calls: median 16.4 s, p90 43.8 s, max 127.5 s** (CF1 at 17:00: 23 / 76 / 126 s); per lane median sp-x1 31 s, the rest 15–18 s. SW11 landed 729ff54811 (17:39) and ed647c4859 (21:44, always run bounded related tests) | every committer | 127.5 s | p90 76 → 44 s; ~0.17 → ~0.05 lane-h/h |
| Peer herdr (G708) | **1,255 `herdr-prompt.sh` sends in 17.8 h** (sp-x2 285, x8 242, x7 225, x6 196, x1 192, x9 115): 737 in the 4.4 h before G708 (21:55) = 167/h; 518 in the 13.4 h after = 39/h; the last 7 h ~17/h (one burst of 104 in the hour from 01:00 Cancun). Before G708: 1,559 in 10.5 h = 148/h | each message is a turn for the receiver | — | 148 → 70/h overall, 167 → 39 → ~17/h after G708 |
| Separate docs commits (G708) | claim/record docs commits (`docs(types): record …`, `claim …`): **24 before 21:55, 0 after**; other docs commits 30 before, 38 after (mostly `docs(plan)` by the coordinator and plan agent: 49 in the window) | — | — | ~95 in 10.5 h (9/h) → 24 in 4.4 h (5.5/h) → 0 |
| One index / tree | 117 changed paths | — | — | 108 → 117 |
| Generated inputs | every push typed `ci`; CI's generated-inputs red 16 times (2 min each, 7 streaks of 1–5 in a row, e.g. 19:10–19:19, 20:20–20:34, 06:01–06:06) | whoever pushes next | — | same |
| Machine | load 1.9–4.1 on 18 cores, 87–93 % idle; swap 5.5 of 7.2 GB used (1.7 free; 0.9 at 17:00); 63 GB RAM unused; fseventsd 0 % (second clean reading); Logitech updater 45 % CPU for 10 days; /private/tmp 61k files, $TMPDIR 254k (131k at 17:00; node-compile-cache 51k, 22 `wildshard-generation-*` dirs of ~2.5k), below the 500k warning; 1.6 TB free; up 10 days | — | — | CPU 51–68 → 87–93 % idle; TMPDIR +123k |
| Budgets | **Claude weekly 100 %** (resets Tue 10-27 12:59 Cancun): 0 Opus. **Codex weekly 22 %** (74 % at 17:00; the week rolled over, resets 11-01, 51.5k credits, one rate-limit reset in hand). Codex sleep 3.9 h by `agent-time` (poll share 56 %): 0.22 h/h | Opus capacity | — | Claude 95 → 100 %; Codex 74 → 22 % (the week rolled over); sleep 0.38 → 0.22 h/h |
| Lane idle | building lanes idle **0.17 lane-h** in 17.8 h (task end → next prompt over 5 min): sp-x6 0.09, sp-x9 0.08, sp-x1/x2/x8 0; 0 "no actionable row" replies; sp-x7 (pusher) 11.3 h in 58 gaps, by design. At 11:20 sp-x7 idle, the rest working | the plan | — | building idle 0.17 → 0.01 lane-h/h; replies 0.4/h → 0 |

**Rules broken in the window (SW7 (4)):** none for the guards: 0 mirror runs or `tmp/*/check.sh` probes, previews only of
landed SHAs, quiet only through `sim-quiet.py`, 0 reverts. G692's 45-minute cap broken 5 times (6 over 30 min).

Measurement notes: a red window starts at the first red push run's creation and ends at the next all-green push run's
completion; deploy-only runs (`workflow_dispatch`, `schedule`) are not green (the 11 dispatch successes and the
10:09 deploy are not counted). Red-main lane-hours use the ~0.66 lane-h per red hour of the 13:00 reading. Herdr counts
are commands whose first word is `scripts/herdr-prompt.sh` or `herdr agent prompt|pane send-text|run|send-keys`. Idle
and sleep come from Codex transcripts; `agent-time.py` counts sleep by wall time (3.9 h; requested sleep seconds sum
to 5.0 h). Lock hits that quote source or a herdr message are excluded.

## Top 5 losses (lane-hours, 17.8 h, with the 24 h pace)

1. **Red main: ~7.0 lane-h (~9.5 a day), estimated.** 10.6 red hours in 5 windows over 45 min; reds cluster by
   cause: 16 two-minute generated-inputs runs and about 20 behaviour reds (shards 5 and 16 four times each). The window
   opened at 10:14 had four different behaviour shards fail in four consecutive pushes, so each peer landed on a red main
   and added a cause. 0.39 lane-h/h against 0.49 at 17:00, but the cap is broken far more often.
2. **Codex sleeping: ~3.9 lane-h (~5 a day), down from ~9.** sp-x1 1.9 h, sp-x8 1.6, sp-x9 1.0 requested, mostly
   `sim-quiet.py status` polls (92) and CI waits; BUILD-SPEED 1.4 A1.
3. **Push loop: 52 min blocked, ~0.9 lane-h (~1.2 a day).** All 13 streaks are the kept `ratchet` step (11 min on 04:48
   alone); SW8 left it in.
4. **commit.sh (SW11): ~1.0 lane-h (~1.3 a day), down from ~4.** Median 16 s, p90 44 s; sp-x1's median is 31 s (its
   commits touch hub files).
5. **Idle and machine: ~0.2 lane-h.** Building lanes idle 0.17 h; TMPDIR doubled to 254k files; the Logitech updater
   still holds 45 % of a core.

Total: ~13.2 lane-h in 17.8 h (~0.74 an hour against ~1.3 at 17:00; no idle: 0.73 against 1.1): red main fell a little,
sleeping, CF1's commit cost, the push loop and idle fell sharply. G704/G708 worked on what they target (peer herdr
messages 167 -> 39 -> ~17 an hour, claim/record docs commits 0 since 21:55, 30 commits an hour of real code against 48);
the one thing that did not move is how often red main outlives 45 minutes.

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h → 0.24 h in 6 h; the 17:20 reading saw the guard refuse both `run` attempts. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; second clean reading 17:20 |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed; G676 (97f3db9d72) makes sp-x7 reproduce and fix every red itself; CF3 (1f76530a1d) cut red verdicts ~17 → 12.6 min; CF4 (eafc904ce9) names candidates on typed-lint reds. 10-24 13:00: 10 windows, median ~45 min. 10-24 17:28: the 14:53 red open 155 min with 9 causes in a row. **10-25 10:45: that window ended 19:38 at 285 min; 8 windows in 17.8 h, 5 over 45 min (148, 123, 92, the 10:14 one open 66 min at 11:20), red 60 % of the time;** four different behaviour shards failed in four consecutive pushes in the open window. CF4's culprit report fails with `RuntimeError` on behaviour runs (sp-x7). | owners; sp-x7 | XS | ~3–5 lane-h a day at 11:20, ~12 a day at 17:28, ~9.5 a day at 10-25 11:20 | no red window over 45 min in a reading (30 once CF3's greens show ≤ 13 min, G692) |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). At 10-24 13:00 fseventsd was at 187 % CPU and 25.2 GB with 0.8 GB swap free. **Done: bar met in two readings (10-24 17:28 and 10-25 11:20: fseventsd 0 %, swap 5.5 of 7.2 GB used, 63 GB RAM unused, 87–93 % CPU idle).** Jake, optional, one click: quit the Logitech Options+ updater (53 % CPU for 9 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading (met twice, done 2026-10-25) |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (D5, G675).** **Done** 97e8dcaeb8 (12:45, source preparation dropped; typed lint and related tests left to CI) and aa1994c3a6: gate median 65 s → 11 s, p90 35 s, `ci-budget` 41 of 44 → 2 of 190. Left: its kept `ratchet` and `deleted-paths` steps blocked the loop 42 min in 7 streaks at 17:28 and 52 min in 13 streaks (all `ratchet`, 11 min at 04:48) at 10-25 11:20 (top 5, 3); delete or move the step to CI. | Codex (sp-x9) | XS | ~16 core-h a day; ≥2 lane-h a day | done 2026-10-23 (gate median 11 s) |
| **SW8a** | **Catch touched-source ratchet rises before push.** Start the exact-Git counter alongside storage/typed lint, before source preparation. | **done (2026-10-25, sp-x9, 1e3f0fe5b2):** staged 1→2 refuses behind loose clean text and a broken loose plugin; index unchanged. Paired hook 308→429 ms (+122 ms), missed rise→refusal. Historical glyph 6→7 and density 0→1 refuse in 1.74 / 1.66 s. Existing deadlines and tests remain; no p90 claim. | XS | catch ratchet reds before push-loop stalls | exact staged rises refuse independently of source preparation |
| **SW9** | **CI shows every red in one run (D6, G678).** **Landed** 81095e9a06 (12:50 10-24, sp-x7); **bar met 17:16**: fbb51b9602's run reported behaviour 7 and 9 together. Left, same D6 logic and deletion only: `ci-fail-fast.py` still stops products and the typecheck shards when a peer is red ("Peer job … stopped this owned command", 6 of 18 red runs in the 17:28 reading), which hid the closed-component lock red until 16:35; delete that stop too, keeping each job's own bail and cause printing. Costs CI minutes only. | sp-x7 (G676) | XS | ~2–4 lane-h a day; hours of live | every failing job of a red run reports its own cause (behaviour part met 17:16) |
| **SW10** | **Idle lanes take the next row.** The 10-24 13:00 reading found 5 Codex building lanes idle 13 lane-h in 19.5 h and ~120 "no actionable unclaimed row" replies. Delete first: lanes stop waiting on and sending "on origin / CPU release" acks (the Simulator's quiet is the only CPU lock, D1; origin is in `git log`), and the coordinator keeps one claimable row per live lane in the queue, or stops the lane. **Done: bar met twice (4.5 h: 0.76 lane-h idle, 2 replies; 10-25 11:20, 17.8 h: 0.17 lane-h, 0 replies).** The `sim-quiet.py status` polling for "CPU release" goes on (92 polls, top 5, 2). | coordinator | XS | ~10–16 lane-h a day | building lanes idle under 1 lane-h in a 12 h reading (met twice, done 2026-10-25) |
| **SW11** | **Make commit-time related tests cheaper, never skipped (G703).** Replace both >20 size deferrals with an always-executed staged/direct plus bounded nearest-importer selection. Keep the single entry-time 60 s budget, staged TS6307 refusal, candidate-index isolation and fatal executed reds. Print the selected and executed suites; prove a red above the old 20-suite line refuses. The old delete-the-run fallback is superseded by G703. | **Landed** 729ff54811 (17:39) and ed647c4859 (21:44, "always run bounded related tests"); 10-25 11:20 reading: 156 calls, median 16.4 s, p90 43.8 s, max 127.5 s (23 / 76 / 126 before); sp-x1 median 31 s. Source (2026-10-24, sp-x8): both size skips removed; all staged tests plus 20 nearest static importers, one batched candidate-object read and printed selection/run counts. Reds over both former 20-file/suite limits now refuse; 38 focused cases, root/scripts types and named typed lint pass. Entry-time 60 s, TS6307, candidate isolation, strict CI products and observed-red-at-deadline refusal remain. **Import-syntax cache (2026-10-25, sp-x9, fe36697fbe):** exact staged blob IDs reuse raw imports only; paths/exports re-resolve each time. 21 interleaved pairs on 7,148 modules keep identical selections: median 684→99 ms, p90 707→107 ms; cold 1,056 ms (7,112 parses). Staged changes, moved paths, deletions, export remaps and corrupt/missing caches retain uncached selection. 70 related cases pass; no test-size skip or deadline change. Overall p90 bar not yet met (last reading 43.8 s) | XS | ~3 lane-h a day (now ~1.3 left) | commit.sh p90 <= 30 s in a reading; no size-based test skip (skip met) |

### SW11 continuation slices (2026-10-25, G711)

| Slice | Status | Boundary |
|---|---|---|
| Persistent CF1 transforms | done (sp-x9, this commit) | Reuse transformed code, never executed results or module instances. Every selected suite still runs isolated. Candidate overrides and directory globs bypass reuse; relative-resolution inventories, package export maps and helper identity invalidate it. Real warm regressions retain mocks and independent globals, refuse staged reds over identical loose bytes, follow moved index modules and changed package imports. The unchanged 20-suite / 225-case Bank selection passes before and after; measurements are in the code commit. |
| Overall commit p90 | in flight (sp-x9) | The last full reading remains 43.8 s against 30 s. Transform reuse is a bounded partial cut, not acceptance; the expensive Bank selection still spends most time executing tests. Keep all staged/direct suites, the same 20 nearest importers, fatal executed reds and the entry-time 60 s deadline. |

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
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator's prompts carried it 7 of 88 times by 11:20 and 7 of 209 since. (4) 17:20 reading: 0 breaks; the guard refused sp-o3's and sp-o1's `build-mirror run` attempts (11:26, 11:33). 10-24 13:00 and 17:28, 10-25 10:45: 0 breaks, no mirror run or probe, previews only of landed SHAs, quiet only through `sim-quiet.py` (fifth clean reading for the guards). | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (5 of 5 for the guards; the card not re-counted) |

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
