import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const UNCOLLIDED = new Set(['jian.ts', 'portalRide.ts', 'portalVeil.ts'].map(name => `src/shards/nine-dragon-stack/world/${name}`));

/**
 * Exact native collision inputs of Nine Dragon Stack: the fragment's floors and fronts, the Well's crossings and guard, the
 * landing decks and every placed model's colliders; a changed recipe refuses the trusted headless bake (SF72). The world
 * modules that register no collider are left out (the Jian's view, world/jian.ts; the portals' ride, world/portalRide.ts,
 * and its fade veil, portalVeil.ts, once split out), so a viewmodel or ride change never forces a physics rebake.
 */
export function ninePhysicsInputs(root) {
  const paths = ['shard.config.ts', 'layout.ts', 'terrain.ts', 'places.ts', 'runtime/state.ts'].map(path => `src/shards/nine-dragon-stack/${path}`);
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'world', 'models']) walk(`src/shards/nine-dragon-stack/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !UNCOLLIDED.has(path));
  walk('public/assets/nine-dragon', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
