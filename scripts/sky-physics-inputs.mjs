import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native collision/model inputs; a changed recipe refuses the trusted headless bake. */
export function skyPhysicsInputs(root) {
  const paths = ['layout.ts', 'data/layout.ts', 'data/spawns.ts', 'runtime/variants.ts', 'data/movers.ts', 'data/isletLift.ts', 'data/storm.ts',
    'runtime/index.ts', 'runtime/crownLayout.ts'].map(path => `src/shards/far-reach/${path}`);
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
