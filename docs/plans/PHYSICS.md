# Plan: stop hand-rolling physics — one collision world for Wildshard

**State:** `draft` 2026-09-22 — research done (E20): Rapier 3D is the pick, crashcat the pure-TS runner-up, navcat for animal pathing; waiting on the user's go and the picks under Decisions. Nothing built.

## Where we are (surveyed 2026-09-22)

No physics library — runtime deps are `three`, `postprocessing`, `n8ao`, Capacitor. About **800 lines** of
hand-rolled 2.5D physics: circles and Y-rotated boxes in XZ plus `heightAt()` terrain sampling.

| Hand-rolled piece | Where | Lines |
|---|---|---|
| Player kinematic controller (gravity, jump, platforms, swim/buoyancy, hoverboard spring) | `src/player/Player.ts` | ~250 |
| `Collider` boxes typed as numbers + `floorHeightAt` per structure, 13 world files | `src/world/Cabin.ts`, `Pier.ts`, `Boat.ts`, `Wreck.ts`, `Hut.ts`, `Lookout.ts`, `Shrine.ts`, `Cove.ts`, `Palms.ts` … | ~150 |
| Animal steer / confine / wander (no pathing) | `src/entities/AnimalManager.ts:682-807` | ~60 |
| Animal terrain fit, death pose, corpse IK settle, stagger | `src/entities/Animal.ts:279-519,611` | ~80 |
| Bolt ballistics, rifle hitscan, trunk cylinder + terrain bisection | `src/player/Crossbow.ts:1184-1270`, `Rifle.ts:280-320` | ~150 |
| Particles, brass, coconuts, blood, pickup motes | `Crossbow.ts`, `Rifle.ts`, `Enemies.ts:191-262`, `AnimalManager.ts:185-265` | ~80 |

**The real problem is not the line count, it's that there is no shared world to query.** `Collider[]` is read
by `Player.collide()` and nothing else, so on Driftwood today:

