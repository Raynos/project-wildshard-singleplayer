# Shared waits: mini plan (G666)

**State:** `open` 2026-10-25 — seventh reading 17:20 Cancun (6.0 h since the 11:20 reading). SW1, SW2, SW5, SW6,
SW8, SW10 done; SW4 done; SW11 landed (729ff54811, ed647c4859) but its p90 bar is open again (50.6 s over 75 ledger
calls; the 9-call cohort said 26.8 s); SW9's bar met, peer-stop deletion left; SW3 open and worse: red main 79 % of the
window (60 % at 11:20), 3 windows over 45 min (G692), the longest 130 min, a new one open at 17:19 with 16 behaviour
shards red in one run. The push loop is no longer a problem (1 streak, 1.5 min; the `ratchet` step blocked 0 times).
Peer herdr sends rose again (~17 -> ~30 an hour), claim docs commits stay 0.
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-25 17:20 Cancun: 11:20 → 17:20, 6.0 h; rates per hour to compare with the 10-25 11:20 reading)

Read with `python3 scripts/agent-time.py --hours 6`, `gh run list` (push runs, cancelled ignored) plus the jobs of every
red run, `.git/push.log`, `.git/commit-times.jsonl` (the wrapper ledger), the six Codex transcripts (read only; the
`exec` tool calls are `custom_tool_call`s, only commands that start with the tool count, so a doc or a herdr message that
quotes "timed out" does not), `herdr agent list`, `openusage`. Lanes: Codex sp-x2, x6, x8, x9, x7 (pusher) working and
sp-x1 finishing a task at 17:19, no building lane idle; no Opus (Claude weekly 100 %, G605; 9 Claude commits). 163
commits (27/h; 30/h at 11:20): Codex-trailer lanes 124, sp-x2 30, Claude 9; 0 reverts (G674).

