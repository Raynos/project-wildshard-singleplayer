# CI-FIRST-PRINCIPLES: what GitHub Actions does per push, why it is slow, and what it should do

**State:** `open` 2026-10-29, ruled by Jake ~17:45 (G918–G923); revised ~18:45 to match: every test still runs on **Not part of SHARD-PLATFORM; lowest priority (G924): its rows come after FOUNDATIONS, frame-cost, the Pine / Nine QA rows and CX1–CX3.**
every push, in far less wall clock; pins are deleted outright; the tested build ships as soon as it is green; the
Simulator stays on GitHub Actions; the Node harness is the main integration test; test-quarantine goes. Rows CI1–CI14
are open. Where this text disagrees with G918–G923, the G-rows win.

Jake, 2026-10-29 ~16:50 Cancun: *"How many actions are there per commit on main? Are there 16 fanout actions and
another 8 fanout actions for like all kinds of really slow-ass tests? How fucking long do they take? … What's a really
good way of doing integration tests for the system? And what are we doing, and why is it so slow and shit?"* ~17:45
(G918): *"We need to run all the tests but faster and better."*

Measured with `gh` over 48 h, 2026-10-27 22:00 → 10-29 22:20 UTC (1,951 runs on `main`, 659 runs' jobs, all 264
failed jobs' logs). Per-file vitest times come from 4 of the 16 `behaviour` shard logs of run 40940376404.

## One screen

- **Today: 16 + 8 fan-out.** Each code push starts a 30-job `deploy` run (16 + 8 vitest shards and 6 build / types /
  docs jobs). On top come `storage`, `test-quarantine` and, when the run is green, `boot-smoke` (10 jobs, 7 on macOS).
  That is **4 runs and 43 jobs per push**, at 385 pushes a day.
- **Today's time:** push to CI answer **23 min** (p90 31), the boot smoke **+16**, and the release **rebuilds the game
  (+21)** on an hourly slot. Push to live is **1–3 h**.
- **Why slow:**
  1. **Vitest spends 80 % of its time not testing.** A 10-min shard reports "setup 49 %, import 32 %, tests 18 %".
     `test/setup.ts` installs the whole game (species, pickups read from `public/`, Nalati and Pine native blocks,
     loot, score) before **each** of 2,174 files.
  2. `gen` runs twice (in `generated-inputs` and `products`), and the 8 product shards start 2.5 min behind the 16.
  3. **60 % of finished runs are red, almost all on pin tests** broken by intended changes. Only 44 green SHAs in
     2 days could ship.
  4. Releases wait for the hour and then rebuild what CI built.
- **Target (G918–G920): every test, every push, ≤ 12 min to an answer; live ≤ 15 min after the push when green.**
  One prepare job builds once. Every test and browser leg runs in one parallel wave on that artifact. The run's last
  job deploys that same build.
- **Order:** delete tonight's Nalati pins and ship the tested build first (unsticks the deploy), then the speed work,
  then the harness.

---

## 1. What runs today (`.github/workflows/`)

| Workflow | Trigger | Jobs | Notes |
|---|---|---|---|
| `deploy` (push) | every code push (docs / progress / art / sources ignored) | 30: `generated-inputs`, `products`, `typecheck-lint`, `derived-docs`, `behaviour` ×16, `behaviour-products` ×8, `build-and-deploy`, `dispatch-boot-smoke` | One group: the running run finishes and only the newest pending one survives (G582) |
| `deploy` (release) | :17 hourly + dispatch | 1 | `newest-ci-green` pin, then **rebuilds**: native build 11.3 min + `vercel build` 7.5 min |
| `boot-smoke` | each green push run | 10: `build`, 7 `macos-15` legs (boot-public, -developer, -grid, hover-chromium, hover-webkit, explorer, phone-route), `verdict`, `release` | Reuses the push dist; phone-route is report-only and runs `brew install` every time |
| `test-quarantine` | after **every** deploy run, cancelled ones too | 2 | Report-only; 38 of 46 sampled jobs red |
| `storage` · `admin-deploy` · `site-deploy` · `ota-promote` | push · :47 · site/ · manual | 1–2 | Small |

`gpu-gate.yml` was deleted on 10-13 (819a36b8d4), but DEPLOY.md still says it runs nightly.

## 2. Numbers (48 h)

| Workflow | Runs / day | Outcome | Wall p50 / p90 | Runner-min / run | Runner-min / day |
|---|---|---|---|---|---|
| deploy push | 265 | 78 % cancelled before starting; of 116 finished, 44 green and 70 red | 25 / 36 | 215 | ≈ 12,400 |
| boot-smoke | 22 | 33 green, 11 red | 16 / 19 | 51 | ≈ 1,130 |
| test-quarantine | 277 | jobs mostly red | 1.5 / 5 | 1.7 | ≈ 470 |
| deploy release | 16 | 24 real deploys | 22 / 26 | 21 | ≈ 230 |

**Long poles:** `generated-inputs` 5.8 min, then each `behaviour` shard 8–10 min (p90 13). `products` 9.5 min (gen
2.4, shardfiles 4.1), then `behaviour-products` 3.7 (+2.5 queue). **Smoke legs:** explorer 7.6, boot-developer 4.5,
boot-public 4.3, grid 2.8, hover 1.7 min.

**Slowest test files (s, one run):** `sky-prepared-model-output` 60 · `sky-signal-quest-product` 50 · `heavy-lane` 32 ·
`scene-dressing-rows` 31 · `pine-return-binary` 29 · `template-generation` 27 · `return-projection-v2` 23 ·
`nine-map-cache` 22 · `nalati-decorative-scene` 22 · `taming-script-admission` 21 · `nalati-places-program` 21 ·
`isolated-shard-pine-output-values` 20 · seven `isolated-shard-*-values` / `nalati-*` files at 16–19.

**Reds (264 failed jobs):** `browser-escape` (10 SHAs over 17 h), `test/value` (8), `nine-source-output`,
`nine-owned-product`, `nalati-species-product-inputs`, `nalati-place-blob-program` (5 each), then ~50 files on 2–3
SHAs. Nearly all fail with "expected [new shape] to deeply equal [old pin]". Lanes landed 48 `fix(test)` and ~90
`test(...)` commits in the 2 days. Tonight's reds (21:24–22:02) are Nalati pins: `nalati-titan-binary`,
`nalati-headless-assembly`, `nalati-script-sections-source`, `nalati-species-product-inputs`,
`nalati-place-blob-program`. **Flaky:** the Simulator leg (25 timeouts: inspector, `xcrun`) and hover-webkit (3).

## 3. What CI caught and what it missed

**Caught (boot smoke):** Nine fatal at load (10-27 22:26), Pine specimen bytes missing (10-28 05:45), title GL error
1282 (10-27 23:46, 10-28 03:44), a blank Nalati boulder card (10-28 02:01). **Vitest:** almost all oracle drift.
**Missed:** all of QB1–QB21. A browser journey catches QB1, QB3, QB4, QB5, QB7, QB9, QB13, QB14 and QB21. The Node
harness catches QB11, QB17 and QB15's crank logic. The Simulator catches QB12. Looks, feel and design (QB2, QB6,
QB8, QB10, QB16, QB18–QB20) are not testable this way.

