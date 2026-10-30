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

**Push → answer ≤ 12 min** (6 + 5 + ~1 of job start). **Push → live ≤ 15 min** when green. At 17 pushes an hour,
"finish the running run, keep the newest pending" (G582) stays: `cancel-in-progress` would cancel every run before it
finished. Shorter runs give ~5 finished runs an hour instead of ~2.5. Pending runs are already cancelled when
superseded. **Runner-minutes per run:** ~215 → ~110, from the setup saving.

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
| CI6 | One prepare job: merge `generated-inputs` + `products` + vite / vercel build; gen once; every job reads one artifact | Prepare ≤ 6 min; no job rebuilds | Codex sp-x2 (workflow dcc1847cea, streaming smoke archives) + sp-x1 (build-script speed). Actual da6af prepare 703 s vs prior 826 s, bar 360 s: gen 304, checks/app 148, smoke pack 42, Vercel package 39 s. Local 64 MiB archive comparison 119 → 75 ms, same tar hash/extent; containing remote streaming gain open; app half sp-x9 eb312d69da + ba60585eb3: local 50.188 -> 38.856 s warm (first population 56.090), seams 32.709 -> 19.134 s, all 48 transport files / 187,981,755 B exact, 27 focused controls pass; remote <=360 s acceptance open | M |
| CI7 | One test wave: every Vitest file once across a duration-sharded matrix and blocking native Escape runner; `isolate: false` for pure files | Vitest wave ≤ 5 min, no shard > 1.2× the mean | Codex sp-x9 planner 985fbe3ac1 + sp-x2 34d7ac95e5/051ba4c3df; unchanged native controls/deadlines on one dedicated worker, full inventory union checked. Containing Linux run 41000966804 at da6af: original 6/6 pass, suite 24.323 s, trusted pair 9.496 s, job 72 s. Historical D-state cause unlocalized. Successful 2b625 source run 40998533769: all 2214 files, slowest Vitest step 709 s / mean 515.25 s = 1.376x (bars 300 s / 1.2x); timing/balance remain open. Collection reductions f515b43284 retain all 13 original cases across three prepared-product suites; post-read-warmed 9052d50ac2 + hook 7d03b1e0eb qualified on a037 / 41019098886: original six cases 15.479 s, trusted pair 0.907 s; pre-read 234 files / 434017483 B / 784.126 ms. Historical cold D-state remains unlocalized. Allocation dd2cc42999 observed on 4a41 / 41027244389: original six Escape pass 17.649 s, Pine pass 26.314 s, Nalati fails 93.465 s at its unchanged worker 30 s bound, then Driftwood still runs and passes 23.306 s. Exact-once selection, no-bail execution and blocking failure are observed; Nalati cause remains with sp-x8 and overall wave timing remains open | M |
| CI8 | Slowest files ≤ 10 s each (§2 list), or deleted if they are pins | **done** (see lane) — None over 10 s | Codex sp-x9 · done 82814dfd66 + c2b1f2acd9 (all 47 slow files ≤ 8.9 s) | M |
| CI9 | Browser journeys (§8) in the push wave on the prepare artifact; the ship job deploys after them; the boot-smoke dispatch chain goes | Push → live ≤ 15 min; the 4 real breaks replayed red | Codex sp-x2 · wired fa13b9fce6; remote timing open | M |
| CI10 | Simulator leg fast on GitHub macOS (G921): early boot, cached proxy, condition waits, shorter route | ≤ 6 min, 0 timeouts for a day | **open** · Codex sp-x2. Wiring fa13b9fce6; x10 native route 140.987 → 105.710 s locally, all six stages/wall/no faults. Latest containing 3c5c / 41030167413 job 123977778516 has f1d8 + 65c but still fails preparation: launch RPC 82.763 s, then openurl no response at the shared 120 s limit; no document request, frame proof or route. The earlier process-observation branch is unconfirmed, and later cold-storage retention is unreached. Prior 4a41 launch timeout 121.038 s had empty output; no OS/app cause established. Earlier 5c3 readiness passed 80.155 s cold / 4.958 s warm before a pre-title xcrun timeout. Source 65c7805b21 retains prepared Safari while clearing cold game storage. Source f1d8a80079 permits only an owned parent-chain process to request the same two-frame probe before launch RPC returns. Source cc55c7fee1 retains complete process rows on bounded-query timeout, rejects truncated rows, and records query outcomes/latencies, import time and every existing URL attempt. All 29 preceding case bodies unchanged plus two parser controls; 31 fake-shell/runner + seven preparation cases pass under the unchanged 20/25 s wrapper in 16.4 s. The 120/10 s native bounds remain unchanged; new source awaits ordinary native qualification. Prior df27 entry miss at 61.093 s: modules 12.838 / Home 31.202 / shaders 9.120 s, firstFrame 0.642 s so far; game cuts sp-o3. Preview reuse 344f244384 measures HTTP-only cold CPU 225 → 155 ms and repeat median 164 → 24 ms over 222 bodies; no native gain inferred. Overall six-minute/timeout-day acceptance remains open | M |
| CI11 | Node harness v1 (G922): every shard enters, walks 1,800 ticks, quests, disposes | **done** (see lane) — All shards < 60 s in the wave | Codex sp-x1 · done e04252c31e (18 cases / 8 shards in 18.2 s) | M |
| CI12 | Verbs as sim commands + tapes (MF15–MF18 verb lists) | Hook, crank, crossbow and quest steps pass; QB11 / QB17 replayed red | Codex · Pine + Nine verbs done (sp-x9 51280a4d5a, c2fb86a782); Pine 55ff9bdd62 passed Linux a037 / 41019098886 after the 5792 status-1 refusal (exit cause unconfirmed); child diagnostics 220a1a7e28 + live observation cut cbd2cb8fe1: matched 10.753 -> 10.240 s, same 29312 ticks / 29418 commands / 65 observations / final resident save; original 30/35 test 11.15 s; Linux 5c3 preallocation still timed out at 30.162 s; current dd2cc42999 + 1b619096db ordinary Linux 4a41 / 41027244389 original Pine case PASS 26.314 s, with every tick, command, observation and original cap retained (no isolated cache gain claim); Driftwood full quest ec64ddf75e + Nalati (sp-x6); Signal full quest + storm retry done (sp-x1, 14,180 ticks); Sky (sp-x8) | L |
| CI13 | Physics walk moves into the harness; the Chromium walk retires | **done** (see lane) — 0 stuck in Node | Codex sp-x1 + sp-x6 · done: Node fixed 75 / 75, 0 snags, 42.4 s (a4b85eadc5, 7858ced937, b8905d9134) | M |
| CI14 | Pin waves 2+ (G919): rank files by reds-on-intended-change over 14 days; delete from the top | No file red twice in a week for a drift-only change | Codex sp-x8 (Far Reach, Sunscar, Nine done) + sp-x1 (Pine / Nalati / Driftwood) | M |
