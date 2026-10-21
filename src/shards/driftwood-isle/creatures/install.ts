import { PerchBodyBinding } from '@wildshard/game/population/perchBody';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { ShardContext } from '@wildshard/game/shard/context';
import { driftwoodLooks } from '../species/install';
import { ISLAND_BEAR_LOOK, ISLAND_BOAR_LOOK } from '../species/fauna';
import { readLootTables, registerLootTable } from '@wildshard/game/loot/tables';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { installPopulationProjection } from '@wildshard/game/shardfile/clientPopulationProjection';
import { preloadCreatureBodies } from '../species/bodies';
import { graphCreatureLook } from '../runtime/looks/creatureLooks';


/** Kit rows precede AnimalManager construction; the ready hook preserves the original placement stage. */
export async function installDriftwoodCreatures(ctx: ShardContext, decisions: SpeciesDecisionAuthority): Promise<void> {
  const monkey = new PerchBodyBinding(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('poses/monkey.json'))), ctx.scope);
  const section = ctx.product.section('actors/species-programs'), program = section.program;
  const respawn = section.spawns?.find(row => row.id === 'spawn.driftwood.practice')?.respawn;
  if (program === undefined || respawn === undefined) throw new Error('Driftwood requires its admitted creature recipes');
  ctx.rows.species([...monkey.species(ctx, program, decisions), ...section.page]);
  // the boar and bear from the bake; every creature on its graph toon look
  ctx.rows.speciesLook([...await driftwoodLooks(ctx.product), ISLAND_BOAR_LOOK, ISLAND_BEAR_LOOK].map((look) => graphCreatureLook(look.kind === 'monkey' ? { ...look, animate: monkey.animate } : look)));
  ctx.rows.spawnTable(declaredSpawnTables(section.spawns));
  const loot = readLootTables(ctx.product.section('economy/loot').rows.loot[0]?.economy?.tables);
  ctx.rows.lootTable(loot);
  for (const row of loot) registerLootTable(row, ctx.scope);
  await preloadCreatureBodies();
  installPopulationProjection(ctx, await ctx.product.json('actors/projection.json'));
}
