import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Pine Hollow; a changed recipe refuses the trusted headless bake (SF72). */
export function pinePhysicsInputs(root) {
  const paths = ['layout.ts', 'shard.config.ts', 'manifest.ts', 'plugin.ts', 'runtime/index.ts', 'runtime/fauna.ts']
    .map(path => `src/shards/pine-hollow/${path}`);
  // the shared creature rows Pine's herds derive their simulation fields from, the manager and the hunting brain that roll them
  paths.push('src/shards/pine-hollow/generators/bake-pine-physics.mjs', 'src/shards/pine-hollow/generators/pineSpots.mjs', 'src/shards/pine-hollow/generators/bake-pine-spots.mjs', 'src/engine/player/WeaponPickup.ts', 'src/engine/entities/AnimalView.ts', 'src/engine/entities/animalPose.ts', 'src/engine/entities/animalRig.ts', 'src/engine/entities/species/rigs.ts', 'src/engine/entities/AnimalManager.ts', 'src/engine/entities/bodyClear.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/huntPattern.ts', 'src/engine/ai/stalker.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  // The trusted owner identity capture depends on the actual tag writer and readonly probe, not geometry guesses.
  paths.push('src/engine/physics/surface.ts', 'src/engine/physics/pieces.ts', 'src/engine/world/registry.ts', 'src/engine/debug/probe.ts');
  // Native rain goals read the page's exact crown-cover values from this defining texture builder.
  paths.push('src/shards/pine-hollow/runtime/looks/rainFx.ts');
  // SF82: the canonical native boss patterns are part of the actual producer's defining closure.
  paths.push('src/game/plugin/bossPhase.ts', 'src/game/shardfile/phasedBossRoaming.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'world', 'models', 'species', 'combat', 'quest', 'runtime/looks', 'runtime/kit', 'runtime/props', 'runtime/npc', 'runtime/species', 'runtime/cull', 'runtime/viewmodel', 'runtime/items', 'runtime/brains']) walk(`src/shards/pine-hollow/${dir}`, path => /\.(?:ts|json)$/u.test(path));
  paths.push('src/game/plugin/animation.ts', 'scripts/bake/worldHost.mjs', 'scripts/bake/environment.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake-loader.mjs', 'scripts/pine-physics-inputs.mjs', 'src/engine/world/Heightfield.ts', 'src/engine/physics/entrySockets.ts', 'src/engine/world/Terrain.ts', 'src/engine/practice/TrainingArena.ts', 'src/game/models/interact.ts', 'src/engine/world/interact/Interactables.ts', 'src/shards/pine-hollow/runtime/antlerKing.ts', 'src/shards/pine-hollow/runtime/persistence.ts', 'src/shards/pine-hollow/runtime/facts.ts', 'src/shards/pine-hollow/runtime/questLifetime.ts', 'src/shards/pine-hollow/runtime/directorClock.ts', 'src/shards/pine-hollow/runtime/elitePrelude.ts', 'src/shards/pine-hollow/runtime/nightDirector.ts', 'src/shards/pine-hollow/runtime/nightPopulation.ts', 'src/shards/pine-hollow/behaviour/night.as', 'src/shards/pine-hollow/behaviour/night.generated.json', 'src/game/plugin/director.ts', 'src/shards/pine-hollow/look/dayKeys.ts', 'public/assets/baked/pine-hollow/terrain.bin', 'pnpm-lock.yaml');
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  walk('public/assets/pine-hollow/creatures', path => path.endsWith('.glb'));
  walk('public/assets/pine-hollow/npcs', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
