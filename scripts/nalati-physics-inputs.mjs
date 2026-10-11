import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Nalati Grasslands; a changed recipe refuses the trusted headless bake (SF72). */
export function nalatiPhysicsInputs(root) {
  const paths = ['layout.ts', 'shard.config.ts', 'manifest.ts', 'plugin.ts', 'edge.ts', 'wet.ts', 'outcrops.ts', 'cragRock.ts', 'terrainSurface.ts', 'water.ts', 'kokpar.ts',
    'runtime/index.ts', 'runtime/state.ts', 'runtime/groupDeclared.ts', 'runtime/groupDispatch.ts', 'runtime/groupPorts.ts', 'runtime/groupRegistry.ts', 'runtime/flockDeclared.ts', 'runtime/aqbarsKeeper.ts', 'runtime/argymaqKeeper.ts', 'runtime/windStooper.ts', 'data/qyranProfile.ts', 'runtime/qyranKeeper.ts', 'runtime/ledgePouncer.ts', 'runtime/packHowler.ts', 'data/eliteProfiles.ts', 'runtime/kokboriKeeper.ts',
    'runtime/ghostVolleyDirector.ts', 'runtime/ghostRosterKeeper.ts', 'runtime/headlessGhost.ts', 'runtime/raidDirector.ts', 'runtime/tamingLaw.ts', 'look/grassFieldLayout.ts']
    .map(path => `src/shards/nalati-grasslands/${path}`);
  // the manager, the hunting brain and the group policies that roll and drive the bodies, the shared floor recipe
  paths.push('src/engine/world/geometryBounds.ts');
  paths.push('src/engine/entities/AnimalManager.ts', 'src/engine/entities/bodyClear.ts', 'src/engine/ai/diver.ts', 'src/engine/ai/stalker.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/huntPattern.ts', 'src/engine/ai/pack.ts', 'src/engine/ai/herd.ts', 'src/engine/ai/grazer.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  // the grass field the bake samples (its `grass` rows)
  paths.push('src/game/systems/looks/grassField.ts');
  // SF82: the canonical native boss patterns are part of the actual producer's defining closure.
  paths.push('src/game/plugin/bossPhase.ts', 'src/game/shardfile/phasedBossRoaming.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  // data/runtimeCost.ts is the memory model's calibration (SF57), never an actor or collider recipe
  for (const dir of ['data', 'world', 'models', 'species', 'combat', 'creatures', 'ride', 'runtime/looks']) walk(`src/shards/nalati-grasslands/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !path.endsWith('data/runtimeCost.ts'));
  paths.push('src/game/plugin/mover.ts', 'src/game/plugin/animation.ts', 'src/shards/nalati-grasslands/generators/bake-nalati-physics.mjs', 'scripts/bake/worldHost.mjs', 'scripts/bake/environment.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake-loader.mjs', 'scripts/nalati-physics-inputs.mjs', 'src/engine/world/Heightfield.ts', 'src/engine/physics/entrySockets.ts', 'src/engine/world/Terrain.ts', 'src/engine/practice/TrainingArena.ts', 'src/engine/physics/pieces.ts', 'src/engine/world/registry.ts', 'src/engine/app/identity.ts', 'src/engine/entities/AnimalView.ts', 'src/engine/entities/animalPose.ts', 'src/engine/entities/animalRig.ts', 'src/engine/entities/species/rigs.ts', 'src/shards/nalati-grasslands/adventure.ts', 'src/shards/nalati-grasslands/stealth.ts', 'src/shards/nalati-grasslands/runtime/groupHost.ts', 'public/assets/baked/nalati-grasslands/terrain.bin', 'pnpm-lock.yaml');
  paths.push('src/shards/nalati-grasslands/data/questStory.ts', 'src/shards/nalati-grasslands/campPeople.ts', 'src/shards/nalati-grasslands/campPeopleModels.ts', 'src/shards/nalati-grasslands/campPeopleProfiles.ts', 'src/shards/nalati-grasslands/runtime/quests.ts', 'src/shards/nalati-grasslands/runtime/persistence.ts', 'src/shards/nalati-grasslands/runtime/enteredAdventure.ts');
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  walk('public/assets/nalati/models', path => path.endsWith('.rigged.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
