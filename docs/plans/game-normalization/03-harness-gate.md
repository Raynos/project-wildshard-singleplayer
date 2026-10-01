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
| `m5` | Jake's M5 Max, the lead's run, headless Chromium `channel: 'chromium'` + `--use-angle=metal`, in `scripts/browser-lane.sh` | phone, the changed shards (every commit); phone + desktop, every shard (before every push, before each milestone and nightly; R1-10) | every commit, every push (§10); nightly (§14) | the lead's push (the plan's rule: harness green → push, 12 §5) |
| `gh-macos15` | GitHub-hosted `macos-15` runner (M1 VM, 3 vCPU, 7 GB, paravirtual Metal) | phone | every push to main (§11) | the `gpu-gate` status; the deploy pin needs it green (§13) |
| `gh-ubuntu` | GitHub-hosted `ubuntu-latest` (a case-sensitive disk) | — (no browser) | every push to main: the `asset-case` job (§11.6) | the `gpu-gate` status (it is one of the jobs the aggregate reads) |
| `sim` | the iOS Simulator on Jake's M5 (`scripts/sim-lane.sh`, iOS Safari) | phone | nightly (§14.1) | the pin: a red `gpu-perf/memory` stops the line and `deploy-pin.mjs set` refuses (§14.1). With the budgets it is the plan's memory gate (decision 98, R3-11′), though it can't prove the phone is under its limits (12 §8) |

Baselines are per lane (pixels, programs and GPU bytes differ between a paravirtual M1 and an M5 Max; ci-gpu-options §3).
Timing (ms, fps) is never a gate on either lane: it is recorded as information and gated only by the nightly `gpu-perf`
status, which blocks nothing (decision 28′).

## 1. `scripts/parity.mjs`

```
node scripts/parity.mjs [source] [--lane=m5|gh-macos15] [--shards=a,b|all] [--tiers=phone,desktop]
                        [--record [--runs=3]] [--rebaseline=<slug>] [--accept=<ids>] [--pending-fill=<ids>]
                        [--pending=<file>] [--retry=1] [--plant=<id>] [--prove [--only=green|<plant id>]]
                        [--offline] [--full] [--ms] [--angle=metal] [--out=<dir>] [--timeout=240]
  source (one of): --export=<sha>  git archive <sha> → a temp dir, node_modules symlinked, vite build, vite preview
                   --url=<origin>  a server already running (the gate job, the nightly)
```

- **Every run names its SHA (R2-25).** `--export` takes a full SHA, never `HEAD`: up to 3 subagents and, from M1, the
  reopened lanes commit to the same local `main`, so `HEAD` can move between a commit and its run. The SHA is
  captured in the same shell command as the commit (`git commit … -- <paths> && sha=$(git rev-parse HEAD)`) and
  checked with `git show -s --format=%s $sha` against the message just written. Baselines never ride a `git commit
  --amend` (amends are banned under the lock): a run that re-records (`--rebaseline`, `--accept`, `--pending-fill`,
  case 2's new fields) lands its files in a follow-up pathspec commit whose message names the SHA they were recorded
  on (`<slug> baselines for <sha7>`), and both commits go up in one `scripts/push-main.sh`.
- **What `--export` archives (R2-32; C2-14).** `git archive <sha>` of the build inputs only (the paths
  `.vercelignore` keeps, the list `scripts/vercel-tree-gate.sh` computes) plus `test/parity/`, never `art/`,
  `progress/` or `docs/`. So a runner's `blob:none` checkout never fetches the 2.3 GB of `art/` and `progress/`
  blobs one by one, and an m5 export stays small. An export has no `.git`, so its build runs with
  `VERCEL_GIT_COMMIT_SHA=<sha>` set, which `vite.config.ts:16-17` reads before `git rev-parse`: its `version.json`
  and `boot.sha` name the SHA (C3-11).
- **Baselines come from the target SHA, harness code from HEAD (R2-31).** A run compares against the baselines,
  rename maps and plants in the target SHA's `test/parity/` (inside the export, or the runner's checkout of that SHA),
  while the harness code (`scripts/parity.mjs`, `scripts/parity/`, `scripts/gpu-gate/`, `scripts/types/`) runs from
  the lead's checkout or main's head (§8 "How", §11.1). So a proof runs on a SHA that holds the baselines it compares
  with: a recording's follow-up commit, never the recording SHA itself (R3-01; §9).