- bolts, bullets, coconuts and the sword pass through cabin walls, rocks, palms, the hut and the pier;
- doors and pickups can be used through walls (pure distance, `src/main.ts:436-441`); aim assist has no line of sight;
- animals ignore every `Collider` and each other, never stand on a platform; crabs/monkeys avoid nothing (Driftwood has no `Forest` trees);
- the cove cave is one solid box (can't enter), stumps/logs aren't solid, the boat bobs but its floor doesn't;
- deaths are keyframed poses — no ragdoll; nothing can be knocked over, thrown or dropped with physics.

## Candidates (researched 2026-09-22, sizes measured from npm tarballs)

Hard constraint: **Capacitor kills WASM threads for good** — iOS `capacitor://` never gets `crossOriginIsolated`,
Android WebView never supports it ([capacitor#6182](https://github.com/ionic-team/capacitor/issues/6182),
[Chromium 40914606](https://issues.chromium.org/issues/40914606)). Single-threaded builds only. The main loop is
variable-dt (`src/core/Game.ts:181`, clamped 0.1 s); an engine wants a fixed step + interpolation.

| Engine | Version | Wire size | Character controller | Heightfield | Ragdoll | Verdict |
|---|---|---|---|---|---|---|
| **Rapier** `@dimforge/rapier3d-simd` | 0.20.0 (2026-08) | ~537 KB br wasm + 25 KB JS | built-in KCC: autostep, snap-to-ground, slope limits, push dynamics | yes | joints (DIY) | **pick** — most complete KCC, `any`-free types, very active; known moving-platform dip bug [#488](https://github.com/dimforge/rapier/issues/488) |
| **crashcat** (pure TS) | 0.0.5 (2026-07) | ~46 KB gz, tree-shakes | Jolt-style KCC incl. moving platforms | no (trimesh) | yes, example | **runner-up** — fits the bytes / long-task budget best; pre-1.0, one maintainer |
| Jolt `jolt-physics` | 1.1.0 (2026-07) | 741 KB wasm + 135 KB glue | `CharacterVirtual` (best in class) | yes | native | heavier, manual `destroy()` memory, npm ST build has no SIMD |
| Bounce, Box3D | 1.10 / 0.1.1 | 72 KB / 334 KB | separate pkg / building blocks only | yes | joints | promising, too new |
| Havok, PhysX, Ammo, cannon-es, Oimo | — | — | — | — | — | out: Babylon-first / 1.6 MB / dead since 2016–2022 |
| three-mesh-bvh | 0.9.15 | ~62 KB | none — capsule push-out example | via mesh | no | middle option: fixes "hits through walls", but we keep owning the controller and get no dynamic bodies |
| **navcat** (pathing) | 0.4.1 | ~96 KB, pure JS | — | — | — | **pick for animals** — baked navmesh + crowd; `recast-navigation` (WASM) is the mature fallback |

No credible phone benchmark exists for any of them ([js-physics-benchmarks](https://isaac-mason.github.io/js-physics-benchmarks)
is desktop). **The WASM compile + instantiate time on an iPhone is the number that decides Rapier vs crashcat** —
LOAD-PERF's budget is ≤ 100 ms longest task and ≤ 12 MB cold. Load Rapier as a streamed `.wasm` (not the
base64 `-compat` build: +33 % bytes and a blocking decode), SIMD with a non-SIMD fallback, instantiated during
the title screen, added to the service worker's asset index.

## From the trials-gauntlet (`~/projects/game-demos/trials-gauntlet-demo/docs/plans/USE_A_REAL_PHYSICS_LIBRARY.md`)

Its plan is **parked, never started** (behind the store release), so there is no measured evidence to borrow —
and it's a planar bike game: its picks (Rapier **2D**, Planck) and its determinism / snapshot / replay contract
don't port. What does port:

1. **Custom stays as the control** behind one boundary; the library is a second implementation, switchable
   without a rebuild (`?physics=custom|rapier`, later a settings toggle), until it beats the control on the phone.
2. **Count WASM bytes and startup separately** from the JS budget — don't let a JS-only gate hide them.
3. **Async init at boot, never inside a tick**; the tick interface stays synchronous.
4. **The library owns collision and constraints; game feel stays ours.** Hover spring, swim buoyancy, wade
   hysteresis, double jump, landing impulse stay in `Player.ts` on top of the KCC's move — and nothing
   re-hand-rolls collision inside the adapter.
5. **Time-box the qualification** (gauntlet: 3–5 days) and decide from measurements, not feature lists.
6. **Judge by played clips**, not posed stills.

## Levers (in order; each ships on its own)

| # | Lever | Replaces | Evidence it landed |
|---|---|---|---|
| Q | **Qualify** Rapier vs crashcat: Driftwood heightfield + today's colliders + KCC on the pier-spawn loop, `?physics=` switch | — | cold bytes delta, longest-task delta, per-frame physics ms (4× CPU bench + one iPhone reading), a walk clip each; pick written into this plan |
| 1 | **One static collision world**: heightfield (from the baked `terrain.json`), every `Collider` box, trunk capsules, trimeshes where boxes lie (wreck hull, cove cave, hut) | `Player.collide()`, trunk circles | player walks the same as `custom` on the §0 poses; cave enterable |
| 2 | **Player on the KCC** (autostep, snap, slopes, platforms); platforms become colliders, `floorHeightAt` callbacks retire | `groundAt()` / platforms | stairs, pier, wreck deck, hut, bridge walkable; boat floor bobs with the hull |
| 3 | **Every query through the world**: bolt segments, rifle hitscan, sword fan, coconuts, interact + aim-assist line of sight | trunk/terrain bisection, distance-only interact | a bolt sticks in the cabin wall; no door through a wall |
| 4 | **Animals as kinematic bodies** against the world + each other; **navcat** baked navmesh for wander / flee / charge | `steer` / `confine` / wander sampling | crabs route round rocks and huts; nobody walks through a wall |
| 5 | **Dynamic bodies**: ragdoll deaths (crab, monkey, sailor, boar, deer), physics coconuts / brass / loot drops | death pose blend, corpse IK, hand integrators | a clip of a ragdoll on the beach slope |
| — | Rope bridge stays visual (static walk surface + shader / verlet sway); revisit when Rapier ships soft bodies | — | — |

Budgets that gate every lever: PLAY-PERF phone tier (≥ 55 fps, p50 ≤ 18 ms at every pose) and LOAD-PERF
(`bench.budget.json`). A lever that costs frame time or cold bytes past them doesn't ship on the phone tier.

## Decisions (the user's)

1. **Go / no-go**, and whether it waits for LOAD-PERF / PLAY-PERF to finish (both are fighting the same budgets).
2. **Rapier vs crashcat** — default: run lever Q and take the winner; or pick Rapier outright (maturity) or crashcat outright (bytes).
3. **Keep `custom` selectable after the switch** (the gauntlet's choice) or retire it once the library wins.
4. **Scope**: levers 1–3 (collision correctness) first, or straight to 5 (ragdolls — the visible "AAA" win).
5. **Driftwood only**, or Pine Hollow too (it has 3 cabins and the forest trunks).
