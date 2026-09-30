# GAME-NORMALIZATION v2 · 03 — The parity harness and the GPU gate

The behaviour spec for `scripts/parity.mjs` (built in [02-foundations.md](02-foundations.md) F2), the per-push GPU gate
on GitHub `macos-15` and the pinned deploys (F3), and the nightly `gpu-perf` poller on Jake's Mac. Sources:
[ci-gpu-options](../../design/engine-fit-v2/ci-gpu-options.md), [budget-design](../../design/engine-fit-v2/budget-design.md),
[mobile-web-practice](../../design/engine-fit-v2/mobile-web-practice.md) §3b and MW1 / MW3,
[tooling-pipeline-audit](../../design/engine-fit-v2/tooling-pipeline-audit.md) §2 and TP4–TP6, and
[01-architecture.md](01-architecture.md) §2 (clock, RNG), §4 (leak test), §13.4 (budgets). Decisions cited by number are
in [E357](../../tasks/asks/E357.md).

## 0. What it proves, where it runs

The refactor bar (GAME-NORMALIZATION §3) is "every step is identical under the harness". The harness turns that into
facts per shard × tier that are compared with a committed baseline: a **boot fingerprint** (what exists the instant the
world is built), **3 poses** (what the camera draws), a **scripted walk** (the character controller on real
geometry), a **swing and a shot to a kill and its loot** (combat end to end), and, from F8 on, the **leak test** and,
from S1.6 on, the **budgets**.

| Lane | Where | Tiers | When | Blocks what |
|---|---|---|---|---|
| `m5` | Jake's M5 Max, the lead's run, headless Chromium `channel: 'chromium'` + `--use-angle=metal`, in `scripts/browser-lane.sh` | phone (every commit); desktop (before each milestone and nightly) | before every commit (§10); nightly (§14) | the lead's commit (the plan's rule: harness green → commit) |
| `gh-macos15` | GitHub-hosted `macos-15` runner (M1 VM, 3 vCPU, 7 GB, paravirtual Metal) | phone | every push to main (§11) | the `gpu-gate` status; the deploy pin needs it green (§13) |
| `gh-ubuntu` | GitHub-hosted `ubuntu-latest` (a case-sensitive disk) | — (no browser) | every push to main: the `asset-case` job (§11.6) | the `gpu-gate` status (it is one of the jobs the aggregate reads) |
| `sim` | the iOS Simulator on Jake's M5 (`scripts/sim-lane.sh`, iOS Safari) | phone | nightly (§14.1) | nothing: a memory regression check that turns `gpu-perf` red, never phone evidence |

Baselines are per lane (pixels, programs and GPU bytes differ between a paravirtual M1 and an M5 Max; ci-gpu-options §3).
Timing (ms, fps) is never a gate on either lane: it is recorded as information and gated only by the nightly `gpu-perf`
status, which blocks nothing (decision 28′).

## 1. `scripts/parity.mjs`

```
node scripts/parity.mjs [source] [--lane=m5|gh-macos15] [--shards=a,b] [--tiers=phone,desktop]
                        [--record [--runs=3]] [--retry=1] [--plant=<id>] [--prove] [--full] [--ms]
                        [--angle=metal] [--out=<dir>] [--timeout=240]
  source (one of): --export=<ref>  git archive <ref> → a temp dir, node_modules symlinked, vite build, vite preview
                   --url=<origin>  a server already running (the gate job, the nightly)
```

- Default `--lane=m5`, `--shards` = every shard in the registry (today the 4; from Z1 also `_template`),
  `--tiers=phone`, `--retry=1`.
- `--record` runs everything `--runs` times (default 3) and writes the baseline (§8). Without it, one run is compared
  with the baseline (§7).
- `--plant=<id>` applies `test/parity/plants/<id>.patch` to the exported tree before the build (§9); needs `--export`.
- `--prove` runs the determinism proof (§9) and exits 0 only if it holds.
- `--full` walks every leg of the shard's route and its trails (§4) instead of the 3 gate legs (nightly, F11, F12,
  milestones).
- `--ms` keeps the timing fields (§2.2 class C) in the report; they are always recorded, `--ms` prints them.
- `--angle=<backend>` is passed to Chromium as `--use-angle=<backend>` (default `metal`); only the `metal-off` plant
  (§9) sets anything else, to prove the Metal check (§11.2) fires.
- **Output** in `--out` (default `progress/parity/<sha7>/`): `<shard>.<tier>.json` (every field of §2, plus
  `verdict` per field), `<shard>.<tier>.<pose>.jpg`, a diff image per failed pose (`<pose>.diff.png`: SSIM map), and
  `report.md` (one table per shard × tier: field, baseline, now, band, verdict).
- **Exit codes:** `0` green, `1` red (a field outside its band, a threshold broken), `2` usage error, `3` infrastructure
  (the renderer is not Metal, the page never served, the browser crashed twice). The gate maps 3 to status `error`.
- **One browser at a time per shard × tier**, a fresh context per shard × tier, `--mute-audio`, `serviceWorkers:
  'block'` in the context plus `?sw=0` (no worker cache between runs), under `scripts/browser-lane.sh` on the Mac.

## 2. The probe and the fingerprint (JSON schema, every field)

### 2.0 `window.__wildshard` (typed in `scripts/types/wildshard-probe.d.ts`)

| Member | From | What it is |
|---|---|---|
| `version` | F2 | `1`; bumped with a breaking probe change, together with the `.d.ts` |
| `world` | F2 | today's handle (`src/main.ts:1296`), every key; `window.__world` is the same object until F7 deletes the alias |
| `shard` | F2 | `{ slug, …handles }`: each shard-named handle key at `shard.<name>`, the place `ctx.debug.expose(name, value)` writes from S1.1 on (01 §7; 02 F2 step 1) |
| `boot` | F2 | the §2.1 record, captured once inside `installProbe` |
| `fingerprint()` | F2 | the §2.1 record taken now (used after F8 to compare a reloaded shard) |
| `pose(p)` | F2 | teleports to a §3 pose and resolves after the landing (§2.2) |
| `walkLeg(leg)` | F2 | runs one route leg with the autopilot and resolves with its §2.3 record |
| `combat` | F2 | `{ equip(id), target(kind, near), hold(animal, on), hits, kills }`: §5.1 |
| `arena()` | F2 | `hud.enterArenaNow()` (the practice room, for Nine Dragon's dummies) |
| `state()` | F2 | the gameplay snapshot the pause → resume step compares (§5.6): `{ appState, clockNow, player: { pos, yaw, pitch, vel, health }, weapon: { id, state, ammo }, creatures: [{ id, kind, pos, hp, brain }] (sorted by id), quest }`; positions rounded to 1 mm. Plus `onResume(fn)`: a one-shot callback the resume path calls (`tap.resume`, 02 F2 step 2) before the loop runs its next frame |
| `saves` | F2 | `{ read, written }`, filled by the init script's `Storage` wrapper |
| `nav` | F3.2 | `{ randomPoint(near, min, max), path(a, b) }` over the engine's navmesh query (`src/physics/navmesh.ts` today) with the harness seed, for the soak bot (§14.2); `null` on a shard with no baked navmesh (Nine Dragon) |
| `app` | F8 | a read-only view of the `App`: state, systems by phase, clock, RNG seed, census |
| `leak()` | F8 | §5.5 |
| `budgets()` | S1.6 | §2.5 |

Each field has a **class**: **A** structural — compared exactly, always; **B** measured number — exact if the
baseline's 3 recording runs were identical, else within `2 × spread + floor` where `spread` = max − min of the 3 runs
and `floor` is the field's number below (why: noise is measured on the lane, not guessed; the floor stops a quiet field
with spread 0 from failing on a one-unit wobble the 3 runs happened not to show); **C** information only, never a
verdict; **D** a threshold that holds on every run regardless of the baseline.

### 2.1 `boot` — captured synchronously inside `installProbe` (02 F2 step 1)

The probe is installed right before `ws:ready` is dispatched (`src/main.ts:1291`), in the same task, after the world is
built and before the play loop's first frame runs. Nothing in this block depends on frame timing, which is why most of
it is class A.

