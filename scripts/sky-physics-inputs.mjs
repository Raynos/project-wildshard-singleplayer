import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native collision/model inputs; a changed recipe refuses the trusted headless bake. */
export function skyPhysicsInputs(root) {
  const paths = ['layout.ts', 'data/layout.ts', 'data/files.ts', 'data/spawns.ts', 'data/species.ts', 'data/variants.ts', 'data/strikes.ts', 'data/movers.ts', 'data/isletLift.ts', 'data/isletDesign.ts', 'generators/risingIslets.ts', 'generators/physicsPlacements.ts', 'generators/bridgeColliders.ts', 'data/storm.ts', 'data/modes.ts',
    'runtime/index.ts', 'data/crownLayout.ts', 'data/brains.ts'].map(path => `src/shards/far-reach/${path}`);
  // DS1.5: the native Node world, finite spawn factory and loaded rigs are the producer's defining closure.
  for (const file of ['src/shards/far-reach/manifest.ts', 'src/shards/far-reach/shard.config.ts',
    'src/shards/far-reach/generators/bake-sky-physics.mjs', 'scripts/sky-physics-inputs.mjs',
    'scripts/bake/worldHost.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake/environment.mjs', 'scripts/bake-loader.mjs',
    'src/game/plugin/mover.ts', 'src/format/modes.ts', 'src/engine/entities/AnimalManager.ts', 'src/engine/entities/AnimalFactory.ts', 'src/engine/entities/AnimalView.ts',
    'src/engine/entities/AnimalSim.ts', 'src/game/plugin/geometry.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/huntPattern.ts', 'src/engine/ai/stalker.ts',
    'src/engine/entities/species/registry.ts', 'src/engine/entities/species/look.ts', 'src/engine/practice/TrainingArena.ts',
    'src/engine/models/colliders.ts', 'src/engine/models/place.ts', 'src/engine/world/geometryBounds.ts', 'src/engine/world/registry.ts', 'pnpm-lock.yaml']) paths.push(file);
  // SF82: the canonical native boss patterns are part of the actual producer's defining closure.
  paths.push('src/shards/far-reach/data/rocFight.ts', 'src/format/bossProfiles.ts', 'src/format/directorStages.ts', 'src/game/plugin/director.ts', 'src/sdk/species.ts', 'src/sdk/species/clips.ts', 'src/engine/ai/strikeRows.ts', 'src/game/plugin/bossPhase.ts', 'src/game/shardfile/phasedBossRoaming.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['world', 'models', 'species']) walk(`src/shards/far-reach/${dir}`, path => path.endsWith('.ts'));
  walk('public/assets/far-reach', path => path.endsWith('.glb'));
  // the baked world pieces' rows carry their colliders (SF72, src/shards/far-reach/generators/bake-sky-world.mjs)
  walk('src/shards/far-reach/data', path => path.endsWith('.json'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
