# Shared waits: mini plan (G666)

**State:** `open` 2026-10-23 — second reading 11:20 Cancun. SW1, SW2, SW5, SW6 done; SW7 built (1 of 2 clean
readings); SW4's H1 landed, its fseventsd bar not met; SW3 open (fix-forward speed); SW8 new, with D5 for Jake.
Refreshed twice a day by the plan agent (G666); new rows go to the coordinator through STATE, never herdr.

Jake, 2026-10-23 ~08:10 Cancun: *"we keep having the shared waits problem. We keep having to improve and fix it …
Lock contention, waiting, queuing, shared resources. Like, we almost need to look at it, like, twice a day."*

Related, never copied here: [fail-fast](fail-fast-mini-plan.md) (G610/G612: 5-minute caps, pooled slots, no pre-land
checks), G620 (red main 30-minute cap, shared previews, third build lease), G662 (dirty tree burn-down),
[BUILD-SPEED](../BUILD-SPEED.md) (Wave 1 landed; 3.4/3.5 quiet-vs-not not asked), [TOOLING-PERF](../TOOLING-PERF.md)
(G671 quick wins un-parked: H1 H3 H4 C4 C5 C6 P1 P3 K4 L4 V1 V3 S3; P4 and M1–M3 still parked).

## Latest reading (2026-10-23 11:20 Cancun: 09:20–11:20, 2 h; 12 h numbers where the source has them)

Read with `python3 scripts/agent-time.py --hours 2` and `--hours 12` (SW5), plus `gh run list` for the 12 h CI (the
script's `gh` call timed out at 12 h). Lanes active: Opus sp-o1, sp-o3, sp-o4 (sp-o2 and sp-o5 idle, G605's three);
Codex sp-x1, x2, x6, x8, x9 and sp-x7. 117 commits in 2 h (529 in 12 h).

| Shared resource | Held or waited, 2 h (12 h) | Who was blocked | Worst wait | Change vs 09:20 |
|---|---|---|---|---|
| Push gate (one push loop) | ran 1.4 of 2 h (70 %): 69 pushes, **0 red**, median 60 s, p90 115 s; **every push `ci-budget`: source preparation takes 80–120 s of the 45 s budget, so no check runs** (12 h: 383 ticks, 46 red, all before 07:00; median 44 s) | nobody directly: commit → origin median 1.5 min, p90 2.8 (12 h: 1.4 / 3.2) | 3.9 min to origin (12 h: 14.5, held by quiet) | origin 2× slower (0.7 → 1.5 min); the gate has caught nothing since 07:00 (new, SW8) |
| CI and red main | **red the whole window**: one red window since 08:42, 157 min at 11:22; 14 red, 0 green finished, 48 cancelled. Causes: C4's typed-lint slip (fixed 942eb34bfb in 23 min), `pnpm docs` running npm's browser command (fixed 23e671d1fc in 21 min), the grid boot hang from 8a97034b97 (fixed 9ee919dc14, second try). 0 reverts (G674) (12 h: 8 red windows, 12.2 of 12 h red, 7 over 30 min, longest 161 min; 62 red, 8 green) | release (live waits for green), owning lanes, sp-x7 | 157 min red, still open at 11:22 | worse in share (71 % → 100 % red); each red now fixed in ~20–25 min |
| Build mirror (check..check5, ruler) | **Opus 0.3 h of mirror commands, all previews of landed SHAs**; 0 probes of unlanded commits after 09:50; the guard refused 4 preview starts from `tmp/` (sp-o4 09:56, sp-o3 10:03 and 10:17, sp-o1 10:08) (12 h: Opus 7.3 h, mostly before 09:40) | — | 0 real pool timeouts | **22.9 lane-h a day → ~4 a day pace (−83 %)** |
| Heavy-lane builds (3 leases) | 15 builds, 0 s queued, build median 213 s, p90 557 s; 0 real 5-minute timeouts (the script's 12 "heavy-lane" hits are test fixtures and source reads) (12 h: log only since 10:29) | — | 0 | 17 timeouts a day → 0 |
| Full-test lane | CI only (SF74 W1) | — | — | same |
| Simulator | 1 lease; 2 open sim-queue rows; 0 reaps | — | 0 | same |
| Browsers (4 slots) | 0 admission timeouts, 0 reaps (12 h: 6 reaps) | — | — | same |
| Quiet window | **0 quiet ticks**; only the Simulator reader can take it (f92c7e94fa); sp-o3 and sp-o4 deleted their `quiet.sh` at 09:47 (12 h: 74 ticks, last 08:32) | — | 0 | **2.8 h a day → 0** |
| Commit lock (commit.sh) | 0 lock timeouts; pre-commit 1.0–2.3 s after H1 (29d7c2079b, was 3.2 s) | — | — | faster |
| One index / tree | 58 changed paths | — | — | 37 → 58 |
| Generated inputs | the push gate defers to CI on every push (`ci-budget` 69 of 70); CI `derived-docs` red after G2 moved docs out of gen | push gate, CI | — | `ci-cache-miss` 35 % → budget 99 % |
| Machine | load 18 on 18 cores, 70 % idle; **swap 57.8 of 58.4 GB used, 0.5 GB free** (the swap file doubled in 2 h); fseventsd 100 % CPU, 19.7 GB (up 2 d 18 h); Logitech updater 47 %; /private/tmp 77k files, $TMPDIR 245k; 1.5 TB free | everyone, a little | — | idle 28 → 70 %; swap 30 → 58 GB; fseventsd 175 → 100 % CPU |
| Budgets | **Claude weekly 67 %** (~2.5 points an hour): G605 steps to 2 Opus at 70 % (~12:30), 1 at 80 % (~16:30), 0 at 90 % (~20:30) until Tue 10-27 13:00 Cancun. Codex weekly 54 % (resets 10-29), 51.9k credits; Codex poll share 8 % | Opus capacity | — | Claude 62 → 67 %; Codex polling 23 → 8 % |

**Rules broken in the window (SW7 (4)):** sp-x6 1 (09:39–09:50, a `build-mirror.mjs run` check driven by `tmp/` scripts,
before the 09:40 brief reached it and before the guard landed); every other lane 0 mirror probes and 0 quiet. The
four `tmp/` preview refusals were landed SHAs started where the old docs said (fixed in f92c7e94fa), not breaks.
Reds were fixed forward within 30 minutes of detection. The coordinator's briefs carried the 5-rule card in 7 of 88
prompts since 09:47, including new tasks for sp-x1, sp-x2 and sp-x6 without it.

Measurement notes: the script's "five-minute waits" row counts the phrase anywhere in tool output (source reads,
test fixtures, cat of old logs) and over-counts; the per-lane checks above read the commands themselves. The heavy-lane
log restarted at 10:29 (SW5), so build numbers before that are not comparable.

