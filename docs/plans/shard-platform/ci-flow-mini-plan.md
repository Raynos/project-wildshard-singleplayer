# CI flow: commit, push, CI, release (E495)

**State:** `active` 2026-10-24 — Jake ruled D1–D4 (G689–G692): CF1, CF3, CF4, CF5 go; CF2 fixes flaky tests, never deletes. Audit by the plan agent's subagent, read only, window
10-23 18:00 → 10-24 13:30 Cancun (19.5 h). Builds on [shared-waits](shared-waits-mini-plan.md) (SW1–SW10, its 13:00
reading) and never repeats its rows; CF rows go to the coordinator through STATE.

Jake, 2026-10-24 ~13:30 Cancun (E495): *"Lanes waiting, lanes blocked, lanes red, lane hours wasted. Can you make a
mini audit and just like another mini plan based upon the last 12 hours or whatever? Like what can we do with CI and
pushing and waiting and committing and all that stuff."*

## Findings

Sources: `gh run list --workflow deploy` (push runs with every check), `gh run view --json jobs` and `--log-failed`
for all 17 red runs and 48 green ones, `gh run list --workflow boot-smoke.yml`, `git log` of each red window,
`.git/push.log`, `.git/commit-lanes.jsonl`, `.github/deploy-pin.json` history, `python3 scripts/agent-time.py
--hours 20`, the six live Codex transcripts (read only).

1. **Committing and pushing are not the bottleneck.** 342 commits; commit → origin median 21 s, p90 52 s; push gate
   median 8 s, 17 red ticks; 0 commit-lock timeouts, 0 heavy-lane queue. Nothing to cut here beyond SW8.
2. **CI gives one verdict per ~16 minutes, whatever the push rate.** The `deploy-ci` concurrency group runs one push
   run and keeps one pending; every newer push cancels the pending one. 252 push runs: **186 cancelled (74 %)**, 66
   verdicts for 342 commits (one per ~5 commits). A green run takes median **19 min** from push to last job (p90 27):
   2.6 min to the first job, generated-inputs 3.3, then products 5.7 (types 2.5 and lint 2.0 run beside it), then
   the 16 behaviour shards 4–4.5 (they wait for products), then build-and-deploy 2.2.
3. **Main was red 527 of ~1,165 min (45 %) in 11 windows, median 49 min.** Each window splits into: red push →
   red verdict median **17 min**, verdict → fix pushed median **9 min** (max 41), fix pushed → green verdict median
   **17 min**. So ~34 of the 49 minutes is two CI cycles: **G620's 30-minute cap cannot be met even by an instant
   fix** while a cycle takes 17–19 min. 0 reverts (G674).
4. **What turned main red** (all caught by CI; the push gate checks none of these since G675):

| Cause | Windows (start, minutes) | Red min | Cheap local catch? |
|---|---|---|---|
| A test that exercises the changed module, not run before landing | 01:07 35 (`client-wildlife` after 0f37fa8429), 02:14 66 (`view-frame-slot` after e472f34069 + a slow test), 03:38 44 (`grid-reentry` imports `sim/snapshot`, changed by 54619d7a5f) | 145 (28 %) | **yes**: `vitest related` on the commit's files, seconds. Pre-commit runs no tests ("no related walk") and the push gate skips `related-tests` (G675), so nothing enforces G612's "land on types / lint / related" |
| Flaky test or runner crash: the next run passed with no fix | 21:11 29 (`heavy-lane.test` 3.7 s timing), 01:33 49 (`nine-movers-view` clock; fixed later 27eeec17dd), 06:57 32 (`nalati-creature-views` tolerance 5e-10), 09:17 25 (V8 `SIGILL` in `shard-headless`) | 135 (26 %) | no; delete or make deterministic (G416). Also `scene-dressing-rows` takes 69 s against a 30 s timeout (02:14) |
| Build / products / shard boot | 19:38 55 (products: every `shard.config.ts` check exited 1), 23:15 59 (top-level-await refusal and codec prep broke the build and Pine headless boot; 3 red runs) | 114 (22 %) | no; needs a product build, CI's job |
| Types project list | 11:53 64 (`TS6307`: `src/engine/boot/bytes.test.ts` imports `test/fake/FakeGame.ts`, outside the engine project; plus products, derived-docs) | 64 (12 %) | **yes**: a static guard or the touched layer's `tsc`, seconds |
| Pinned content hash | 18:12 49 (`driftwood-deck-files` expects an old catalogue hash) | 49 (9 %) | partly (the test reads files, not imports) |

