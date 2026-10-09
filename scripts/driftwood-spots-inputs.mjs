import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** the declared movers (the moored boat, the rope bridge's chain) are runtime bodies: they place no quest spot */
const MOVERS = new Set(['src/shards/driftwood-isle/data/movers.ts']);

/**
 * Exact source inputs of Driftwood Isle's quest spots (runtime/spots.baked.json, read off the built page by
 * scripts/bake-driftwood-spots.mjs): the interactables table and the adventure that places it (quest/), the POI modules
 * whose anchors and floors it stands on (world/, data/), Wendell (npc/), the finale's reward spot, the shard's config and
 * manifest, the kit's own placement (engine Interactables) and the physics ground. A changed input refuses the bake until
 * it is re-read from the page (SF72).
 */
export function driftwoodSpotsInputs(root) {
  const paths = ['shard.config.ts', 'manifest.ts', 'runtime/finale.ts'].map(path => `src/shards/driftwood-isle/${path}`);
  paths.push('src/engine/world/interact/Interactables.ts', 'src/engine/world/interact/prompts.ts', 'src/engine/world/interact/pickup.ts', 'src/engine/physics/terrain.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['quest', 'world', 'data', 'npc']) walk(`src/shards/driftwood-isle/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !MOVERS.has(path));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