## Top 5 losses (lane-hours, 2 h, with the 24 h pace)

1. **Red main: ~1.5 lane-h (live 2 h behind).** Six red fixes in 2 h, including sp-o3's bisect of the grid boot hang
   and sp-o1's two fixes. Each red was fixed forward in 20–25 minutes, but three in a row kept main red the whole
   window. C4 (fail fast), P1 (recently red first) and V1/V3 (smoke legs) landed today; S3 is in progress.
2. **The push gate prepares a tree it never checks: ~0.3 lane-h plus ~1.4 core-h.** Source preparation alone takes
   80–120 s, so all 69 pushes deferred every check to CI. Typed-lint slips such as C4's now reach CI (SW8, D5).
3. **Build mirror: 0.3 lane-h,** all legitimate previews of landed SHAs (was 22.9 lane-h a day of pre-land probes).
4. **Machine swap at 99 %: unmeasured, everyone.** fseventsd still at 100 % CPU and 19.7 GB after H1; the swap file
   doubled in two hours. Nothing has failed yet; a full swap would stall every lane at once.
5. **Codex waiting on its own commands: small** (poll share 8 %, was 23 %). BUILD-SPEED 1.4 A1 owns it.

Total: ~1.8 lane-h in 2 h against ~3.5 per 2 h at 09:20 (−50 %); without red main, waits fell ~90 %.

## Rows (ranked by lane-hours saved)