| Shared resource | Held or waited, 6.0 h | Who was blocked | Worst wait | Change vs 11:20 (per hour) |
|---|---|---|---|---|
| Push gate (one push loop) | 151 pushed ticks, 2 red (one streak, `deleted-paths`, 15:50, 1.5 min), 28 quiet, 285 idle; gate median 12.6 s, p90 16.8 s, max 26.2 s. `ratchet`: 0 blocks (52 min in 13 streaks at 11:20) | every push: commit → origin median 27 s, p90 68 s | 9.1 min to origin (547 s) | blocked 2.9 → 0.25 min/h; gate p90 17 → 17 s; origin median 32 → 27 s, p90 86 → 68 s |
| CI and red main | 5 red windows (first red push run to the next all-green push run's end), Cancun: the 10:14 one ended 12:25 (**130 min in all**, 64 in this window; 5 consecutive `generated-inputs` reds 11:31–12:01); 13:20–15:07 **106 min** (4 behaviour reds on 4 different shards); 15:07–15:48 41; 15:43–16:44 **61** (11 behaviour shards red at once, then green); **17:01 open at 17:19 (17 min): 16 behaviour shards and products red in one run** (`e997625af7`). Red ~4.7 of 6.0 h (79 %), **3 windows over 45 min (G692)**, 4 over 30. Push runs: 8 green, 14 red, 1 running, 112 cancelled (83 % of 135). The 14 reds: 7 behaviour, 5 generated-inputs (2–5 min each), 2 typed lint (one with behaviour 5) | every lane's verdict; live | 130 min | red share 60 → 79 %; windows over 45 min 5 in 17.8 h (0.28/h) → 3 in 6 h (0.5/h); longest 285 → 130 min |
| Release and boot smoke | deploy dispatches: 3 success (13:11, 14:13, 16:01 Cancun), 1 running at 17:05; schedule 2 success (12:05, 14:43). boot-smoke: 7 success, 1 failure (the d035898a candidate, 15:06, the typed-lint red), 1 cancelled. No release hold commit in the window | releases | 0 holds | holds 20 → 0 min; smoke reds 10 in 17.8 h (0.56/h) → 1 in 6 h (0.17/h) |
| CI verdict time (CF3) | Green push → last job median 17.2 min (n=8, max 19.1; 17.0 at 11:20); red verdicts median 15.4 min (n=14, the five generated-inputs reds 3–5 min; 16.4 for the 9 over 6 min; 15.7 at 11:20). Green ≤ 13 min still not met | every lane's verdict | 24.2 min | green 17.0 → 17.2; red 15.7 → 16.4 (full runs) |
| Build mirror (check..check5, ruler) | 0 `build-mirror.mjs run`, 0 `tmp/*/check.sh` in the six Codex transcripts; Claude Bash 1 command naming `build-mirror` (0.00 h); previews only of landed SHAs; 0 pool timeouts | — | 0 | same |
| Heavy-lane builds (3 leases) | 85 builds, 0 s queued, median 30 s, p90 167 s, max 268 s; 0 real transcript queues over 60 s (`agent-time`'s 2 are a fixture quoting the line) | — | 0 | 12 → 14 builds/h; same 0 queue |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | reap log 0 new lines (last 10-24 23:39); sim-queue rows 2 open (S8, S9); `sim-quiet.py status` polled 42 times (sp-x2 39, sp-x9 3) | the pollers' sleeps | — | polls 5 → 7/h (sp-x2 only) |
| Browsers (4 slots) | 0 reaps; 0 headless shells live at 17:18 | — | — | same |
| Quiet window | 28 quiet ticks (~28 min), no `.git/quiet` write seen outside `sim-quiet.py` (D1) | the push loop | — | ~1.2 → ~4.7 min/h |
| Commit lock (commit.sh), SW11 | 0 lock timeouts (the hits are source reads and fixtures). **Wrapper ledger, 75 invocations of 163 commits (60 commits, 15 refusals): wall median 13.9 s, p90 50.6 s, max 60.9 s** (successful only 19.3 / 53.5); lock wait median 0, p90 3.4 s, max 29.5 s; work median 12.7 s, p90 37.9 s. Medians per lane: sp-x9 31 s, sp-x8 25 s, sp-x6 17.5 s, sp-x1 13 s, sp-x2 8 s. Total 0.39 lane-h (0.37 of it work) | every committer | 60.9 s | median 16.4 → 13.9 s; p90 43.8 → 50.6 s (bar 30 s not met); ~0.05 → ~0.065 lane-h/h |
| Peer herdr (G708) | **182 `herdr-prompt.sh` sends in the six transcripts** (the pusher included): ~30/h, from ~17/h at 11:20 (39/h in the 13.4 h after G708); the coordinator's 16:23 standing-queue message went to every lane | each message is a turn for the receiver | — | ~17 → ~30/h |
| Separate docs commits (G708) | claim docs commits: **0** (`docs(types): record …` 0, `claim …` 0); 16 docs commits in all (2.7/h; 2.8/h after G708), 4 titled `record …` (plan, ci smoke, two perf profiles) | — | — | same |
| One index / tree | 159 changed paths | — | — | 117 → 159 |
| Generated inputs | every push typed `ci`; CI's generated-inputs red 5 times in a row (11:31–12:01, 3–5 min each): `ValueError: Unexpected prepared output path: budgets/ceiling-sources.json` while the test-moving commits (`d22b0b0c81`, `2cdf5ecc78`, `736b50a5f4`) changed that file; fixed forward by `673de55f86` at 12:05 | whoever pushes next | 30 min | 16 → 5 reds; 0.9 → 0.8/h |
| Machine | load averages 8.5 on 18 cores (spiky, two node builds at 100–160 %), CPU 58–79 % idle (87–93 % at 11:20); swap 5.3 of 6.1 GB used (0.87 GB free; 1.7 free); 47 GB RAM unused; fseventsd absent from `ps` top (third clean reading); Logitech updater 16 % CPU for 10 days; /private/tmp 62.5k files, $TMPDIR 298.6k (254k at 11:20; +45k in 6 h), below the 500k warning; 1.5 TB free; up 10 days | — | — | idle 87–93 → 58–79 %; swap free 1.7 → 0.87 GB; TMPDIR +7.5k/h |
| Budgets | **Claude weekly 100 %** (resets Tue 10-27 12:59 Cancun): 0 Opus. **Codex weekly 38 %** (22 % at 11:20, resets 11-01, 51.5k credits, one rate-limit reset in hand). Codex sleep 1.08 h by `agent-time` (+0.13 h `wait`; poll share 55 %): 0.18 h/h | Opus capacity | — | Codex 22 → 38 % (16 points in 6 h, ~2.7/h); sleep 0.22 → 0.18 h/h |
| Lane idle | building lanes idle **0.00 lane-h** (0 gaps over 5 min from task end to next prompt in sp-x1, x2, x6, x8, x9; no "no actionable row" reply found); sp-x7 (pusher) 18 gaps of 6–16 min, by design. At 17:18 sp-x1 had just finished a task, the rest working | the plan | — | 0.01 → 0.00 lane-h/h |

**Rules broken in the window (SW7 (4)):** none for the guards: 0 mirror runs or `tmp/*/check.sh` probes, previews only of
landed SHAs, no quiet write outside `sim-quiet.py`, 0 reverts. G692's 45-minute cap broken 3 times (4 over 30 min).

Measurement notes: a red window starts at the first red push run's creation and ends at the next all-green push run's
completion (the 15:07 and 15:43 windows overlap by 5 minutes; red minutes counted once); deploy-only runs
(`workflow_dispatch`, `schedule`) are not green. Red-main lane-hours use the ~0.66 lane-h per red hour of the 13:00
reading. Herdr counts are commands whose first word is `scripts/herdr-prompt.sh` (the Codex transcripts only, so the
Claude lanes' sends are not in it). The commit.sh numbers come from `.git/commit-times.jsonl` (the ledger of SW11's last
slice), which holds 75 completions for the 163 commits of the window; `agent-time.py` prints the same 14.4 / 50.6 s.

## Top 5 losses (lane-hours, 6.0 h, with the 24 h pace)

1. **Red main: ~3.1 lane-h (~12.5 a day), estimated.** 4.7 red hours, 79 % of the window, 3 windows over 45 min (130,
   106, 61). Of the 14 reds, 7 behaviour (two of them took out 11 and then 16 shards at once: `ee49ee1c9f` "retire the
   map scheduler job" and `e997625af7` "retain native deflate build bytes", the latter open at 17:19), 5 generated-inputs
   (one producer-path slip, 5 pushes in a row) and 2 typed lint. 0.52 lane-h/h against 0.39 at 11:20: the worst rate
   since the first reading, and two reds in a row break many shards, so the fix is a shared one.
2. **Codex sleeping: ~1.1 lane-h (~4.3 a day), from ~5.** sp-x2 owns 39 of the 42 `sim-quiet.py status` polls; CI waits
   for the rest; BUILD-SPEED 1.4 A1.
3. **commit.sh (SW11): ~0.4 lane-h (~1.6 a day), from ~1.3.** Median 14 s but p90 50.6 s (bar 30 s): sp-x9's and sp-x8's
   own commits run 25–31 s (hub files and CF1 related tests, 0.37 h of the 0.39 h is work, not lock wait).
4. **Push loop: ~0.03 lane-h.** One `deleted-paths` streak of 1.5 min; `ratchet` blocked 0 times (52 min at 11:20).
5. **Idle and machine: ~0 lane-h.** No building lane idle; CPU idle fell to 58–79 % and swap free to 0.87 GB, TMPDIR
   at 299k files; peer herdr sends back up to ~30/h.

Total: ~4.6 lane-h in 6.0 h (~0.77 an hour against ~0.74 at 11:20 and ~1.3 at 17:00 on 10-24; no idle: 0.77 against
0.73): the push loop, idle, boot-smoke reds and the generated-inputs reds fell; red main rose from 0.39 to 0.52
lane-h/h and is now the whole loss (67 %). No new loss over 2 lane-hours a day, so no new row: SW3 holds it.

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h → 0.24 h in 6 h; the 17:20 reading saw the guard refuse both `run` attempts. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; second clean reading 17:20 |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed; G676 (97f3db9d72) makes sp-x7 reproduce and fix every red itself; CF3 (1f76530a1d) cut red verdicts ~17 → 12.6 min; CF4 (eafc904ce9) names candidates on typed-lint reds. 10-24 13:00: 10 windows, median ~45 min. 10-24 17:28: the 14:53 red open 155 min with 9 causes in a row. **10-25 10:45: that window ended 19:38 at 285 min; 8 windows in 17.8 h, 5 over 45 min (148, 123, 92, the 10:14 one open 66 min at 11:20), red 60 % of the time;** four different behaviour shards failed in four consecutive pushes in the open window. CF4's culprit report fails with `RuntimeError` on behaviour runs (sp-x7). **10-25 17:20: 5 windows in 6 h, 3 over 45 min (130, 106, 61), red 79 % of the time; two reds failed 11 and 16 behaviour shards at once (a shared break), the second open at 17:19.** | owners; sp-x7 | XS | ~3–5 lane-h a day at 11:20, ~12 a day at 17:28, ~9.5 a day at 10-25 11:20, ~12.5 a day at 17:20 | no red window over 45 min in a reading (30 once CF3's greens show ≤ 13 min, G692) |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). At 10-24 13:00 fseventsd was at 187 % CPU and 25.2 GB with 0.8 GB swap free. **Done: bar met in two readings (10-24 17:28 and 10-25 11:20: fseventsd 0 %, swap 5.5 of 7.2 GB used, 63 GB RAM unused, 87–93 % CPU idle).** Jake, optional, one click: quit the Logitech Options+ updater (53 % CPU for 9 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading (met twice, done 2026-10-25) |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (D5, G675).** **Done** 97e8dcaeb8 (12:45, source preparation dropped; typed lint and related tests left to CI) and aa1994c3a6: gate median 65 s → 11 s, p90 35 s, `ci-budget` 41 of 44 → 2 of 190. Left: its kept `ratchet` and `deleted-paths` steps blocked the loop 42 min in 7 streaks at 17:28 and 52 min in 13 streaks (all `ratchet`, 11 min at 04:48) at 10-25 11:20 (top 5, 3); delete or move the step to CI. **10-25 17:20: `ratchet` blocked 0 times in 6 h (one `deleted-paths` streak, 1.5 min); nothing left to delete.** | Codex (sp-x9) | XS | ~16 core-h a day; ≥2 lane-h a day | done 2026-10-23 (gate median 11 s) |
| **SW8a** | **Catch touched-source ratchet rises before push.** Start the exact-Git counter alongside storage/typed lint, before source preparation. | **done (2026-10-25, sp-x9, 1e3f0fe5b2):** staged 1→2 refuses behind loose clean text and a broken loose plugin; index unchanged. Paired hook 308→429 ms (+122 ms), missed rise→refusal. Historical glyph 6→7 and density 0→1 refuse in 1.74 / 1.66 s. Existing deadlines and tests remain; no p90 claim. | XS | catch ratchet reds before push-loop stalls | exact staged rises refuse independently of source preparation |
| **SW9** | **CI shows every red in one run (D6, G678).** **Landed** 81095e9a06 (12:50 10-24, sp-x7); **bar met 17:16**: fbb51b9602's run reported behaviour 7 and 9 together. Left, same D6 logic and deletion only: `ci-fail-fast.py` still stops products and the typecheck shards when a peer is red ("Peer job … stopped this owned command", 6 of 18 red runs in the 17:28 reading), which hid the closed-component lock red until 16:35; delete that stop too, keeping each job's own bail and cause printing. Costs CI minutes only. | sp-x7 (G676) | XS | ~2–4 lane-h a day; hours of live | every failing job of a red run reports its own cause (behaviour part met 17:16) |
| **SW10** | **Idle lanes take the next row.** The 10-24 13:00 reading found 5 Codex building lanes idle 13 lane-h in 19.5 h and ~120 "no actionable unclaimed row" replies. Delete first: lanes stop waiting on and sending "on origin / CPU release" acks (the Simulator's quiet is the only CPU lock, D1; origin is in `git log`), and the coordinator keeps one claimable row per live lane in the queue, or stops the lane. **Done: bar met twice (4.5 h: 0.76 lane-h idle, 2 replies; 10-25 11:20, 17.8 h: 0.17 lane-h, 0 replies).** The `sim-quiet.py status` polling for "CPU release" goes on (92 polls, top 5, 2). | coordinator | XS | ~10–16 lane-h a day | building lanes idle under 1 lane-h in a 12 h reading (met twice, done 2026-10-25) |
| **SW11** | **Make commit-time related tests cheaper, never skipped (G703).** Replace both >20 size deferrals with an always-executed staged/direct plus bounded nearest-importer selection. Keep the single entry-time 60 s budget, staged TS6307 refusal, candidate-index isolation and fatal executed reds. Print the selected and executed suites; prove a red above the old 20-suite line refuses. The old delete-the-run fallback is superseded by G703. | **Landed** 729ff54811 (17:39) and ed647c4859 (21:44, "always run bounded related tests"); 10-25 11:20 reading: 156 calls, median 16.4 s, p90 43.8 s, max 127.5 s (23 / 76 / 126 before); sp-x1 median 31 s. Source (2026-10-24, sp-x8): both size skips removed; all staged tests plus 20 nearest static importers, one batched candidate-object read and printed selection/run counts. Reds over both former 20-file/suite limits now refuse; 38 focused cases, root/scripts types and named typed lint pass. Entry-time 60 s, TS6307, candidate isolation, strict CI products and observed-red-at-deadline refusal remain. **Import-syntax cache (2026-10-25, sp-x9, fe36697fbe):** exact staged blob IDs reuse raw imports only; paths/exports re-resolve each time. 21 interleaved pairs on 7,148 modules keep identical selections: median 684→99 ms, p90 707→107 ms; cold 1,056 ms (7,112 parses). Staged changes, moved paths, deletions, export remaps and corrupt/missing caches retain uncached selection. 70 related cases pass; no test-size skip or deadline change. **Observed bar met (2026-10-25, sp-x9):** first wrapper-ledger cohort, 9 invocations across five lanes (4 refusals included), median 3.90 s / p90 26.81 s / max 26.81 s. Successful-only: 5 commits, median 10.74 s / p90 26.81 s. Waits 0; unknown/invalid rows 0. This is an initial bounded cohort, not a guarantee for every future workload; the reader retains ongoing monitoring. **10-25 17:20 reading (75 ledger calls in 6 h, 15 refusals): median 13.9 s, p90 50.6 s, max 60.9 s; successful only 19.3 / 53.5 s; lock wait p90 3.4 s. The 9-call cohort did not hold at volume: the p90 bar is open again.** | XS | ~3 lane-h a day (now ~1.3 left) | commit.sh p90 <= 30 s in a reading; no size-based test skip (skip met) |

### SW11 continuation slices (2026-10-25, G711)

| Slice | Status | Boundary |
|---|---|---|
| Persistent CF1 transforms | done (sp-x9, 87a1387349) | Reuse transformed code, never executed results or module instances. Every selected suite still runs isolated. Candidate overrides and directory globs bypass reuse; relative-resolution inventories, package export maps and helper identity invalidate it. Real warm regressions retain mocks and independent globals, refuse staged reds over identical loose bytes, follow moved index modules and changed package imports. The unchanged 20-suite / 225-case Bank selection passes before and after; measurements are in the code commit. |
| Repeated pack fixture compilation | done (sp-x9, 3e6d67947e) | Compile the identical real pack program lazily once per suite, with fresh byte copies and fresh runtime state for every case. An independent compile plus caller-mutation regression preserves the exact Wasm image. All 15 original cases and timeouts remain; focused duration 31.23→10.08 s, unchanged 20-suite Bank selection 44.17→38.40 s (225→226 cases). Scoped types, typed lint and related tests pass. This is a partial cut; overall p90 remains open. |
| Serialized CF1 worker limit | done (sp-x9, 85409aed46) | The existing commit invocation marker selects four local workers; ordinary lane runs retain two, CI retains its runner default, and explicit positive limits keep priority. The same 20-suite / 226-case Bank selection passes at 38.61→26.09 s with no skipped suite; 16 worker-policy/candidate-isolation regressions pass. Scoped scripts/fixture types and named typed lint pass. Overall p90 needs a new reading. |
| Commit wait/work attribution | done (sp-x9, ce2b966a97) | Report lock request and separate lock-wait / serialized-work milliseconds alongside the unchanged total. Real queued fixture: 169 ms wait + 240 ms work = 409 ms total; hook sees the original entry-time budget and a hook red still refuses. The old wrapper fails this reporting regression. No concurrency, timeout, guard or deadline change; this is attribution, not a p90 improvement claim. |
| Malformed-message preflight | done (sp-x9, 8606899d32) | Reuse the existing convention validator under the commit lock before candidate/index preparation or expensive hooks. Invalid-body fixture 1,029→433 ms, executed checks 1→0; valid messages still execute every normal hook, hook reds refuse, human attribution stays unchanged, and foreign stages survive. Entry-time budget and signing are unchanged. This removes failed-attempt waste; no overall p90 claim. |
| Patch-index stat metadata | done (sp-x9, 144abc220c) | The signed main trace spent 8.98 s scanning all 27,540 entries because a fresh read-tree index discarded stat metadata. Seed the private index from shared metadata, reset every blob to HEAD, clear assume-unchanged/skip-worktree/fsmonitor flags, then apply only the declared patch. Fixture scans 69→5; peer staged changes/additions/deletions, hidden working bytes and original shared flags remain intact. Exact candidate checks still see hidden edits. Signed main refresh measured 8.98 s / 27,540 scans→2.7 ms / 44 scans; whole invocation 9.60 s. Overall p90 remains open pending the new reading. |
| Actual invocation distribution | done (sp-x9, df97086b33) | Each finished wrapper invocation journals total/wait/work/outcome metadata in the Git directory, including refusals. The shared-waits reader deduplicates IDs, rejects invalid/quoted rows and reports missing input explicitly; no result is synthesized from transcript rereads. Two real fixture rows match console times, and logging failures cannot change success/refusal. The first production cohort starts with this source; p90 acceptance stays open until enough ordinary invocations are recorded. |
| Overall commit p90 | done (sp-x9, this commit; observed cohort) | First actual wrapper-ledger reading: 9 invocations / five lanes, median 3.90 s, p90/max 26.81 s; all four refusals included. Successful-only 5 commits: median 10.74 s, p90/max 26.81 s. Unknown/invalid rows 0 and all waits 0. The ≤30 s bar is met in this initial bounded cohort. Keep all staged/direct suites, the same 20 nearest importers, fatal executed reds, signing and the entry-time 60 s deadline; the reader now shows both complete and successful-only distributions for future monitoring. |

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
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator's prompts carried it 7 of 88 times by 11:20 and 7 of 209 since. (4) 17:20 reading: 0 breaks; the guard refused sp-o3's and sp-o1's `build-mirror run` attempts (11:26, 11:33). 10-24 13:00 and 17:28, 10-25 10:45: 0 breaks, no mirror run or probe, previews only of landed SHAs, quiet only through `sim-quiet.py` (fifth clean reading for the guards); 10-25 17:20: 0 breaks again (sixth). | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (5 of 5 for the guards; the card not re-counted) |

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