5. **A red verdict names the test, not the commit.** The range from the last green run holds 1–13 commits (median
   ~6, since 74 % of tips get no verdict); the owner is found by reading `git log`, which is most of the 9-minute fix
   phase and all of the 41-minute one at 11:53.
6. **Release waited 11.2 of 19.5 h on holds.** `deploy-pin.json` held from 15:30 10-23 to 01:18 (9.8 h; live stayed
   on ff45b6a24) and from 12:00 to 13:22 10-24 (TB1). Boot smoke: 46 verdicts, **14 red (30 %)**, 10 of them the
   `explorer` leg's "Explorer catalogue/thumbnail deadline" on consecutive SHAs 20:33–00:35, one every leg ("Missing
   built title shard catalogue", 19:01), one `hover-webkit` (03:32). A smoke takes median 20 min after CI; outside
   holds a green commit reaches live in ~1.5–2 h (CI 19 + smoke 20 + up to 60 to the hourly release + 18 deploy).
7. **Lanes wait on CI and on each other only a little; they mostly idle or sleep.** Codex slept 6.85 h in 20 h (799
   sleeps, poll share 71 %); the transcripts whose text names a reason give ~1 h on CI verdicts, ~1 h on Simulator
   quiet / "CPU release", ~0.4 h on another lane, ~0.2 h on origin; the rest has no readable reason. Idle Codex lanes
   (~13 lane-h, SW10) stay the biggest loss.

**Lane-hours:** red main ~7 lane-h a day (shared-waits estimate) splits by the causes above; CI latency doubles every
window; Codex sleeping on CI / origin / acks ~1.5 lane-h a day. Idle lanes (SW10, ~10–16 a day) dwarf all of it.

## Rows (ranked by lane-hours saved)