- **Lane-pending (R3-12; C3-1).** Between a reopened lane's content commit `C` and its follow-up baseline commit
  (`<slug> baselines for <sha7>`, §8 case 6), every SHA carries that shard's old baselines. `parity.mjs` derives this
  for the target SHA `X` from `X`'s `.github/lock.json` and its commit log: a slug in `reopened` is **`lane-pending`**
  on `X` when `git log <B>..X -- <the slug's allowlisted paths that the export carries>` (02 F0 step 5, without
  `art/` and `docs/`) lists a commit without the `E357-Lead: yes` trailer **that touches a path outside
  `test/parity/baselines/**`** (a baselines-only commit changes no runtime, so it never makes a shard lane-pending;
  R4-10), where `B` is the newest commit in `X`'s history that touches `test/parity/baselines/m5/<slug>.*` (or the
  `lock.json` commit that reopened the slug), whatever its message. Only the m5 lane derives it (`--lane=m5`, the
  lead's checkout with its full history): the runner treats no shard as lane-pending, since nothing is pushed while
  one is (below), and its `blob:none` checkout of one SHA has no history to derive it from (R4-10). The lane's own
  `--rebaseline=<slug>` run records that shard and so ignores the state for it. On a lane-pending shard every
  field is still compared and printed, but its verdict is `lane-pending` (yellow, like a pending board), never red;
  only its class D thresholds, which need no baseline, can turn it red. Every other run in that window (the lead's
  per-commit and pre-push runs, another lane's cross-shard proof) therefore shows that shard yellow, and the lead
  never reverts for it. **A red is attributed before anything is reverted:** a red that may come from a lane's window
  (a class D red on a lane-pending shard, or a red on another shard in the lane's own cross-shard proof) is re-run on
  the lane's parent commit, `--export=<C^> --shards=<that shard>`. Red there too, it predates `C`: the lane commits
  its baselines and tells the lead (`herdr agent prompt`), who finds the cause (§11.4's bisect by dispatch). Green
  there, it is `C`'s, and `C` is reverted. **Nothing is pushed while the newest local SHA has a lane-pending shard**
  (the lane's follow-up lands within its ≤ 25 min run, §10), so the runner never gates a lane-pending SHA.

- Default `--lane=m5`, `--shards` = every shard in the registry (today the 4; from Z1 also `_template`; `all` says
  the same explicitly), `--tiers=phone`, `--retry=1`.
- **The two commands the plan runs (R1-10; 12 §5).** Per commit: `node scripts/parity.mjs --export=<sha>
  --shards=<changed> --tiers=phone` against the lane's baselines (`<sha>` = that commit's, captured at commit time;
  `<changed>` = the shards whose folders the commit touches, or `all` for an engine / game / kit commit); a subagent
  runs it for its own shard only (one shard, phone ≤ 2.5 min, under AGENTS.md's 4-minute wait), and anything longer is
  "queued: <command>" for the lead. Before every push: `node scripts/parity.mjs --export=<the newest local sha>
  --shards=all --tiers=phone,desktop`.
- `--accept=<ids>` (R1-13, R2-18, R3-14): runs **only after Jake's OK** on boarded items at the milestone (§13.4
  step 3), and **last**: the milestone's fixes and reverts land first, and `--accept` runs on the newest SHA after
  them (`--export=<sha>`, whose build shows the OKed items as they ship). It records exactly the fields of those
  entries of the pending file (§8) into the m5 baselines, per tier, **with 3 runs** (`--runs=3` always, so each
  class B field gets its `spread` and each pose its `selfMin`, as `--record`), and removes the entries; every other
  field must still pass, or nothing is written.
- `--pending-fill=<ids>` (R2-18, R3-14): the run that writes a pending entry's `expect` (§8 "Pending boards"). With
  `--export=<sha>` of the change commit, it runs each entry's shard on m5 on both tiers, compares every other field
  as usual (all must be green), and writes each entry's `expect` as `{ "<tier>/<field path>": <value> }`. It also
  runs the commit's own per-commit check on phone for every other shard that check covers (`<changed>`, or `all` for
  an engine / game / kit commit), which must be green, so it fully replaces that commit's per-commit run; its
  `pending.json` lands in a follow-up commit naming the SHA. A field outside the entries that comes out red fails the
  fill (§8 step 2's rule).
- `--pending=<file>` (default `docs/plans/game-normalization/reviews/pending.json`, R1-13): the pending-board entries
  (§8). A missing file reads as `[]`. With `--export=<sha>` the default is read from the target SHA
  (`git show <sha>:docs/plans/game-normalization/reviews/pending.json`, because the export drops `docs/`), as the
  runner and `deploy-pin.mjs set` read it (C3-9).
- `--rebaseline=<slug>` (R1-12): the reopened lane's re-record of its own shard (§8 case 6): records `<slug>` on m5
  (phone + desktop, `--runs=3`) and in the same run compares every other shard, which must stay green (the
  cross-shard proof); it writes only `test/parity/baselines/m5/<slug>.*`.
- `--offline` (R1-47): the offline boot check (§11.1, §14) instead of the scripted run.
- `--record` runs everything `--runs` times (default 3) and writes the baseline files (§8) into
  `test/parity/baselines/<lane>/` of the checkout it runs from: on the runner, the job's own checkout, from which the
  job uploads them (§11.1; R2-33). Without it, one run is compared with the baseline (§7).
- `--plant=<id>` applies `test/parity/plants/<id>.patch` to the exported tree before the build (§9); needs `--export`.
- `--prove` runs the determinism proof (§9) and exits 0 only if it holds; it needs `--export` (it builds each plant).
  `--only=green` runs only its two green runs, and `--only=<plant id>` only that plant: the runner's prove matrix runs
  one job per part (§11.1; R2-32). Without `--only` (the m5 lane), it runs every part: the two green runs and every
  `patch` and `flag` plant (§9; R3-16). On a compare run,
  `--only=fingerprint+poses` or `--only=walk+combat+leak` runs half the steps, for a runner job split in two (§10).
- `--full` walks every leg of the shard's route and its trails (§4) instead of the 3 gate legs (nightly, F11, F12,
  milestones).
- `--ms` keeps the timing fields (§2.2 class C) in the report; they are always recorded, `--ms` prints them.
- `--angle=<backend>` is passed to Chromium as `--use-angle=<backend>` (default `metal`); only the `metal-off` plant
  (§9) sets anything else, to prove the Metal check (§11.2) fires.
- **Output** in `--out` (default `progress/parity/<sha7>/`, git-ignored since F2, 02 F2 step 7; R2-35):
  `<shard>.<tier>.json` (every field of §2, plus
  `verdict` per field), `<shard>.<tier>.<pose>.jpg`, a diff image per failed pose (`<pose>.diff.png`: SSIM map), and
  `report.md` (one table per shard × tier: field, baseline, now, band, verdict).
- **Exit codes:** `0` green, `1` red (a field outside its band, a threshold broken), `2` usage error, `3` infrastructure
  (the renderer is not Metal, the page never served, the browser crashed twice). The gate maps 3 to status `error`.
- **One browser at a time per shard × tier**, a fresh context per shard × tier, `--mute-audio`, `serviceWorkers:
  'block'` in the context plus `?sw=0` (no worker cache between runs), under `scripts/browser-lane.sh` on the Mac.
  Only `--offline` allows the worker (R1-47): a fresh context with `serviceWorkers: 'allow'` and no `sw=0` loads the
  title and waits until the worker is active and its precache is done; then `context.setOffline(true)`, a reload
  must reach the title, entering each requested shard (a page reload, served from the worker's cache) must reach
  play (the loading screen gone), and Explore must open. Any step that fails, or any page error, exits 1 naming the step.

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
| `state()` | F2 | the gameplay snapshot the pause → resume step compares (§5.6): `{ appState, clockNow, player: { pos, yaw, pitch, vel, health }, weapon: { id, state, ammo }, creatures: [{ id, kind, pos, hp, brain }] (sorted by id), quest }`; positions rounded to 1 mm. Plus `onResume(fn)`: a one-shot callback fired by `tap.resumed`, after every resume handler has run (after `hud.onResume`, `src/ui/HUD.ts:472`) and before the loop runs its next frame (02 F2 step 2; R2-13) |
| `saves` | F2 | `{ read, written }`, filled by the init script's `Storage` wrapper |
| `sounds()` | F2 | the sound-play log since the last call, as `{ event: { <sound id>: count }, ambient: <sound id>[] sorted }`, then cleared. Its one source for the whole plan is `tap.sound`, which every sound-play path calls (`Audio.ts`'s cue methods and private schedulers and the 9 modules that play sound outside it, 02 F2 step 2), and from S1.5 the `AudioService` too, with the same ids and kinds: a call with `kind: 'ambient'` (a timer-driven one-shot) goes into `ambient`, every other call into `event` (§2.3; R1-45, R2-26, R3-13) |
| `used()` | F2 | the labels `tap.use` received since the last call (the one use dispatch, `src/main.ts:1093`; 02 F2 step 2), then cleared: the touch leg's `used` read (§4; B3-10) |
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
| (sounds played) | — | the requests above cover boot only; the sound-play log of each scripted run is §2.3's `walk.sounds` / `combat.sounds` (R1-45) | — | — |
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
| `walk.sounds`, `combat.sounds` | the sound-play log of that scripted run, `{ event, ambient }` (§2.0): every sound played from the run's start to its end, read from the probe's `tap.sound` hook, which every sound-play path calls from F2 on, and the `AudioService` too from S1.5 with the ids and kinds of the paths it replaced (02 F2 step 2; R1-45, R2-26). The source never switches, so S1.5 and S3.5 compare against the same baseline. **Two kinds (R3-13; C3-2):** `event` (sounds a gameplay event starts) is a multiset `{ <sound id>: count }`; `ambient` (one-shots a timer starts: birds, larks, crickets, bubbles, crackle, far calls) is a set of **scheduler** ids, tapped at each scheduler's tick before its play condition (02 F2 step 2; R4-12), because how many fire depends on wall time and which play depends on the time of day and the player's position. Ids in `test/parity/ambient-info.json` (schedulers slower than the run) are printed, never compared. The baseline's `ambient` is the ids every recording run started; a run passes when it started each of them (an extra id is printed as information) | A: `event` by multiset equality, `ambient` by "no baseline id missing" (both after the rename map) | — |
| `combat.swing` | `{ weapon, target, hits, hitWithinS, killed, killWithinS }` or `'n/a'` (§5) | D: `hits ≥ 1` within the step's hit limit; `killed` within its kill limit when the table says kill; the limits' clock is §5.2's (R1-44) | — |
| `combat.shot`, `combat.shot2` | the same for the ranged steps (`shot2`: Pine Hollow's longbow, `'n/a'` elsewhere; §5.2, R1-34) | D (same rule) | — |
| `combat.hitsToKill` | per step | B | floor 1 hit (damage rolls use the seeded `Math.random`, but the number of draws before the swing depends on AI timing) |
| `combat.kills` | the kinds reported by `tap.kill` during both steps, in order | A | — |
| `combat.loot` | `{ written: string[] }`: the storage keys written in the 2 s after each kill | A (after the rename map) | — |
| `pauseResume` | `{ before, after, diff: string[], appStates }`: `probe.state()` while paused and at `tap.resumed` (§5.6); `diff` lists the paths that differ, `appState` left out; `appStates` = `[before.appState, after.appState]` (from F8) | D: `diff` must be `[]`; from F8, `appStates` must be `['paused', <the state before the pause>]` (R2-13) | — |

### 2.4 `leak` (from F8)

See §5.5 for the procedure. Every field is a count; **class D: after-unload must equal the baseline exactly** for the
level-owned kinds (what the level scope created, its systems included), with engine-retained resources subtracted
(§5.5 step 4; R1-28, R2-15).

| Field | How |
|---|---|
| `geometries`, `textures` | `renderer.info.memory` |
| `programs` | `renderer.info.programs.length` |
| `bodies`, `colliders` | Rapier `world.bodies.len()`, `world.colliders.len()` |
| `listeners` | `{ window, document, canvas, other }`: the init script wraps `EventTarget.prototype.addEventListener / removeEventListener` and keeps a net count per target kind (a listener added with `{ once: true }` counts until it fires; a listener with an `AbortSignal` is subtracted on abort) |
| `timers` | `{ timeouts, intervals, raf }`: the init script wraps `setTimeout / clearTimeout / setInterval / clearInterval / requestAnimationFrame / cancelAnimationFrame` and counts pending ids (a timeout that fired is not pending) |
| `audio` | `app.audio.census()`: live voices, beds and buses (F8 adds `census()` to today's `Audio.ts`: `activeVoices`, playing beds, connected buses; from S3.5 the `AudioService` registry answers the same call, 01 §15) |
| `systems` | the level scope's system count per phase (0 after unload); the engine scope's systems are engine-retained and not counted (02 F8 step 2; R2-15) |
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
(`budgets/calibration.json`, which S1.6's `calibrate.mjs` writes from its M5 run × the measured phone : M5 ratio,
E283's hot ~10×, decision 99; before S1.6 lands, `budgets/provisional.json` holding budget-design §6's P numbers). `ceiling` is the ratchet from `lint/ratchet.json` `"budgets"` (`"<shard>.<tier>.<pose>.<metric>":
n`) for a shard already over its derived number (budget-design §7: its worst today, may only go down).

| Check | Against | Class |
|---|---|---|
| each pose's `calls` | `≤ ceiling.draws ?? derived.draws` | D |
| each pose's `tris` | `≤ ceiling.tris ?? derived.tris` | D |
| `boot.render.programs` | `≤ ceiling.programs ?? derived.programs` | D |
| `boot.gpuBytes.total` | `≤ (ceiling.gpuMB ?? derived.gpuMB) × 2²⁰` | D |

Before S1.6 `probe.budgets()` does not exist and the harness prints `budgets: not derived yet (S1.6)` and checks
nothing. **A shard without derived budgets is never red for that alone (R1-14).** S1.6 writes, for every shard whose
budgets aren't derived yet, its F2-baseline numbers as ceilings into `lint/ratchet.json` `"budgets"` (per pose and
metric, the higher of the two lanes' baseline value plus its band), so its `derived` is `null` and the checks above
read `ceiling`. Each shard gets derived budgets at its own milestone row, which drops those ceilings unless the shard
is over its derived number (then its worst today stays as the ceiling, budget-design §7): Nine Dragon S1.6, Pine
Hollow S2.6, Nalati S3.5, Driftwood S4.4. Download bytes and CPU ms
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

**The touch leg (phone tier only; R1-46).** After the gate legs, from the spawn, the harness drives the touch controls
through real `pointerType: 'touch'` input, never held keys: (1) it drags the move pad (the left stick) straight up for
2 s: the feet move ≥ 2 m; (2) it drags 120 px across the look area: the yaw changes; (3) it taps DODGE: the player's
dodge starts (the dodge cooldown goes above 0); (4) it teleports next to the shard's nearest interactable to the spawn
(`'n/a'` on a shard with none) and taps USE: the interaction fires. The record `walk.touch` = `{ moved, yawDelta,
dodged, used }` is class D (`moved ≥ 2`, `yawDelta ≠ 0`, `dodged`, and `used` unless `'n/a'`). Its two reads, from
verified source lines (B3-10; R2-F5): `dodged` = `player.dodgeCooldown > 0` right after the tap (the getter at
`src/player/Player.ts:212`, which the DODGE disc's sweep reads); `used` = `probe.used()` holds the interactable's
label after the tap (`tap.use` at the one use dispatch, `src/main.ts:1093`, which the USE disc reaches through its
`KeyE`, `src/player/TouchControls.ts:398`; 02 F2 step 2). The disc selectors are read from
`src/player/TouchControls.ts` into `scripts/parity/walk.mjs` as constants.

**`--full`** walks every leg, then every trail (`physics-baseline.mjs --trails`: each path of `TRAILS` end to end, both
ways, a waypoint every 3 m). It runs nightly (§14), for F11's and F12's done-when, and before each milestone. The
baselines hold the gate legs only (02 F2 step 7), so for the other legs and the trails `--full` checks the class D
fields (`stuck`, `out`) and reports `end` / `maxY` as information (R1-43).

## 5. Combat, loot and the leak test

### 5.1 How the harness attacks

- `probe.combat.equip(id)` selects the weapon (`weapons.select(id, true)`); `nolock` in the URL unlocks locked weapons
  (Pine Hollow's longbow). It throws when the shard's loadout has no weapon with that id, so a wrong step table fails
  at once, naming the id (R1-34). `probe.combat.target(kind, near)` returns the nearest live animal of that kind to
  the point `near` (the herds are placed from the manifest's seed, so the target is the same animal every run) and
  sets `harnessHold = true` on it so it neither flees nor charges (02 F2 step 2).
- The harness teleports the player to the stand-off distance on the line from the target to the player's current
  position, faces the target's bounding-sphere centre (yaw and pitch), then **attacks through real input**: on the
  phone tier a `pointerdown` then `pointerup` with `pointerType: 'touch'` on `.ws-touch-attack` (the ATTACK disc,
  `src/player/TouchControls.ts:163`; touch-down fires `weapons.tryFire()`); on the desktop tier `page.mouse.down()` /
  `up()` on the canvas centre. Presses repeat every 600 ms (melee) or on reload-ready (ranged: the probe exposes
  `weapons.current.state`) until the step's limit. The move pad, look drag, DODGE and USE are driven by the touch leg
  (§4; R1-46).
- Hits and kills are observed through `tap.hit` / `tap.kill` (02 F2 step 2), which the probe connects only when
  `window.__wildshardHarness` exists (§6).

### 5.2 The steps per shard

| Shard | Step | Weapon | Target | Stand-off | Pass (class D) |
|---|---|---|---|---|---|
| `driftwood-isle` | swing | wooden sword (`sword`, the base) | the practice crab (E308, spawned at `PRACTICE_CRAB` = (−7, −143), `src/chunks/driftwood-isle.ts:84`) | 1.8 m | ≥ 1 hit within 3 s; killed within 15 s |
| | shot | — Driftwood's loadout has no ranged weapon (no rifle on the sword shards, E333; R1-34) | — | — | recorded as `'n/a'` |
| `pine-hollow` | swing | — Pine Hollow's loadout has no melee weapon (crossbow, lever rifle, longbow) | — | — | recorded as `'n/a'` |
| | shot | crossbow (the base) | the nearest `boar` to (0, −200) | 12 m | killed within 20 s |
| | shot2 | Warden's longbow (`bow`, unlocked by `nolock`; R1-34) | the nearest other `boar` to (0, −200) | 12 m | killed within 20 s |
| `nalati-grasslands` | swing | sabre (`sabre`) | the nearest `wolf` to the spawn (0, 232) | 1.8 m | ≥ 1 hit within 3 s; killed within 15 s |
| | shot | bow (`bow`) | the nearest other `wolf` to the spawn | 12 m | killed within 20 s |
| `nine-dragon-stack` | swing | the jian (the base sword) | training dummy 1 in the practice arena (`probe.arena()` = `hud.enterArenaNow()`; the shard has no creatures) | 1.8 m | ≥ 1 hit within 3 s (dummies do not die) |
| | shot | — the Neon Jian is Nine Dragon's whole kit (no rifle, E314 A; R1-34) | — | — | recorded as `'n/a'` |
| `_template` (Z1) | swing, shot | Z1's kit weapon and custom weapon | Z1's creature | Z1's spec | killed |

**The clock of the limits (R1-44).** From F8 on, every limit above is in game-clock seconds (the capture clock, §6:
fixed steps × step length), so a slow runner changes nothing. Before F8 there is no game clock: the limits are wall
seconds, doubled on the `gh-macos15` lane (the M1 VM runs ≈ 2× slower than the M5, §10).

### 5.3 Loot

Loot differs per shard today (Driftwood's coins and bounty, Pine Hollow's compendium, progress counters elsewhere), so
the harness checks it the shard-agnostic way: `combat.loot.written` = the storage keys written in the 2 s after each
kill, which must equal the baseline (class A, renames applied). On today's tree that is Driftwood `ws.purse.v1`,
`ws.bounty.v1` and whatever else the kill chain saves; the baseline records the actual list. Nine Dragon has no kill,
so no loot. A context starts with empty storage (a fresh context per shard × tier), so "each enemy pays once" pays.

### 5.4 Order inside one shard × tier run

boot fingerprint → poses → walk (the gate legs, then the phone tier's touch leg) → combat (swing, then shot, then
shot2) → pause → resume (§5.6) → leak test (from F8). The leak
test is last so it unloads a world that has run every other step (projectiles, particles, sounds, the arena, the pause
menu).

### 5.5 The leak test (from F8; 01 §4, decision 60)

1. **Baseline B0** (R1-28; 01 §4). The engine records `census()` (§2.4's fields) when it has booted to `title` (02 F8
   step 6: the renderer, physics world, sky rig, UI shell, audio context and input exist, and no shard resource does
   yet; under `?skipintro=1` at that same point) into `app.debug.leakBaseline`. Engine-retained resources are in B0.
2. The shard loads and every other harness step runs.
3. `await probe.leak()`: sets the app state to `loading`, calls `app.unloadLevel()` (the shard scope's `dispose()`,
   which releases only what the shard created and never the engine's services, 02 F8 step 6; then
   `emit('level.unloaded')`), waits two animation frames, and takes **B1** = `census()`.
4. **Pass:** for the level-owned kinds, B1 equals B0 (R2-15: the level scope's systems are 0 again). Engine-retained resources aren't counted: `census()` subtracts
   `app.assets.retained()`, the per-kind count (geometries, textures, programs, audio nodes) of what the engine still
   holds that it created or acquired after B0 (the sky rig, the composer's targets, acquired kit / engine assets it
   keeps cached), so B0 and B1 compare only what a shard can leak. **Red** lists each differing field with B0, B1 and,
   for listeners and timers, the first 5 registration stack traces the init script kept for entries still alive.
5. **With weather (R1-48).** Nalati and Pine Hollow run the leak test a second time per tier, in a fresh context with
   their weather active: Nalati with `?weather=storm` (the `harness` allowlist's `weather` param, which forces a storm
   phase, `src/nalati/weather.ts:211`), Pine Hollow with the setting `weather: 'rain'` through `debugSettings`. That
   run is boot → 30 s at the spawn → leak test, so the rain, lightning and storm resources are unloaded under test.
6. The page is closed after the leak test (the next shard × tier gets a fresh context), so a failed unload never
   pollutes another run.

### 5.6 Pause → resume → state identical (FINISH-LINE S1; 13-lead-resolutions G19)

FINISH-LINE S1's golden path included a pause and a resume; it joins the scripted run here, on both lanes and both
tiers, from F2.
1. After the shot step, the harness pauses through real input: on the phone tier a touch tap on the PAUSE disc, on the
   desktop tier `page.keyboard.press('Escape')`. It waits until the pause menu is shown (today `#menu` visible; from
   X2 the `menu` layer on top) and, from F8, `app.state === 'paused'`.
2. `before = probe.state()` (§2.0), taken while paused.
3. It waits 2 s of wall time with the menu open. Nothing may move: today the frame gate (`src/main.ts:1067`) runs no
   frame while the menu is up, and from F8 the game clock excludes paused time (01 §2).
4. It arms `probe.onResume(fn)`, then taps or clicks the menu's RESUME button. The callback fires on `tap.resumed`
   (R2-13): at the end of HUD's menu-close wrapper (`src/ui/HUD.ts:472`), after `Menu.close()` has cleared the menu
   and after `hud.onResume` (= `enter`, `src/main.ts:1014`) has run, so every resume handler has run and the loop has
   not run its next frame (02 F2 step 2). `after = probe.state()` is taken there.
5. `pauseResume.diff` lists every path where `after` differs from `before` (exact, after the 1 mm rounding), with
   `appState` left out: a correct resume changes it from `paused` back to the state before the pause, so it is
   checked on its own (from F8, `appStates` = `['paused', 'play']`, or `['paused', 'practice']` in Nine Dragon's arena;
   R2-13). `clockNow` stays in the diff: the game clock doesn't move across a pause. Pass (class D): the diff is
   empty and `appStates` holds. A red report prints each differing path with both values.
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
  runnerImage }`. Each `<shard>.<tier>.json` also carries its own `harness`, `sha` and `recorded`, so re-recording one
  shard (cases 1, 5, 6) never touches `meta.json`. `/test/parity` is in `.vercelignore` (02 F2 step 7).
- **How (R1-19, R2-31).** The harness code always runs from HEAD's tree (the lead's checkout; on the runner, main's
  head, §11.1) against a build of the target SHA, and it compares with the target SHA's own baselines and rename maps
  (its `test/parity/`; §1). Only SHAs from F2 on, which have the probe, can be baselined. On the Mac:
  `node scripts/parity.mjs --record --runs=3 --lane=m5 --tiers=phone,desktop --export=<sha>`. On the runner:
  `gh workflow run gpu-gate -f sha=<sha> -f record=true`; each matrix job uploads its own artifact
  `parity-baselines-gh-macos15-<slug>` (R1-18) holding exactly that shard's `test/parity/baselines/gh-macos15/<slug>.*`
  files (R2-33); `gh run download <run> -p 'parity-baselines-gh-macos15-*' -D <tmp>` puts each in its own folder, and
  their files are merged into `test/parity/baselines/gh-macos15/` (every shard's artifact must be there). A shard with
  no baselines on the runner gets them from its first gate run instead (a bootstrap record, §11.1; R1-11), and that
  artifact is committed the same way. A field a lane's baseline doesn't have yet is reported `new`, never red, until
  that lane re-records. The baseline commit touches only `test/parity/baselines/**` (and `scripts/parity/**` for a
  harness version bump, `reviews/pending.json` for case 1 and the pending fill), with a pathspec commit whose message
  says which rule below allowed it and **names the SHA the baselines were recorded on**. It is always its own
  follow-up commit, never an amend (R2-25; §1).
- **Pending boards (R1-13, R2-18, R3-14).** A visible change that waits for Jake's board has a state:
  `docs/plans/game-normalization/reviews/pending.json`, `[{ "id", "row", "wave", "shard", "fields": [<field paths>],
  "expect": null | { "<tier>/<field path>": <m5 value> }, "notes"?: ["<sha7>: <one line>"] }]`. The flow:
  1. **The change commit** adds its entries with `"expect": null`, and its message names each entry's fields
     (`pending <id>: <field paths>`). A pending field with no `expect` is reported `pending` without being compared:
     yellow, allowed, never red.
  2. **The fill.** Instead of that commit's plain per-commit run, the lead runs `node scripts/parity.mjs
     --pending-fill=<ids> --export=<its sha>` (§1): both tiers on m5 for the entries' shards, the commit's own
     per-commit check on phone for every other shard it covers (all green), and each entry's `expect` written per tier
     from the run's "now" values. `pending.json` lands in a follow-up commit naming the SHA (R2-25), before the push.
     **A newly red field joins `fields` only if its change commit names it** (the message's `pending <id>:` list;
     the fill then adds it to the entry); otherwise it is red, and the change is reverted (12 §5).
  3. **After the fill**, the m5 lane compares a pending field with its tier's `expect` instead of the baseline, within
     the field's own band (§2: exact for class A, the baseline's band for class B): inside it, the verdict is
     `pending` (yellow in `report.md` and the status descriptions, allowed); **off its `expect` beyond the band, it is
     red** (R3-14). The runner, which has no `expect` value, reports the field `pending` without comparing it.
  4. **A later commit that changes an already-pending field** (a second item on the same field, a case-4 bug fix
     whose effect lands on it, a fix Jake asked for on the board) names the entry in its message and refills that
     entry's `expect` with `--pending-fill=<id> --export=<its sha>` as its per-commit run; the refilled `pending.json`
     lands in its own follow-up commit, and the entry gains a note (`"<sha7>: <why>"`), so the board shows the field
     as it will ship. A case-4 fix records its other fields in the baseline as usual (case 4); a field it shares with
     an entry follows this step.
  5. **At the milestone,** the reverts of the items Jake said no to (each removes its entries in the revert commit)
     and the fixes he asked for (each refilled, step 4) land first. **A fix Jake asked for goes back to him (R4-13):**
     after its refill lands, the lead sends the fixed item's clip or page with AskUserQuestion; its entry is settled
     only by his OK (then accepted) or a revert. **A reverted entry that carries a case-4 refill note** (step 4)
     leaves that bug fix's effect on the field unrecorded: the revert's follow-up commit re-records that field under
     case 4 on the revert's SHA (R4-13). Then, once every entry is OKed or reverted, only for his OKs and **last**,
     `node scripts/parity.mjs --accept=<ids> --export=<the newest sha>` records those fields per tier with 3 runs and
     removes the entries (case 1; §1), so no accepted baseline carries the effect of a reverted item.
  6. **Memory entries (R4-14; A4-1, B4-9, C4-8).** An entry whose `fields` are `memory.<shard>.<phase>` (§14.1) is
     owned by the nightly, not by parity: `--pending-fill` leaves its `expect` null and `--accept` records nothing for
     it (no parity field exists), only removing the entry. Only the lead commits it (a lane can't commit
     `pending.json`, 02 F0 step 5).
  `deploy-pin.mjs set` refuses while the target SHA's file has any entry (§13.2), so every entry is settled before the
  pin moves.
- **Who may re-record, and when — the only six cases:**
  1. **A boarded change** (R1-13). Jake OKed a visible change on a wave board (weapons, creatures, input / HUD, audio,
     look; GAME-NORMALIZATION §5). Only after Jake's OK, and last, after the milestone's reverts and fixes (R3-14),
     `node scripts/parity.mjs --accept=<ids> --export=<sha>` (the newest SHA, whose build shows the OKed items)
     re-records exactly the fields of those pending entries on m5, per tier, with 3 runs, and removes the entries
     (R2-18); the runner's files for those shards are deleted in the same accept commit
     and come back from the next gate run's bootstrap record. The accept commit names the board, Jake's pick and the
     SHA. Other fields must still pass unchanged.
  2. **A harness version bump** (a new field, a new pin such as capture mode, a changed band rule; R1-19). Its commit's
     only `src/` change is the probe. First the old harness (the parent's `scripts/parity*`) is run on the parent and
     must be green. Then the new harness, run on a build of the commit itself, must compare every existing field green
     against the old baselines; its new fields are then recorded on that commit's SHA and land in the follow-up
     baseline commit naming it (`meta.json` `harness` + 1; R2-25). The runner lane follows with a `record` dispatch on
     that SHA.
  3. **A runner image or Chromium bump** (`macos-15` image version, the Playwright lockfile). Re-record the affected
     lane only, on the last gpu-green SHA, in a commit that touches only that lane's baselines.
  4. **A found bug fixed inline** (decision 4) whose fix changes a recorded field. The fix commit carries its test; the
     fields the fix changes, and only those, are re-recorded on its SHA in the follow-up baseline commit (R2-25); the
     messages name the bug (GAME-NORMALIZATION §7 list or a new entry there).
  5. **A dependency upgrade Jake decided** (F12's Rapier 0.21, decision 89; R1-52). With 0 stuck everywhere, a walk
     `end` / `maxY` beyond its band is inspected by the lead (the trails too, `--full`): a pure numeric drift is
     re-recorded with a note naming the legs; a new stuck waypoint or a fall (a leg ending lower than its baseline by
     more than the band, or an `out` frame) reverts the upgrade.
  6. **A reopened shard's own content** (R1-12, R2-25). From the milestone that reopens a shard, its lane owns that
     shard's baselines. After a content commit touching only that shard's allowlist (02 F0 step 5), with its SHA
     captured at commit time, the lane runs `node scripts/parity.mjs --rebaseline=<slug> --export=<sha>`. The same
     run compares every other shard, which must stay identical (the cross-shard proof). Its new `m5/<slug>.*` files,
     and the deletion of its `gh-macos15/<slug>.*` files (so the push's gate run bootstrap-records them), land in a
     follow-up pathspec commit, `<slug> baselines for <sha7>`, which lists the fields that changed. Never an amend:
     the lead may have committed in between. Both commits go up in one `scripts/push-main.sh`, and the lane commits
     the bootstrap artifact next, as `<slug> gh-macos15 baselines for <sha7>` (baselines only, so it never makes the
     shard lane-pending again; R4-10). **Until the follow-up lands, the shard is `lane-pending` (R3-12; §1):** every other
     run shows it yellow, not red, and nothing is pushed. A red on another shard in the lane's cross-shard proof is
     re-run on `C^` before the lane reverts anything: red there too, the regression isn't the lane's (§1).
  Anything else that changes the fingerprint is a regression and is reverted.
- The lead re-records cases 1–5 (decision 33); a reopened shard's lane re-records only its own shard, under case 6.
  The lead's engine, game and kit commits keep every shard identical except boarded items (R1-12). After the plan
  (§16) the rule changes.

## 9. Determinism proof

`node scripts/parity.mjs --prove --lane=<lane> --export=<sha>` (and `gh workflow run gpu-gate -f sha=<sha> -f prove=true`
on the runner, which splits it into one job per shard for step 1 and one job per plant for step 2, §11.1; R2-32).
`<sha>` holds the baselines the proof compares with: after a recording, that is the follow-up baseline commit (its
runtime is the recorded SHA's), never the recording SHA (R3-01; 02 F2 step 8, F3.2 step 6). Before it runs, the proof
asserts that every shard × tier it compares has a baseline at `<sha>`; a missing one exits 1, so fields reported `new`
can never pass as a proof.
1. Two compare runs on the unchanged SHA: both green.
2. Each `patch` and `flag` plant of `test/parity/plants/index.json` (R3-16) on the same SHA: a `patch` plant applied
   (`git apply <patch>`), built and run, a `flag` plant run with its launch argument: each red, and among its red
   fields every field in the plant's `expect` list (`metal-off`: exit 3, status `error`). A plant that comes out
   green means a band is too wide or a field is missing: the harness is fixed before the row that introduced the
   plant is done. The `nightly` plant is proven by `scripts/gpu-perf/nightly.sh --plant=<id>` (§14) and the `linux`
   plant by `gh workflow run gpu-gate -f plant=<id>` (the `asset-case` job, §11.6), as 02 F3.2's done-when does;
   neither is in the prove matrix.

**`test/parity/plants/index.json`** (R3-16; C3-7) is `[{ "id", "kind": "patch" | "flag" | "nightly" | "linux",
"shards": [<slug>…] | "all", "patch"?: "<id>.patch", "flag"?: "<launch argument>", "expect": [<field paths>] |
"exit3" }]`, one entry per row of the table below: `patch` names the patch file of a `patch`, `nightly` or `linux`
plant; `flag` is a `flag` plant's launch argument (`metal-off`: `--angle=swiftshader`); `expect` is the table's
expected red fields (`metal-off`: `"exit3"`). `metal-off` is a `flag` plant, `soak-leak` is `nightly`, `asset-case`
is `linux`, and every other plant is a `patch`.

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
| `pause-drift` | the resume path no longer gives back the player's state at the pause, which a correct build has restored before `tap.resumed` fires: the resume handler (`hud.onResume` = `enter`, `src/main.ts:1014`) first sets `player.velocity` to (0, 2, 0) m/s. `tap.resumed` fires after that handler (§5.6 step 4), so the snapshot sees the write and the diff shows `player.vel`; the frame gate (`src/main.ts:1067`) is untouched (R1-42, R2-13) | driftwood-isle, pine-hollow, nalati-grasslands | `pauseResume` (`player.vel`) | F2 |
| `metal-off` | Chromium launched with `--use-angle=swiftshader` (a `flag` plant: its launch argument, no patch; the gate's `angle` input does the same) | all | exit 3, status `error` | F3.2 |
| `asset-case` | (a `linux` plant) one boot-declared asset URL's case changed (`/assets/music/…` → `/assets/Music/…` in Driftwood's declared audio list); the file on disk unchanged | — (the `asset-case` job) | the job fails naming the URL (§11.6) | F3.2 |
| `soak-leak` | (a `nightly` plant) one 1 MiB `DataTexture` uploaded every 10 s and never disposed (a system added in the shard's scope) | all (nightly soak only) | the soak's `gpuBytes` growth (§14.2) | F3.2 |
| `leak-geometry` | the shard scope skips disposing one geometry on unload | all | `leak.geometries` | F8 |
| `render-throw` | Nine Dragon's `render` thunk throws | nine-dragon-stack | `boot.errors` (the error screen, 02 F9) | F9 |
| `budget-over` | 200 extra draws at Nine Dragon's `spawn-rail` pose | nine-dragon-stack | `budgets` | S1.6 |

Paths in the table are today's; after F6 the patch files are regenerated against the moved paths in the F6 commit
(`move.mjs` rewrites the `diff --git a/… b/…` headers with the move map) and re-proved. The proof runs at the end of
F2 (m5), of F3.2 (runner), and again after F6, F8, F9 and S1.6 (each adds its plant).

## 10. Runtime budget

| Run | Budget | How it holds |
|---|---|---|
| The lead's per-commit run: m5, phone, the changed shards (all 4 for an engine / game / kit commit; 5 from Z1) | ≤ 6 min wall | 2 shards in parallel (2 browser-lane slots), each ≤ 2.5 min: boot ≈ 11 s (TP audit §6), fingerprint 2 s, 3 poses × (3 s settle + 5 s sample) = 24 s, 3 gate legs ≈ 45 s, combat ≤ 40 s, pause → resume ≈ 5 s, leak 5 s (plus ≈ 40 s for Nalati's and Pine's weather leak run, §5.5), build ≈ 15 s once |
| `pnpm test` on the Mac, with `bake-check`'s GPU part (02 F1 step 7: a `vite build`, a preview and the cards / textures bakes in a browser-lane slot) | measured at F1 and written here (02 F1 done-when; C4-14) | every commit runs it before the parity run (12 §5); if it is over 4 min, a subagent reports "queued: pnpm test" for the lead as AGENTS.md says |
| A subagent's per-commit run: m5, phone, its one shard (R1-10) | ≤ 2.5 min | under AGENTS.md's 4-minute wait; anything longer is "queued: <command>" for the lead |
| The lead's pre-push run: m5, phone + desktop, all shards (R1-10) | ≤ 12 min wall | the per-commit run × 2 tiers |
| The lead's pre-milestone run: m5, phone + desktop, `--full` | ≤ 45 min | full routes and trails dominate; runs once per milestone and nightly |
| Recording (3 runs) | ≤ 3× the matching compare run | only on the six re-record cases |
| One compare job on `macos-15` | ≤ 12 min (timeout 20; R2-32) | setup ≈ 4 min (sparse checkout with `public/`, pnpm install from cache, Playwright Chromium from cache, `vite build`), harness for one shard ≈ 2× the M5's 2.5 min. Unmeasured until the F3.2 probe run (ci-gpu-options: "the 3.5 min M5 budget could become 8–12 min"); if a shard's compare job exceeds 12 min, `matrix.mjs` emits two compare entries for it, `part: 'fingerprint+poses'` and `part: 'walk+combat+leak'`, which the parity step passes as `--only=<part>` (§1, §11.1). The split shards are a `SPLIT` constant in `matrix.mjs`, set from the F3.2 probe run; a record or bootstrap entry is never split, since two jobs would upload one artifact name (R1-18; B3-17) |
| One record, bootstrap or prove job on `macos-15` (R2-32) | ≤ 45 min (timeout 60) | record and bootstrap: setup ≈ 4 min plus 3 recording runs of one shard (≈ 3 × 5 min, plus ≈ 1.5 min per run for Nalati's and Pine's weather leak run from F8) ≈ 23 min; prove: one job per part, either the two green runs (≈ 2 × 5 min) or one plant (patch, build ≈ 1 min, one run ≈ 5 min), so no job runs more than one plant |
| A reopened lane's `--rebaseline=<slug>`: m5, its shard × 3 runs × phone + desktop, then a compare of every other shard (§8 case 6) | ≤ 25 min | ≈ 3 × 2 × 2.5 min plus the pre-push compare of the others; over AGENTS.md's 4-minute wait, so a subagent never runs it: it is "queued: <command>" for the lead or a main session (B2-21) |
| The whole gate (matrix of 4, then 5) | ≤ 15 min wall | jobs in parallel (5 macOS jobs at once on the Free plan) |
| The `asset-case` job on `ubuntu-latest` | ≤ 5 min (timeout 10) | install from cache ≈ 1.5 min, `vite build` ≈ 1 min, the check < 30 s (§11.6) |
| Nightly `gpu-perf` | ≤ 4 h, 04:00 → 08:00 (`--max 240` for the whole nightly; R1-43) | each step its own lane call with its own `--max`: the parity `--full` run and the offline check ≤ 90 min; the GPU rulers + scorecard ≤ 30 min; the Simulator memory run ≤ 30 min (§14.1); the soak 4 × (20 min + boot) ≈ 90 min (§14.2) |

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
      offline: { description: Also run the offline boot check (a milestone candidate; R1-47), type: boolean, default: false }
concurrency:
  # push runs: one running + one pending; a burst of pushes gates the newest (ci-gpu-options §6).
  # dispatches (plant / record / prove / a re-gate) get their own group, so they never replace a push run (R1-41)
  group: ${{ github.event_name == 'push' && 'gpu-gate-main' || format('gpu-gate-dispatch-{0}-{1}-{2}-{3}', inputs.sha, inputs.plant, inputs.record, inputs.prove) }}
  cancel-in-progress: false
permissions:
  contents: read
  statuses: write
jobs:
  setup:                         # the job list comes from the target SHA's registry at CI time, never a hand list (R1-11),
    runs-on: ubuntu-latest       # one entry per job with its mode, so each job's timeout fits its mode (R2-32)
    outputs:
      jobs: ${{ steps.list.outputs.jobs }}
    steps:
      - uses: actions/checkout@v4          # main's head: the harness code (R2-31)
        with: { sparse-checkout: scripts/gpu-gate, sparse-checkout-cone-mode: true, filter: 'blob:none' }
      - id: list                 # [{ shard, mode, part }], read from the target SHA's tree with git ls-tree / cat-file
        env:
          SHA: ${{ inputs.sha || github.sha }}
          MODE: ${{ inputs.prove && 'prove' || (inputs.record && 'record' || 'compare') }}
        run: |
          git fetch --no-tags --filter=blob:none origin "$SHA"
          echo "jobs=$(node scripts/gpu-gate/matrix.mjs "$SHA" "$MODE")" >> "$GITHUB_OUTPUT"
  shard:
    needs: [setup]
    strategy:
      fail-fast: false
      matrix:
        include: ${{ fromJSON(needs.setup.outputs.jobs) }}
    runs-on: macos-15            # pinned label, never macos-latest
    timeout-minutes: ${{ matrix.mode == 'compare' && 20 || 60 }}   # by mode (R2-32, §11.5)
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
      - name: Harness code from main's head; test/parity (baselines, rename maps, plants) stays the target SHA's (R1-19, R2-31)
        if: inputs.sha != ''
        run: |
          git fetch --no-tags --filter=blob:none origin ${{ github.sha }}
          git checkout ${{ github.sha }} -- scripts/parity.mjs scripts/parity scripts/gpu-gate scripts/types
      - name: Pending boards of the target SHA (R1-13; docs/ is outside the sparse checkout)
        run: git show "$SHA:docs/plans/game-normalization/reviews/pending.json" > pending.json 2>/dev/null || echo '[]' > pending.json
      - name: Apply plant
        if: inputs.plant != ''
        run: git apply "test/parity/plants/${{ inputs.plant }}.patch"
      - run: pnpm exec vite build
        if: matrix.mode != 'prove'                         # prove builds each part from its own export
      - name: Serve the build
        if: matrix.mode != 'prove'
        run: |
          pnpm exec vite preview --host 127.0.0.1 --port 4400 --strictPort > preview.log 2>&1 &
          for i in $(seq 1 60); do curl -fsS http://127.0.0.1:4400/version.json && break; sleep 1; done
      - name: Parity (${{ matrix.shard }}, phone, ${{ matrix.mode }} ${{ matrix.part }})   # exactly one mode per job (R1-35)
        run: |
          common="--lane=gh-macos15 --shards=${{ matrix.shard }} --tiers=phone --angle=${{ inputs.angle || 'metal' }} --out=parity-out"
          case "${{ matrix.mode }}" in
            prove)            node scripts/parity.mjs --prove --only=${{ matrix.part }} --export="$SHA" $common ;;   # one part per job (R2-32)
            record|bootstrap) node scripts/parity.mjs --url=http://127.0.0.1:4400 --record --runs=3 $common ;;   # writes test/parity/baselines/gh-macos15/<slug>.* (R2-33)
            compare)          node scripts/parity.mjs --url=http://127.0.0.1:4400 --retry=1 --pending=pending.json ${{ matrix.part && format('--only={0}', matrix.part) || '' }} $common ;;
          esac
      - name: Offline boot (a milestone candidate; R1-47)   # compare and bootstrap: both post a status (R3-10)
        if: inputs.offline && (matrix.mode == 'compare' || matrix.mode == 'bootstrap')
        run: node scripts/parity.mjs --offline --url=http://127.0.0.1:4400 --lane=gh-macos15 --shards=${{ matrix.shard }} --tiers=phone --out=parity-out/offline
      - name: Facade instancing (E271, Nine Dragon only)   # every job that posts a status runs it (R3-10)
        if: matrix.shard == 'nine-dragon-stack' && (matrix.mode == 'compare' || matrix.mode == 'bootstrap')
        run: node scripts/test-facade-instancing.mjs --url=http://127.0.0.1:4400
      - name: Per-shard status   # compare and bootstrap only; never from a record, prove or plant dispatch (R1-35)
        if: always() && (matrix.mode == 'compare' || matrix.mode == 'bootstrap') && inputs.plant == ''
        env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs shard "$SHA" "${{ matrix.shard }}" "${{ job.status }}" parity-out ${{ matrix.mode }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:   # one name per job: upload-artifact@v4 refuses two jobs writing one artifact (R1-18)
          name: ${{ (matrix.mode == 'record' || matrix.mode == 'bootstrap') && format('parity-baselines-gh-macos15-{0}', matrix.shard) || (matrix.mode == 'prove' && format('parity-prove-{0}-{1}', matrix.shard, matrix.part) || format('parity-{0}{1}', matrix.shard, matrix.part && format('-{0}', matrix.part) || '')) }}
          # record and bootstrap upload the baseline files themselves, never the parity-out report (R2-33)
          path: ${{ (matrix.mode == 'record' || matrix.mode == 'bootstrap') && format('test/parity/baselines/gh-macos15/{0}.*', matrix.shard) || 'parity-out' }}
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
        if: always() && !inputs.prove && inputs.plant == ''
        env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs shard "$SHA" asset-case "${{ job.status }}" asset-case.json
  gate:
    needs: [shard, asset-case]
    if: always() && !inputs.record && !inputs.prove && inputs.plant == ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { sparse-checkout: scripts/gpu-gate, sparse-checkout-cone-mode: true }
      - env: { GH_TOKEN: '${{ github.token }}' }
        run: node scripts/gpu-gate/status.mjs gate "${{ inputs.sha || github.sha }}" "${{ needs.shard.result }},${{ needs.asset-case.result }}" "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

**The job list (R2-32).** `scripts/gpu-gate/matrix.mjs <sha> <mode>` (main's head) reads the target SHA's tree
without checking it out (`git ls-tree`, `git cat-file -e`, `git show`) and prints `[{ shard, mode, part }]`:
- the shards are the folders of `src/shards/` with a `manifest.ts` (as `gen-shards.mjs` lists them, `_template`
  from Z1; before F6 the four slugs);
- `compare`: one job per shard (two for a shard in the `SPLIT` set, §10), whose mode becomes `bootstrap` when the
  SHA has no `test/parity/baselines/gh-macos15/<shard>.phone.json` (R1-11); a bootstrap is always one job per shard,
  split or not (B3-17);
- `record`: one `record` job per shard;
- `prove`: per shard one job with `part: 'green'` (§9 step 1), plus one job per plant of the SHA's
  `test/parity/plants/index.json` whose `kind` is `patch` or `flag` and whose `shards` names that shard (or is
  `"all"`; §9 step 2; R3-16), so no job runs more than one plant. A `nightly` or `linux` plant is never a prove job.

The parity step runs exactly one mode per job (R1-35), and the job's timeout follows its mode (§11.5):
- **compare** (every push, and a plain dispatch): the run is compared with the runner baselines, pending-board fields
  with the target SHA's `pending.json` (§8; they show yellow, allowed).
- **record** (`record: true`): `--record` writes the shard's baseline files into the job's own
  `test/parity/baselines/gh-macos15/`, and the job uploads exactly those files, `<slug>.*`, as the artifact
  `parity-baselines-gh-macos15-<slug>` (R1-18, R2-33). It posts no status.
- **bootstrap** (R1-11): a compare job whose shard has no runner baselines at the SHA (a new shard, or one whose lane
  just re-recorded, §8 case 6) records instead. It uploads the same artifact the same way (R2-33), still holds every
  class D threshold (they need no baseline), and runs the same extra checks a compare job runs (R3-10; B3-6): the
  Nine Dragon facade-instancing check (E271; AGENTS.md: "keep this regression check") and, on an `offline: true`
  dispatch, the offline boot check. Its `success` requires both; then it posts `gpu-gate/<slug>` = `success` with the
  description `bootstrap record: commit parity-baselines-gh-macos15-<slug>`. The lead, or the reopened shard's lane,
  commits it (§8 "How").
- **prove** (`prove: true`): each job runs one part, `parity.mjs --prove --only=<part> --export=$SHA`: the two green
  runs, or one plant built on a temp copy with its expected red fields asserted (§9), and uploads the proof as
  `parity-prove-<slug>-<part>`. A prove or a plant dispatch never posts a status, so it can never mark a real commit
  green.

A dispatch on an older SHA runs main's head **harness code** against a build of that SHA, and compares with **that
SHA's** `test/parity/` (baselines, rename maps, plants), which the checkout of the SHA already holds: the "Harness code
from main's head" step overlays only `scripts/parity.mjs`, `scripts/parity/`, `scripts/gpu-gate/` and `scripts/types/`
(R1-19, R2-31). So a baseline that main's head re-recorded later (an accept, a bootstrap, a lane's case 6) never judges
an older build. It reads that SHA's pending boards with `git show`, because the sparse checkout leaves `docs/` out. With
`offline: true` (R1-47) each compare or bootstrap job also runs the offline boot check (§1) for its shard (R3-10); a
failure fails the job and so the gate. The lead dispatches it on every milestone candidate (§13.4).

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
  `report.md`'s first red field (`walk.stuck 1 at lookout-climb wp4`) or `green (retried: <field>)`; pending-board
  fields keep the state `success` and add `· pending board: <ids>` (yellow in `report.md`; R1-13);
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
Dispatches (a re-gate, plant, record or prove) run in their own group, `gpu-gate-dispatch-<sha>-<plant>-<record>-<prove>`
(R1-41), so they never replace a pending push run, and back-to-back plant dispatches of F3.2's proof don't cancel
each other.

### 11.5 Timeouts

By mode (R2-32; §10): a compare job has `timeout-minutes: 20`; a record, bootstrap or prove job 60 (each prove job
runs one part, §11.1). The setup job derives each job's mode before the job starts, so the timeout can follow it.
`parity.mjs --timeout=240` s per page load (scorecard's default). A job that times out posts `error` via the aggregate
(its per-shard step runs with `if: always()`).

### 11.6 The asset-URL case check on Linux (ci-gpu-options §6.2; 13-lead-resolutions G15)

macOS disks ignore case, so a URL `/assets/Music/x.mp3` for the file `public/assets/music/x.mp3` works on every Mac lane
and 404s on Vercel. `scripts/check-asset-case.mjs <dist>` runs on `ubuntu-latest`, whose disk is case-sensitive:
1. It collects every asset URL the build references: every `"/assets/…"` string literal (and `assets/…` relative to
   the page) in `dist/**/*.{js,css,html,json,webmanifest}`, which covers the generated file lists
   (`bytes.generated.ts`, the KTX2 tables `gpu.generated.ts` until F9 and `**/ktx2.generated.ts` after it, 02 F9;
   R2-04, the packs' `/assets/packs/<slug>.<tier>-<hash>.bin` rows) as they land
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
  reported, but never turns the run red. `until` is at most **3 days** after `since` (R1-36; the same limit as 12 §8,
  and the schema test in `test/parity-compare.test.ts` refuses a longer one). The gate fails (status `failure`,
  description `quarantine expired: <id>`) when any entry is past `until`, or when there are more than 5 entries. Only
  the lead adds an entry, and only with an ask file whose `Owns:` names the fix. A class D threshold (`errors`,
  `walk.stuck`, `renderer`, `batched`, the leak test) can never be quarantined. **At expiry** the field is fixed, or its
  check is deleted only in a commit that adds a replacement check covering the same field (R1-36): coverage is
  repaired, never dropped.

## 13. The deploy pin (decision 32)

### 13.1 `.github/deploy-pin.json`

```json
{
  "$doc": "What production and the native OTA channel serve (E357 decision 32). Moved only by scripts/deploy-pin.mjs set (at a milestone, after Jake OKs its boards) or rollback. mode: pinned (during GAME-NORMALIZATION) | newest-green (after Z4).",
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
| `set <sha> --milestone <Mn> --go "<where Jake said go>"` | refuses unless `git merge-base --is-ancestor <sha> origin/main` and `check-gate <sha>` pass; the **target SHA's** pending file has no entry (`git show <sha>:docs/plans/game-normalization/reviews/pending.json`, a missing file reading as `[]`; R1-13, R2-28); no `gpu-gate/<slug>` status of `<sha>` has a description starting `bootstrap record` (a shard the runner recorded but never compared there; R2-27); and **`<sha>` has a `gpu-perf/memory` status `success`**, or an ancestor `A` of it has one and `git diff --quiet A
<sha> -- <the build inputs §1's `--export` archives, without `test/parity/`>` holds (no runtime change since; R4-15,
C4-1); without one, the lead first runs `scripts/gpu-perf/nightly.sh --memory-only --sha=<sha>` (§14), and a
`failure` there refuses (R1-53). Writes the file with `gate: "required"`, `set` = now, `by` = `E357 lead` |
| `rollback <sha> --go "<Jake's words>"` | (R1-16) accepts only a SHA the pin history holds (every `sha` in `git log -p -- .github/deploy-pin.json`; M0 is there from F3.1, recorded as trusted then) and skips the gate check; writes that pin's own `gate` value back, `milestone` = `<its milestone>-rollback`. When the SHA predates F10, it prints, and the lead states to Jake with the rollback, that the old build can't read the v2 saves made since F10 (it reads only the deleted `ws.*` keys), so progress resets a second time (decision 95; the saves reset of decision 13) |
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

The milestone flow (R1-15), in order:
1. **Gate green on the candidate.** The milestone's last commit is on main and its `gpu-gate` is green, dispatched on
   its SHA with `-f sha=<sha> -f offline=true` so the offline boot check runs too (R1-47); the lead's `--full` run on
   both tiers (m5, `--export=<sha>`) is green.
2. **Boards to Jake** (decision 42): the summary, and the boards built from the harness's capture of that SHA (its
   pose images and clips).
3. **Jake OKs the board items**, or they're fixed or reverted. The reverts and the fixes land first (a fix refills
   its entry, §8 pending step 4); then, last, the OKed items are accepted with `node scripts/parity.mjs
   --accept=<ids> --export=<the newest sha>` (3 runs; §8 case 1; R2-18, R3-14), committed with `pending.json`, so
   the file is empty.
4. **The pin moves to the newest `gpu-gate`-green SHA after step 3** (R2-27): step 3's accept, fix and revert
   commits included, and, after an accept, the commit that lands the runner's bootstrap artifacts (the accept deleted
   those shards' runner baselines, §8 case 1, and `set` refuses a SHA where a shard was only bootstrap-recorded,
   §13.2). That SHA's `pending.json` must be empty, and the lead dispatches the offline check on it as in step 1. **That SHA
   needs its own memory reading (R4-15):** a `gpu-perf/memory` `success` on it or on a runtime-equal ancestor
   (§13.2); otherwise the lead runs `scripts/gpu-perf/nightly.sh --memory-only --sha=<sha>` (with
   `run_in_background`, ≤ 40 min) before `set`. The
   lead runs `node scripts/deploy-pin.mjs set <sha> --milestone M<n> --go "E357 <where Jake OKed>"`, commits
   `.github/deploy-pin.json` alone, `scripts/push-main.sh`, then `gh workflow run deploy`, and checks that
   `version.json` reports `<sha7>`. The build id goes into E357 (AGENTS.md → Deploy).
5. **Jake plays it live** on his phone (the home-screen app), including the milestone's checklist items (05–08 §9).
   **No checklist has a physical-iPhone reading (decision 98, R3-11′).** The memory evidence is the nightly Simulator
   memory run (§14.1: every shard's WebContent footprint against 1.8 GB loading and 1.0 GB in the world, decimal;
   decision 31) plus the budgets (§2.5). Over a limit means **stop the line** (R1-53): the pin doesn't move (`set`
   refuses a SHA without its own `gpu-perf/memory` `success`, §13.2), and the next commit fixes or reverts the cause. The accepted
   risk is stated in 12 §8: an iPhone-only memory death (the E271 class) can reach Jake's phone undetected.
6. **Jake's go starts the next shard.** The go is not a ship gate: the build already shipped in step 4. **A "no"
   (R2-29):** the next shard phase waits. Jake's reasons become rows of this milestone, each one fixed, gated, boarded
   if it is visible, and then "M<n>: go?" is asked again (the flow repeats from step 1). The pinned build stays live
   unless it is broken on his phone; then it is rolled back (R1-16).

**If Jake wants to play before the pin moves**, the lead deploys the candidate as a Vercel **preview** deployment
(R2-34): from a clean export of it (`git archive <sha> | tar -x -C <dir>`), copy the checkout's `.vercel/project.json`
into `<dir>/.vercel/` (`.vercel` is git-ignored, so the export has none, and without it the CLI links, or creates, a
project named after the temp folder; `deploy.yml` writes the same file before its own pull,
`.github/workflows/deploy.yml:116-117`), then `vercel pull --yes --environment=preview --scope raynos-projects`,
`VERCEL_GIT_COMMIT_SHA=<sha> vercel build --scope raynos-projects` (the export has no `.git`, so the variable stamps
`version.json` with the SHA, §1; C3-11) and `vercel deploy --prebuilt --scope raynos-projects` (no `--prod`, so
production is untouched). Unlike `scripts/release-url.sh`, which deploys static `dist/` only, it keeps `/api` (the
inbox, `/api/errors`). The preview sits behind the project's deployment protection, so Jake opens it signed in to
Vercel.

**Rollback of production (R1-16):** `node scripts/deploy-pin.mjs rollback <a pinned sha> --go "<Jake's words>"`, then
the same commit, push, deploy and check as step 4. Any SHA in the pin history is accepted, M0 included, with no gate
check (§13.2); a rollback past F10 comes with its saves note (decision 95). **Hotfix:** decision 53 — fixed on main,
shipped with the next milestone. **An early pin move** (outside a milestone, on Jake's explicit go; R2-28) goes only to
a `gpu-gate`-green SHA whose own `pending.json` is empty, which is usually the last green SHA before the phase's first
pending entry; `set` keeps refusing a SHA with any pending entry (§13.2). When the fix landed after that entry, the lead
asks Jake, with one recommended option, to board the pending items early or to wait for the milestone.

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
- **`scripts/gpu-perf/nightly.sh [--plant=<id>] [--memory-only --sha=<sha>]`**, in order, under `caffeinate -i`, capped at 240 min as a whole
  (`--max 240` for the nightly; each step below is its own lane call with its own `--max`, within its §10 budget;
  R1-43). `--plant` (a one-off, by hand)
  applies `test/parity/plants/<id>.patch` to the exported tree, runs only the parts the plant's `shards` names (its
  `index.json` entry, §9),
  prints the verdict, writes the report under `~/.wildshard/gpu-perf/plant-<id>-<date>.md` and posts no status (a
  plant never marks a real commit, as in the gate). `--memory-only --sha=<sha>` (R4-15: the pin's own memory reading,
  §13.2) runs steps 2, 4 and 7 on that SHA, compares with the newest earlier reading, writes
  `~/.wildshard/gpu-perf/memory-<date>-<sha7>.json` and posts only `gpu-perf/memory` on it:
  1. `git --git-dir=<mirror> fetch origin main`; pick the newest of the last 30 commits whose `gpu-gate` is `success`;
     stop if a report for it exists (`~/.wildshard/gpu-perf/*-<sha7>.json`, the name step 6 writes).
  2. `git archive <sha>` into `~/.cache/wildshard-gpu-perf/tree-<sha7>/`; `pnpm install --frozen-lockfile
     --prefer-offline --config.enable-global-virtual-store=false`; `scripts/serve-build.sh --hours 5 --name gpu-perf`
     from that tree (a registered preview the reaper knows; the whole nightly is ≤ 4 h, §10).
  3. Three lane calls, one after another (R1-43):
     - `scripts/browser-lane.sh --max 90`: `node scripts/parity.mjs --url=<u> --lane=m5 --tiers=phone,desktop --full
       --ms` (every route leg and trail, both tiers, compared with the m5 baselines as §4 says; from F8 the leak test
       on every shard, both tiers, weather runs included, §5.5), then `node scripts/parity.mjs --offline --url=<u>
       --lane=m5 --tiers=phone` (the offline boot check for every shard; R1-47);
     - `scripts/browser-lane.sh --max 30`, under the machine-wide model lock (`lockf -k ~/projects/localai/.model.lock`,
       so no MiniMax / TRELLIS / Qwen job shares the GPU while it times; ≤ 30 min held, AGENTS.md): the GPU-ms rulers
       `node scripts/nine-dragon-gpu.mjs --url=<u>` and `node scripts/pine-hollow-gpu.mjs --url=<u>` (and each shard's
       ruler as its S row adds one), against budget-design's M5 ruler budget (1.6 ms per pose, P), then
       `node scripts/scorecard.mjs --url=<u> --tag=nightly-<date>-<sha7> --no-switch --compare=baseline` (load bytes
       and time on shaped Fast 4G, heap, GL-API GPU bytes; `--no-switch` because the resident host is gone after F11).
  4. **The Simulator memory run** (§14.1), inside `scripts/sim-lane.sh run --max 40 wildshard-iphone …`.
  5. **The soak bot** (§14.2): one `scripts/browser-lane.sh --max 30 node scripts/soak.mjs --url=<u> --shard=<slug>`
     per shard, one after another (never two soak pages at once).
  6. Writes `~/.wildshard/gpu-perf/<date>-<sha7>.md` and `.json` (every number, the flake tally of §12, each budget with
     its formula, the Simulator memory table, the soak table) and posts context **`gpu-perf`** on `<sha>`: `success`
     when every check passed, `failure` otherwise, description ≤ 140 characters, e.g. `M5 GPU worst nine/well-edge
     1.42 ms (1.6) · GPU 373 MB · parity 0 red · sim 0.71/1.0 GB · soak ok`. It never blocks a deploy. It also posts
     context **`gpu-perf/memory`**, from the Simulator memory table alone (`failure` when §14.1's verdict is red),
     which `deploy-pin.mjs set` reads on the target SHA (or a runtime-equal ancestor): the pin can't move to a SHA
     without a `success` there (R1-53, R4-15).
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
  the same shard and phase (a regression on the same machine). The table goes into the report, and the verdict is the
  `gpu-perf/memory` status (§14 step 6).
- **An intended increase (C3-15; R3-N, R4-14)** is a boarded item, and only the lead commits its entry (a lane can't
  commit `pending.json`):
  - **A lane's increase** (a new hero model): the lane's follow-up baseline commit names it (`memory: <slug>.<phase>
    +<n> % intended`), and the lane tells the lead (`herdr agent prompt`, or its ask file). The lead's next commit
    adds the entry. **The lead's own increase** (an engine change that holds more) adds it in the change commit.
  - The entry is `{ id, row, wave: "look", shard, fields: ["memory.<shard>.<phase>"], expect: null }` (§8 pending
    step 6: parity's fill and accept skip it). While it is open, a reading more than 10 % above the previous one
    on that phase reads `pending` (yellow), never red, as long as the phase is under its limit; over a limit is red
    regardless.
  - It goes on the milestone's Look board as "memory: <shard> <phase> +<n> %" with the two readings. Jake's OK
    removes the entry in the accept commit; the readings compare with the previous reading as before, so the
    raised one is the reference from then on. A "no" reverts the commit that raised it.
- **Memory red stops the line (R1-53).** The lead's next commit fixes it or reverts the cause (found by running
  `node scripts/sim-memory.mjs --url=<u> --shards=<the red shard>` on the SHAs between the last green night and the
  red one), and no other row lands before it. The pin can't move to a SHA without its own `gpu-perf/memory` `success` (§13.2, R4-15).
- **The memory gate, and its limit (decision 98, R3-11′).** This run plus the budgets (§2.5) is the plan's memory
  evidence: there is no physical-iPhone reading at any milestone (§13.4 step 5) or for F12 (02 F12 step 5 uses a
  Simulator load reading). The Simulator runs on the Mac's memory and GPU and read ~0.75 GB where the phone read 1.054
  (the ios-simulator skill; E271 / E272), so under the limits here does not prove the phone is under them: an
  iPhone-only memory death (the E271 class) can reach Jake's phone undetected. That risk is accepted and stated in
  12 §8.

### 14.2 The soak bot (MW19; 13-lead-resolutions G13)

`scripts/soak.mjs --url=<u> --shard=<slug> [--minutes=20] [--weather]` runs one shard for 20 minutes, headless on the
M5 (full Chromium, ANGLE Metal, `--mute-audio`, phone tier, `window.__wildshardHarness` seeded as §6).
**With weather (R1-48):** Nalati and Pine Hollow alternate by night between clear and weather active (`--weather`:
Nalati `?weather=storm`, Pine Hollow the setting `weather: 'rain'`, as §5.5), so each is soaked both ways every two
nights and the nightly still runs four soaks inside its 240 minutes:
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
on the M5, `gpu-perf`), CPU ms per system and download bytes (nightly scorecard), memory (the nightly Simulator run of
§14.1 against decision 31's limits: with the budgets, the plan's memory gate; there is no physical-iPhone reading,
decision 98, R3-11′, and the risk that leaves is stated in 12 §8).
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
  layout or content re-records that shard's baselines on its SHA, in the follow-up baseline commit that names it (§1;
  R2-25), with the fields it changed listed in the message; the gate then proves that nothing *else* changed and every class D threshold holds. Engine and kit commits
  keep the plan-time rule (§8 cases 1–5).
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
