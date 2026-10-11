import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Signal Dunes; a changed recipe refuses the trusted headless bake (SF72). */
export function signalPhysicsInputs(root) {
  const paths = ['shard.config.ts', 'plugin.ts', 'runtime/index.ts', 'combat/creatures.ts', 'combat/matriarch.ts']
    .map(path => `src/shards/sunscar-dunes/${path}`);
  paths.push('src/shards/sunscar-dunes/generators/bake-signal-physics.mjs', 'src/engine/world/interact/prompts.ts');
  paths.push('src/shards/sunscar-dunes/runtime/looks/bakedGround.ts', 'src/shards/sunscar-dunes/runtime/looks/duneField.ts', 'src/shards/sunscar-dunes/runtime/looks/duneFieldRows.ts', 'src/shards/sunscar-dunes/runtime/looks/dusk.ts', 'src/shards/sunscar-dunes/runtime/looks/duskCurves.ts', 'src/shards/sunscar-dunes/runtime/looks/duskDome.ts', 'src/shards/sunscar-dunes/runtime/looks/duskFamilies.ts', 'src/shards/sunscar-dunes/runtime/looks/duskLook.ts', 'src/shards/sunscar-dunes/runtime/looks/familyLook.ts', 'src/shards/sunscar-dunes/runtime/looks/fireFx.ts', 'src/shards/sunscar-dunes/runtime/looks/fittedHull.ts', 'src/shards/sunscar-dunes/runtime/looks/lightLook.ts', 'src/shards/sunscar-dunes/runtime/looks/mapPalette.ts', 'src/shards/sunscar-dunes/runtime/looks/minimap.ts', 'src/shards/sunscar-dunes/runtime/looks/paintedStrips.ts', 'src/shards/sunscar-dunes/runtime/looks/renderLook.ts', 'src/shards/sunscar-dunes/runtime/looks/sky.ts', 'src/shards/sunscar-dunes/runtime/species/hullsRows.ts', 'src/shards/sunscar-dunes/runtime/species/striderRows.ts');
  paths.push('src/shards/sunscar-dunes/runtime/headlessRows.ts', 'src/shards/sunscar-dunes/runtime/looks/stormShell.ts', 'src/shards/sunscar-dunes/runtime/quest/matriarchFight.ts', 'src/shards/sunscar-dunes/runtime/quest/pivotNpc.ts', 'src/shards/sunscar-dunes/runtime/quest/questReward.ts', 'src/shards/sunscar-dunes/runtime/rowsHeadless.ts', 'src/shards/sunscar-dunes/runtime/shard/standaloneEntry.ts', 'src/shards/sunscar-dunes/runtime/shardfile/bossFight.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBoss.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBossPresentation.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBossRow.ts');
  paths.push('src/shards/sunscar-dunes/runtime/items/lashHold.ts', 'src/shards/sunscar-dunes/runtime/items/lashHost.ts', 'src/shards/sunscar-dunes/runtime/items/lashView.ts', 'src/shards/sunscar-dunes/runtime/items/lashWeapon.ts', 'src/shards/sunscar-dunes/runtime/items/whipRows.ts');
  const walk = (dir, accept) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, accept);
      else if (accept(path)) paths.push(relative(root, join(root, path)));
    }
  };
  for (const dir of ['data', 'generators', 'world', 'models', 'species', 'runtime/species']) walk(`src/shards/sunscar-dunes/${dir}`, path => /\.(?:ts|json)$/u.test(path));
  walk('public/assets/sunscar-dunes', path => path.endsWith('.glb'));
  return Object.fromEntries(paths.sort().map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