## 4. Target design (G918, G920)

**One run per push, three stages, every test, ≤ 12 min:**

| Stage | What | Wall today → target | How |
|---|---|---|---|
| Prepare (1 job) | `gen` once, shardfiles, vite build, `vercel build` → one artifact (dist + `.vercel/output` + products) | 5.8 + 9.5 (two jobs, gen twice) → **≤ 6** | Merge `generated-inputs` and `products`. Cache `node_modules`, `~/.cache/wildshard/{gen,generate,shardfiles,basis}` and Playwright by key. Build once; no other job rebuilds |
| Wave (parallel) | **All** vitest files (product and product-free together) · types + lint + docs · browser legs · Simulator leg | 10–13 (+3.7 behind) → **≤ 5** | Lazy setup (§5). Shards balanced by measured file time (the `DurationSequencer` fed with CI timings), no shard > 1.2× the mean. Product tests in the same wave. Browser legs on the prepare artifact |
| Ship (1 job) | `vercel deploy --prebuilt` of the prepare artifact, if every wave job is green and the SHA is newer than live | 1–3 h → **≤ 2** | No hourly slot, no second build (G920) |

**Push → answer ≤ 12 min** (6 + 5 + ~1 of job start). **Push → live ≤ 15 min** when green.
**CI9 delivery decision (sp-x2, G872):** scope G582 coalescing to the prepare job rather than the entire push:
finish the running prepare and retain its newest pending source while earlier running waves finish. Push workflow
keys are unique per run. Native phone admission has its own per-ref coalescing, still starts alongside prepare and
never cancels a running phone job. Manual release and production shipping remain serialized; exact-run artifacts,
all source gates/SIX and the live floor remain mandatory. This removes the whole-wave dependency, not the account's
runner queues. GitHub's [job concurrency semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
permit this scope. Future containing runs must measure queue/throughput effects; no live-time gain is claimed.

