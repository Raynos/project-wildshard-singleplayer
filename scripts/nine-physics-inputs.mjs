import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const UNCOLLIDED = new Set(['jian.ts', 'portalRide.ts', 'portalVeil.ts'].map(name => `src/shards/nine-dragon-stack/world/${name}`));

/**
 * Exact native collision inputs of Nine Dragon Stack (with the layout's generators, G285: the crossings come from its bake):
 * the fragment's floors and fronts, the Well's crossings and guard, the
 * landing decks and every placed model's colliders; a changed recipe refuses the trusted headless bake (SF72). The world
 * modules that register no collider are left out (the Jian's view, world/jian.ts; the portals' ride, world/portalRide.ts,
 * and its fade veil, portalVeil.ts, once split out), so a viewmodel or ride change never forces a physics rebake.
 */
export function ninePhysicsInputs(root) {
  const paths = ['manifest.ts', 'shard.config.ts', 'layout.ts', 'terrain.ts', 'places.ts', 'runtime/state.ts'].map(path => `src/shards/nine-dragon-stack/${path}`);
  // DS1.5: fence the actual Node capture, host, placement math, practice room and their platform versions.
  for (const file of ['src/shards/nine-dragon-stack/generators/bake-nine-physics.mjs',
    'scripts/bake/worldHost.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake/environment.mjs', 'scripts/bake-loader.mjs',
    'scripts/nine-physics-inputs.mjs', 'src/game/plugin/mover.ts', 'src/format/modes.ts', 'src/engine/models/colliders.ts', 'src/engine/models/place.ts', 'src/engine/world/geometryBounds.ts',
    'src/engine/practice/TrainingArena.ts', 'src/engine/world/registry.ts', 'test/fake/portableMath.ts', 'src/commons/bake/portableMath.ts', 'pnpm-lock.yaml']) paths.push(file);
  // DS1.3: the declared portal floors now compile through the retained authoring reader.
  for (const file of ['scene', 'sceneDeclarations', 'physics', 'sceneTransform', 'sceneAnimation', 'sceneAudio', 'audio', 'entries', 'spawns', 'movers', 'modes', 'director']) paths.push(`src/sdk/${file}.ts`);
  // DS1.4: the reader's catalogue materials and light rows.
  for (const file of ['src/sdk/materials.ts', 'src/format/lights.ts', 'src/format/materialFamilies.ts', 'src/format/materialGraph.ts']) paths.push(file);
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'generators', 'world', 'models']) walk(`src/shards/nine-dragon-stack/${dir}`, path => /\.(?:ts|json)$/u.test(path) && !UNCOLLIDED.has(path));
  walk('public/assets/nine-dragon', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
