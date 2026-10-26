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
dispatch/partition fixtures validate it. Ordinary runs `40364990561` and
`40368094795` subsequently completed all six legs without cancellations while newer
cohorts queued. Both exact-SHA raw receipt sets pass independent verification.
This does not close the separate CF2 title-capture contention.

## CF2 grid preparation: unresolved evidence (2026-10-26 18:47 UTC)

Smoke `40371580877` tested `2b11287c5f` from green CI `40367165227`. Its grid leg
refused at 17:56:05 UTC while gameplay was ready, unpaused and drawing: frame
1,233, no fatal/fault/report, seven far preparations still "fetching". The later
failure receipt retained five pending preparations, so some work continued. Other
five legs passed. Artifact `12674215226` contains no network trace of the failing
interval; the native title trace ends before it. "Fetching" includes index/file
reads, decode and hidden shader preparation, so the held stage is unassigned.

Sp-x2 landed passive phase/age and existing file/worker-wait observations in
`12750adbcb`; this changes no promise, queue, cap or deadline and is not a causal
fix. The original 18:26:05 UTC repair deadline elapsed unresolved. Sp-x7's one
cause-directed local reproduction used exact `12750ad-mvplx4jl` and the maintained
original grid driver: 25,369 ms, prepared at 6,590 ms, gameplay at 7,256 ms, no
faults/reports and all original route/pixel gates passing. Passive recording of
the driver's existing polls retained 44 observations and 18,822 network events,
with no failed request. Proof `20261026T134620-sp-x7-grid-wait-repro-9167` and raw
`tmp/sp-x7-live/grid-wait-repro/` retain the result. Browser and owned preview
cleanup completed; no second reproduction or CI retry was started.

Later ordinary exact CI/six-leg proofs for `9b20c6faf0` and `14a3d5d935` pass,
but neither establishes a fix for the retained red. It remains **open**, owned by
sp-x7 after the elapsed clock. No speculative cache/render patch, deadline change
or source attribution is claimed; the passive phase/wait evidence must name the
held boundary if a subsequent ordinary run fails.

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

## G745: Jake's phone smoke route

**In flight (2026-10-26, sp-x7).** A seventh exact-artifact leg follows
cold title → SHARD SELECT → grid/Driftwood → road → inner northwest
Night Market → road → Driftwood return. One ordinary run is report-only;
only that matrix part has `continue-on-error`. After its receipt is reviewed,
remove that one exemption so every leg blocks the exact-SHA boot status.
No smoke retry, deadline extension or later successful frame substitutes for
that first report. The existing six release checks continue during rollout.

The phone leg gets its own checksummed push artifact. It retains the declared
grid neighbours because the real prediction path can prepare them, plus the
same shared shell/JS/JSON pack closure. It never rebuilds app bytes in smoke.
An available iOS runtime selects the existing one-device Simulator lane;
only a runner without one uses the iPhone-tier WebKit equivalent. Runtime
inventory and the selected engine are uploaded, so fallback is visible.

Checks retain the 500 ms presented hero target, first geometric Night Market
entry with actual L0/L1 tiles and no far proxy, real touch HOVER/held-input
wall containment, completed draws over ten wall-clock seconds from G718's
pill/draw path (integer-rounded 30 fps, the existing floor policy), and zero cinematic grain on the route. Every crossing
uses the maintained held-input driver with no pose seed or forced admission.
Original fatal/pixel failures remain red; route receipts, captures and exact
SHA/source-run transfer identities are artifacts. This is smoke, not a physical
phone memory or frame-floor acceptance claim.

