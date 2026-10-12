import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Exact native actor/collision/model inputs of Signal Dunes; a changed recipe refuses the trusted headless bake (SF72). */
export function signalPhysicsInputs(root) {
  const paths = ['shard.config.ts', 'plugin.ts', 'runtime/index.ts', 'combat/creatures.ts', 'combat/matriarch.ts']
    .map(path => `src/shards/sunscar-dunes/${path}`);
  paths.push('src/shards/sunscar-dunes/generators/bake-signal-physics.mjs', 'src/engine/world/interact/prompts.ts');
  paths.push('src/shards/sunscar-dunes/runtime/looks/bakedGround.ts', 'src/shards/sunscar-dunes/runtime/looks/duneField.ts', 'src/shards/sunscar-dunes/runtime/looks/duskCurves.ts', 'src/shards/sunscar-dunes/runtime/looks/duskDome.ts', 'src/shards/sunscar-dunes/runtime/looks/duskFamilies.ts', 'src/shards/sunscar-dunes/runtime/looks/duskLook.ts', 'src/shards/sunscar-dunes/runtime/looks/fireFx.ts', 'src/shards/sunscar-dunes/runtime/looks/fittedHull.ts', 'src/shards/sunscar-dunes/runtime/looks/lightLook.ts', 'src/shards/sunscar-dunes/runtime/looks/mapPalette.ts', 'src/shards/sunscar-dunes/runtime/looks/paintedStrips.ts');
  paths.push('src/shards/sunscar-dunes/runtime/looks/stormShell.ts', 'src/shards/sunscar-dunes/runtime/quest/matriarchFight.ts', 'src/shards/sunscar-dunes/runtime/quest/pivotNpc.ts', 'src/shards/sunscar-dunes/runtime/quest/questReward.ts', 'src/shards/sunscar-dunes/runtime/rowsHeadless.ts', 'src/shards/sunscar-dunes/runtime/standalone.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBoss.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBossPresentation.ts', 'src/shards/sunscar-dunes/runtime/shardfile/markedBossRow.ts');
  paths.push('src/shards/sunscar-dunes/runtime/items/lashHold.ts', 'src/shards/sunscar-dunes/runtime/items/lashHost.ts', 'src/shards/sunscar-dunes/runtime/items/lashView.ts', 'src/shards/sunscar-dunes/runtime/items/lashWeapon.ts');
  paths.push('src/shards/sunscar-dunes/runtime/items/lash.ts');
  // DS1.5: the Node host, real creature factory and actual scout/prompt constructors define the producer.
  for (const file of ['src/shards/sunscar-dunes/manifest.ts', 'scripts/signal-physics-inputs.mjs',
    'scripts/bake/worldHost.mjs', 'scripts/bake/nativeWorld.mjs', 'scripts/bake/environment.mjs', 'scripts/bake-loader.mjs',
    'src/engine/entities/AnimalManager.ts', 'src/engine/entities/AnimalFactory.ts', 'src/engine/entities/AnimalView.ts',
    'src/engine/entities/AnimalSim.ts', 'src/engine/ai/hunt.ts', 'src/engine/ai/huntPattern.ts', 'src/engine/ai/stalker.ts',
    'src/engine/entities/species/registry.ts', 'src/engine/entities/species/look.ts', 'src/engine/practice/TrainingArena.ts',
    'src/engine/quest/view.ts', 'src/engine/quest/view/ui.ts', 'src/game/plugin/quests.ts',
    'src/engine/models/colliders.ts', 'src/engine/models/place.ts', 'src/engine/world/geometryBounds.ts', 'src/engine/world/registry.ts', 'pnpm-lock.yaml']) paths.push(file);
  // SF82: the canonical native boss patterns are part of the actual producer's defining closure.
  paths.push('src/format/weaponProfiles.ts', 'src/game/plugin/bossPhase.ts', 'src/game/shardfile/phasedBossRoaming.ts');
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
