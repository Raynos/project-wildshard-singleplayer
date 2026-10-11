import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** the declared movers (the moored boat, the rope bridge's chain) are runtime bodies, never part of this bake */
const MOVERS = new Set(['src/shards/driftwood-isle/data/movers.ts']);

/** Exact native actor/collision/model inputs of Driftwood Isle; a changed recipe refuses the trusted headless bake (SF72). */
export function driftwoodPhysicsInputs(root) {
  const paths = ['shard.config.ts', 'manifest.ts', 'runtime/ziplineLayout.ts', 'data/modes.ts', 'plugin.ts', 'runtime/standalone.ts', 'runtime/index.ts', 'runtime/hybrid.ts', 'runtime/brains.ts', 'npc/faceHeads.ts']
    .map(path => `src/shards/driftwood-isle/${path}`);
  // the manager and the hunting brain that roll every body's draws, the creature floor, the physics ground and its cuts
  paths.push('src/shards/driftwood-isle/generators/bake-driftwood-physics.mjs', 'src/shards/driftwood-isle/generators/groundRows.ts', 'src/shards/driftwood-isle/generators/groundField.ts', 'src/shards/driftwood-isle/generators/landscape.ts', 'src/shards/driftwood-isle/generators/landscapeNoise.ts', 'src/shards/driftwood-isle/generators/driftwoodSpots.mjs', 'scripts/driftwood-spots-inputs.mjs', 'src/engine/physics/Physics.ts', 'src/engine/physics/surface.ts', 'src/engine/world/interact/prompts.ts', 'public/assets/models/driftwood-hero/captain/captain.glb', 'public/assets/models/driftwood-hero/faces/sailor-head.glb', 'src/engine/entities/AnimalFactory.ts', 'src/engine/entities/AnimalView.ts', 'src/engine/entities/animalPose.ts', 'src/engine/entities/animalRig.ts', 'src/engine/entities/species/rigs.ts', 'src/engine/entities/AnimalManager.ts', 'src/engine/entities/bodyClear.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/huntPattern.ts', 'src/engine/ai/stalker.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  paths.push('src/shards/driftwood-isle/runtime/kit/kitParts.ts', 'src/shards/driftwood-isle/runtime/looks/bakedIsland.ts', 'src/shards/driftwood-isle/runtime/looks/boatLook.ts', 'src/shards/driftwood-isle/runtime/looks/cascade.ts', 'src/shards/driftwood-isle/runtime/looks/castawayLook.ts', 'src/shards/driftwood-isle/runtime/looks/coverGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/coverGrid.ts', 'src/shards/driftwood-isle/runtime/looks/facetedDay.ts', 'src/shards/driftwood-isle/runtime/looks/facetedDayBackdrop.ts', 'src/shards/driftwood-isle/runtime/looks/facetedGround.ts', 'src/shards/driftwood-isle/runtime/looks/facetedOcean.ts', 'src/shards/driftwood-isle/runtime/looks/facetedSky.ts', 'src/shards/driftwood-isle/runtime/looks/fpArmsGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/groundCoverLook.ts', 'src/shards/driftwood-isle/runtime/looks/groundLook.ts', 'src/shards/driftwood-isle/runtime/looks/gullFlock.ts', 'src/shards/driftwood-isle/runtime/looks/gullsGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/instancedTiles.ts', 'src/shards/driftwood-isle/runtime/looks/islandLook.ts', 'src/shards/driftwood-isle/runtime/looks/oceanGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/reefBed.ts', 'src/shards/driftwood-isle/runtime/looks/reefGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/seabedLook.ts', 'src/shards/driftwood-isle/runtime/looks/skyGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/smokeColumn.ts', 'src/shards/driftwood-isle/runtime/looks/streamedCover.ts', 'src/shards/driftwood-isle/runtime/looks/toonGlsl.ts', 'src/shards/driftwood-isle/runtime/looks/traderLook.ts', 'src/shards/driftwood-isle/runtime/looks/waterfallGlsl.ts', 'src/shards/driftwood-isle/runtime/props/mooringLines.ts', 'src/shards/driftwood-isle/runtime/viewmodel/toonArms.ts');
  paths.push('src/shards/driftwood-isle/runtime/models/slots.ts', 'src/shards/driftwood-isle/runtime/world/blenderArea.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['creatures', 'data', 'world', 'models', 'species', 'combat', 'quest', 'npc']) walk(`src/shards/driftwood-isle/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !MOVERS.has(path));
  paths.push('src/game/plugin/animation.ts', 'scripts/bake/worldHost.mjs', 'scripts/bake/worldHost.d.mts', 'scripts/bake/environment.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake-loader.mjs', 'scripts/driftwood-physics-inputs.mjs', 'src/engine/world/Heightfield.ts', 'src/engine/physics/pieces.ts', 'src/engine/physics/entrySockets.ts', 'src/engine/physics/bodies.ts', 'src/engine/physics/active.ts', 'src/engine/practice/TrainingArena.ts', 'src/game/models/interact.ts', 'src/game/systems/props/interact.ts', 'src/engine/world/interact/Interactables.ts', 'public/assets/baked/driftwood-isle/terrain.bin');
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  paths.push('src/game/plugin/mover.ts', 'src/format/modes.ts');
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
