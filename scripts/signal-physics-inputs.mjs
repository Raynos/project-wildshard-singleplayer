import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Signal Dunes; a changed recipe refuses the trusted headless bake (SF72). */
export function signalPhysicsInputs(root) {
  const paths = ['shard.config.ts', 'plugin.ts', 'runtime/brains.ts', 'runtime/index.ts', 'combat/creatures.ts', 'combat/matriarch.ts']
    .map(path => `src/shards/sunscar-dunes/${path}`);
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'world', 'models', 'species', 'runtime/species']) walk(`src/shards/sunscar-dunes/${dir}`, path => /\.(?:ts|json)$/u.test(path));
  walk('public/assets/sunscar-dunes', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