Local driver development retained two nonqualifying refusals: a missing
statement separator in the injected save/harness source (parser RED/GREEN
regression), then duplicate Night Market slug instances (the route now picks
the declared inner northwest address). The second visit reached Driftwood:
806 ms presented hero over production HTTP, 292 draws/10.002 s, no faults.
Neither number is a pass or a reason to relax the gates. A third prototype
refused a duplicate `harness.walk` observer: entry observation now uses passive
browser rAF, retaining a value copy of the first-entry tile state. The exact
child-process regression proves it never takes the maintained driver's slot or
rewrites late tiles as on-time. Ordinary dry-run and activation remain pending.
The straight north drive from the cold south-beach spawn hit a real town wall;
the shipping navigation query also refused that north-socket path. Neither is
an app-regression claim. The driver instead exits through the nearby south
socket and follows the west perimeter road. That actual departure completed
on live `14a3d5d93`; the complete return/wall proof remains pending. Thirteen
focused JS cases (including eleven archive Python cases), scripts/root types,
named typed lint and actionlint pass for the report-only source boundary.
Report-only source `893f149908` is on origin. The live14a south-departure
visit retained 295 draws/10.001 s in Driftwood and 298/10 s on the road,
then stopped at the Night Market preparation barrier (world feet
`-656.3,0.4,288.2`, current road) under the unchanged 150 s driver limit.
No held-await attribution or complete route pass is claimed. Failure receipts
now retain the existing ring preparation/wait and crossing state; one current
exact preview is building before another development visit. Ordinary dry-run
and gating promotion remain open; no retry of the old CI smoke was requested.
The containing893 preview's stop evidence corrects the earlier barrier label:
rings were ready, preparation/waits empty and crossing settled. The driver
aimed off the declared midpoint turn-in and hit the road kerb. Its waypoint now
uses the actual cell-edge midpoint before approaching the wall; no app source,
readiness guard, collision or clock changes. That visit's local presented hero
was151ms/FCP87ms, which qualifies only that development observation.
The corrected held visit reached Night Market with first-entry ready/current
and inside all `open-plot-nw`, L0=15/L1=16, far=false and grain0. The public
avenue has no east wall within25m, so the old posed G721 room coordinates are
not used. The probe now queries actual building-sized box colliders in four
directions, walks to a ten-metre approach with the maintained driver, taps
HOVER and requires the same collider for four seconds of blocked board input.
Directional projection also verifies west/north/south contacts without assuming
a positive-X wall. Six focused cases/types/lint pass; complete return and the
ordinary report remain pending. Development visits are not CI smoke retries.
The boxed locator was not valid for the shipped `collide_plot` triangle mesh:
its broad query first found a creature-only border (the player correctly
crossed it); requiring a Cuboid then found no building. The corrected query
uses the actual player's collision groups and confirms a vertical2m×1.2m
surface patch on the same native collider using multiple rays. Missing JS
surface tags remain null, never fabricated. Platform edge hits refuse;
the structural mesh is tagged `ground`, so its vertical walls remain eligible
while horizontal surfaces refuse by their observed normals. The existing real
board-mesh collision regression retains both fresh and restored wall contacts.
all real board containment/settling checks stay. The first-paint read also
awaits the observer's first published image/rAF timestamp under the SAME title
deadline, avoiding a null read while the shell hydrates. No later frame can
replace that recorded first paint or relax the500ms gate.

The exact893 functional visit after this correction reached Night Market:
first-entry ready/current/inside agree, L0=15/L1=16, far=false, grain0.
It still refused `No real building wall on the public approach`; wall contact
and the complete return are UNPROVED. The local hero witness was195ms and
ten-second draw counts were298/300/299, not CI performance acceptance.
Browser cleanup completed and the owned4405 preview was stopped. No ordinary
smoke retry or gating promotion follows this refusal. O1 was asked for a
source-defined reachable wall approach before another functional visit.

O1 supplied the authored gate boundary: c27ec452e8's three-bay gate has an
open central avenue and solid stone plinth faces at plot-local x=±5.4,
z=-2.6..2.6. The maintained held-input route now reaches the actual plot
centre before querying the existing collider, then returns along the same
avenue. The earlier avenue stop at local z=-218.75 was outside that wall's
ray range. A containing exact preview is required; the old893 visit cannot
qualify this changed geometry. No posed start, synthetic wall or gate waiver.

The containing8b8 functional visit reached plot-local (0.002,-1.25) but
the locator still refused before board input. Native inspection of the actual
far-model triangles isolates its beveled upper face: west base hit5.358m,
normalY=.02044; upper hit5.598m, normalY=.47351. The old perfectly-vertical
upper probe rejected that24cm bevel. It now requires the upper surface to
exceed the player's actual max-climb slope, on the same collider and within
the corresponding bounded horizontal run. Base verticality/width and all
held-board collision/settling assertions remain unchanged. Seven controlled
cases include steep-bevel admission plus walkable/disconnected upper refusal;
named lint and scripts types pass. Full return remains unproved.

### Release reading — 2026-10-26 21:35 UTC (sp-x7)

Live remains `14a3d5d93-mvpm835t`, published18:54UTC with exact six-leg
smoke40377284254 and full push CI. No newer release is proved. Scheduled
release-only successes are not counted as main CI greens. The completed
40401413261 red on99537535fc contains three known classes: products' native
CMake120s timeout, Inspector lint, and retired Sky rig fixture paths.

