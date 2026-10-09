import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** the declared movers (the moored boat, the rope bridge's chain) are runtime bodies, never part of this bake */
const MOVERS = new Set(['src/shards/driftwood-isle/data/movers.ts']);

/** Exact native actor/collision/model inputs of Driftwood Isle; a changed recipe refuses the trusted headless bake (SF72). */
export function driftwoodPhysicsInputs(root) {
  const paths = ['shard.config.ts', 'manifest.ts', 'plugin.ts', 'runtime/index.ts', 'runtime/hybrid.ts', 'runtime/brains.ts', 'npc/faceHeads.ts']
    .map(path => `src/shards/driftwood-isle/${path}`);
  // the manager and the hunting brain that roll every body's draws, the creature floor, the physics ground and its cuts
  paths.push('src/engine/entities/AnimalManager.ts', 'src/engine/entities/bodyClear.ts', 'src/engine/ai/hunt.ts', 'src/engine/world/faunaLayout.ts', 'src/engine/physics/terrain.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['creatures', 'data', 'world', 'models', 'species', 'combat']) walk(`src/shards/driftwood-isle/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !MOVERS.has(path));
  walk('src/game/systems/species', path => path.endsWith('.ts'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
