# CI-FIRST-PRINCIPLES: what GitHub Actions does per push, why it is slow, and what it should do

**State:** `open` 2026-10-29, ruled by Jake ~17:45 (G918–G923); **the rows are being revised to match his rulings** (every test still runs, less wall clock; pins deleted outright; ship the tested build as soon as green; Simulator stays on GitHub Actions; the Node harness is the main integration test; test-quarantine deleted). Where this text disagrees with G918–G923, the G-rows win.

Jake, 2026-10-29 ~16:50 Cancun: *"How many actions are there per commit on main? Are there 16 fanout actions and
another 8 fanout actions for like all kinds of really slow-ass tests? How fucking long do they take? This is like a
draft plan from first principles. What's a really good way of doing integration tests for the system? And what are we
doing, and why is it so slow and shit?"* ~16:55: *"… really good integration tests without having to go through a
headless Chrome … we're gonna go into the MMO server direction … I don't know what the fuck these heavy proofs are …
What I do know is that what we have is really heavy and really slow."*

Measured with `gh` over 48 h, 2026-10-27 22:00 → 10-29 22:20 UTC (1,951 runs on `main`, 659 runs' jobs read, the logs
of all 264 failed jobs).

## One screen

- **Yes: 16 + 8 fan-out.** One code push starts the `deploy` run, which is **30 jobs**: 16 `behaviour` vitest shards,
  8 `behaviour-products` vitest shards, and 6 build / types / docs jobs. On top come `storage` (1 job),
  `test-quarantine` (2 jobs) and, when the run is green, `boot-smoke` (**10 jobs**, 7 of them on macOS).
  **4 workflow runs and 43 jobs** for one push.
- **Pushes:** 385 a day (17 an hour, 30 at peak).
- **How long:** a push run takes **23 min** from push to answer (p90 31). The boot smoke adds **16 min**. The release
  then **rebuilds the whole game again (21 min)**. So the best case from push to live is about **1 h**, and the
  usual case is 2–3 h.
- **Runner time:** **≈ 14,300 runner-min a day** (240 h); 215 per finished push run. Free (public repo); the cost is
  waiting: GitHub caps concurrent jobs, so the 8 product shards queue 2.5 min behind the 16.
- **Why slow:** (1) the whole vitest suite (2,174 files, ~165 runner-min) runs every push. (2) 78 % of push runs are
  cancelled unstarted and **60 % of finished runs are red**: only **44 green SHAs in 2 days** could ship. (3) Almost
  every red is a shape / fixture pin broken by an intended change (`browser-escape.test.mjs` red on 10 SHAs over 17 h).
  (4) The release rebuilds what CI built.
- **What protects the player:** the boot smoke caught **4 real breaks** in 2 days (Nine fatal on load, Pine missing
  specimen bytes, a title GL error, a blank Explorer card). No CI job caught **any** of QB1–QB21. About 12 of them were
  catchable by journeys that play the game.
- **Target:** a **≤ 8 min push check** (one build, types / lint, unit tests, a **Node game harness** playing every
  shard headless); **no browser per push**. Hourly, **one release candidate** runs browser journeys (WebKit, iPhone 16
  Pro) and **deploys CI's own build**: live ≤ ~1 h 15 min behind green main. Simulator, soak and pins go nightly on
  the Mac. **−85 % runner-minutes.**
- **Questions for you (bottom):** seven, each with a recommended answer.

---

## 1. What runs today (`.github/workflows/`)

| Workflow | Trigger | Jobs | Notes |
|---|---|---|---|
| `deploy` (push) | every code push (docs / progress / art / sources ignored) | 30: `generated-inputs`, `products`, `typecheck-lint`, `derived-docs`, `behaviour` ×16, `behaviour-products` ×8, `build-and-deploy`, `dispatch-boot-smoke` | One group, no cancel: the running run finishes, the newest pending survives (G582) |
| `deploy` (release) | :17 hourly + dispatch | 1 | `newest-ci-green` pin, then **rebuilds**: native build 11.3 min + `vercel build` 7.5 min |
| `boot-smoke` | each green push run | 10: `build`, 7 `macos-15` legs (boot-public, -developer, -grid, hover-chromium, hover-webkit, explorer, phone-route), `verdict`, `release` | Reuses the push dist; phone-route report-only |
| `test-quarantine` | after **every** deploy run, cancelled too | 2 | Report-only; 38 of 46 sampled jobs red |
| `storage` | every push | 1 | 5–10 s storage policy. Keep |
| `admin-deploy`, `site-deploy`, `ota-promote` | hourly :47; site/; manual | 1–2 | Small; admin failed 3 of 8 |