**Job count:** stays within GitHub's concurrent-job cap so one run never queues behind itself: prepare 1, vitest ~12,
checks 1, browser legs 3–4, Simulator 1, ship 1 (≈ 20). macOS legs ≤ 5 (the cap on concurrent macOS jobs).

## 5. Making every test faster (G918) and deleting pins (G919)

- **Lazy setup.** `test/setup.ts` keeps only `localStorage`, `location` and strings (milliseconds). The world installs
  (species, pickups, native blocks, loot, score) move into fixtures that only the files needing them import. Expected:
  setup 49 % → < 10 %, so each shard is roughly −40 %.
- **Import cost (32 %).** Pure-unit files run with `isolate: false` in a threads pool, so modules load once per worker.
  Files that mutate globals stay isolated. Heavy fixtures are read once per worker from the prepare artifact.
- **Slowest files** (§2 list): each one ≤ 10 s by sharing its built product from prepare instead of rebuilding it in
  the test. A file that is a pin is deleted instead (G919).
- **Duplicate work:** gen runs once; `derived-docs` folds into the checks job; the native build runs only on native
  inputs (already); the release build goes.
- **Pins deleted outright (G919):** a test that pins exact bytes / hashes / shapes and only goes red on intended
  changes is deleted, in waves. Each commit lists the test and what it pinned. Real behaviour tests stay.

## 6. Integration tests without a browser: the Node game harness (G922)

**Already in Node today.** vitest runs in `environment: 'node'`, and Rapier runs in Node. `HeadlessSimulation`
(`src/sdk/headless.ts`) boots a **real built shard product** and steps it with commands
(`sim.step([{ source: 'player', commands: [{ kind: 'player', moveX, moveZ, yaw }] }])`). It returns a snapshot
(`decodeSimSnapshot`) and a `checkpoint`. `test/shard-headless.test.ts` already boots all 8 shards, walks 24 ticks and
completes every quest. Grid `SimHost` (docs/GRID-SIMULATION.md) steps regions with no renderer.

**What blocks the rest:** the verbs (crossbow `heldFirearm`, the hook, the crank, the HUD slots in
`src/engine/ui/hudSlots.ts`) live page-side, driven by DOM events and the render loop. Some modules touch DOM /
WebGL / Worker / `fetch` at import time, and timers decide things. three.js itself is fine in Node.

**Harness design:**
- **A journey is a command tape plus asserts on state.** Per shard:
  - enter;
  - walk 1,800 ticks on the physics route;
  - play each verb on the shard's verb list (MF15–MF18: hook lock → zip → land; crank ×3; crossbow aim / fire /
    reload / swap; each quest step);
  - exit and dispose.

  It asserts: no throw, nothing quarantined, no system switched off, the player grounded, verb state advanced (bolts
  30 → 29 → reload → 30), and resources released. It takes seconds and never retries.
