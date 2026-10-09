# Handoff (sf72-driftwood3) — 2026-10-08, SF72 Driftwood Isle headless part 3

Coordinator `wildshard-new` pushes. Driftwood's canonical witness (`test/proof/driftwood-isle/`) is UNCHANGED and still
fails closed (its entry is still `runtime/hybrid.ts`). Supersedes the "Exact next steps" of `sf72-driftwood2.md`.

## Landed (this lane)

- `21a26a912`, `68bc208e4`: Driftwood rebakes (the bake now hashes `src/engine/ai/hunt.ts`; the bake script reads each
  body's goal from `animals.hunt.memory(a)`). **Any hunt.ts / AnimalManager.ts change rebakes Driftwood and Pine.**
- `bb6d93f69`: engine seam `HuntConfig.species?: (kind) => HuntSpecies` (default: the global `speciesDef`).
- The headless slice (this commit): `runtime/headless.ts` (PrepareHeadlessRuntime, `ground:false`, baked floor + 2067
  solids), `runtime/baked.ts`, `runtime/keeper.ts` (34 bodies, stream, creature floor, HuntBrain herds / tokens /
  steering, the scheduler's 'ai' decision clock, practice-crab return, exact restore), `runtime/enemyBrains.ts`
  (crab / sailor / monkey shipping policies over host ports), `species/monkeyVariants.ts`.

## Exact next steps (in order)

1. **Fauna decisions.** In `keeper.ts`: pass `species: kind => kind === 'boar' ? ISLAND_BOAR : ISLAND_BEAR`
   (`creatures/species.ts`, renderer-free) and `faunaTuning: () => <manifest faunaTuning copy>` (test-held equal to
   `DRIFTWOOD_ISLE.faunaTuning`) to the HuntBrain. Adopt each fauna memory at its own stream position: replay
   `Rng(seed + 31)` and, at each fauna's baked seed, call `hunt.adopt(a, at.x, at.z)` (its next 3 draws); assert the
   stream then stands at exactly 148. Per tick: `hunt.beginTick(dt)`, `resetRepaths()`, the manager's smoothed
   `playerSpeed`, the token sweep's still-attacking test for a charger (`state === 'charge'`), `hunt.think` on the same
   decision clock, `advanceCharge` / `chargeContact` on the body tick, `damage.dealt` → `hunt.hurt` / `hunt.died`.
   Ports: `reach` = `canReach`, `charge` = PlayerHurt.creature's hit (feel.blow). Snapshot the memories (HuntMemory is
   plain data; its path stays empty without a navmesh). **Blocker for fidelity:** the browser's fauna steer by
   Driftwood's baked navmesh (`public/assets/baked/driftwood-isle/navmesh.bin`), and `engine/physics/navmesh.ts`
   imports the app; split a renderer-free `parseNavmesh` / `Navmesh` from the app binding first, then `nav` reads it.
2. Coconuts on `host.physics` (`COCONUT_BODY`, 8 damage on the feet→head segment within 0.45 m, landing, 4 s rest /
   16 s age, float on the sea), then `world.throwCoconut` in `keeper.ts`.
3. The captain (bake his spec by setting `used:altar` in the bake), swords, quest / ledger, `proveEntries`, the witness.

## Known simplifications (all in the source docs)

- The scheduler's body bands (half rate 60–160 m, paused beyond) and its interrupts (hit, lost sight, ally died) are not
  modelled: every body steps every tick, decisions follow only the distance-banded clock.
- The practice crab's replacement keeps its slot's id (the browser allocates a fresh entity id).
- The fauna's spawn yaw is not baked (0); their herd centres start at the members' mean.
- `clearBody` (a fauna body pushed off the camera) is not modelled.

Plan-State: unchanged.