| Row | What | Saves (lane-h/day) | Owner | Effort | Done when |
|---|---|---|---|---|---|
| → SW10 | **Idle lanes take the next row** (already a shared-waits row, not repeated): one claimable row per live lane, no "on origin / CPU release" acks. Fold in: a lane never sleeps on a CI verdict or on origin (Done = pushed, E428), so its ~1 h of CI sleeps and ~0.2 h of origin sleeps go too | 10–16 (SW10) + ~1.5 | coordinator | XS | SW10's bar; 0 Codex sleeps whose reason is CI or origin in a reading |
| **CF1** | **`commit.sh` refuses a commit whose related tests fail.** It runs `vitest related --run` on the staged `src/`, `test/` and `scripts/` files (and the touched layer's `tsc -p` if warm), capped at 60 s; over the cap it lands and says so (CI decides). Delete the doc lines that ask lanes to remember it (D3: guardrails, not reminders). Plus a static guard: a file under a layer imports nothing outside that layer's `tsconfig` include list (the `TS6307` class). Not a mirror check (G612): it runs on the files being committed | ~3 (40 % of red minutes: 145 + 64 of 527) | done (sp-x2; b96c1accac, f4465ac4ab, 7d684da322) | S | a reading where no red window's failing test is `related` to its culprit and no `TS6307` reaches CI |
| **CF2** | **Flaky tests are made deterministic, never deleted, never retried (G690; Jake overrode delete-by-default).** A red the next run passes without a fix is a flake: sp-x7 (G676) fixes the defining clock, arithmetic, fixture ownership or setup in the same hour; all original assertions and deadlines remain. A runner failure remains explicit rather than receiving a retry. The unresolved title-capture contention and current evidence are recorded below. | ~2 (26 % of red minutes) | sp-x7 | XS | no red window in a reading that the next run clears without a fix |
| **CF3** | **CI verdict in ≤ 13 min: product-free tests stop waiting for products.** The 16 behaviour shards wait for products (5.7 min) though most test files never read a product. Split them: files that read `WS_TEST_PRODUCTS_SHA` products stay after products; the rest run right after generated-inputs (or after checkout). Delete what the split makes dead. Two cycles per red window → ~12 min off each window and more verdicts per hour (fewer cancelled tips). Costs CI minutes only | ~1.5, and every lane gets verdicts ~6 min sooner | in flight (2026-10-24, coordinator reading; source 1f76530a1d done) | M | median green run ≤ 13 min from push to last job over a reading |
| **CF4** | **The red run names its likely culprit.** `ci-fail-fast.py`'s cause printing (C4) adds the last green SHA and the commits in that range that touch the failing file or its imports (`git log <green>..<sha> -- <files>`), with their `Assisted-by` lane. No bot, no message: the owner reads it in the run, sp-x7 forwards it as today | ~0.5 (fix phase median 9 → ~4 min) | sp-x7 | XS | every red run in a reading lists ≤ 3 candidate commits with lanes |
| **CF5** | **Boot smoke stops failing on a runner deadline.** The `explorer` leg's "catalogue/thumbnail deadline" failed 10 SHAs in a row on CI runners while the game was fine (G415: no glitches + same look, not timing exactness): loosen it to a hang guard or delete that check. A red smoke blocks the release, not the lanes | ~0; hours of live (11 of 19.5 h held) | sp-x7 | XS | 0 smoke reds in a reading that the next SHA clears without a fix |

Not worth a row: the push loop (gate 8 s, origin 21 s), the commit lock (0 timeouts), a local product build before
landing (55 s–2 min per commit, CI's job, and G612 says no), more CI runners (queue to first job is 2.6 min; the
critical path, not capacity, sets the 19 min).

## CF3 implementation (2026-10-24, sp-x1)

Source landed in 1f76530a1d. The 16 product-free behaviour shards now depend only on generated-inputs; four
behaviour-products shards retain the exact-run product artifact and strict product preflight. The existing product
registry partitions files before duration packing or hash fallback. Local/full/nightly selection without a cohort
remains complete. Both cohorts report independently, and both must succeed before exact-SHA smoke dispatch.

The current inventory proof covers 1,263 files once (1,219 free / 44 product consumers). Real Vitest fixtures cover
both cohorts with and without duration data; missing-product refusal stays strict. 23 focused and 21 related tests,
root types, named typed lint and actionlint passed. This is topology/coverage evidence: the median green verdict
of at most 13 minutes remains OPEN for the next ordinary CI reading (sp-x7/coordinator); no timing claim yet.
G692 returns the red-window cap to 30 minutes once this source lands.

### CF3 ordinary verdict reading (2026-10-26 03:15 UTC)

The latest five completed main push verdicts, excluding cancelled and deploy-only runs, took 15.43, 16.30,
20.65, 17.87 and 18.22 minutes. Median: **17.87 minutes**; green-only median: **18.05 minutes**. The
13-minute target remains **open**. These are push-to-final-verdict wall times, including queue, setup,
artifacts and job tails; they are not test CPU times. Runs: `40261303981`, `40258944555`, `40257263766`,
`40256014057`, `40253473574`. sp-x1 owns the next critical-path audit at a natural source boundary.

## Exact-smoke queue repair (2026-10-26, sp-x7)

Independent automatic concurrency groups for the build and each browser leg
allowed newer dispatches to replace different queued legs. Run `40352474526`
lost public, Explorer and Developer; `40359234545` lost grid and public. These
were incomplete exact-SHA proofs, never accepted by combining other runs' greens.
The workflow now coalesces complete automatic cohorts: one active workflow keeps
all six legs, and only the newest pending workflow survives. Explicit SHA proofs
retain separate groups. The release-dispatch job keeps its independent lock.
No cases, artifact identities, deadlines, fatal checks or pixel gates change.
The workflow contract regression fails before this repair; actionlint and the
dispatch/partition fixtures validate it. The next ordinary smoke verifies actual
GitHub scheduling; this does not close the separate CF2 title-capture contention.

## CF2 title capture: unresolved evidence (2026-10-26 16:15 UTC)

The supported fast PNG path and original ten-second shared capture allowance remain. Disabling script
execution was unsafe: it discarded pending animation callbacks. `dacdb64b62` removed that protocol
mutation; subsequent public/Developer gameplay and exact six-leg smoke passed without callback replay.

The next failure is smoke `40273171598`, tested `a3eedbaba0` from CI `40271513060`, Developer Nine's first
title capture. Artifact `12629855004` retains the native Chromium trace. There are no app faults or error
reports. Stage timings: fonts-ready **8,414.645 ms**, rAF **123.015 ms**, layout **26.970 ms**, native PNG
RPC **1,547.255 ms**; the native wait had only about 1.4 seconds left. Total refusal: **10,542.037 ms**,
including cleanup. The late PNG is refused; the diagnostic JPEG is not substituted.

The retained trace has an **8,348.303 ms** renderer animation task and **6,616.257 ms** across 464
`GetProgramiv` events (longest **1,484.820 ms**), with concurrent GPU work. Its generic callback is in
`assets/unlock-Cgd1TyGh.js`; without the exact source map this does not identify a specific warm owner.
This proves renderer/GPU contention during the readiness wait, not font-network latency or an idle GPU.
The original native-capture contention remains **open**, owned by sp-x7. Per the coordinator's stop rule,
there is no third speculative capture change, retry, deadline increase, pixel change, script suspension
or new Debug row. This records the next stage timing rather than claiming a deterministic fix or a
green proof for the failed candidate. Older exact CI-and-six-leg-green main candidates remain releasable.

Later exact failures retain the same evidence limit. Smoke `40346975383` tested
`019bc07a92` from green CI `40344402224`: public Nine's native capture refused after
10,011 ms, with no app faults or reports. Artifact `12661729025` contains a 7,094 ms
renderer animation task, 413 `GetProgramiv` calls totaling 5,198 ms, and concurrent
GPU work. Smoke `40355584392`, tested `6e84134e0c` from green CI `40351491224`, again
refused public Nine's native capture (9,159 ms of the shared allowance; roundtrip
11,151 ms). Artifact `12665868137` retains its bounded native trace; no app faults
or reports occurred. Neither failed candidate was retried or admitted for release.