| Row | What | Owner | Size | Saves | Done when |
|---|---|---|---|---|---|
| **SW1** | **The mirror builds only landed commits, for previews and the ruler.** `build-mirror.mjs` and `serve-build.sh --rev` refuse a revision that is not on main; `build-mirror.mjs run` keeps only serve-build's re-exec; the doc lines that taught mirror runs are gone. **Done** f92c7e94fa, d9b7bff33b, 280a9392a3, 0251d46d01; Opus mirror time 22.9 lane-h a day → 0.3 h in 2 h. | Codex (+ coordinator brief) | S | ~15–18 lane-h a day, most build-lease timeouts | done 2026-10-23; the 16:45 reading confirms the second clean reading |
| **SW2** | **Quiet only for official Simulator readings (D1).** **Done** f92c7e94fa (only the Simulator reader can take quiet); sp-o3 and sp-o4 deleted their wrappers at 09:47; 0 quiet ticks since 08:32. BUILD-SPEED 3.4/3.5 can now measure quiet vs not once. | Codex (docs) + sp-o4/sp-o5 | XS | ~6–8 lane-h a day | done 2026-10-23 |
| **SW3** | **Fix-forward speed (D4).** The owner fixes forward within 30 minutes; C4 81559b512a and P1 0181f41dd4 landed, S3 in progress. The reading counts red windows over 45 min. Open: this window was one 157-minute red made of three short ones. | owners; sp-x7 | XS | ~3–5 lane-h a day; live within the hour | no red window over 45 min in a reading |
| **SW4** | **Stop the file churn (D2).** H1 landed 29d7c2079b (pre-commit 3.2 s → 1.0–2.3 s, no source snapshot for docs). fseventsd is still at 100 % CPU and 19.7 GB, and swap is full. Jake, optional, one click: quit the Logitech Options+ updater (47 % CPU for 8 days). | Codex; Jake | S | ~2–3 cores back, swap headroom | fseventsd under 50 % CPU in a reading |
| **SW5** | **The reading is one command.** **Done** 7d9bf159d9: `python3 scripts/agent-time.py --hours N` prints the table. Left: its five-minute-wait count over-counts (matches source and fixtures). | Codex | S | ~0.5 h per reading | done 2026-10-23 |
| **SW6** | **Delete the dead locks and logs.** **Done** 34b62ababc: 233 dead files (44 git locks/logs, 97 browser markers, 92 drive locks), plus H4 5fc27d4e6e (the retired E357 lock). | Codex | XS | 0 h; no false holders | done 2026-10-23 |
| **SW8** | **The push gate stops preparing a tree it never checks (new, D5).** Since ~09:00 every push is `ci-budget`: source preparation takes 80–120 s of the 45 s budget and every check is skipped, so the gate spends ~16 core-hours a day doing nothing and commits reach origin 2× slower. Delete source preparation, source inputs and the typed phase from the scheduled gate; keep the guards (binary JSON, storage); CI owns typed checks, with C4 stopping on the first red. P4 can bring checks back later if CI reds rise. | Codex (sp-x9) | XS | ~1.4 core-h per 2 h on a machine in full swap; origin back under 1 min; ≥2 lane-h a day | gate median under 15 s in `.git/push.log` |

After SW1 the build leases show 0 timeouts in 2 h, so TOOLING-PERF M1 is not needed for now.

## Decisions (G670, Jake 2026-10-23 ~10:20)

- **D1** quiet windows only for official Simulator readings (SW2).
- **D2** TOOLING-PERF H1 un-parked as a SHARD-PLATFORM extra (SW4); the rest of TOOLING-PERF stays parked.
- **D3** lanes follow rules by guardrails, not reminders (SW7).
- **D4** (G674): no reverts, fix forward only (Jake: *"reverts sound like a mess"*). SW3 becomes fix-forward speed: the
  owner fixes, and G671's C4, P1 and S3 shorten red windows.
- **D5** (open, for Jake): the gate's source preparation never fits its budget. Recommended: SW8, delete it (G585);
  the coordinator's STATE asks to un-park P4 (a cached snapshot per tip) instead. SW8 costs nothing, because the gate
  has run no check since 09:00.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| **SW7** | **Guardrails (D3).** (1) **Done** f92c7e94fa: the mirror refuses unlanded commits and callers under `tmp/`; only the Simulator reader takes quiet. (2) **Done** 280a9392a3, 0251d46d01: no doc teaches a banned move. (3) **Done** 280a9392a3: the 5-rule card is in `lanes/common.md`, but the coordinator pasted it into 7 of 88 briefs since 09:47. (4) This reading: sp-x6 1 break (09:39, before the guard), every other lane 0. | Codex (1, 2) + coordinator (3) + plan agent (4) | S | two readings in a row with no mirror probe, no non-Simulator quiet, and the card in every brief (1 of 2; the card is not yet in every brief) |

## Twice-daily review (~10:45 and ~16:45 Cancun, 15 minutes, one subagent)

Window: the 12 h since the last reading. Fill the same table, compare with the last reading, rewrite "Latest reading"
and the top 5, and add a row only for a new loss over 2 lane-hours a day. SW5 has landed, so start with
`python3 scripts/agent-time.py --hours 12`; for what it leaves out or over-counts, read:

1. **Push loop:** `.git/push.log` (statuses, `gateSeconds`, `types`, `steps`, `quiet` ticks); commit → origin from
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
