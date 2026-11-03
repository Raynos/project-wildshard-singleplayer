# CI close-out mini spike (2026-11-03)

How to close [CI-FIRST-PRINCIPLES](CI-FIRST-PRINCIPLES.md) fast. Read-only research by a wildshard-v subagent, about
08:20 Cancun. Sources: the 100 `deploy` runs created 2026-11-03 04:38–12:45Z (`gh run view --json jobs` on all of
them, with failed-step logs for the phone and draw-budget jobs), `.github/workflows/deploy.yml`, the plan at HEAD
`2ec2da8a9e`, and git history.

## What the plan really says today

The brief listed 7 of 14 rows done. **HEAD already marks 11 done** (CI2, CI3, CI5, CI6 and CI7 were marked
done by the lanes on 10-30 to 11-02). The working-tree copy of the plan was a stale 10-31 file (213 lines against
HEAD's 4,007). Committing that copy would have reverted those five done marks and deleted the evidence log. The plan
edit in this round starts from HEAD instead.

With CI12 marked done on today's evidence, **12 of 14 are done. Two rows are open, CI9 and CI10.** Both are stuck on
GitHub runner capacity, not on code.

## Rows

| Row | State | Evidence | Smallest finishing step | Owner | Hours |
|---|---|---|---|---|---|
| CI2 | done at HEAD | 15/15 staged releases ship in 26–49 s. Today 14/14 shipping runs: ship job 27–49 s | none | — | 0 |
| CI3 | done at HEAD (status clock) | 21/21 live 108–196 s after the success status. Today the ship job itself waited 7–787 s for a Linux runner (over 300 s on 9 of 14) | none; that queue belongs to CI9 | — | 0 |
| CI5 | done at HEAD | setup 0.61 % (run 41154960690) | none | — | 0 |
| CI6 | done at HEAD | one run at 349 s (41123682086). Today p50 416 s, 9/38 ≤ 360 s | none: keep done. Not the long pole | — | 0 |
| CI7 | done at HEAD | today 21/21 green waves' test step max 185–207 s (bar 300). Balance 1.17–1.38× (bar 1.2×) | drop the 1.2× half: chapter-one (12–17 min) sets the wave, so balance buys no time | — | 0 |
| CI9 | **open** | push → live 28–65 min on today's 14 shipping runs (bar 15). 17e15e8: 1760 of 2625 s is queue | rescope the bar; land 3 capacity cuts; record one day's p50 | sp-x8 | ~5 |
| CI10 | **open** | 0 of 45 phone jobs got past Simulator prepare today; none has passed since 10-30 | cut: delete the job | sp-x8 | ~1 |
| CI12 | **done (marked now)** | tapes for the hook (with a QB17 red control), crank, crossbow, QB11 and quests for all 6 story shards; green in all 21 green waves | none | — | 0 |

## CI9: where the 43 minutes go

Run 17e15e8 (41605229499), the plan's own receipt: prepare waits 352 s, runs 592 s; the wave takes 1256 s, of which
the grid leg waited **1009 s for a macOS runner**; the ship waits **399 s** for a Linux runner; deploy 26 s.

- **macOS is the tight pool.** The account runs at most 5 macOS jobs at once. Today it sat at 5/5 for 49 % of the
  day. Each run asks for ~45 macOS-minutes: 7 journey legs (~40 min, of which 90–180 s per leg is setup) plus the
  phone job (~8 min, always failing).
- **Linux comes in bursts.** Each run asks for ~156 Linux-minutes, 97 of them in 24 `behaviour` shards. A wave drops
  ~33 Linux jobs at once on a cap that looks like 20 (peak seen: 18), so later jobs, the ship included, wait.
- **The floor without any queue is 18–28 min:** prepare 300–650 s + the chapter-one native tape 718–1045 s + ship
  30–50 s. 15 min needs chapter-one out of the ship gate. sp-x8 already measured splitting it as no gain.

**Smallest cuts, by size of effect:**
1. Delete `phone-route` (CI10): −8 of 45 macOS-min a run (−18 %).
2. `behaviour` 24 → 12 shards (`--shards 12` plus the matrix list): about −19 Linux-min of setup a run, and an 8-job
   smaller burst. Each shard still ends long before chapter-one.
3. `journeys` 7 → 4 legs (pair the short legs: hover-chromium with boot-grid, hover-webkit with boot-developer):
   about −6 macOS-min of setup a run.
4. Take `draw-budget` off the push run. It is report-only, exits 3 every run on SwiftShader ("Reading INCOMPLETE …
   NOT MEASURED") and costs ~5 Linux-min a run. It belongs to EP10, so its owner says yes first.

Together these cut macOS demand by about a third (45 → ~31 min a run), which is the queue that hurts most.

**The "4 real breaks replayed red" half:** retire it. Replaying them means rebuilding four old broken SHAs, hours of CI
for nothing new. The same scripts that caught those breaks live now gate every ship as journeys.

## CI10: root cause

- 100 runs: 45 phone jobs failed and 55 were cancelled as superseded. **All 45 failed inside "Prepare isolated
  Safari"**, before any game page.
- Failure shapes: `bootstatus` exit 75 after ~231 s (run 41633469749), Safari URL clients exit 124 with zero HTTP
  requests, and the latest run (41638394923) overran a 12 s compile of a 93-line C file.
- On 8057's job, 4.5 min passed before the device was even created.
- Both the arm64 image (3 CPU / 7 GB, run cc55) and the Intel image (4 CPU / 14 GB, since 675f2e6abb) fail.
- 31 commits have touched the phone CI code since 10-30. The furthest runs (ec08 / 41011494209, df27 / 41021253518)
  got Safari ready, then missed Driftwood entry at 60 s.
- **Cause:** a freshly created iOS 26.2 Simulator on a standard GitHub-hosted VM spends minutes in first-boot setup
  with the CPU pinned. Nothing in the repo can fit that into 6 minutes, and the device cannot persist between runners.
- **Cost:** each attempt holds one of the 5 macOS slots for up to 15 min, so the job slows CI9's journeys. A
  cancelled phone job also marks a shipped run `cancelled` (33934a5 / 41627641293 shipped and still reads
  `cancelled`).

**Phone job verdict: delete it.** "Fix it" has had five days and 31 commits without one pass. "Report-only" still
costs macOS capacity on every push. Phone coverage stays where it works: the local Simulator at milestones
(`scripts/sim-lane.sh`) and Jake's iPhone. This reverses G921, so it needs Jake's word.

## Why runs read "queued" or "cancelled"

Each push gets its own run, so no run is held. A run reads `queued` until one of its jobs gets a runner. `prepare`
and `phone-route` each keep one running plus one pending job per ref, and a newer push cancels the pending one
(55 of 100 runs today). Overnight piles happen when the macOS and Linux pools are full of older waves. This window
never went idle (05:30–12:45Z always had a running job). There were no runs at all on 11-02 (no code pushes).

## Recommendations for Jake

1. **CI10: delete the push Simulator job** (reverses G921; phone checks stay on the local Simulator and your iPhone).
   Recommended: **Delete**.
2. **CI9: retire the 15-min bar and the replay half; close on "journeys gate the ship + 3 capacity cuts landed + one
   day's p50 recorded".** Recommended: **Rescope**.
3. **CI7: drop the 1.2× shard-balance half** (the 5-min half passes 21/21). Recommended: **Drop**.
4. **CI3 and CI6 stay done** with today's numbers in the row (the ship job's runner wait moves to CI9). Recommended:
   **Keep**.
5. **draw-budget off the push run** (always NOT MEASURED on SwiftShader). Recommended: **Remove** (ask the EP10 owner).
6. **Check the GitHub plan:** the 18-job peak fits the Free cap of 20. Pro ($4 a month) raises it to 40; macOS stays at
   5. Recommended: **Upgrade** only if Linux waits remain after the cuts.

Total to close the plan: about 6 h of one Codex lane (sp-x8), then one day of measurement.
