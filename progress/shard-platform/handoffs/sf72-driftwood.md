# Handoff (sf72-driftwood) — 2026-10-08, SF72 Driftwood Isle headless, 90-min cap

Coordinator `wildshard-new` pushes. Driftwood's canonical witness (`test/proof/driftwood-isle/`) is UNCHANGED and still
fails closed (its entry `runtime/hybrid.ts` is the browser boot and never loads in Node). No browser left running.

## Landed

- `0f2ce839a` slice 1, renderer-free policies: `species/captainPolicy.ts` (the captain's whole fight + `CaptainBrain`),
  `species/monkeyPolicy.ts` (perch choice, bite / coconut strike, `MonkeyBrain`), the crab / sailor brain shells and
  `combat/strikes.ts` generic over `AnimalSim` with small port interfaces that `ThinkCtx` satisfies unchanged.
  `test/shards/driftwood-isle/policy-node.test.ts` imports them in plain Node under `scripts/sim-node-loader.mjs`.
  Graph driftwood→engine +3 approved. The decision for crab / sailor / monkey in the hybrid boot is the engine's generic
  `SkirmisherBrain` / `GuardianBrain` / `PerchHunterBrain` (runtime/brains.ts), so all four policies are now host-ready.

## What Driftwood is (differs from Signal)

- **No admitted terrain collider** (`shard.terrain` is null). Heights are the analytic `buildTerrain(SEED, …)` +
  `droppedTerrain` in `manifest.ts` (which imports `.webp`, so it cannot load in Node, and carries foreign WIP), and the
  browser's physics ground is cut for the sea cave (`cutTerrain(world.physics, cove.terrainCuts())`, world/build.ts).
- **No homes.** Placement is `creatures/Enemies.ts` (renderer class, TS parameter properties): `Rng(engine SEED ^ 0xe11e)`
  drawing crab groups at `cove.crabSites` (`enemyCount('tidepool')`, one big + smalls, skipped below water + 0.15), the
  practice crab (respawn `DRIFTWOOD_PRACTICE.respawn` delay / away), monkey troops in the densest palm groves (palmSpecs,
  ≥ 60 m from spawn, ≥ 30 m from WRECK, ≥ 45 m apart), perches from palm crowns, and the sailor in the wreck hold after
  `preloadSailorHead` (night-gated by `habitat.night`). Bodies come from the AnimalManager stream `Rng(engine SEED + 31)`.
- Coconuts are dynamic physics balls (`COCONUT_BODY`), 8 damage on a feet→head segment hit; the shove law is not used.

## Exact next steps (in order)

1. **Terrain module**: move the analytic terrain recipe out of `manifest.ts` into a renderer-free `data/terrain.ts`
   (not a map-hash input; manifest.ts has foreign staged WIP — build its hunk from HEAD on a private index), and reproduce
   the browser's physics ground natively (heightfield from that field + the cove's cuts) — or bake both, see 2.
2. **Bake** (`scripts/bake-driftwood-physics.mjs`, Signal's shape, muted Chromium iPhone 16 Pro via browser-lane, a
   clean build): the native colliders (registry pieces: pier, jetties, hut, lookout, wreck, shrine, cove, bridge deck,
   boulders, palms, entry landings), every enemy's model-derived `AnimalSimSpec` / seed / scale in placement order, the
   crab sites, palm perches + bases, the hold (centre / r / guardR + wreck floor samples), the captain's spec + pool.
   Prove in a bake test that the seeds / scales reproduce from `Rng(SEED + 31)` and placement from `Rng(SEED ^ 0xe11e)`.
3. **runtime/headless.ts** with `PrepareHeadlessRuntime`: `ground:false` + real floor queries, the baked colliders, a
   keeper that places crabs / practice crab / troops / sailor via `host.spawn/retire` with the two streams, the 2 attack
   tokens (manifest `fight.attackers`), and per body the hybrid policy (`new CrabBrain(body, skirmisher decide)` etc.)
   over host ports (`player`, `reach` = canReach + 70° arc, `hurt` → `host.combat.hit`, `claim/mayAttack`, `sound` no-op,
   `world.throwCoconut` → a headless coconut keeper on `host.physics`, `world.splash` no-op), 10 Hz think / per-tick act;
   restore reinstalls the roster before the host restore (Signal's homes.ts pattern).
4. Captain encounter (`runtime/finale.ts` + quest wake via `mem.awake`), the sword item rows, the quest / ledger facts
   from gameplay, `proveEntries` over the four socketOverWater landings; then the witness `run.mjs` →
   `HeadlessSimulation` + `trustedRuntime`, flipping compatibility.json only from a real run.

Plan-State: unchanged.