The exact `019bc07a92` source audit identifies two outstanding title owners:
`finish.ts` starts `warmRest()` without exposing completion, and schedules
`primeFrame()` after 1,200 ms. The latter forces a world draw through the otherwise
closed title frame gate. The generic animation wrapper does not establish which
owner caused a particular recorded task. Title visibility, `ws:ready`, fonts and a
normal animation frame are not a completion barrier for both owners;
`warmEnteredFrame` belongs to a different entered-region path. There is no existing
public combined warm-idle signal to use for the permitted capture wait. No new
readiness signal, app scheduling change, capture change or deadline was introduced.

## Decisions for Jake

- **D1** Should `commit.sh` run `vitest related` (and the touched layer's types) on every commit, capped at 60 s,
  and refuse a red? **Recommended: yes** (CF1). It is what G612 already asks for, made a guardrail; 40 % of red main
  in this window would not have landed. **Jake: yes, refuse reds (G689).**
- **D2** Flaky tests: delete or fix the same hour, never retry? **Recommended: yes, delete by default** (CF2, G416). **Jake: fix, never delete (G690).**
- **D3** Split the behaviour shards so product-free tests start before products (more CI minutes, ~6 min faster
  verdicts)? **Recommended: yes** (CF3). **Jake: yes (G691).**
- **D4** G620's 30-minute red cap is below two CI cycles (~34 min). **Recommended: measure red windows against 45
  minutes until CF3 lands, then back to 30** (SW3 already uses 45). **Jake: yes, 45 min until CF3 lands, then 30 (G692).**
