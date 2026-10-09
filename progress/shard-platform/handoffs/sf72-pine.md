# Handoff (sf72-pine) — 2026-10-08, SF72 Pine Hollow headless, 90-min cap

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed. There is no `runtime/headless.ts` yet. Landed: the trusted native bake (floor, solid world, roster recipes) and
its test.

## Landed

- Bake: `scripts/bake-pine-physics.mjs` (+ `pine-physics-inputs.mjs` freshness hash) → `src/shards/pine-hollow/runtime/physics.baked.json`
  (1.8 MB), from a clean HEAD preview (muted Chromium, iPhone 16 Pro / phone, two same-page captures exactly equal).
  - `ground`: Rapier's own 256² terrain heightfield, column-major float32 (base64). `physics-bake.test.ts` proves it is
    Pine's `world/terrain.ts TERRAIN.heightAt` at every lattice vertex except 135 vertices lowered by the crag cuts.
  - `solids`: all 2082 solid WORLD colliders (973 trunk capsules, 643 rock/crag convex hulls, 454 cuboids (structures, props and the edge
    walls), 2 trimeshes, 10 door cuboids at their load pose on kinematic bodies) as native shapes; the test rebuilds every
    one in a fresh Rapier world. Material tags (`tagCollider`) are not readable from the page, so they are not baked.
  - `actors`: the manager's 164 bodies at load (52 herds incl. the Den's 3 bears) plus the 4 scripted lair elites
    (Ironhide, Ghost, Blackpaw, Imperial): kind / variant / herd / model-derived `simSpec` / seed / scale. Positions,
    yaws and herd centres are NOT baked: the page ticks and recentres between captures, so they are not stable facts.
  - `pieces`: the 50 registry pieces' metadata only (their colliders are in `solids`).

## The real blocker (needs the coordinator's call before more Pine work)

Pine's ordinary fauna has no renderer-free policy. Deer / boar / elk / bear run `AnimalManager.think` (engine,
`src/engine/entities/AnimalManager.ts` ~L933–1430): senses/awareness, herd panic, flee, charge, ring/back-off fight rules,
the director's tokens, ambient calls, nav-path steering. It lives in the renderer-bound manager (it imports
`fx/ParticlePool`, so the Node loader refuses it) and shares the manager's one `Rng(SEED + 31)` with herd placement.
Signal avoided this because each of its species has its own brain. Honest next step (engine, shared with Nalati's herds):
1. Extract the legacy hunt brain into a renderer-free engine module (e.g. `src/engine/ai/hunt.ts`) over `AnimalSim` +
   ports (player, physics `canReach`, floor, nav, rng stream, director claim), with AnimalManager delegating to it and a
   parity run on Pine + Nalati unchanged. Land it first, alone.
2. Reproduce herd placement in Node: `spawnHerds` draws (centre search uses `isOpen`/`isDry`: the forest's tree positions
   and the water), then per member ang / r / yaw and the six spawn draws. Either bake the tree positions or add a
   capture-before-first-tick hook to the bake for exact initial placement; verify seeds against `actors[].seed`.
3. `runtime/headless.ts`: `ground:false`, the baked heightfield through the engine `addTerrain(physics, grid)` (convert the
   column-major heights back to row-major) (the edge walls are already inside `solids`); the roster via `host.spawn`, the
   hunt brains at the manager's cadence, the four elites (`combat/elites.ts` EliteGoals, needs the view split), the Antler
   King (`runtime/KingGoals.ts` already loads in Node; `antlerKing.ts` must split its BossScript from BossBar/fx/fog),
   night thralls, roster reinstall before restore. Shoves use the landed `SimHost.impulsePlayer` (defff10d1).
4. Witness: headless 10k → replay (King mid-fight) → ledger from gameplay (feat facts via `pine.progress`) → entry proof
   on the four 8 m entryways. Flip `compatibility.json` only from a real run.

Note: `test/proof/*/run.mjs` runs Node without `--experimental-transform-types`; Pine's entry fails on a parameter
property for that reason alone (`runtime/index.ts` still imports the renderer behind it).

Plan-State: unchanged.
