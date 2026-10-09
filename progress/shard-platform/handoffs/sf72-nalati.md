# Handoff (sf72-nalati) — 2026-10-09, SF72 Nalati Grasslands headless, part 1

Coordinator `wildshard-new` pushes. Nalati's canonical witness (`test/proof/nalati-grasslands/`) is UNCHANGED and still
fails closed. There is no `runtime/headless.ts` yet.

## Landed

- `48b714a99`: the declared pack / herd policies (`runtime/groupPorts.ts`, `runtime/groupDeclared.ts`) take a
  `NativeGroupHost` (`sharedRng`, `register`) and load under `scripts/sim-node-loader.mjs`; the page binds
  `runtime/groupHost.ts APP_GROUP_HOST`. The bake script `scripts/bake-nalati-physics.mjs` (+ `nalati-physics-inputs.mjs`).
- `c7900754c`: `runtime/physics.baked.json` (clean candidate 64ac50402): `ground` (256² heightfield, column-major float32
  base64; equals `TERRAIN.heightAt` at every vertex), `solids` (2694 WORLD colliders: 1/2/9 shapes, doors at load pose; the
  walking camp people excluded), `actors` (35 bodies at load), `herds`, `trees` (155 trunks), `pieces`. Parser
  `runtime/baked.ts nalatiBake()`; test `test/shards/nalati-grasslands/physics-bake.test.ts`.
  The bake hashes AnimalManager, `ai/hunt.ts`, `ai/pack.ts`, `ai/herd.ts` and Nalati's data / world / models / species /
  combat / creatures / ride (not `data/runtimeCost.ts`): an edit there rebakes Nalati in the same commit.

## The roster at load (manager ids)

creature:0-4 wolf pack (alpha, grey, tawny, grey, scout; herd 0) · 5-19 the wild herd (11 mares, 3 foals, stallion;
herd 1) · 20 sheepdog (its herd 2 has no members: Wildlife sets `d.herd` but never pushes it) · 21-22 the camp horses ·
23 a camp-bay (sheep raid / kokpar) · 24 spawned then retired (find out which: an elite roll by day?) · 25 leopard.aqbars
(elite) · 26-35 Argymaq's herd (herd 3, `argymaq.stallion` at 35). Placement draws: Wildlife's `Rng(seed ^ 0x3a17)`
for spots, the manager's stream for spawns.

## Inventory: what a witness needs, and what blocks it in Node

- Herds / packs: `PackBrain` / `HerdBrain` with `NALATI_PACK_BRAIN` / `NALATI_HERD_BRAIN` now load; drive them from
  `@wildshard/game/shardfile/homeKeeper installHomeKeeper` (4dca8153a), not a shard keeper.
- Species rows (`species/rows.ts`): blocked by `app` + `hulls.ts` (anim/rig, GLTF). wolf / horse import the think
  callbacks from `runtime/groupDispatch.ts` (now via `groupHost.ts` → app). Split the variant / spawn tables into a
  renderer-free module (Pine's `pineSpawnSpecies` shape) for `spawnRolls` and `HuntConfig.species`.
- Param properties (strip-only Node refuses): creatures/wildlife.ts, flock.ts, marmots.ts, combat/elites.ts,
  goldenKing.ts, stormTitan.ts, ghostRiders.ts, balbalWarriors.ts, ride/Mount.ts, Taming.ts, runtime/persistence.ts,
  items.ts, quests.ts. `combat/damage.ts encounterHit` imports app (night / elites / King strikes).
- Elites (5 lairs on the clock / storm), night (balbal warriors at dusk, ghost riders at night), the Golden King
  (kurgan), the Storm Titan (mesh-only, storm-gated), mounted riding / taming, bow / rifle / spear projectiles, and the
  day-night clock all still live in browser classes.

## Next, in order

1. Renderer-free species tables + the roster in Node, id for id against `actors` (Wildlife's placement over the baked
   floor, then the elites' boot spawns; explain creature:24).
2. `runtime/headless.ts` (Signal's shape): `ground:false`, the baked heightfield + solids, the roster through
   `installHomeKeeper` with the declared pack / herd policies over a Node `NativeGroupHost`.
3. Witness: headless 10k → replay → ledger from gameplay (the wolf feats are the cheapest) → entry proof.

Plan-State: unchanged.
