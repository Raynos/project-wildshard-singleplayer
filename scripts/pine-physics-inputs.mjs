import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Pine Hollow; a changed recipe refuses the trusted headless bake (SF72). */
export function pinePhysicsInputs(root) {
  const paths = ['layout.ts', 'shard.config.ts', 'manifest.ts', 'plugin.ts', 'runtime/index.ts', 'runtime/fauna.ts']
    .map(path => `src/shards/pine-hollow/${path}`);
  // the shared creature rows Pine's herds derive their simulation fields from, the manager and the hunting brain that roll them
  paths.push('src/engine/entities/AnimalManager.ts', 'src/engine/ai/hunt.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'world', 'models', 'species', 'combat']) walk(`src/shards/pine-hollow/${dir}`, path => /\.(?:ts|json)$/u.test(path));
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  walk('public/assets/pine-hollow/creatures', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
