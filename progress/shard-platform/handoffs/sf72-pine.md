# Handoff (sf72-pine) — 2026-10-08, SF72 Pine Hollow headless (boot roster reproduced id for id, sf72-pine3)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed. There is no `runtime/headless.ts` yet.

## Landed

- Bake: `scripts/bake-pine-physics.mjs` (+ `pine-physics-inputs.mjs` freshness hash) → `src/shards/pine-hollow/runtime/physics.baked.json`,
  from a clean candidate preview (muted Chromium, iPhone 16 Pro / phone, two equal captures). `ground` (Rapier's 256²
  heightfield, column-major float32 base64), `solids` (2082 solid world colliders as native shapes, doors at their load
  pose), `actors` (the manager's 164 bodies at load: 160 herd bodies + the 4 lair elites, kind / variant / herd /
  model-derived `simSpec` / seed / scale), `parked` (NEW: the Antler King's prewarm, see below, with specs), `herds`
  (member ids), `trees` (918 trunk circles), `pieces` (metadata). Positions / yaws / herd centres are NOT baked.
  The bake hashes `ai/hunt.ts`, `AnimalManager.ts` and Pine's `combat/`, `species/`, `models/`, `world/`, `data/`: any edit
  there needs a rebake in the same commit (and hunt.ts / AnimalManager.ts also Driftwood's).
- Herd brain (334031a26): `src/engine/ai/hunt.ts` `HuntBrain` over `HuntPorts`; `placeHerds(plan, spawn, make)`, then per
  spawn `spawnRolls` + `adopt` (6 shared-stream draws for a string variant, + the variant roll for a list).
- Herd placement in Node (e4616421b): `runtime/fauna.ts`, `runtime/herds.ts` (`pineHuntGround(grid)`, `PINE_HERD_STREAM` =
  Rng(1337 + 31)).
- Boot roster id for id (sf72-pine3, a7962acd0):
  - Ids: creature:0-159 herds (157 = the Den's rolled 'black-old', retired); 160 = its ordinary replacement
    (`combat/eliteRoster.ts swapRolledElites`, view-free over `SwapPorts`); **161-163 = the King's prewarm**
    (`runtime/antlerKing.ts prewarm`: King 'warden', elk 'thrall', boar 'thrall', spawned then parked out of the
    manager's list); 164-167 = the lair elites (`Elites.initialize`, PINE_ELITE_DEFS order).
  - Engine seam: `spawnRolls(rng, kind, variant, hasLegendary, species = speciesDef)`, registry `variantOf(row, id)`.
  - `runtime/herds.ts pineSpawnSpecies(kingVariant)`: Pine's rows renderer-free (kit deer / elk + `PINE_ELK_THRALL`,
    `PINE_BOAR`, `PINE_BEAR`, King); use it for both `spawnRolls` and `HuntConfig.species`.
  - `test/shards/pine-hollow/herd-placement.test.ts`: every id / kind / variant / scale / seed of actors + parked, and every
    herd's members, bit-exact in plain Node with no global registry.

## Next (Pine headless), in order

1. `runtime/headless.ts` (copy Signal's shape: `src/shards/sunscar-dunes/runtime/{headless,homes,matriarch}.ts`):
   `ground:false`; the baked heightfield through the engine `addTerrain(physics, grid)` (convert column-major → row-major)
   plus `solids` (edge walls already inside). The roster: one `Rng(PINE_HERD_STREAM)`, the exact boot order above (herds →
   swap → prewarm King + 2 thralls → 4 elites) so ids and draws match; bodies via `host.spawn` with the baked `simSpec`
   (`actors[i].spec`, `parked[i].spec`) and the rolled seed / scale; the parked three are spawned (draws + ids) but stay
   out of the brain. `HuntBrain.think` at the manager's cadence (20 Hz within 60 m, 10 Hz to 160 m). Roster reinstall
   before restore (Signal's `reinstall` / `settle`).
2. Elites headless: `combat/EliteGoals.ts` already loads in Node, but its `GoalHost` types name the browser `Animal` and the
   `LaneCharge` class (private members: a headless lane can't satisfy it). Split `combat/ctx.ts LaneCharge` into a
   view-free lane (StrikeRunner) + the decal view, and type the goals over a small body / lane interface that
   `AnimalSim` satisfies. Then headless `EliteScript`s over `EliteBrain` (spawn at the lair from the shared stream; yaw from
   `cosmetic` fork `pine.elite.spawn.<id>`, not baked). This touches `combat/` → Pine rebake in the same commit.
3. The Antler King: one view-free boss script shared by the browser and headless (as Signal's Matriarch fbd8b15b6 and
   Sky's Roc 3361c50c3): `runtime/KingGoals.ts` loads in Node; `antlerKing.ts` must split its BossScript from
   BossBar / fx / fog / LightPool. Thralls (night + phase II) through the same lane. Shoves: `SimHost.impulsePlayer`.
4. Witness: headless 10k → replay (King mid-fight) → ledger from gameplay (feat facts via `pine.progress`) → entry proof on
   the four 8 m entryways. Flip `compatibility.json` only from a real run. `test/proof/*/run.mjs` runs Node without
   `--experimental-transform-types`; `runtime/index.ts` still imports the renderer behind the entry.

Pre-existing parity reds (Pine phone leak.textures / leak.weather.textures, Nalati save keys) predate this work.

Plan-State: unchanged.