| Field | Type | How it is measured | Class | Band / floor |
|---|---|---|---|---|
| `schema` | `1` | constant | A | — |
| `lane`, `sha`, `build`, `shard`, `tier` | strings | `version.json`, the URL | A (identity; must match the baseline's `shard`, `tier`, `lane`) | — |
| `viewport` | `{ w, h, dpr, touch }` | the context | A | — |
| `renderer` | string | `WEBGL_debug_renderer_info` `UNMASKED_RENDERER_WEBGL` | D: must match `/ANGLE \(Apple, ANGLE Metal Renderer/` | — |
| `browser` | string | `browser.version()` | C (a change triggers the re-record rule, §8) | — |
| `errors` | string[] | `pageerror` + `console` type `error`, from `page.goto` to the barrier, minus `favicon` and `net::ERR_ABORTED` (the `nalati-boot-check.mjs` filter) | D: must be `[]` | — |
| `steps` | string[] | the loading plan's step keys in the order they completed (`bootSteps` on today's handle; after F8, the boot stages + `boot.steps`) | A | — |
| `systems` | `Record<phase, string[]>` | `game.systemLabels()` (02 F2 step 2); after F8, `app` systems by phase, sorted order | A (after the rename map, §7) | — |
| `appStates` (from F8) | string[] | every `'app.state'` event from boot to the barrier | A | — |
| `registry` | `[{ id, category, surface, floor, solidFloor, follows, shapes: { cuboid, ball, capsule, convex, trimesh, treads } }]` sorted by `id` | `registry.pieces()`; `shapes` counts the piece's `colliders` by kind | A | — |
| `registryModels` | `{ models, sets }` | `registry.models().length`, the sets count | A | — |
| `physics` | `{ fixed, kinematic, dynamic, colliders }` | Rapier `world.bodies` by type, `world.colliders.len()` | A | — |
| `scene.totals` | `{ mesh, instanced, instances, skinned, points, lines, sprites, lights, batched }` | one `scene.traverse`; `instances` = Σ `InstancedMesh.count` | A; and D: `batched === 0` on every shard (E271 / E272: no `BatchedMesh` anywhere) | — |
| `scene.named` | `[{ path, type, n }]` | every named Object3D at depth ≤ 2 under the scene (`path` = names joined by `/`), `n` = its descendant mesh count | A | — |
| `render.programs` | number | `renderer.info.programs.length` | B | floor 0 |
| `render.programKeys` | sha256 hex | sha256 of the sorted `cacheKey`s of `renderer.info.programs` | A per lane | — |
| `render.memory` | `{ geometries, textures }` | `renderer.info.memory` | B | floor 0 |
| `gpuBytes` | `{ textures, renderbuffers, buffers, total }` | the GL-API accounting lifted from `scorecard.mjs:185-260` (every `texImage*` / `texStorage*` / `compressedTexImage*` / `renderbufferStorage*` / `bufferData`, minus deletes) | B | floor 1 MiB (textures that finish decoding in a worker just before the barrier) |
| `audio.requests` | string[] sorted | every request URL under `/assets/music/`, `/assets/sfx/`, `/assets/audio/` from `goto` to the barrier, `?v=` stripped | A | — |
| `audio.state` | `{ style, set, mood }` | the music engine's state and the chosen SFX set | A | — |
| `hud` | `[{ cls, spot, shown }]` sorted | every element under `#hud` with a `ws-` class: its `ws-*` classes sorted and joined, its `at-*` class, `shown` = computed `display !== 'none' && visibility !== 'hidden'` | A (phone tier; desktop records `[]` for the touch layer) | — |
| `saves` | `{ read: string[], written: string[] }` sorted, unique | the init script wraps `Storage.prototype.getItem / setItem / removeItem` and records the key per storage (`local:` / `session:` prefix) from the first script to the barrier | A (after the rename map) | — |
| `facade` (Nine Dragon only) | `{ multiDraw, batches, instances }` | the `test-facade-instancing.mjs` check on the `facade` object | D: `multiDraw === true && batches === 0 && instances > 0` | — |
| `playMs` | number | ms from navigation to the barrier | C | — |
| `stepMs` | `Record<step, ms>` | the loading log (bench-load's definitions) | C | — |
| `heapMB` | number | CDP `Performance.getMetrics` `JSHeapUsedSize` | C | — |

### 2.2 `poses[]` — one record per pose of §3

Per pose: `probe.pose(p)` teleports (scorecard's `measurePose`: `player.spawn(x, z, yaw)`, land on the static floor
within 2.5 m above, `pitch` set, velocity and keys cleared), the harness waits the settle time (3 s), samples 5 s of
drawn frames, then takes one JPEG (q 80, CSS scale).

| Field | How | Class | Band / floor |
|---|---|---|---|
| `name` | §3 | A | — |
| `pos` | the player's feet after the settle | B | floor 0.05 m per axis |
| `calls` | p50 of `game.lastFrame.calls` over drawn frames | B | floor 2 draws |
| `tris` | p50 of `game.lastFrame.triangles` | B | floor 1 % of the baseline |
| `ssim` | SSIM on luma, 7×7 windows, creature boxes masked (`scorecard.mjs:707-755`), against the lane's golden | B′ | must be ≥ `min(0.99, selfMin − 0.01)`, where `selfMin` = the lowest SSIM of recording runs 2 and 3 against run 1's golden (a pose with wind-blown grass gets its floor from its measured noise; a still pose gets 0.99) |
| `creatureBoxes` | number of masked boxes | C | — |
| `fps`, `frameP95Ms`, `cpuP50Ms`, `cpuP95Ms` | scorecard's sampler | C | — |

### 2.3 `walk` and `combat`

| Field | How | Class | Band / floor |
|---|---|---|---|
| `walk.legs[]` | `{ name, end: [x, y, z], maxY, stuck: [{ wp, x, y, z }], seconds, out? }` per leg (§4) | — | — |
| `walk.stuck` | Σ `stuck.length` over legs | D: must be 0 | — |
| `walk.legs[].end` | the feet at the leg's end | B | floor 1.0 m per axis (the autopilot stops within 0.8 m of a waypoint) |
| `walk.legs[].maxY` | the highest feet y | B | floor 0.3 m |
| `walk.legs[].out` | escape legs: frames outside `inside` | D: must be 0 | — |
| `walk.legs[].seconds` | wall time | C | — |
| `combat.swing` | `{ weapon, target, hits, hitWithinS, killed, killWithinS }` or `'n/a'` (§5) | D: `hits ≥ 1` within the step's hit limit; `killed` within its kill limit when the table says kill | — |
| `combat.shot` | the same for the ranged step | D (same rule) | — |
| `combat.hitsToKill` | per step | B | floor 1 hit (damage rolls use the seeded `Math.random`, but the number of draws before the swing depends on AI timing) |
| `combat.kills` | the kinds reported by `tap.kill` during both steps, in order | A | — |
| `combat.loot` | `{ written: string[] }`: the storage keys written in the 2 s after each kill | A (after the rename map) | — |
| `pauseResume` | `{ before, after, diff: string[] }`: `probe.state()` right before the pause and right after the resume (§5.6); `diff` lists the paths that differ | D: `diff` must be `[]` | — |

### 2.4 `leak` (from F8)

See §5.5 for the procedure. Every field is a count; **class D: after-unload must equal the baseline exactly**.

| Field | How |
|---|---|
| `geometries`, `textures` | `renderer.info.memory` |
| `programs` | `renderer.info.programs.length` |
| `bodies`, `colliders` | Rapier `world.bodies.len()`, `world.colliders.len()` |
| `listeners` | `{ window, document, canvas, other }`: the init script wraps `EventTarget.prototype.addEventListener / removeEventListener` and keeps a net count per target kind (a listener added with `{ once: true }` counts until it fires; a listener with an `AbortSignal` is subtracted on abort) |
| `timers` | `{ timeouts, intervals, raf }`: the init script wraps `setTimeout / clearTimeout / setInterval / clearInterval / requestAnimationFrame / cancelAnimationFrame` and counts pending ids (a timeout that fired is not pending) |
| `audio` | `app.audio.census()`: live voices, beds and buses (F8 adds `census()` to today's `Audio.ts`: `activeVoices`, playing beds, connected buses; from S3.5 the `AudioService` registry answers the same call, 01 §15) |
| `systems` | the app's system count per phase |
| `events` | the event bus's listener and answerer count |
| `dom` | `{ hud: #hud descendants, body: document.body.children.length }` |
| `sceneObjects` | Object3D count from one `scene.traverse` |

This instrumentation is the spec for the leak test's listener and audio counts (13-lead-resolutions C9, 03 Q5). The
harness's own wrappers count from outside the page; the probe also exposes the shard scope's `census` (01 §4: listeners,
timers, bodies, audio nodes the scope owns) and the audio census from the `AudioService` registry, and the report prints
both side by side. The verdict is the harness's count (B1 = B0); a scope census that disagrees with it is printed as a
note, never a verdict.

### 2.5 `budgets` (from S1.6)

`probe.budgets()` returns, per pose of the running tier: `{ derived: { draws, tris, programs, gpuMB }, ceiling: {…} |
null, formula: { inputs, source } }`. The derived numbers come from `src/engine/render/budgets.ts` (01 §13.4), which
computes them from the manifest's `budgets` inputs (target fps, CPU / GPU split) and the committed calibration file
(`budgets/calibration.json`, or `budgets/provisional.json` holding budget-design §6's P numbers until Jake's first
calibration run). `ceiling` is the ratchet from `lint/ratchet.json` `"budgets"` (`"<shard>.<tier>.<pose>.<metric>":
n`) for a shard already over its derived number (budget-design §7: its worst today, may only go down).

| Check | Against | Class |
|---|---|---|
| each pose's `calls` | `≤ ceiling.draws ?? derived.draws` | D |
| each pose's `tris` | `≤ ceiling.tris ?? derived.tris` | D |
| `boot.render.programs` | `≤ ceiling.programs ?? derived.programs` | D |
| `boot.gpuBytes.total` | `≤ (ceiling.gpuMB ?? derived.gpuMB) × 2²⁰` | D |

Before S1.6 `probe.budgets()` does not exist and the harness prints `budgets: not derived yet (S1.6)` and checks
nothing. From the commit that lands S1.6, a shard with no derived budgets fails the gate. Download bytes and CPU ms
per system are not checked here (they need a shaped network and the calibrated `k`); the nightly (§14) reports them.

## 3. Poses per shard

Driftwood, Pine Hollow and Nalati reuse scorecard's 3 poses (`scripts/scorecard.mjs:56-60`, taken from
`physics-baseline.mjs`'s `POSES`). Nine Dragon uses mockup cameras A, B, C from
`src/chunks/nine-dragon-stack/mockupCameras.ts` (→ `src/shards/nine-dragon-stack/mockupCameras.ts` in F6; the file is
self-contained and node-importable): `feet` is the pose, engine `yaw = −yaw° × π / 180`, `pitch = pitch° × π / 180`.
Camera D is a free camera (no feet) and is not a pose.

| Shard | Pose | x | z | y | yaw (rad) | pitch (rad) |
|---|---|---|---|---|---|---|
| `driftwood-isle` | `pier` (the spawn) | 0 | −194 | floor | 3.1416 | 0 |
| | `beach` | −10 | −150 | floor | 4.3 | 0 |
| | `wreck` | 105 | 0 | floor | −1.5708 | 0 |
| `pine-hollow` | `gate` | 0 | −200 | floor | 3.1416 | 0 |
| | `cabin` | −14 | −62 | floor | 3.1416 | 0 |
| | `pond` | −56 | 95 | floor | 3.1416 | 0 |
| `nalati-grasslands` | `camp` | 60 | 214 | floor | −1.5708 | 0 |
| | `bridge` | 0 | 200 | floor | 0 | 0 |
| | `plains` | 65 | 0 | floor | 3.1416 | 0 |
| `nine-dragon-stack` | `spawn-rail` (A) | 0.95 | 7.5 | 125 | −0.2094 | −0.0698 |
| | `well-edge` (B) | −19.5 | 13.3 | 125 | 0 | −0.1745 |
| | `stair-street` (C) | 18 | 6 | 125 | −1.5708 | 0.1745 |
| `_template` (from Z1) | `spawn`, and the two poses Z1's spec names | | | | | |

"floor" = the static floor within 2.5 m above the terrain (scorecard's `land`). The poses live in
`scripts/parity/poses.mjs` as data; a shard's poses change only with a re-record (§8).

## 4. The scripted walk per shard

The walk is `physics-baseline.mjs`'s autopilot (each leg teleports to its start, faces the next waypoint and holds W,
Space at `jump` waypoints, until within 0.8 m; < 0.3 m of progress in 2 s = stuck at that waypoint; escape legs never
teleport and count `out` frames) over `scripts/physics-route.json`, which already holds every shard's legs (Driftwood 8,
Pine Hollow 7, Nalati 12, Nine Dragon 19). The walk runs at 1× CPU.

**The gate walk** is the 3 legs per shard marked `"gate": true` (02 F2 step 6), chosen to cover a deck, a stair or climb,
and an enclosed or edge space:

| Shard | Gate legs |
|---|---|
| `driftwood-isle` | `pier`, `lookout`, `cave` |
| `pine-hollow` | `cabin-porch`, `lookout-climb`, `creek-bridge` |
| `nalati-grasslands` | `road-camp`, `great-kurgan-door`, `leopard-cave` |
| `nine-dragon-stack` | `stair-street`, `crossing-gate-bridge`, `escape-square-balustrade` |

If the F3.2 probe run (02 F3.2 step 1) shows a shard's 3 gate legs take more than 60 s on the runner, the lead swaps
the longest for a shorter leg of the same kind and records the swap in E357; the full route still runs nightly. Three
legs per shard on the runner is the lead's accepted answer (13-lead-resolutions C9, 03 Q4): it keeps a job under 12
minutes (§10), and the full route runs nightly (§14) and before each milestone.

**`--full`** walks every leg, then every trail (`physics-baseline.mjs --trails`: each path of `TRAILS` end to end, both
ways, a waypoint every 3 m). It runs nightly (§14), for F11's and F12's done-when, and before each milestone.

## 5. Combat, loot and the leak test

### 5.1 How the harness attacks

- `probe.combat.equip(id)` selects the weapon (`weapons.select(id, true)`); `nolock` in the URL unlocks locked weapons
  (the rifle). `probe.combat.target(kind, near)` returns the nearest live animal of that kind to the point `near` (the
  herds are placed from the manifest's seed, so the target is the same animal every run) and sets `harnessHold = true`
  on it so it neither flees nor charges (02 F2 step 2).
- The harness teleports the player to the stand-off distance on the line from the target to the player's current
  position, faces the target's bounding-sphere centre (yaw and pitch), then **attacks through real input**: on the
  phone tier a `pointerdown` then `pointerup` with `pointerType: 'touch'` on `.ws-touch-attack` (the ATTACK disc,
  `src/player/TouchControls.ts:163`; touch-down fires `weapons.tryFire()`); on the desktop tier `page.mouse.down()` /
  `up()` on the canvas centre. Presses repeat every 600 ms (melee) or on reload-ready (ranged: the probe exposes
  `weapons.current.state`) until the step's limit.
- Hits and kills are observed through `tap.hit` / `tap.kill` (02 F2 step 2), which the probe connects only when
  `window.__wildshardHarness` exists (§6).

### 5.2 The steps per shard

| Shard | Step | Weapon | Target | Stand-off | Pass (class D) |
|---|---|---|---|---|---|
| `driftwood-isle` | swing | wooden sword (`sword`, the base) | the practice crab (E308, spawned at `PRACTICE_CRAB` = (−7, −143), `src/chunks/driftwood-isle.ts:84`) | 1.8 m | ≥ 1 hit within 3 s; killed within 15 s |
| | shot | rifle (`rifle`, unlocked by `nolock`) | the nearest `boar` to (0, −150) | 12 m | killed within 20 s |
| `pine-hollow` | swing | — Pine Hollow's loadout has no melee weapon (crossbow, lever rifle, longbow) | — | — | recorded as `'n/a'` |
| | shot | crossbow (the base) | the nearest `boar` to (0, −200) | 12 m | killed within 20 s |
| `nalati-grasslands` | swing | sabre (`sabre`) | the nearest `wolf` to the spawn (0, 232) | 1.8 m | ≥ 1 hit within 3 s; killed within 15 s |
| | shot | bow (`bow`) | the nearest other `wolf` to the spawn | 12 m | killed within 20 s |
| `nine-dragon-stack` | swing | the jian (the base sword) | training dummy 1 in the practice arena (`probe.arena()` = `hud.enterArenaNow()`; the shard has no creatures) | 1.8 m | ≥ 1 hit within 3 s (dummies do not die) |
| | shot | rifle (`nolock`) | training dummy 2 | 10 m | ≥ 1 hit within 5 s |
| `_template` (Z1) | swing, shot | Z1's kit weapon and custom weapon | Z1's creature | Z1's spec | killed |

### 5.3 Loot

Loot differs per shard today (Driftwood's coins and bounty, Pine Hollow's compendium, progress counters elsewhere), so
the harness checks it the shard-agnostic way: `combat.loot.written` = the storage keys written in the 2 s after each
kill, which must equal the baseline (class A, renames applied). On today's tree that is Driftwood `ws.purse.v1`,
`ws.bounty.v1` and whatever else the kill chain saves; the baseline records the actual list. Nine Dragon has no kill,
so no loot. A context starts with empty storage (a fresh context per shard × tier), so "each enemy pays once" pays.

### 5.4 Order inside one shard × tier run

boot fingerprint → poses → walk → combat (swing, then shot) → pause → resume (§5.6) → leak test (from F8). The leak
test is last so it unloads a world that has run every other step (projectiles, particles, sounds, the arena, the pause
menu).

### 5.5 The leak test (from F8; 01 §4, decision 60)

1. **Baseline B0.** The engine records `census()` (§2.4's fields) at the engine / shard boundary (02 F8 step 6: after
   the renderer, physics world, UI shell, audio context and input exist, before the shard's first resource) into
   `app.debug.leakBaseline`.
2. The shard loads and every other harness step runs.
3. `await probe.leak()`: sets the app state to `loading`, calls `app.unloadShard()` (the shard scope's `dispose()`,
   then `emit('shard.unloaded')`), waits two animation frames, and takes **B1** = `census()`.
4. **Pass:** every field of B1 equals B0. **Red** lists each differing field with B0, B1 and, for listeners and timers,
   the first 5 registration stack traces the init script kept for entries still alive.
5. The page is closed after the leak test (the next shard × tier gets a fresh context), so a failed unload never
   pollutes another run.

### 5.6 Pause → resume → state identical (FINISH-LINE S1; 13-lead-resolutions G19)

FINISH-LINE S1's golden path included a pause and a resume; it joins the scripted run here, on both lanes and both
tiers, from F2.
1. After the shot step, the harness pauses through real input: on the phone tier a touch tap on the PAUSE disc, on the
   desktop tier `page.keyboard.press('Escape')`. It waits until the pause menu is shown (today `#menu` visible; from
   X2 the `menu` layer on top) and, from F8, `app.state === 'paused'`.
2. `before = probe.state()` (§2.0).
3. It waits 2 s of wall time with the menu open. Nothing may move: today the frame gate (`src/main.ts:1067`) runs no
   frame while the menu is up, and from F8 the game clock excludes paused time (01 §2).
4. It arms `probe.onResume(fn)`, then taps or clicks the menu's RESUME button. The resume path calls the callback
   before the loop's next frame, and `after = probe.state()` is taken there.
5. `pauseResume.diff` lists every path where `after` differs from `before` (exact, after the 1 mm rounding). Pass
   (class D): the list is empty. A red report prints each differing path with both values.
Nine Dragon runs it in the practice arena (its combat steps end there), and the other shards in the world. If today's
game fails the step when F2 records its baselines, that is a found bug (decision 4): it joins GAME-NORMALIZATION §7 and
is fixed in F2, with a test, before the baselines are recorded.

## 6. Seeding and pins

| Pin | How | From |
|---|---|---|
| `Math.random` | the init script replaces it with mulberry32 seeded `0x2545f491` before any page script (scorecard's stream, `scorecard.mjs:165-166`) | F2; stays until `wildshard/no-raw-random-time` reaches 0 for `Math.random` |
| RNG streams | the init script sets `window.__wildshardHarness = { seed: 0x2545f491, capture: null }` before any page script; `RngService` seeds each stream with `fnv1a32(seed + ':' + stream)` for `gameplay`, `ai`, `loot`, `spawn`, `cosmetic` (02 F8 step 1) | F8 |
| time of day, Pine weather | the saved settings `time: 'midday'`, `weather: 'clear'` through `scripts/debug-settings.mjs` (`debugSettings(context, …)`), which writes the settings key the build reads (`ws.settings.v1` until F10, the v2 global document after) | F2 |
| Nalati's storm cycle | `?weather=clear` (on the `harness` allowlist, `lint/url-params.json`) | F2 |
| the intro, the lock, audio, the worker | `?skipintro=1&nolock=1&mute=1&sw=0` (all on the allowlist) | F2 |
| tier, touch | `?tier=phone&touch=1` (phone: 390 × 844, DPR 3, `isMobile`, `hasTouch`) or `?tier=desktop` (1600 × 900, DPR 1) | F2 |
| the game clock | from **harness version 2** (§8), `window.__wildshardHarness.capture = 30`: `clock.setCapture(30)` at boot, so every frame advances exactly 1/30 s of game time whatever the frame takes (01 §2, decision 80) | F8 |
| hit / kill taps, `harnessHold` | active only when `window.__wildshardHarness` exists | F2 |

No new query param is added (AGENTS.md: the allowlist changes only with Jake's OK). `window.__wildshardHarness` is a
page global set by the test browser's init script, not a URL switch, and the lint rule does not cover it.

## 7. Comparison rules and rename maps

- A run passes when every class A field equals the baseline, every class B field is inside its band, every class D
  threshold holds, and the budget checks (§2.5) hold. Class C never fails.
- **Rename maps** make an internal rename provable instead of re-recorded. A row that renames a system id, a save key
  or a registry piece ships `test/parity/renames/<row>.json` in the same commit:
  `{ "systems": { "<old>": "<new>" }, "saves": { "<old>": "<new>" }, "registry": { "renamed": { "<old>": "<new>" },
  "added": [<id globs>], "removed": [<id globs>] }, "physics": { "colliders": "same total" } }`. The harness applies
  every map whose row has landed (the files are read in `F`/`S`/`X`/`Z` order) to the **baseline** before comparing.
  The order of a renamed list must still match, so a rename cannot hide a reorder. `added` / `removed` entries are
  allowed only in the maps of the rows that 02 / later specs say add or remove those pieces (F11's are listed there).
  A rename map never covers a player-visible field (poses, SSIM, walk, combat, audio, HUD).
- A red report names the field path (`boot.systems.update[12]`, `poses.cabin.ssim`, `walk.legs.lookout-climb.stuck`),
  the baseline value, the value now and the band.

## 8. Baselines

- **Where:** `test/parity/baselines/<lane>/<shard>.<tier>.json` (the medians of the recording runs, each class B
  field with its `spread`, each pose's `selfMin`), and `test/parity/baselines/<lane>/<shard>.<tier>.<pose>.jpg` (run 1's
  frame, the golden). `test/parity/baselines/<lane>/meta.json`: `{ harness: <version>, sha, recorded, browser,
  runnerImage }`. `/test/parity` is in `.vercelignore` (02 F2 step 7).
- **How:** `node scripts/parity.mjs --record --runs=3 --lane=m5 --tiers=phone,desktop --export=<sha>` on the Mac;
  on the runner, `gh workflow run gpu-gate -f sha=<sha> -f record=true`, then `gh run download <run> -n
  parity-baselines-gh-macos15` into `test/parity/baselines/gh-macos15/`. The baseline commit touches only
  `test/parity/baselines/**` (and `scripts/parity/**` for a harness version bump), with a pathspec commit whose message
  says which rule below allowed it.
- **Who may re-record, and when — the only four cases:**
  1. **A boarded change.** Jake picked a visible change on a wave board (weapons, creatures, input / HUD, audio, look;
     GAME-NORMALIZATION §5). The fields the board covers are re-recorded on the commit that makes the change; the
     commit message names the board and Jake's pick. Other fields must still pass unchanged.
  2. **A harness version bump** (a new field, a new pin such as capture mode, a changed band rule). Re-record on the
     last gpu-green SHA **before** the harness change, with the new harness, in a commit that touches only the harness
     and the baselines — the game code is identical, so the new baseline is today's game measured the new way.
     `meta.json` `harness` goes up by 1.
  3. **A runner image or Chromium bump** (`macos-15` image version, the Playwright lockfile). Re-record the affected
     lane only, on the last gpu-green SHA, in a commit that touches only that lane's baselines.
  4. **A found bug fixed inline** (decision 4) whose fix changes a recorded field. The fix commit carries its test and
     re-records only the fields the fix changes; the commit message names the bug (GAME-NORMALIZATION §7 list or a new
     entry there).
  Anything else that changes the fingerprint is a regression and is reverted.
- The lead is the only one who re-records (decision 33: nobody else is in the repo). After the plan (§16) the rule
  changes.

## 9. Determinism proof

`node scripts/parity.mjs --prove --lane=<lane> --export=<sha>` (and `gh workflow run gpu-gate -f sha=<sha> -f prove=true`
on the runner):
1. Two compare runs on the unchanged SHA: both green.
2. Each plant in `test/parity/plants/index.json` applied to the same SHA (`git apply`), built and run: each red, and
   among its red fields every field in the plant's `expect` list. A plant that comes out green means a band is too wide
   or a field is missing: the harness is fixed before the row that introduced the plant is done.

| Plant `id` | The one change (a patch file) | Shards | Expected red fields | From |
|---|---|---|---|---|
| `boot-throw` | `throw new Error('plant')` at the start of Pine Hollow's props step (`src/chunks/pine-hollow/world/props.ts`, the `build` method) | pine-hollow (the others must stay green) | `boot.errors` | F2 |
| `system-rename` | the label `'physics.movers'` → `'physics.mover'` (`src/core/bootstrap.ts:138`) | all | `boot.systems` | F2 |
| `registry-drop` | Driftwood's jetty loop starts at index 1 (`src/main.ts:345`): `jetty-0` is never registered | driftwood-isle | `boot.registry`, `boot.physics` | F2 |
| `census-drop` | Nine Dragon's lantern group (`scene.getObjectByName('lanterns')`) is not added to the scene | nine-dragon-stack | `boot.scene.named`, `boot.scene.totals` | F2 |
| `look-fog` | Nalati's `atmosphere` fog density × 1.2 (`src/chunks/nalati-grasslands.ts`) | nalati-grasslands | `poses.*.ssim` (at least one pose) | F2 |
| `draw-add` | 20 extra 1 m boxes (each its own mesh) added beside Pine Hollow's gate at (2, −203) | pine-hollow | `poses.gate.calls`, `boot.scene.totals` | F2 |
| `step-height` | the character controller's step 0.35 → 0.20 m (`src/physics/`, the autostep setting) | nine-dragon-stack, pine-hollow | `walk.stuck` | F2 |
| `sword-nohit` | the sword's damage application returns before `applyDamage` | driftwood-isle, nine-dragon-stack | `combat.swing` | F2 |
| `crossbow-weak` | the crossbow's damage × 0.05 | pine-hollow | `combat.shot` (not killed within 20 s) | F2 |
| `audio-drop` | one Driftwood ambience file removed from the boot's declared audio list | driftwood-isle | `boot.audio.requests` | F2 |
| `hud-hide` | the LOCK disc is never mounted (`src/player/TouchControls.ts`) | all (phone) | `boot.hud` | F2 |
| `save-rename` | `ws.purse.v1` → `ws.purse.v9` (`src/game/loot/Purse.ts:16`) | driftwood-isle | `combat.loot`, `boot.saves` | F2 |
| `pause-drift` | the frame gate ignores the pause menu (`src/main.ts:1067`: the `hud.entered` term dropped), so the world keeps running under the menu | driftwood-isle, pine-hollow, nalati-grasslands | `pauseResume` | F2 |
| `metal-off` | the gate job launches Chromium with `--use-angle=swiftshader` (a workflow input, not a patch) | all | exit 3, status `error` | F3.2 |
| `asset-case` | one boot-declared asset URL's case changed (`/assets/music/…` → `/assets/Music/…` in Driftwood's declared audio list); the file on disk unchanged | — (the `asset-case` job) | the job fails naming the URL (§11.6) | F3.2 |
| `soak-leak` | one 1 MiB `DataTexture` uploaded every 10 s and never disposed (a system added in the shard's scope) | all (nightly soak only) | the soak's `gpuBytes` growth (§14.2) | F3.2 |
| `leak-geometry` | the shard scope skips disposing one geometry on unload | all | `leak.geometries` | F8 |
| `render-throw` | Nine Dragon's `render` thunk throws | nine-dragon-stack | `boot.errors` (the error screen, 02 F9) | F9 |
| `budget-over` | 200 extra draws at Nine Dragon's `spawn-rail` pose | nine-dragon-stack | `budgets` | S1.6 |

Paths in the table are today's; after F6 the patch files are regenerated against the moved paths in the F6 commit
(`move.mjs` rewrites the `diff --git a/… b/…` headers with the move map) and re-proved. The proof runs at the end of
F2 (m5), of F3.2 (runner), and again after F6, F8, F9 and S1.6 (each adds its plant).

## 10. Runtime budget

| Run | Budget | How it holds |
|---|---|---|
| The lead's per-commit run: m5, phone, 4 shards (5 from Z1) | ≤ 6 min wall | 2 shards in parallel (2 browser-lane slots), each ≤ 2.5 min: boot ≈ 11 s (TP audit §6), fingerprint 2 s, 3 poses × (3 s settle + 5 s sample) = 24 s, 3 gate legs ≈ 45 s, combat ≤ 40 s, pause → resume ≈ 5 s, leak 5 s, build ≈ 15 s once |
| The lead's pre-milestone run: m5, phone + desktop, `--full` | ≤ 45 min | full routes and trails dominate; runs once per milestone and nightly |
| Recording (3 runs) | ≤ 3× the matching compare run | only on the four re-record cases |
| One gate job on `macos-15` | ≤ 12 min (timeout 20) | setup ≈ 4 min (sparse checkout with `public/`, pnpm install from cache, Playwright Chromium from cache, `vite build`), harness for one shard ≈ 2× the M5's 2.5 min. Unmeasured until the F3.2 probe run (ci-gpu-options: "the 3.5 min M5 budget could become 8–12 min"); if a shard's job exceeds 12 min, its matrix entry splits into `part: fingerprint+poses` and `part: walk+combat+leak` |
| The whole gate (matrix of 4, then 5) | ≤ 15 min wall | jobs in parallel (5 macOS jobs at once on the Free plan) |
| The `asset-case` job on `ubuntu-latest` | ≤ 5 min (timeout 10) | install from cache ≈ 1.5 min, `vite build` ≈ 1 min, the check < 30 s (§11.6) |
| Nightly `gpu-perf` | ≤ 4 h, 04:00 → 08:00 | the parity `--full` run ≤ 90 min; the GPU rulers + scorecard ≤ 30 min; the Simulator memory run ≤ 30 min (§14.1); the soak 4 × (20 min + boot) ≈ 90 min (§14.2) |

## 11. The per-push gate on GitHub `macos-15`

### 11.1 `.github/workflows/gpu-gate.yml`

```yaml
name: gpu-gate
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      sha:    { description: Commit to gate (default the branch head), type: string, required: false }
      record: { description: Record runner baselines (artifact), type: boolean, default: false }
      prove:  { description: Run the determinism proof, type: boolean, default: false }
      plant:  { description: Apply one plant (test/parity/plants/<id>.patch), type: string, required: false }
      angle:  { description: ANGLE backend (the metal-off plant uses swiftshader), type: string, default: metal }
concurrency:
  group: gpu-gate-main          # one running + one pending; a burst of pushes gates the newest (ci-gpu-options §6)
  cancel-in-progress: false
permissions:
  contents: read
  statuses: write
jobs:
  shard:
    strategy:
      fail-fast: false
      matrix:
        shard: [driftwood-isle, pine-hollow, nalati-grasslands, nine-dragon-stack]   # + _template from Z1
    runs-on: macos-15            # pinned label, never macos-latest
    timeout-minutes: 20
    env:
      SHA: ${{ inputs.sha || github.sha }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.sha || github.sha }}
          filter: blob:none
          sparse-checkout: |
            /*
            !/progress/
            !/art/
            !/sources/
            !/docs/
          sparse-checkout-cone-mode: false
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v4
        with:
          path: ~/Library/Caches/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm exec playwright install chromium          # full Chromium, not the headless shell
      - name: Apply plant
        if: inputs.plant != ''
        run: git apply "test/parity/plants/${{ inputs.plant }}.patch"
      - run: pnpm exec vite build
      - name: Serve the build
        run: |
          pnpm exec vite preview --host 127.0.0.1 --port 4400 --strictPort > preview.log 2>&1 &
          for i in $(seq 1 60); do curl -fsS http://127.0.0.1:4400/version.json && break; sleep 1; done
      - name: Parity (${{ matrix.shard }}, phone)
        run: >
          node scripts/parity.mjs --url=http://127.0.0.1:4400 --lane=gh-macos15 --shards=${{ matrix.shard }}
          --tiers=phone --retry=1 --angle=${{ inputs.angle || 'metal' }}
          ${{ inputs.record && '--record --runs=3' || '' }} --out=parity-out
      - name: Facade instancing (E271, Nine Dragon only)
        if: matrix.shard == 'nine-dragon-stack' && !inputs.record
        run: node scripts/test-facade-instancing.mjs --url=http://127.0.0.1:4400
      - name: Per-shard status
        if: always() && !inputs.record && inputs.plant == ''
        env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs shard "$SHA" "${{ matrix.shard }}" "${{ job.status }}" parity-out
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ${{ inputs.record && 'parity-baselines-gh-macos15' || format('parity-{0}', matrix.shard) }}
          path: parity-out
          retention-days: 14
  asset-case:                    # §11.6: Linux, case-sensitive disk (ci-gpu-options §6.2; 13-lead-resolutions G15)
    if: ${{ !inputs.record }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      SHA: ${{ inputs.sha || github.sha }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.sha || github.sha }}
          filter: blob:none
          sparse-checkout: |
            /*
            !/progress/
            !/art/
            !/sources/
            !/docs/
          sparse-checkout-cone-mode: false
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Apply plant
        if: inputs.plant != ''
        run: git apply "test/parity/plants/${{ inputs.plant }}.patch"
      - run: pnpm exec vite build
      - run: node scripts/check-asset-case.mjs dist --out=asset-case.json
      - name: Status
        if: always() && inputs.plant == ''
        env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs shard "$SHA" asset-case "${{ job.status }}" asset-case.json
  gate:
    needs: [shard, asset-case]
    if: always() && !inputs.record && inputs.plant == ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { sparse-checkout: scripts/gpu-gate, sparse-checkout-cone-mode: true }
      - env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs gate "${{ inputs.sha || github.sha }}" "${{ needs.shard.result }},${{ needs.asset-case.result }}" "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

With `record: true`, the matrix jobs upload baselines instead of comparing and post no status. With `plant`, no status
is posted (a plant must never mark a real commit). `prove: true` runs `parity.mjs --prove` in each job instead of the
compare step (the plants are applied inside the job to temp copies).

### 11.2 Metal or fail

`parity.mjs` launches Chromium with `channel: 'chromium'` (Playwright's full browser; the default headless shell falls
back to SwiftShader even on a Mac, ci-gpu-options §1) and `--use-angle=metal --ignore-gpu-blocklist --mute-audio`.
Before any game page, it opens `about:blank`, creates a WebGL2 context and reads `UNMASKED_RENDERER_WEBGL`. If the string
does not match `/ANGLE \(Apple, ANGLE Metal Renderer/`, it prints the string and exits 3 within the first seconds; the
job's status is then `error` (infrastructure), not `failure`. The renderer string is also recorded in every fingerprint
(`boot.renderer`, class D).

### 11.3 Commit statuses

`scripts/gpu-gate/status.mjs` posts through `gh api repos/Raynos/project-wildshard-singleplayer/statuses/<sha>`:
- per shard: context `gpu-gate/<slug>`, state `success` / `failure` / `error`, description ≤ 140 characters from
  `report.md`'s first red field (`walk.stuck 1 at lookout-climb wp4`) or `green (retried: <field>)`;
- the `asset-case` job: context `gpu-gate/asset-case`, description `n URLs checked` or the first wrong-case URL;
- the aggregate: context **`gpu-gate`**, state `success` only if every matrix job and the `asset-case` job succeeded
  (`status.mjs gate` reads the comma-joined results), `error` if any job exited 3 or timed out, else `failure`;
  description `4/4 shards green · assets ok` or `red: nalati-grasslands, asset-case`; `target_url` = the run.

Only `gpu-gate` is read by the deploy (§13); the per-shard contexts are for people.

### 11.4 Concurrency and superseded runs

`group: gpu-gate-main` with `cancel-in-progress: false` keeps one running run and one pending run; a newer push
replaces the pending one. A superseded commit gets no `gpu-gate` status at all (neither green nor red). That is safe
because nothing deploys from main's head: the deploy reads the pin, and `deploy-pin.mjs set` refuses a SHA without a
green `gpu-gate` (§13.2). To gate a superseded commit on purpose: `gh workflow run gpu-gate -f sha=<sha>`.

### 11.5 Timeouts

`timeout-minutes: 20` per job (§10); `parity.mjs --timeout=240` s per page load (scorecard's default). A job that times
out posts `error` via the aggregate (its per-shard step runs with `if: always()`).

### 11.6 The asset-URL case check on Linux (ci-gpu-options §6.2; 13-lead-resolutions G15)

macOS disks ignore case, so a URL `/assets/Music/x.mp3` for the file `public/assets/music/x.mp3` works on every Mac lane
and 404s on Vercel. `scripts/check-asset-case.mjs <dist>` runs on `ubuntu-latest`, whose disk is case-sensitive:
1. It collects every asset URL the build references: every `"/assets/…"` string literal (and `assets/…` relative to
   the page) in `dist/**/*.{js,css,html,json,webmanifest}`, which covers the generated file lists
   (`bytes.generated.ts`, `gpu.generated.ts`, the packs' `/assets/packs/<slug>.<tier>-<hash>.bin` rows) as they land
   in the bundle, and the service worker's precache list. `?v=` and `#…` are stripped; a URL built at runtime from a template (a `${tier}`
   part) is expanded over the values the source declares next to it (the tiers, the shard slugs from the registry).
2. For each URL it checks, segment by segment, that the path exists in `dist/` with exactly that spelling
   (`fs.readdirSync` of each parent and an exact `includes`, so it never relies on the disk's case rules).
3. It writes `{ checked, missing: [{ url, from, closest }] }` to `--out`, where `closest` is a case-insensitive match
   if one exists (the "wrong case" verdict) and `from` is the referencing file. It exits 1 on any `missing` entry.

A plant (`asset-case`, §9) proves it goes red. After the plan (§16) the job stays on every push.

## 12. Flake policy (MW3)

- **Retry once.** `--retry=1`: when a shard × tier run is red, `parity.mjs` re-runs that shard × tier once in a fresh
  context. It is red only if the second run is red too. A green retry is reported as `flaked` in `report.md`, in the
  per-shard status description (`green (retried: poses.cabin.ssim)`) and in the job summary. Infrastructure errors
  (exit 3) are not retried inside the job; the lead re-runs the workflow once (`gh run rerun <id> --failed`).
- **Flake tally.** The nightly (§14) downloads the last 7 days of `gpu-gate` run artifacts (`gh run list -w gpu-gate`,
  `gh run download`) and writes a tally of flaked fields into its report. A field that flaked 3 times in 7 days must be
  fixed or quarantined by the lead the same day.
- **Quarantine.** `test/parity/quarantine.json`: `[{ "id": "<shard>/<tier>/<field path>", "owner": "<who fixes it>",
  "ask": "E<n>", "since": "YYYY-MM-DD", "until": "YYYY-MM-DD", "why": "…" }]`. A quarantined field still runs and is
  reported, but never turns the run red. `until` is at most 14 days after `since`. The gate fails (status `failure`,
  description `quarantine expired: <id>`) when any entry is past `until`, or when there are more than 5 entries. Only
  the lead adds an entry, and only with an ask file whose `Owns:` names the fix. A class D threshold (`errors`,
  `walk.stuck`, `renderer`, `batched`, the leak test) can never be quarantined.

## 13. The deploy pin (decision 32)

### 13.1 `.github/deploy-pin.json`

```json
{
  "$doc": "What production and the native OTA channel serve (E357 decision 32). Moved only by scripts/deploy-pin.mjs set, at a milestone, after Jake's go. mode: pinned (during GAME-NORMALIZATION) | newest-green (after Z4).",
  "mode": "pinned",
  "sha": "<40 hex>",
  "milestone": "M0",
  "gate": "grandfathered",
  "go": "E357 decision 32: production stays on the pre-normalization build",
  "set": "<ISO time>",
  "by": "E357 lead"
}
```

`gate` is `"grandfathered"` only for M0 (the build live when F3.1 lands predates the gate); every later pin is
`"required"`.

### 13.2 `scripts/deploy-pin.mjs`

| Command | Does |
|---|---|
| `read` | validates the file (40-hex `sha`, `mode` ∈ {`pinned`, `newest-green`}, `gate` ∈ {`grandfathered`, `required`}); in `pinned` mode prints `sha`; in `newest-green` mode walks `git rev-list origin/main -n 50` newest first and prints the first SHA whose `gpu-gate` status is `success`; writes `sha=`, `mode=`, `gate=` to `$GITHUB_OUTPUT` when set |
| `check-gate <sha>` | exit 0 only if `gh api repos/Raynos/project-wildshard-singleplayer/commits/<sha>/status` has context `gpu-gate` with state `success` |
| `set <sha> --milestone <Mn> --go "<where Jake said go>"` | refuses unless `git merge-base --is-ancestor <sha> origin/main` and `check-gate <sha>` pass; writes the file with `gate: "required"`, `set` = now, `by` = `E357 lead` |
| `mode newest-green --go "<…>"` | (Z4 only) switches the mode; `sha` is kept as the last pinned build for the record |

### 13.3 `deploy.yml` (schedule and dispatch path; the push / PR path is unchanged)

After the existing sparse `actions/checkout` of main:
1. **Read the pin** with main's `scripts/deploy-pin.mjs read` (step id `pin`), and copy main's `scripts/deploy-pin.mjs`
   and `scripts/deploy-version.mjs` to `$RUNNER_TEMP/` — the pinned tree is older and may not have them (the M0 tree
   has neither the pin script nor `DEPLOY_SHA` support).
2. **Gate check:** if `steps.pin.outputs.gate == 'required'`, `node $RUNNER_TEMP/deploy-pin.mjs check-gate <sha>`;
   a red or missing status fails the run (production stays where it is).
3. **Check out the pin:** `git fetch --no-tags --filter=blob:none origin <sha>` and `git checkout --detach <sha>`; the
   sparse rules stay.
4. **Check live commit** runs `node $RUNNER_TEMP/deploy-version.mjs check` with `DEPLOY_SHA=<sha>` (02 F3.1 step 3:
   the script prefers `DEPLOY_SHA` over `GITHUB_SHA`, because a workflow cannot override `GITHUB_*` variables). Live ==
   pin → `skip=true`, and every later step is skipped as today.
5. The existing install, typecheck, lint, test, build and deploy steps run on the pinned tree (its own gates). `vite
   build` stamps `version.json` from `git rev-parse --short HEAD` = the pin.
6. **Verify production** runs `node $RUNNER_TEMP/deploy-version.mjs verify` with the same `DEPLOY_SHA`.

`ota-promote.yml` gets steps 1–3 before its build, so a promote ships the pinned build and never main's head.

### 13.4 How the pin moves at a milestone

1. The milestone's last commit is on main and its `gpu-gate` is green (dispatch the gate on it if it was superseded).
2. The lead's `--full` run on both tiers (m5) is green, and Jake has the summary and boards (decision 42).
3. Jake says go (through the ask tool). The lead runs `node scripts/deploy-pin.mjs set <sha> --milestone M<n> --go
   "E357 <where>"`, commits `.github/deploy-pin.json` alone, `scripts/push-main.sh`, then `gh workflow run deploy`,
   and checks that `version.json` reports `<sha7>`. The build id goes into E357 (AGENTS.md → Deploy).
4. **Rollback of production:** `deploy-pin.mjs set <the previous milestone's sha> --milestone M<n>-rollback --go
   "<Jake's words>"`, same steps. **Hotfix:** decision 53 — fixed on main, shipped with the next milestone; a pin move
   outside a milestone needs Jake's explicit go and the same `set` (which still requires a green gate).

## 14. The nightly `gpu-perf` poller on Jake's Mac (never a runner)

- **What it is.** A launchd agent, `~/Library/LaunchAgents/com.wildshard.gpu-perf.plist` (the committed template is
  `scripts/gpu-perf/com.wildshard.gpu-perf.plist`), `StartCalendarInterval` 04:00; launchd runs a missed run on wake,
  so a night asleep delays a report and never a deploy. It registers no GitHub runner and runs nothing from GitHub: it
  polls `origin` and runs the repo's own scripts on a commit that already passed the gate (ci-gpu-options §4).
- **Install** (`scripts/gpu-perf/install.sh`, run once by the lead): writes the plist with absolute paths (the current
  `node`, `pnpm`, `gh`, so an nvm switch cannot strand it), creates `~/.wildshard/gpu-perf/`, clones a bare mirror to
  `~/.cache/wildshard-gpu-perf/repo.git` (so the shared checkout is never touched), and loads it with `launchctl
  bootstrap gui/$(id -u)`. It needs no new token (13-lead-resolutions 02/03#8): the poller posts with the Mac's
  existing `gh` login (`gh api repos/Raynos/project-wildshard-singleplayer/statuses/<sha> -f state=… -f
  context=gpu-perf -f description=…`), and `install.sh` refuses to load the agent while `gh auth status` fails.
- **`scripts/gpu-perf/nightly.sh [--plant=<id>]`**, in order, under `caffeinate -i`. `--plant` (a one-off, by hand)
  applies `test/parity/plants/<id>.patch` to the exported tree, runs only the parts the plant's `Shards` column names,
  prints the verdict, writes the report under `~/.wildshard/gpu-perf/plant-<id>-<date>.md` and posts no status (a
  plant never marks a real commit, as in the gate):
  1. `git --git-dir=<mirror> fetch origin main`; pick the newest of the last 30 commits whose `gpu-gate` is `success`;
     stop if `~/.wildshard/gpu-perf/<sha7>.json` exists.
  2. `git archive <sha>` into `~/.cache/wildshard-gpu-perf/tree-<sha7>/`; `pnpm install --frozen-lockfile
     --prefer-offline --config.enable-global-virtual-store=false`; `scripts/serve-build.sh --hours 5 --name gpu-perf`
     from that tree (a registered preview the reaper knows; the whole nightly is ≤ 4 h, §10).
  3. Inside `scripts/browser-lane.sh --max 90`:
     - `node scripts/parity.mjs --url=<u> --lane=m5 --tiers=phone,desktop --full --ms` (every route leg and trail,
       both tiers, compared with the m5 baselines);
     - under the machine-wide model lock (`lockf -k ~/projects/localai/.model.lock`, so no MiniMax / TRELLIS / Qwen job
       shares the GPU while it times; ≤ 30 min held, AGENTS.md): the GPU-ms rulers `node scripts/nine-dragon-gpu.mjs
       --url=<u>` and `node scripts/pine-hollow-gpu.mjs --url=<u>` (and each shard's ruler as its S row adds one),
       against budget-design's M5 ruler budget (1.6 ms per pose, P);
     - `node scripts/scorecard.mjs --url=<u> --tag=nightly-<date>-<sha7> --no-switch --compare=baseline` (load bytes and
       time on shaped Fast 4G, heap, GL-API GPU bytes; `--no-switch` because the resident host is gone after F11);
     - from F8, the harness's leak test on every shard, both tiers (already inside the parity run).
  4. **The Simulator memory run** (§14.1), inside `scripts/sim-lane.sh run --max 40 wildshard-iphone …`.
  5. **The soak bot** (§14.2): one `scripts/browser-lane.sh --max 30 node scripts/soak.mjs --url=<u> --shard=<slug>`
     per shard, one after another (never two soak pages at once).
  6. Writes `~/.wildshard/gpu-perf/<date>-<sha7>.md` and `.json` (every number, the flake tally of §12, each budget with
     its formula, the Simulator memory table, the soak table) and posts context **`gpu-perf`** on `<sha>`: `success`
     when every check passed, `failure` otherwise, description ≤ 140 characters, e.g. `M5 GPU worst nine/well-edge
     1.42 ms (1.6) · GPU 373 MB · parity 0 red · sim 0.71/1.0 GB · soak ok`. It never blocks a deploy.
  7. `scripts/serve-build.sh stop <port>`, closes every browser, deletes the tree.
- `.claude/hooks/session-brief.sh` prints the newest report's first line, so the lead sees the night's numbers at
  session start.
- **This report replaces FINISH-LINE S7's committed `latest.md` table** (13-lead-resolutions G19): the budget numbers
  per shard live in the gate's per-run report artifact (`parity-<shard>` → `report.md`, §2.5, §15) and in this nightly
  report, not in a committed file (GAME-NORMALIZATION §8).

### 14.1 The Simulator memory run (decision 31 "nightly = Simulator"; 13-lead-resolutions G2)

`scripts/sim-memory.mjs` is `scripts/nine-sim-memory.mjs` (E264) generalised to every shard at F3.2: `--url=<u>
--shards=<every registry shard> --runs=1 --play=60 --fly=60`. For each shard, on a cold Safari in the booted Simulator
(`sim-lane.sh run`, one device machine-wide, shut down after), it measures three phases: **loading** (the arrival on
the title, then `?chunk=<slug>&mute=1`, until the loading screen is gone), **play** (60 s at the spawn, turning one
full circle), and **explorer** (pause ▸ EXIT TO MAIN ▸ EXPLORE WORLD ▸ World explorer, 60 s of flight). Each phase
records the game tab's **WebContent physical-footprint high-water** (the kernel meter of `scripts/sim-mem-phases.py`,
reset at each phase start) and Web Inspector's total.
- **Against:** loading ≤ 1.8 GB, play and explorer ≤ 1.0 GB (decimal; decision 31, 01 §13.4).
- **Verdict:** red when a phase is over its limit, or when it is more than 10 % above the previous night's reading for
  the same shard and phase (a regression on the same machine). The table goes into the report.
- **What it is not.** The Simulator runs on the Mac's memory and GPU and read ~0.75 GB where the phone read 1.054
  (the ios-simulator skill; E271 / E272). Under the limits proves nothing about the phone; the physical iPhone reading
  at each milestone stays the memory evidence (§15, 12 §8).

### 14.2 The soak bot (MW19; 13-lead-resolutions G13)

`scripts/soak.mjs --url=<u> --shard=<slug> [--minutes=20]` runs one shard for 20 minutes, headless on the M5 (full
Chromium, ANGLE Metal, `--mute-audio`, phone tier, `window.__wildshardHarness` seeded as §6):
- **The wanderer.** From the spawn it picks a seeded random point 30–80 m away on the shard's baked navmesh
  (`public/assets/baked/<slug>/navmesh.bin`, through the probe's `nav.randomPoint(near, min, max)` and `nav.path(a,
  b)` over the engine's navmesh query), follows the path's corners with the walk autopilot (`scripts/parity/walk.mjs`),
  and repeats. Nine Dragon has no baked navmesh, so it walks the legs of `scripts/physics-route.json` in a seeded order.
  Every 60 s it attacks the nearest creature (or practice dummy) within 15 m through real input (§5.1); every 5 minutes
  it pauses for 5 s and resumes.
- **Stuck state:** less than 0.3 m of progress in 5 s. It is recorded with its position and a screenshot, then the
  wanderer teleports to its next target.
- **Samples, every 30 s:** JS heap after a forced GC (CDP `HeapProfiler.collectGarbage`, then `JSHeapUsedSize`), GPU
  bytes (the §2.1 GL-API accounting), `renderer.info.memory`, the scene's Object3D count, the fps median of the last 30 s,
  and every page error.
- **Verdict (red on any):** a page error; a stuck state; GPU-byte growth over minutes 5–20 above 8 MiB (the
  least-squares slope × 15 min); heap growth over minutes 5–20 above 10 % of the minute-5 value; geometries or textures
  at minute 20 above the minute-5 count × 1.05. **The fps trend** (the median of the last 5 minutes against the first
  5) is reported, not a verdict.
- **Proof:** the `soak-leak` plant (§9: 1 MiB uploaded every 10 s, never freed, ≈ 90 MiB over the window) must turn the
  soak red on the GPU-byte growth (02 F3.2 done-when).

## 15. The budget check in the gate (summary)

Which numbers: per pose and tier, draws, triangles, programs, GPU MB (derived by `src/engine/render/budgets.ts` from the
manifest inputs and `budgets/calibration.json` or `budgets/provisional.json`; ceilings from `lint/ratchet.json`
`"budgets"`). Where checked: the per-push gate (counts, both lanes) from S1.6. Where not: frame ms and GPU ms (nightly
on the M5, `gpu-perf`), CPU ms per system and download bytes (nightly scorecard), memory (the iPhone, decision 31; the
nightly Simulator run of §14.1 checks the same limits as a regression check, never as phone evidence).
The report prints each number with its formula and inputs, so a re-calibration moves numbers without code edits
(budget-design §3).

## 16. What the permanent per-push gate keeps after the plan (Z4)

- `gpu-gate.yml` on every push to main, 5 jobs (the 4 shards + `_template`), phone tier, everything in §2: the boot
  fingerprint, the poses, the gate walk, swing + shot + kill + loot, pause → resume, the leak test and the budgets; the
  Metal check; the Linux `asset-case` job (§11.6); the flake policy and quarantine rules of §12.
- The nightly `gpu-perf` on Jake's Mac, unchanged (desktop, full routes and trails, GPU ms, scorecard, the Simulator
  memory run, the soak bot).
- **The deploy pin switches to `mode: "newest-green"`** (`deploy-pin.mjs mode newest-green`): the hourly deploy ships
  the newest main commit whose `gpu-gate` is green (ci-gpu-options §6), and the milestone-only rule ends with the lock.
- **The baseline rule changes** (§8 becomes): content work is normal again, so a commit that changes a shard's look,
  layout or content re-records that shard's baselines in the same commit, with the fields it changed listed in the
  message; the gate then proves that nothing *else* changed and every class D threshold holds. Engine and kit commits
  keep the plan-time rule (only the four cases).
- Rename maps, plants and the determinism proof stay: every new engine field added to the fingerprint comes with a
  plant that proves it can go red.

## Questions for the lead

Answered in [13-lead-resolutions.md](13-lead-resolutions.md) (the 02/03 table and C9); none is open, and the body
above follows each answer. The gaps 13 closed in this file: the Simulator memory run and the soak bot (§14.1, §14.2;
G2, G13), the Linux asset-case job (§11.6; G15) and the pause → resume step (§5.6; G19).

1. **Loot has no common observable today.** **Resolved → 13-lead-resolutions 02/03#7:** loot is checked as the save keys
   written after a kill (§5.3), until `#game`'s loot rows exist (S4.3).
2. **Nine Dragon has no creatures; Pine Hollow has no melee weapon.** **Resolved → 13-lead-resolutions 02/03#7:** Nine
   Dragon's gate kills a practice-arena dummy (§5.2); Pine's swing check runs only where the loadout has melee
   (recorded `'n/a'`), and the shot check covers Pine. No harness-only creature spawn is added.
3. **Which tiers the per-push gate runs.** **Resolved → 13-lead-resolutions 02/03#7:** the runner covers the phone
   tier; the desktop tier runs in the nightly on Jake's Mac (§14) and in the lead's pre-milestone run (§10).
4. **The gate walk is 3 legs per shard** (§4), not the full route, to keep a job under 12 minutes; the full route and
   trails run nightly and at F11 / F12 / milestones. **Resolved → 13-lead-resolutions C9 (03 Q4):** accepted; §4
   follows.
5. **The leak test's listener and audio counts** (01 §4) don't exist in today's code. §2.4 instruments listeners and
   timers in the harness init script and asks F8 for `app.audio.census()` over today's `Audio.ts` (voices, beds,
   buses) until S3.5's engine. **Resolved → 13-lead-resolutions C9 (03 Q5):** accepted; the probe also exposes the
   scope census and the `AudioService` registry's counts, and §2.4's instrumentation is the spec (§2.4 follows).
6. **The native OTA channel follows the pin.** **Resolved → 13-lead-resolutions 02/03#8:** yes, the pin covers
   `ota-promote.yml` (§13.3).
7. **The M0 pin.** **Resolved → 13-lead-resolutions 02/03#8:** the first pin is the build live when F3.1 lands
   (`gate: "grandfathered"`, §13.1).
8. **The `gpu-perf` token.** **Resolved → 13-lead-resolutions 02/03#8:** none needed; the nightly posts statuses with
   the Mac's existing `gh` login (§14). Nothing in F3 needs Jake.