Products has sole owner sp-x1: configuration ran20:59:04→21:01:04 under
the six-worker product pool. The generic shard.config/compileScript checks
are fallout from that native prerequisite failure. Fix a8ba821b87 is on
origin before the21:31:04 source deadline: checked selected-product native
preparation precedes workers, with both120s stage caps and recipe unchanged.
Local preparation was warm; Linux cold acceptance remains pending. Inspector
fix28c061d9b0 and complete Sky fixture repair0f62b4a703 are also on origin.
The separate transfer fixture repair eee46861ce is pushed and locally checked;
its source does not make the failed older run green. Containing CI is pending.

The Showcase4B tile refusal is source-fixed by3450616487 without a budget
change. Driftwood's subsequent dressing output ENOENT is fixed by dca731cde4
(origin ancestry verified):552bb9196f changed cove bytes without matching
declared output names. O4 identifies those L18 commits as sp-o3's. A matching
ready preview is reported; no second source patch or duplicate build is needed.

### Release reading — 2026-10-26 21:58 UTC (sp-x7)

Full push CI40405743789 on a3b00cc68d finished red in four jobs. Generated
inputs, derived docs and all six lint jobs passed. Live remains14a3d5d93;
there is no newer exact smoke or release proof.

- Products: the earlier CMake defect now has actual Linux cold acceptance.
  Checked Basis preparation took70.869s, ready before workers in71.466s;
  all24 products built. The later refusal is distinct: CLOSED Driftwood C2
  Looks has31 custom lines, first21:51:49, deadline22:21:49. Tested a3b
  predates G750's1d4a4f738f removal of the sole-use cloud comparison code.
  Current source-only closed-component check passes. The full strict output
  census still requires current products; no green claim substitutes for it.
  O3 confirms sole ownership and the exact charge: toonClouds.ts contains
  37 non-comment lines minus six imports, hence31 counted sole-user lines.
  Defining G750 fix1d4a4f738f is verified on origin and deletes that module
  plus the variant branch. The source fix is present; full products/census
  acceptance remains pending on a containing ordinary run. No redundant
  local rebuild, guard allowance or CI-success claim is made.
- Types: quantized GLB tests passed ArrayBuffer|SharedArrayBuffer to
  GLTFLoader, first21:43:49. O3 fix732273c60f is on origin, local strict
  SDK test types and both cases pass, within22:13:49 source deadline.
- Behaviour3: the public boot-pack test omitted the admitted five-rig
  metadata used by production, first21:47:49. X1 fix095787aa7077 is on
  origin before22:17:49; public-file existence and no-retired-rig URL
  assertions remain strict. Eight focused cases/types/lint and CF1 pass.
- Behaviour11: foliage expected raw float attributes after the explicit
  quantized-storage change, first21:47:46. O3 fix1992f8b8fa is on origin;
  full compact-channel, copy-box and trunk-contact checks pass. Companion
  rock consumer repair49773e33d1 is also on origin with four fresh-product
  cases, preserving positions, bounds, colliders and complete world rows.

The separate tiled-buffer usage fixture narrowing04be474cc6 is on origin;
it preserves DynamicDrawUsage without a cast. G745 transfers to sp-x9 under
the lane audit; sp-x7 starts no further feature work while main is red.
This reading is a source/provenance receipt, not a containing-CI success.

CI40407883753 on f99b7837db contains G750 and its products census is still
running. Behaviour7/11 repeat the older Sky/foliage refusals on source before
095787aa7077/1992f8b8fa. A distinct behaviour8 failure is owned/routed to o3:
test/toon-look-platform.test.ts supplies no cloud `detail` after the G750
contract change, so its executable/day-key negatives cannot start. First
22:01:20Z, source deadline22:31:20Z. O3 correction8ff7e588e9 declares cloud
detail1 in that fixture; all refusal cases remain unchanged and four local
cases pass. Publication and containing CI must be verified independently.
The overall verdict remains red pending containing checks. No capture, cap
change or smoke retry is requested.

## Decisions for Jake

- **D1** Should `commit.sh` run `vitest related` (and the touched layer's types) on every commit, capped at 60 s,
  and refuse a red? **Recommended: yes** (CF1). It is what G612 already asks for, made a guardrail; 40 % of red main
  in this window would not have landed. **Jake: yes, refuse reds (G689).**
- **D2** Flaky tests: delete or fix the same hour, never retry? **Recommended: yes, delete by default** (CF2, G416). **Jake: fix, never delete (G690).**
- **D3** Split the behaviour shards so product-free tests start before products (more CI minutes, ~6 min faster
  verdicts)? **Recommended: yes** (CF3). **Jake: yes (G691).**
- **D4** G620's 30-minute red cap is below two CI cycles (~34 min). **Recommended: measure red windows against 45
  minutes until CF3 lands, then back to 30** (SW3 already uses 45). **Jake: yes, 45 min until CF3 lands, then 30 (G692).**
