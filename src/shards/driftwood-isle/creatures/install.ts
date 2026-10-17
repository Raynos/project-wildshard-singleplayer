import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { DRIFTWOOD_LOOKS } from '../species/install';
import { ISLAND_BEAR_LOOK, ISLAND_BOAR_LOOK } from '../species/fauna';
import { readLootTables, registerLootTable } from '@wildshard/game/loot/tables';
import { driftwoodWorld } from '../world/build';
import { PRACTICE_CRAB } from '../data/layout';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { driftwoodSpeciesRows } from './rows';
import { Enemies } from './Enemies';
import { CAPTAIN_LOOK } from '../species/captain';
import { captainMesh } from '../species/captainMesh';
import { graphCaptainLook, graphCreatureLook } from '../runtime/looks/creatureLooks';

/** Kit rows precede AnimalManager construction; the ready hook preserves the original placement stage. */
export function installDriftwoodCreatures(ctx: ShardContext, decisions: SpeciesDecisionAuthority): void {
  const section = ctx.product.section('actors/species-programs'), program = section.program;
  const respawn = section.spawns?.find(row => row.id === 'spawn.driftwood.practice')?.respawn;
  if (program === undefined || respawn === undefined) throw new Error('Driftwood requires its admitted creature recipes');
  ctx.rows.species([...driftwoodSpeciesRows(program,decisions), ...section.page]);
  // the boar and bear from the bake; every creature on the graph toon look, the Drowned Captain on his painted coat
  ctx.rows.speciesLook([...DRIFTWOOD_LOOKS, ISLAND_BOAR_LOOK, ISLAND_BEAR_LOOK].map((look) => (look === CAPTAIN_LOOK ? graphCaptainLook(look, () => captainMesh.textureFor()) : graphCreatureLook(look))));
  ctx.rows.spawnTable(declaredSpawnTables(section.spawns));
  const loot = readLootTables(ctx.product.section('economy/loot').rows.loot[0]?.economy?.tables);
  ctx.rows.lootTable(loot);
  for (const row of loot) registerLootTable(row, ctx.scope);
  const shell = ctx.game.runtime;
  if (shell === undefined) throw new Error('Driftwood creatures require the world host');
  if (shell.world === null) throw new Error('Driftwood creatures require a built world');
  const world = shell.world, previousReady = shell.hooks.animalsReady, previousUpdate = shell.hooks.worldUpdate;
  let enemies: Enemies | null = null;
  const ready = (animals: AnimalManager): void => {
    previousReady?.(animals);
    const built = driftwoodWorld(shell);
    enemies = new Enemies(animals, { respawn, scope: ctx.scope, scene: world.game.scene, sky: world.sky,
      palms: built.palmSpecs, wreck: built.wreck, crabSites: built.cove?.crabSites ?? [], practice: PRACTICE_CRAB }).build();
    shell.objects['enemies'] = enemies;
  };
  const update = (dt: number, t: number): void => { previousUpdate?.(dt, t); enemies?.update(dt, t, world.player.position); };
  shell.hooks.animalsReady = ready; shell.hooks.worldUpdate = update;
  ctx.scope.onDispose(() => {
    if (shell.hooks.animalsReady === ready) {
      if (previousReady === undefined) delete shell.hooks.animalsReady; else shell.hooks.animalsReady = previousReady;
    }
    if (shell.hooks.worldUpdate === update) {
      if (previousUpdate === undefined) delete shell.hooks.worldUpdate; else shell.hooks.worldUpdate = previousUpdate;
    }
    if (shell.objects['enemies'] === enemies) delete shell.objects['enemies'];
  });
}
