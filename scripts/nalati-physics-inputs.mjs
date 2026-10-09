import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Nalati Grasslands; a changed recipe refuses the trusted headless bake (SF72). */
export function nalatiPhysicsInputs(root) {
  const paths = ['layout.ts', 'shard.config.ts', 'manifest.ts', 'plugin.ts', 'edge.ts', 'wet.ts', 'outcrops.ts', 'cragRock.ts', 'terrainSurface.ts', 'water.ts', 'kokpar.ts',
    'runtime/index.ts', 'runtime/state.ts', 'runtime/groupDeclared.ts', 'runtime/groupDispatch.ts', 'runtime/groupPorts.ts', 'runtime/groupRegistry.ts', 'runtime/flockDeclared.ts']
    .map(path => `src/shards/nalati-grasslands/${path}`);
  // the manager, the hunting brain and the group policies that roll and drive the bodies, the shared floor recipe
  paths.push('src/engine/entities/AnimalManager.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/pack.ts', 'src/engine/ai/herd.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  // data/runtimeCost.ts is the memory model's calibration (SF57), never an actor or collider recipe
  for (const dir of ['data', 'world', 'models', 'species', 'combat', 'creatures', 'ride']) walk(`src/shards/nalati-grasslands/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !path.endsWith('data/runtimeCost.ts'));
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  walk('public/assets/nalati/models', path => path.endsWith('.rigged.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
