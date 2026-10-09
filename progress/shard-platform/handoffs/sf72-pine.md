# Handoff (sf72-pine) — 2026-10-08, SF72 Pine Hollow headless (herd brain landed by sf72-herds)

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

## Herd brain: landed (sf72-herds, 334031a26)

The hunting loop that was `AnimalManager.think` now lives in `src/engine/ai/hunt.ts`: `HuntBrain<A extends HuntBody>`
over `HuntPorts` (ground / water / trees, navmesh, reach, wander goal, unaware, sound, charge); the browser delegates to
it. Placement: `HuntBrain.placeHerds(plan, spawn, make)`, then per spawn `spawnRolls(rng, kind, variant, hasLegendary)`
and `adopt(a, x, z)`, in the exact `Rng(SEED + 31)` order. `test/engine/hunt-brain-oracle.test.ts` pins old = new bit for
bit (9 family x fight-style configs, 10.7k–13.2k think ticks each, plus placement); `hunt-node.test.ts` places herds in
plain Node under the renderer-denying loader. Pine was rebaked in that commit (actors / solids / herds byte-identical;
the inputs add `ai/hunt.ts`). Not yet measured: a desktop frame-floor row for Pine + Nalati. Parity at the parity poses
ran on the candidate: walk / combat / poses green; reds only in save-key fields (Nalati) and phone weather-texture leak
fields (Pine), not compared against the parent build.

## Next (Pine headless), in order

1. Reproduce herd placement in Node: `placeHerds` needs `isOpen` over the forest's trunks (`HuntGround.trees`) and the
   water, so bake the tree positions (x, z, r) into `physics.baked.json` (or capture before the first tick), wire a
   `HuntGround` from the baked heightfield, and verify seeds against `actors[].seed`.
2. `runtime/headless.ts`: `ground:false`, the baked heightfield through the engine `addTerrain(physics, grid)` (convert the
   column-major heights back to row-major) (the edge walls are already inside `solids`); the roster via `host.spawn`, the
   `HuntBrain.think` at the manager's cadence (20 Hz within 60 m, 10 Hz to 160 m), the four elites (`combat/elites.ts` EliteGoals, needs the view split), the Antler
   King (`runtime/KingGoals.ts` already loads in Node; `antlerKing.ts` must split its BossScript from BossBar/fx/fog),
   night thralls, roster reinstall before restore. Shoves use the landed `SimHost.impulsePlayer` (defff10d1).
3. Witness: headless 10k → replay (King mid-fight) → ledger from gameplay (feat facts via `pine.progress`) → entry proof
   on the four 8 m entryways. Flip `compatibility.json` only from a real run.

Note: `test/proof/*/run.mjs` runs Node without `--experimental-transform-types`; Pine's entry fails on a parameter
property for that reason alone (`runtime/index.ts` still imports the renderer behind it).

Plan-State: unchanged.