`gpu-gate.yml` was **deleted on 10-13** (819a36b8d4, "delete fragile port proofs"), but DEPLOY.md still says it runs
nightly. That text is stale.

## 2. Numbers (48 h)

| Workflow | Runs / day | Outcome | Wall p50 / p90 | Runner-min / run | Runner-min / day |
|---|---|---|---|---|---|
| deploy push | 265 | 78 % cancelled unstarted; of 116 finished: 44 green, 70 red | 25 / 36 min (push → answer 23 / 31) | 215 (36 jobs) | ≈ 12,400 |
| boot-smoke | 22 | 33 green, 11 red | 16 / 19 min | 51 (mostly macOS) | ≈ 1,130 |
| test-quarantine | 277 | always "success", jobs mostly red | 1.5 / 5 min | 1.7 | ≈ 470 |
| deploy release | 16 | 24 real deploys in 2 days | 22 / 26 min | 21 | ≈ 230 |
| storage | 385 | all green | 0.2 min | 0.1 | ≈ 40 |

**Long poles:** `generated-inputs` 5.8 min → each `behaviour` shard 8–10 min (p90 13); `products` 9.5 min
(shardfiles 4.1, gen 2.4) → `behaviour-products` 3.7 (+2.5 queue) and `build-and-deploy` 5.0. **Smoke legs:** explorer
7.6, boot-developer 4.5, boot-public 4.3, grid 2.8, hover 1.7.

**Reds, by test file (all 264 failed jobs):** browser-escape (10 SHAs), `test/value` (8), `nine-source-output`,
`nine-owned-product`, `nalati-species-product-inputs`, `nalati-place-blob-program` (5 each), `driftwood-world-values`,
`sky-mill-scene-intake` (4), then ~50 more files on 2–3 SHAs each, nearly all "expected [new shape] to deeply equal
[old pin]". Lanes landed 48 `fix(test)` and ~90 `test(...)` commits in the 2 days. **Flaky:** the GitHub-macOS
Simulator leg (25 timeouts) and hover-webkit (3).

## 3. What CI caught and what it missed

**Caught (boot smoke):** Nine fatal at load (10-27 22:26), Pine specimen bytes missing (10-28 05:45), title GL error
1282 (10-27 23:46, 10-28 03:44), blank Nalati boulder card (10-28 02:01). **Vitest:** almost all oracle drift.
**Missed:** all of QB1–QB21 and the Sentry QS rows reached Jake's phone. Which a journey or harness would catch:

| Catchable by | QB rows |
|---|---|
| Browser journey (title, load, exit, reload, warm load, deploy skew) | QB1 black boot, QB3 / QB4 stuck boot shell, QB5 bar passes its total, QB7 Nalati exit throws, QB9 warm load not instant, QB13 deploy strands page, QB14 crash report, QB21 stale hero |
| Node harness (verbs) | QB11 crossbow, QB17 hook (and QB15's crank logic) |
| Simulator only (memory / app switch) | QB12 (nightly or milestone) |
| Not testable (look, feel, design, heat) | QB2, QB6, QB8, QB10, QB15 feel, QB16, QB18–QB20 |

## 4. What CI is for here

1. **Keep live working for Jake's phone.** This is the only thing that justifies blocking a deploy.
2. **Give lanes a fast signal** (≤ 10 min) on the newest SHA, so a red is fixed while the author still has it open.
3. **Never block velocity** (G768, G612, E428): nobody waits for CI, and main may be red. CI decides what ships, not
   what lands.

A test belongs in CI only if its red means "the player would hit this"; a shape pin protects nobody (G416: trash it).

## 5. Target design

- **Push check, every code push, ≤ 8 min, ≤ 6 jobs:** one cached build (uploads the dist **and** the Vercel prebuilt
  output), types + lint, unit vitest (≤ 4 shards), the **Node harness** (§6); `cancel-in-progress: true`.
- **Release candidate, hourly:** the newest push-green SHA runs the browser journeys (§8) on its dist, then
  `vercel deploy --prebuilt` **the same output**. Live trails green main ≤ ~1 h 15 min. Replaces the boot-smoke chain.
- **Nightly / milestone, on the Mac, not gating:** product pins, coverage, Simulator route + memory, short soak,
  frame floor.
- **Deploy keys on:** push check green + RC journeys green on the same SHA. A red vitest product pin never holds live.

## 6. Integration tests without a browser: the Node game harness

**Already in Node today.** vitest runs in `environment: 'node'`; Rapier runs in Node. `HeadlessSimulation`
(`src/sdk/headless.ts`) boots a **real built shard product** and steps it with commands
(`sim.step([{ source: 'player', commands: [{ kind: 'player', moveX, moveZ, yaw }] }])`), returning a snapshot
(`decodeSimSnapshot`) and a `checkpoint`. `test/shard-headless.test.ts` already boots all 8 shards, walks 24 ticks
(grounded, no quarantine) and completes every quest once. Grid `SimHost` (docs/GRID-SIMULATION.md) steps regions with
no renderer.

**What blocks the rest:** the verbs (crossbow `heldFirearm`, the hook, the crank, the HUD slots in
`src/engine/ui/hudSlots.ts`) live page-side and are driven by DOM events and the render loop, not by sim commands.
Modules also touch DOM / WebGL / Worker / `fetch` / Cache at import time. And timers decide things (FOUNDATIONS'
"timers make decisions"). three.js itself is fine in Node; only `WebGLRenderer` needs a GPU.

**Harness design:**
- **Journey = a command tape + asserts on state.** Per shard: enter, walk 1,800 ticks (30 s at 60 Hz) on the physics
  route, play each verb on the shard's verb list (MF15–MF18: hook lock → zip → land; crank ×3; crossbow aim / fire /
  reload / swap; each quest step), then exit and dispose. Asserts: no throw, nothing quarantined, no system off,
  position finite and grounded, verb state advanced (bolts 30 → 29 → reload → 30), resources released. Seconds per
  shard, deterministic, no retries.