- The physics walk (`physics-baseline.mjs --mode=walk`, in Chromium today) becomes a harness journey.
- **Server-ready** (the server itself is Jake's, G828): commands in and snapshots out, a fixed tick with no wall clock,
  seeded RNG, no renderer or DOM in sim state, many sims per process. **Each verb becomes a sim command** (MF14's
  "HUD from state").

## 7. The "heavy proofs", in plain words

| Proof | What it does | Where · time | Caught lately | Verdict |
|---|---|---|---|---|
| Boot smoke (`scripts/parity/boot-smoke.mjs`) | Real built game: every shard reaches page-ready; Explorer draws; HOVER mounts | CI, after green · 16 min | **4 real breaks** | **Keep; move into the push wave** as browser journeys (§8) |
| Phone route (Simulator) | Jake's cold route in the iOS Simulator | CI macOS · report-only | 25 timeouts | **Keep on GitHub (G921), made fast** (§8) |
| Vitest products cohort | Tests that read built products | CI · 3.7 min ×8 | Mostly drift | **Same wave; pins deleted** |
| Soak (`scripts/soak/`) | 30–60 min drive; leak census | local · ~1 h | Leaks | Milestone |
| Frame floor | fps and long frames per scenario | local · tens of min | Freezes | Milestone; "no frame > 100 ms" also in journeys |
| Physics walk | Fixed route per shard, 0 stuck | local · minutes | Stuck spots | **Node harness** |
| gpu-gate | Pixel parity | deleted 10-13 | — | Fix the DEPLOY.md text |
| Golden compare (144 cameras) | Stills vs the approved look | local · port approval | Looks | Looks only |
| Phone-loading, tile-plan reading | Load model; tile census | local | Estimates | Tools, not proofs |
| test-quarantine | Re-runs quarantined tests | CI · 2 jobs | Nothing | **Delete (G923)** |

## 8. Browser and Simulator legs, made fast (G920, G921)

**Journeys** (read through the game's own debug hooks, never pixels; on the prepare artifact):
- icon → title ≤ 0.5 s;
- each shard: enter → PLAY → walk 30 s → MAIN MENU;
- RELOAD;
- warm load: bar full ≤ 0.1 s;
- the bar never passes its total;
- no `/api/errors` report;
- no frame > 100 ms after 2 s;
- deploy skew;
- Explorer draws every catalogue.

**Browser legs:**
- No per-leg rebuild; one static server.
- One browser per leg, with a fresh context for cold runs and the same context for warm runs and RELOAD.
- 3 pages in parallel per leg, split by journey instead of a browser × shard matrix.
- WebKit as the iPhone 16 Pro; Chromium only where WebKit cannot run the check.
- Wait on conditions, never sleeps or 150 s timeouts. No retries.

**Simulator leg (GitHub macOS, G921):**
- Start the dedicated report-only phone job alongside Linux prepare. Boot and
  warm Safari in the foreground before dependency installation or artifact IO
  on its Mac. Keep the original 120 s Safari readiness and 20 min job bounds.
- Wait on only this run's successful prepare job before exact SHA/run archive
  intake; never wait on the aggregate containing the phone job. Failed native
  startup or producer refusal never causes a retry or silent WebKit fallback.
- Cache `ios-webkit-debug-proxy` instead of `brew install` every run.
- Use one pre-created device.
- Run a shorter route that waits on conditions.

**Expected wall clock:** the browser legs take ≤ 5 min in parallel, the Simulator ≤ 6, both inside the wave.

## Rows

Codex does the workflow engineering (non-visual). Ordered to unstick the deploy first.

| Row | What | Done when | Lane | Size |
|---|---|---|---|---|
| CI1 | Pin wave 1 (G919): delete tonight's red Nalati pins and the 2-day repeat offenders (§2); each commit lists the test and what it pinned | **done** (see lane) — Push CI green on main again | Codex sp-ci-deploy · done 143b3edd27, 5b54b7d044, ba70969be3 | S |
| CI2 | Ship the tested build (G920): push CI uploads `.vercel/output`; the release runs `vercel deploy --prebuilt` on it, with no native or vercel rebuild | Release ≤ 3 min; live `version.json` = the tested SHA | Codex sp-ci-deploy · 94c85866ef + 8e893e31a5; first remote package qualified (083d3c1c83 prebuilt artifact 1.54 GB); <= 3 min live acceptance open | M |
| CI3 | Deploy as soon as green (G920): drop the hourly slot; a green exact-SHA proof deploys at once if newer than live | Live = the newest green SHA within 5 min of its verdict | Codex sp-ci-deploy · landed 419a077b21 (hourly slot gone, 07:00 one-off kept) | S |
| CI4 | Delete `test-quarantine.yml` (G923); fix DEPLOY.md's gpu-gate text | **done** (see lane) — Workflow gone; DEPLOY.md matches | Codex sp-ci-deploy · done 87baf789f5 | S |
| CI5 | Lazy `test/setup.ts`: world installs move to opt-in fixtures | Setup < 10 % of vitest Duration; shards −40 % | Codex sp-x9 · landed 72aad6c49d (cohort 24.85 → 10.42 s, setup 52 % → 1 %); sealed Linux 6e0 / 41002964368: all 2221 planned files ran once, setup 40.477 / 10694.371 module-phase s = 0.37849%, 10898 pass / 2 story watchdog failures / 14 pre-existing draft cases unexecuted; setup bar met; ordinary containing Linux 4a41 / 41027244389 qualifies Pine 26.314 s and Driftwood 23.306 s with serial allocation dd2cc42999 + compile-cache publication 1b619096db, original 30/35 s limits unchanged; native job red only on separately owned Nalati discovery, no full-wave green claim | M |
| CI6 | One prepare job: merge `generated-inputs` + `products` + vite / vercel build; gen once; every job reads one artifact | Prepare ≤ 6 min; no job rebuilds | Codex sp-x2 (workflow dcc1847cea, streaming smoke archives) + sp-x1 (build-script speed). Actual da6af prepare 703 s vs prior 826 s, bar 360 s: gen 304, checks/app 148, smoke pack 42, Vercel package 39 s. Local 64 MiB archive comparison 119 → 75 ms, same tar hash/extent; containing remote streaming gain open; app half sp-x9 eb312d69da + ba60585eb3: local 50.188 -> 38.856 s warm (first population 56.090), seams 32.709 -> 19.134 s, all 48 transport files / 187,981,755 B exact, 27 focused controls pass; remote <=360 s acceptance open Asset ownership b39b50ed63 keeps all admission/refusal checks: private immutable snapshots plus full byte equality carry a computed hash across producer/SDK/disk reads. Pine retains 1,097 published files / 271,117,131 B byte-identical, including shard.json; only validation.buildKey changes with current source authority. Complete 43-file SDK fixture parity and 67 behavior controls/types/typed lint pass. Initial normal strict builds 15.56 -> 19.42 s are not a total speed win (admission/write 1.244 -> 1.118 s). Requested private warm SDK CLI host control uses identical current producer source and all 23 generation-step keys: 10.197 -> 9.769 s (-4.2%), process CPU 15.258 -> 14.801 s (-3.0%), all 1,098 private output files byte-identical. No warm handle overhead was observed in this single pair; the initial cold/source-key-confounded runs do not isolate the full step-cache contribution. Final normal generation 61.35 s plus independent strict Pine/DW/Nalati readers all pass; this is local readiness, not the remote 360 s prepare bar. | M |
| CI7 | One test wave: every Vitest file once across a duration-sharded matrix and blocking native Escape runner; `isolate: false` for pure files | Vitest wave ≤ 5 min, no shard > 1.2× the mean | Codex sp-x9 planner 985fbe3ac1 + sp-x2 34d7ac95e5/051ba4c3df; unchanged native controls/deadlines on one dedicated worker, full inventory union checked. Containing Linux run 41000966804 at da6af: original 6/6 pass, suite 24.323 s, trusted pair 9.496 s, job 72 s. Historical D-state cause unlocalized. Successful 2b625 source run 40998533769: all 2214 files, slowest Vitest step 709 s / mean 515.25 s = 1.376x (bars 300 s / 1.2x); timing/balance remain open. Collection reductions f515b43284 retain all 13 original cases across three prepared-product suites; post-read-warmed 9052d50ac2 + hook 7d03b1e0eb qualified on a037 / 41019098886: original six cases 15.479 s, trusted pair 0.907 s; pre-read 234 files / 434017483 B / 784.126 ms. Historical cold D-state remains unlocalized. Allocation dd2cc42999 observed on 4a41 / 41027244389: original six Escape pass 17.649 s, Pine pass 26.314 s, Nalati fails 93.465 s at its unchanged worker 30 s bound, then Driftwood still runs and passes 23.306 s. Exact-once selection, no-bail execution and blocking failure are observed; Nalati cause remains with sp-x8 and overall wave timing remains open; latest sealed fe0ca110e6 / 41035012795 measured slowest Vitest step 578 s / mean 448 s = 1.29018x. Rebalance f0247cd581 keeps all tests and original caps, using 24 shards with two workers and exact-source 12/24 recovery proof. All 12 same-SHA/run timing reports cover 2,282 files once; current discovery assigns 2,284 parallel files once, including two unmeasured files. Complete-module work 9,775.954 worker-s gives a twelve-shard perfect floor of 407.331 s, already above 300 s. Replaying those weights at 24 shards models max 203.683 s / mean 203.672 s = 1.000054x (no cloud timing claim). Sixteen planner/inventory controls plus 14 recovery controls, types, typed lint and Actionlint pass; the 300 s / 1.2x ordinary Linux bars remain open Sealed first measured 24-job carrier a149ffbbd9 / 41042142412 has 23 passing behavior jobs and one old SIX-order pin failure (fixed later by 5b112abf0f): Vitest max 375 s / mean 272.292 s = 1.377200x, so both bars remain open. Behavior queues are 2–497 s (median 213 s), with the last finishing 1,023 s after prepare. The run peaks at 13 Linux jobs; that is not the account quota. Latest 2,283/2,284 complete-module observations repacked at 24x2 model 255.839 s (median actual/module calibration 1.073), versus 279.097 s at 22x2 and 511.664 s at 12x2. At 13 available Linux slots with the observed 76 s median job overhead and fixed native/check jobs, modeled waves are 665.675 / 712.181 / 711.653 s respectively. Keep 24; fewer shards have no robust real-wall advantage, and a per-run cap 12 can worsen the model by 122 s without reserving account-wide capacity across waves. These counterfactuals are not measured cloud acceptance. | M |
| CI8 | Slowest files ≤ 10 s each (§2 list), or deleted if they are pins | **done** (see lane) — None over 10 s | Codex sp-x9 · done 82814dfd66 + c2b1f2acd9 (all 47 slow files ≤ 8.9 s) | M |
| CI9 | Browser journeys (§8) in the push wave on the prepare artifact; the ship job deploys after them; the boot-smoke dispatch chain goes | Push → live ≤ 15 min; the 4 real breaks replayed red | Codex sp-x2 · wired fa13b9fce6; sealed baseline fe0ca110e6 / 41035012795: created 09:39:23Z, verified live fe0ca11-mvuso9aw at 10:15:29.802Z, 2,166.802 s (36 m 06.802 s) vs 900 s. Critical path: workflow coalescing 482 s, prepare runner allocation 3 s, prepare 533 s, Explorer runner queue 337 s, Explorer job 600 s (actual catalogue guard 515 s), verdict/shipping queue 9 s, shipping to verified live 202.802 s (exact prebuilt restore 122 s). Observed peak 15 Ubuntu plus five macOS jobs does not establish the account quota. Remaining: workflow/concurrency policy sp-x2; CI6 prepare sp-x1 with app/build-script work sp-x9 and workflow sp-x2; prebuilt restore/shipping sp-ci-deploy; Explorer rendering stays Opus; the harness reuse cut is sp-x9 7cc041b4cd. One immutable 0b72 local Metal comparison retains all 24 dynamic catalogues and identical 338 card identities, 106.776 -> 83.011 s (-22.3%), with first-canvas sums 69.183 -> 54.819 s. One context/page retains native caches across fresh requested-world documents; URL, probe slug, changed time origin and final current card membership refuse stale catalogues. Original pixels/fatal/HTTP/navigation/no-progress checks remain. The existing harness identity suppresses telemetry without request interception or mocked assets. Completed resource-timing transfers 731.655 -> 331.534 MB, JavaScript 120.825 -> 11.956 MB and Wasm 52.164 -> 4.016 MB are observations, not a full wire census or isolated shader gain. All 15 behavior controls, root/test types, typed lint and the 7,659-file ratchet pass; ordinary remote acceptance remains open. Containing eb5 CI exposed a boot QuotaExceededError after 13 cases; storage isolation ca5ca51129 clears persistent origin stores only after leaving the old document, retaining HTTP/shader caches and every original guard. A local immutable 0b72 Metal run at an explicit 128 MiB quota passes all 24 catalogues / 338 cards in 84.741 s, with all 24 preboot storage usage readings zero. The CI quota and failing write were not recorded; a two-world old-harness local control did not reproduce the fatal. Seventeen behavior controls, root/test types and typed lint pass; containing remote repair qualification remains open. Sealed a149ffbbd9 / 41042142412 was created 10:37:49Z: prepare 749 s, Explorer runner queue 374 s then job 717 s, and boot-verdict queued a further 638 s before its 3 s verdict. Ship was skipped, so no same-carrier push-to-live acceptance exists. Runner/admission policy remains sp-x2, prepare generation sp-x1, and restore/shipping sp-ci-deploy. Keep 24x2 after the measured queue review; no speculative per-run cap is adopted. Forward policy: coalesce pending prepares and phone admissions separately, let running waves finish, keep manual/production serialization. Create macOS journey entries in measured LPT order Explorer/public/developer/WebKit/Chromium/grid; all SIX, Metal runners and caps stay. Fixed-duration replay models 656 s versus actual 937 s postprepare Explorer finish, but creation order is only a scheduling hint, not runner priority. Workflow-key, native admission, exact-once SIX and promotion controls pass; same-carrier push-to-live acceptance remains open. | M |
| CI10 | Simulator leg fast on GitHub macOS (G921): early boot, cached proxy, condition waits, shorter route | ≤ 6 min, 0 timeouts for a day | **open** · Codex sp-x2. Actual a149 / 41042142412 phone 124017273758 verifies 675f host delivery: Intel 14 GB / four CPUs, zero reported swap; not a readiness cure. Native boot 5 s, bootstatus/migration 208 s (largest reported migrator LaunchServices 96.371 s, Safari migrator 5.033 s), readiness Python imports 18.803 s, Safari first launch 65.811 s. URL accepted at 118.395 s, no retained owned document/two-frame callback by the unchanged 120 s; no app route ran. Forward cut starts readiness imports alongside bootstatus and waits on its explicit status before any Safari launch; original readiness deadline starts only after successful status. This overlaps setup rather than skipping migration or granting readiness. All 32 prior Python case ASTs unchanged; two new real-child barrier controls plus original preparation controls pass 13.1 s under the unchanged 20/25 s wrapper. Readiness page is already 197 B with zero external URL refs. No new native visit, retry loop or deadline. Six-minute/timeout-day and overlap savings remain unqualified. e62 / 41042965744 readiness passes 44.575 s (app 21.978 s), then correctly refuses its cancelled zero-step prepare; producer cancellation is not a route red. Prior fe0 / 41035012795 completes route/wall with faults[] but hero 1706 ms (FCP 258) and real draws 19.45/28.79/21.29 fps remain real misses; it predates host headroom. Hero phase evidence ee5c and Opus eligibility fix 93110 require containing cloud proof. Native correctness, FPS, hero and total-time acceptance remain open Latest f0b8 / 41057053237 stops at 60.396 s: modules 30.023 s, assembly 9.597 s, Home 18.734 s ongoing, Product data one-file wait shown as 0.0 s, faults[]. Last completed binary read is 57 ms, not proof of the in-flight read or a stall. Hero 1237 ms / FCP 1036; no entered route/FPS. Failure snapshots now retain existing pending-wait resource IDs/ages/bytes without invoking owners; no loader or guard change. This is distinct from 93e4 shader-link waiting. | M |
| CI11 | Node harness v1 (G922): every shard enters, walks 1,800 ticks, quests, disposes | **done** (see lane) — All shards < 60 s in the wave | Codex sp-x1 · done e04252c31e (18 cases / 8 shards in 18.2 s) | M |
| CI12 | Verbs as sim commands + tapes (MF15–MF18 verb lists) | Hook, crank, crossbow and quest steps pass; QB11 / QB17 replayed red | Codex · Pine + Nine verbs done (sp-x9 51280a4d5a, c2fb86a782); Pine 55ff9bdd62 passed Linux a037 / 41019098886 after the 5792 status-1 refusal (exit cause unconfirmed); child diagnostics 220a1a7e28 + live observation cut cbd2cb8fe1: matched 10.753 -> 10.240 s, same 29312 ticks / 29418 commands / 65 observations / final resident save; original 30/35 test 11.15 s; Linux 5c3 preallocation still timed out at 30.162 s; current dd2cc42999 + 1b619096db ordinary Linux 4a41 / 41027244389 original Pine case PASS 26.314 s, with every tick, command, observation and original cap retained (no isolated cache gain claim); Pine margin remains open after later Linux 3c5 passed at 29.435 s. Opus pure-return memo c510d3e794 retains guest fuel, owner validation and full 64 KiB rewinds on misses (project CPU 444–504 -> 73–119 ms, same complete Pine outcomes). Pure controller extraction d91517c445 removes a second eager witness product load: local matched child 9.263 -> 9.006 s, controller setup 111.09 -> 28.44 ms, all 29,312 ticks / 29,418 commands / 65 complete observations / final save identical. Reverse pair refused before ticks on changed product inputs; no reverse or controlled two-core claim. Source-current original 30/35 wrapper passes 7.73 s; root test types, expanded lint and 7,657-file ratchet pass. Ordinary containing Linux >= 3 s steady Pine margin still needs qualification; Driftwood full quest ec64ddf75e + Nalati (sp-x6); Signal full quest + storm retry done (sp-x1, 14,180 ticks); Sky (sp-x8); Driftwood margin source 420440d2e9 (Opus), proof sp-x1: two cold child pairs 8.625 -> 7.222 s / 8.601 -> 7.282 s (-16.3% / -15.3%), all 17,238 input ticks, five full native checkpoints and 37 replay observations exact. Each independent recorder/worker matches 165,456 pose calls, 3,183,154 bone outputs and 29,144,754 raw Float64 values including signed zero. Original 30 s child / 35 s test and terminal stream guards stay; third post-c510 pair 10.912 -> 10.448 s (-4.3%) on an explicitly shared loaded host, with the same inputs/full checkpoints/reports; final source-current original test passes 7.726 s after normal generation and independent strict reads (c510 + 8408127). All original guards remain; coherent Linux c1f3530761 / 41038657010 original DW case passes 19.393 s, retaining 10.607 s headroom under the 30 s child cap (no isolated CSE causal claim). Qara full-fight consumer cdc3367ecc earns five natural night patrol kills, exhausts the bow and swaps to the real sabre to defeat the captain; phase two, support and signature laws pass. Fresh-worker full observations and ordered effects match every 512 ticks plus the final canonical save. Maintained root passes 73.013 s on final 5db herd products; 175/180 s outer guards and 30 s per-part / 128 parts / 60k ticks and commands / 8 MB guards remain. Root types and expanded typed fixture lint pass; ordinary Linux Qara qualification follows normal CI; Nalati finding (2026-10-30, sp-x6): `passChain` has no live UI reader, so the verb list's `2 HIT` chip is absent. Numeric two-hit inputs, fresh-worker replay and earned one-hit restoration pass (19.5 s): two natural body contacts, not two enemy hits. Adding that HUD element requires Jake's pick and E332 coordination; none is built tonight | L |
| CI13 | Physics walk moves into the harness; the Chromium walk retires | **done** (see lane) — 0 stuck in Node | Codex sp-x1 + sp-x6 · done: Node fixed 75 / 75, 0 snags, 42.4 s (a4b85eadc5, 7858ced937, b8905d9134) | M |
| CI14 | Pin waves 2+ (G919): rank files by reds-on-intended-change over 14 days; delete from the top | No file red twice in a week for a drift-only change | Codex sp-x8 (Far Reach, Sunscar, Nine done) + sp-x1 (Pine / Nalati / Driftwood) | M |
