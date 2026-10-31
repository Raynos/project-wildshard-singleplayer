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
| CI6 | One prepare job: merge `generated-inputs` + `products` + vite / vercel build; gen once; every job reads one artifact | Prepare ≤ 6 min; no job rebuilds | **done (2026-10-30, sp-x1 + sp-x2 + sp-x9)**: ordinary run **41123682086**, source `5f41cc9623`, prepare job `124296598406` succeeds in **349 s**, with **24 distinct products reused / 0 rebuilt** through the unchanged source/content and admission guards. Gen 68 s, parallel checks/app 76 s (app 67.80), exact web/release packaging 44.813 s (boot encoder 22.613), uploads 54 s, cache post 11 s. This is the first retained applicable warm reading under 360 s; prior f7 / 41118506049 was 444 s with all 24 rebuilt. The qualifying source contains independent packaging overlap `f8db260657`, but predates streamed prebuilt tar `430cb9f706` and verified phone/world archive sharing `32b0aa1ab9`; no isolated causal saving or whole-CI/deploy success is inferred. Those later cuts retain every archive/source/run/hash/extent/transport guard and the separate phone artifact when shard sets differ. Full product generation or proof of identical inputs remains mandatory (G918). Local parity and phase evidence for the earlier product/app/cache cuts stays in their defining commits (`65609ab320`, `589b702280`, `c93a7ac9b1`, `eb312d69da`, `ba60585eb3`, `b39b50ed63`); neutral verify-in-place and compiler-URI prototypes were withdrawn. | M |
| CI7 | One test wave: every Vitest file once across a duration-sharded matrix and blocking native Escape runner; `isolate: false` for pure files | Vitest wave ≤ 5 min, no shard > 1.2× the mean | **done (2026-10-30, sp-x6):** first accepted containing source `60c0084758` / run `41154960690` meets both measured bars: max **199 s** (B10), mean **167.667 s**, ratio **1.186879×**. All **2340 parallel files** match the source/run plan exactly once; **6 native files** are disjoint and make the exhaustive union. Both blocking native jobs and **11/11 fixture writers** pass at that source. Later `34220aeca1` moves the intact Pine-door case to the existing native stories job (7 native files); its containing qualification is separate. This is **not a green source/release wave**: `frame-floor-draw-budget.test.ts` and `pine-door-continuation.test.ts` fail; retain that result and omit only those two module observations from the **2338 successful complete-module weights**. Model max 139.975 s is separate from the actual 199 s. Main cuts include `31a0ab90cf`, `f6b0901616`, `b609e7179b`, `2157a536fe`, verified Basis reuse `aa63eaf885` and King setup `e5709ddef4`; the awareness capture is in `60c0084758`. Later local Node-world, Kokpar, Kit-body and physics-split readings are not inferred as remote gains. No cases, deadlines, source guards or native allocation were removed. Historical failed balance: `ab792` / `41149186669` was 270/172 = 1.569767×; `5f41` / `41123682086` was 367/203.333 = 1.804918×. CI9 now owns the remaining release/queue acceptance. | M |
| CI8 | Slowest files ≤ 10 s each (§2 list), or deleted if they are pins | **done** (see lane) — None over 10 s | Codex sp-x9 · done 82814dfd66 + c2b1f2acd9 (all 47 slow files ≤ 8.9 s) | M |
| CI9 | Browser journeys (§8) in the push wave on the prepare artifact; the ship job deploys after them; the boot-smoke dispatch chain goes | Push → live ≤ 15 min; the 4 real breaks replayed red | **in flight (2026-10-30, sp-x6, remote acceptance):** merged boot/ship producer `93bd4ce2ba` is on origin (sp-x9/sp-x2, 76 local controls); its first attempt was cancelled before prepare. The first full merged wave, `60c0084758` / `41154960690`, has the CI7 timing bars but two behavior failures, so it cannot qualify an automatic production release. Root owns the sole status watch and will hand over the first successful normal merged ship for queued→started→done→first live-match timings. No duplicate workflow, dispatch or watcher is needed. **Historical evidence:** Codex sp-x2 · **QA f7ee6c3c17 / [41118506049](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/41118506049), measured 2026-10-30 (sp-x6): still open.** UTC push-run created **19:50:25** → prepare **19:52:47–20:00:11** → last non-verdict required job green **20:19:18** → **all 36 required jobs green / ship queued 20:22:38** (boot status success 20:22:36) → ship starts **20:31:29**, done **20:33:39** → full live HTML/SW/core verification **20:35:10**. The ship log already records production `f7ee6c3-mvve9g0q` MATCH at **20:33:36.190939**, before job end: push → first verified live **43m 11.191s / 2,591.191s**, failing the 900s target; later full proof is **44m 45s**. Critical-path queues: prepare **2m 22s**, Developer smoke **11m 31s** (+7m 35s execution), boot verdict **3m 13s**, ship **8m 51s**. Prepare execution is 7m 24s. Behaviour (10) also queues 10m 39s (concurrent, not additive); native Escape/Titan has the longest required-job execution, 9m 24s, but finishes off the critical path. The later full proof is not propagation latency; no account-quota or app-cause inference, workflow edit, retry or cap change. Earlier evidence: wired fa13b9fce6; sealed baseline fe0ca110e6 / 41035012795: created 09:39:23Z, verified live fe0ca11-mvuso9aw at 10:15:29.802Z, 2,166.802 s (36 m 06.802 s) vs 900 s. Critical path: workflow coalescing 482 s, prepare runner allocation 3 s, prepare 533 s, Explorer runner queue 337 s, Explorer job 600 s (actual catalogue guard 515 s), verdict/shipping queue 9 s, shipping to verified live 202.802 s (exact prebuilt restore 122 s). Observed peak 15 Ubuntu plus five macOS jobs does not establish the account quota. Remaining: workflow/concurrency policy sp-x2; CI6 prepare sp-x1 with app/build-script work sp-x9 and workflow sp-x2; prebuilt restore/shipping sp-ci-deploy; Explorer rendering stays Opus; the harness reuse cut is sp-x9 7cc041b4cd. One immutable 0b72 local Metal comparison retains all 24 dynamic catalogues and identical 338 card identities, 106.776 -> 83.011 s (-22.3%), with first-canvas sums 69.183 -> 54.819 s. One context/page retains native caches across fresh requested-world documents; URL, probe slug, changed time origin and final current card membership refuse stale catalogues. Original pixels/fatal/HTTP/navigation/no-progress checks remain. The existing harness identity suppresses telemetry without request interception or mocked assets. Completed resource-timing transfers 731.655 -> 331.534 MB, JavaScript 120.825 -> 11.956 MB and Wasm 52.164 -> 4.016 MB are observations, not a full wire census or isolated shader gain. All 15 behavior controls, root/test types, typed lint and the 7,659-file ratchet pass; ordinary remote acceptance remains open. Containing eb5 CI exposed a boot QuotaExceededError after 13 cases; storage isolation ca5ca51129 clears persistent origin stores only after leaving the old document, retaining HTTP/shader caches and every original guard. A local immutable 0b72 Metal run at an explicit 128 MiB quota passes all 24 catalogues / 338 cards in 84.741 s, with all 24 preboot storage usage readings zero. The CI quota and failing write were not recorded; a two-world old-harness local control did not reproduce the fatal. Seventeen behavior controls, root/test types and typed lint pass; containing remote repair qualification remains open. Sealed a149ffbbd9 / 41042142412 was created 10:37:49Z: prepare 749 s, Explorer runner queue 374 s then job 717 s, and boot-verdict queued a further 638 s before its 3 s verdict. Ship was skipped, so no same-carrier push-to-live acceptance exists. Runner/admission policy remains sp-x2, prepare generation sp-x1, and restore/shipping sp-ci-deploy. Keep 24x2 after the measured queue review; no speculative per-run cap is adopted. Forward policy: coalesce pending prepares and phone admissions separately, let running waves finish, keep manual/production serialization. Create macOS journey entries in measured LPT order Explorer/public/developer/WebKit/Chromium/grid; all SIX, Metal runners and caps stay. Fixed-duration replay models 656 s versus actual 937 s postprepare Explorer finish, but creation order is only a scheduling hint, not runner priority. Workflow-key, native admission, exact-once SIX and promotion controls pass; same-carrier push-to-live acceptance remains open. | M |
| CI10 | Simulator leg fast on GitHub macOS (G921): early boot, cached proxy, condition waits, shorter route | ≤ 6 min, 0 timeouts for a day | **open** · Codex sp-x2. Latest retained ff31 / 41083974455 phone 124160135910 contains 7c: imports 54.455 s finish while bootstatus continues to 249.792 s, confirming overlap delivery rather than a cold-time gain. The launch stage is 103.356 s and includes a synchronous process-observation command that alone takes 72.352 s despite its nominal 250 ms timeout; one check returns no process rows. Owned document arrives at 117.727 s, no two-frame callback by 120 s; prep fails 124 / 415.591 s, before app work. Forward cut removes process enumeration from readiness and samples only the exact UDID-bound launch command's local output (≤4096 B per sample). A complete Safari PID receipt permits requesting the probe before RPC exit; only the existing owned two-frame callback grants a lease. Truncated/foreign/nonpositive receipts and PID-only/no-frame cases refuse. All 35 startup cases remain (30 ASTs unchanged; process-specific cases retargeted to owned receipt guards), original startup/preparation controls pass 13.8 s under unchanged 20/25 s wrapper; 120/10 s native limits, 14 GB Intel profile, cleanup and producer authority unchanged. No native visit or new retry; containing readiness and overall acceptance remain unqualified. The first page remains 197 B with zero external URLs. Earlier f0b8 / 41057053237 entry misses at 60.396 s: modules 30.023 s / assembly 9.597 s / Home 18.734 s ongoing, Product data wait 0.0 s, faults[], hero 1237 ms/FCP 1036, no gameplay/FPS. Last completed binary read 57 ms does not identify the pending wait; failure snapshots now include live wait resources/ages. This differs from 93e4/8b02 shader-link waits. Prior fe0 completed route/wall but hero 1706 ms and completed draws 19.45/28.79/21.29 fps miss; native correctness, hero/FPS and total-time bars remain open | M |
| CI11 | Node harness v1 (G922): every shard enters, walks 1,800 ticks, quests, disposes | **done** (see lane) — All shards < 60 s in the wave | Codex sp-x1 · done e04252c31e (18 cases / 8 shards in 18.2 s) | M |
| CI12 | Verbs as sim commands + tapes (MF15–MF18 verb lists) | Hook, crank, crossbow and quest steps pass; QB11 / QB17 replayed red | Codex · Pine + Nine verbs done (sp-x9 51280a4d5a, c2fb86a782); Pine 55ff9bdd62 passed Linux a037 / 41019098886 after the 5792 status-1 refusal (exit cause unconfirmed); child diagnostics 220a1a7e28 + live observation cut cbd2cb8fe1: matched 10.753 -> 10.240 s, same 29312 ticks / 29418 commands / 65 observations / final resident save; original 30/35 test 11.15 s; Linux 5c3 preallocation still timed out at 30.162 s; current dd2cc42999 + 1b619096db ordinary Linux 4a41 / 41027244389 original Pine case PASS 26.314 s, with every tick, command, observation and original cap retained (no isolated cache gain claim); Pine margin remains open after later Linux 3c5 passed at 29.435 s. Opus pure-return memo c510d3e794 retains guest fuel, owner validation and full 64 KiB rewinds on misses (project CPU 444–504 -> 73–119 ms, same complete Pine outcomes). Pure controller extraction d91517c445 removes a second eager witness product load: local matched child 9.263 -> 9.006 s, controller setup 111.09 -> 28.44 ms, all 29,312 ticks / 29,418 commands / 65 complete observations / final save identical. Reverse pair refused before ticks on changed product inputs; no reverse or controlled two-core claim. Source-current original 30/35 wrapper passes 7.73 s; root test types, expanded lint and 7,657-file ratchet pass. Ordinary containing Linux >= 3 s steady Pine margin still needs qualification; Driftwood full quest ec64ddf75e + Nalati (sp-x6); Signal full quest + storm retry done (sp-x1, 14,180 ticks); Sky (sp-x8); Driftwood margin source 420440d2e9 (Opus), proof sp-x1: two cold child pairs 8.625 -> 7.222 s / 8.601 -> 7.282 s (-16.3% / -15.3%), all 17,238 input ticks, five full native checkpoints and 37 replay observations exact. Each independent recorder/worker matches 165,456 pose calls, 3,183,154 bone outputs and 29,144,754 raw Float64 values including signed zero. Original 30 s child / 35 s test and terminal stream guards stay; third post-c510 pair 10.912 -> 10.448 s (-4.3%) on an explicitly shared loaded host, with the same inputs/full checkpoints/reports; final source-current original test passes 7.726 s after normal generation and independent strict reads (c510 + 8408127). All original guards remain; coherent Linux c1f3530761 / 41038657010 original DW case passes 19.393 s, retaining 10.607 s headroom under the 30 s child cap (no isolated CSE causal claim). Qara cdc3367ecc retains the actual f0b8 Linux 175 s timeout at captain tick 34,899. Capture/replay already overlapped; correction 723109b3b8 splits at earned night and real bow exhaustion, carrying the full continuation, motion memory and one combined 128-part / 60k tick and command / 8 MB ledger. Original 30 s requests and 175/180 s child/case guards stay. Final three child walls 7.874 / 50.044 / 9.005 s; all nine native, handoff and pipeline controls pass. Read-only unsplit comparison matches every command value including signed zero, all 10,684 combat ticks, original full observation intervals and ordered effects, and final canonical save. The extra checked boundary makes 22 parts instead of 21 without resetting the allowance; root types, expanded fixture lint and 7,683-file ratchet pass. Linux 8b02 passed, then d55c timed out; the scheduling follow-up below retains both receipts; Nalati finding (2026-10-30, sp-x6): `passChain` has no live UI reader, so the verb list's `2 HIT` chip is absent. Numeric two-hit inputs, fresh-worker replay and earned one-hit restoration pass (19.5 s): two natural body contacts, not two enemy hits. Adding that HUD element requires Jake's pick and E332 coordination; none is built tonight Qara scheduling correction 37bbf02909: newest applicable marker carrier ff31 / 41083974455 passes all three cases, patrol child 157.852 s. All 21 replay requests progress in 2.853–7.840 s; after quiver completion at 145.247 s, final replay finishes at 153.342 s, canonical check at 154.609 s and handoff write at 156.748 s. This pass shows sustained compute, not a stuck final request; the earlier d55c 175 s refusal remains separate. Qara was omitted from the reviewed two-core serial-native policy. It now runs whole, without sibling Vitest files, in one of two blocking serial groups: Escape + Titan, and Pine + Driftwood + discovery + Qara. The actual ff31 native job was 460 s (332 s stories + 16 s Escape); adding Qara’s 212.143 s ordinary module to one job models about 672 s, versus the slowest behaviour job’s 552 s. The two groups contain measured test work of 272.143 / 286.091 s; adding the observed roughly 112 s setup models 384 / 398 s whole jobs, not a measured remote gain. Every current test file is discovered exactly once, whole earned-checkpoint files stay together, each group has one Vitest worker and both are required by deployment/recovery. All 24 focused discovery/recovery controls, types, typed lint and Actionlint pass; independent group/CLI correspondence and unchanged Qara source hashes pass. All native commands, observations, final saves and 30/175/180 s plus combined 128-part/60k/8 MB guards remain unchanged. Ordinary containing Linux variance and CI7/CI9 acceptance remain pending. **Open: Driftwood buy tape** needs a native RNG / save / continuation port: `CoinBurst` reads global `app.rng` and has no continuation; `Owned` reads a global save. No faked purse; the port is deferred tonight. | L |
| CI13 | Physics walk moves into the harness; the Chromium walk retires | **done** (see lane) — 0 stuck in Node | Codex sp-x1 + sp-x6 · done: Node fixed 75 / 75, 0 snags, 42.4 s (a4b85eadc5, 7858ced937, b8905d9134) | M |
| CI14 | Pin waves 2+ (G919): rank files by reds-on-intended-change over 14 days; delete from the top | No file red twice in a week for a drift-only change | **Pine / Nalati / Driftwood wave done (2026-10-30, sp-x8)**: `6e00681285` removes Pine emitted-Wasm length/hash pins while retaining current native descriptor/content-address and corruption authorities; `17ede1f3dc` deletes the pure Nalati desktop-grass output pin, retaining ownership/detachment/refusal behavior. No forced Driftwood deletion: audited top families assert actual native/admission/lattice behavior. The retained detailed-red dataset is an Oct 27–29 lower bound, not exhaustive 14-day case coverage; six Pine timeout SHAs are not pin-drift closure evidence. Far Reach / Sunscar / Nine earlier waves remain done. Every remaining test still runs (G918). | M |