- The physics walk (`physics-baseline.mjs --mode=walk`, headless Chromium today) becomes a harness journey.
- **Server-ready by construction** (the one-world / MMO server itself is Jake's, G828): commands in, snapshots out; a
  fixed tick, no wall clock; seeded RNG; no renderer or DOM object in sim state; serialisable snapshots (already);
  many sims per process, in a worker or its own process. The same tapes then drive an authoritative server loop
  unchanged. The one structural change: each verb becomes a sim command, not a DOM handler (MF14's "HUD from state").

## 7. The "heavy proofs", in plain words

| Proof | What it does | Time · where | Caught lately | Verdict |
|---|---|---|---|---|
| Boot smoke (`scripts/parity/boot-smoke.mjs`) | Real built game: every shard reaches page-ready; Explorer draws; HOVER mounts | 16 min · CI per green push | **4 real breaks / 2 days** | **Fold into the hourly RC journeys**; drop hover-chromium |
| Phone route (Simulator leg) | Jake's cold route in the iOS Simulator on GitHub macOS | report-only · CI | Nothing; 25 timeouts | **Move to the Mac, nightly** |
| Vitest products cohort | Tests that read built products and pin their shapes | 3.7 min ×8 · CI per push | Oracle drift | **Nightly; trash drift-only pins** |
| Soak (`scripts/soak/`) | 30–60 min drive per layout; leak census | ~1 h · local | Leaks (historically) | **Milestone**; memory is a Simulator reading (G889) |
| Frame floor (`scripts/frame-floor.mjs`) | fps median / p95 and frames > 100 ms per scenario | tens of min · local | Long freezes | **Milestone**; "no frame > 100 ms after 2 s" moves into the RC journey |
| Physics walk (`scripts/physics-baseline.mjs`) | Walks a fixed route per shard in Chromium; 0 stuck | minutes · local after collider changes | Stuck spots | **Move to the Node harness** (seconds, every push) |
| gpu-gate parity | Pixel parity per GPU | workflow deleted 10-13 | — | **Delete the stale DEPLOY.md text** |
| Golden compare (144 cameras) | Stills vs the approved look | long · local at port approval | Look regressions | **Keep for looks only**, never as verb proof (Family 6) |
| Phone-loading (`scripts/phone-loading/`) | Throttled load model | min · local | Estimates | **Replace** by RC load bars |
| Tile-plan reading | Tile-plan census on one SHA | min · local | Diagnostic | **A tool, not a proof** |
| Simulator runs (sim-lane) | Memory, app switch, Jake's bars (MF20) | 10–30 min · local | QB12-class | **Keep: milestone + nightly** |
| test-quarantine | Re-runs quarantined tests, reports only | 2 jobs per run | Nothing | **Delete** |

## 8. Browser tests that must stay, made fast

The journeys follow FOUNDATIONS' bars. Read everything through the game's own debug hooks (page-ready, bar
numerator / total, error reports, frame times, memory), never through pixels.
**Set (one WebKit job, iPhone 16 Pro profile):** icon → title ≤ 0.5 s warm. Each shard: enter → PLAY → walk 30 s →
PAUSE ▸ MAIN MENU → title ≤ 0.5 s. RELOAD. Warm load: bar full ≤ 0.1 s and ≤ 0.1 MB network. Bar never passes its
total. No `/api/errors` report. No frame > 100 ms from 2 s after PLAY. Deploy skew: a page on build N survives build
N+1. Plus Explorer draws every catalogue (its own job).

**Speed rules:** reuse the push dist, no rebuild; one static server; one browser, a new context per cold journey,
the same one for warm / RELOAD; 3 pages in parallel by journey, not a browser × shard matrix; WebKit only, on Linux
(no macOS queue; the real Simulator is nightly); wait on conditions, never sleeps; no retries (fix or delete).
**Expected time:** 6 shards × ~60 s = 6 min serial, **~3 min with 3 pages**, +1 min title / reload / warm,
Explorer ~4 min beside it: **≤ 8 min wall, ~12 runner-min per hour.**

## 9. What it saves

Vitest per push down to unit tests: ~150 of 215 runner-min a run, answer 23 → ≤ 8 min. Boot smoke per green push →
hourly RC: ~1,130 → ~300 a day, no macOS. Release reuses CI's build: 21 → ~2 min. test-quarantine gone: ~470 a day.
**≈ 14,300 → ≈ 2,200 runner-min a day (−85 %)**; push → live ≤ ~1 h 15 min.

## Rows

Codex does the workflow engineering (non-visual, no player pixels). Each row needs Jake's yes first (G585).

| Row | What | Done when | Lane | Size |
|---|---|---|---|---|
| CI1 | Delete `test-quarantine.yml` and the GitHub phone-route leg; strike the stale gpu-gate text in DEPLOY.md | Files gone; DEPLOY.md matches the workflows | Codex | S |
| CI2 | The release deploys CI's build: the push run uploads `.vercel/output`; the release downloads it and runs `vercel deploy --prebuilt` | A release run ≤ 3 min; live `version.json` = the RC SHA | Codex | M |
| CI3 | Push check: one cached build job, types / lint, unit vitest ≤ 4 shards, harness; products cohort tagged for nightly | Push → answer ≤ 8 min p90 over a day; ≤ 6 jobs | Codex | M |
| CI4 | `cancel-in-progress: true` for push CI after CI3 | No run older than the newest SHA keeps running | Codex | S |
| CI5 | Node harness v1 on `HeadlessSimulation`: every shard enters, walks 1,800 ticks on its route, quests, disposes | All shards < 60 s in the push check, 0 retries | Codex | M |
| CI6 | Verbs as sim commands + their tapes (from MF15–MF18's verb lists) | Hook, crank, crossbow, each quest step pass in the harness; QB11 / QB17 replayed red before the fix | Codex (Opus for verb lists) | L |
| CI7 | Physics walk moves into the harness; retire the Chromium walk | 0 stuck in Node; `--mode=walk` deleted | Codex | M |
| CI8 | RC browser journeys (§8) on WebKit as the iPhone 16 Pro, read through debug hooks; replaces boot-smoke's 7 legs | ≤ 8 min wall; the four real breaks of 10-27/28 replayed red | Codex | M |
| CI9 | Hourly RC workflow: newest push-green SHA → journeys → deploy; delete the boot-smoke dispatch chain and the release-slot logic | Live trails green main ≤ 1 h 15 min for a day | Codex | M |
| CI10 | Test trash wave: rank vitest files by reds-on-intended-change over 14 days and delete from the top (G416) | Vitest CPU −50 %; no player-facing check lost | Codex | M |
| CI11 | Nightly on the Mac: products cohort, coverage, Simulator route + memory, short soak; a STATE line, not a gate | One line per night in a STATE file (needs Jake's word: automation, G585) | Codex | M |

## Questions for Jake (each with a recommendation)

1. **Push CI = one ≤ 8 min check, no browser, no product pins?** Recommended: **yes**.
2. **Browser journeys + deploy move to one hourly RC that ships CI's own build?** **Yes**: live ≤ ~1 h 15 min behind.
3. **A red vitest product pin no longer holds live?** **Yes** (G768; journeys protect the phone).
4. **Trash drift-only pin / fixture tests in waves (CI10)?** **Yes** (G416).
5. **Simulator route leaves GitHub macOS for a nightly run on the Mac (CI11, new automation)?** **Yes**.
6. **The server-shaped Node harness (CI5–CI7) becomes the main integration test?** **Yes**: seconds per shard.
7. **Delete `test-quarantine` and the stale gpu-gate text now (CI1)?** **Yes**.
