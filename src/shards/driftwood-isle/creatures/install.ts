import { PerchBodyBinding } from '@wildshard/game/population/perchBody';
import { MONKEY_LOOK } from '../species/monkey';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import type { ShardContext } from '@wildshard/game/shard/context';
import { DRIFTWOOD_LOOKS } from '../species/install';
import { ISLAND_BEAR_LOOK, ISLAND_BOAR_LOOK } from '../species/fauna';
import { readLootTables, registerLootTable } from '@wildshard/game/loot/tables';
import { declaredSpawnTables } from '@wildshard/engine/ai/encounters';
import { driftwoodSpeciesRows } from './rows';
import { installPopulationProjection } from '@wildshard/game/shardfile/clientPopulationProjection';
import { preloadSailorHead } from '../species/sailor';
import { CAPTAIN_LOOK } from '../species/captain';
import { captainMesh } from '../species/captainMesh';
import { graphCaptainLook, graphCreatureLook } from '../runtime/looks/creatureLooks';


/** Kit rows precede AnimalManager construction; the ready hook preserves the original placement stage. */
export async function installDriftwoodCreatures(ctx: ShardContext, decisions: SpeciesDecisionAuthority): Promise<void> {
  const monkey = new PerchBodyBinding(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('poses/monkey.json'))), ctx.scope);
  const section = ctx.product.section('actors/species-programs'), program = section.program;
  const respawn = section.spawns?.find(row => row.id === 'spawn.driftwood.practice')?.respawn;
  if (program === undefined || respawn === undefined) throw new Error('Driftwood requires its admitted creature recipes');
  ctx.rows.species([...driftwoodSpeciesRows(program,monkey,decisions), ...section.page]);
  // the boar and bear from the bake; every creature on the graph toon look, the Drowned Captain on his painted coat
  ctx.rows.speciesLook([...DRIFTWOOD_LOOKS, ISLAND_BOAR_LOOK, ISLAND_BEAR_LOOK].map((look) => (look === CAPTAIN_LOOK ? graphCaptainLook(look, () => captainMesh.textureFor()) : graphCreatureLook(look === MONKEY_LOOK ? { ...look, animate: monkey.animate } : look))));
  ctx.rows.spawnTable(declaredSpawnTables(section.spawns));
  const loot = readLootTables(ctx.product.section('economy/loot').rows.loot[0]?.economy?.tables);
  ctx.rows.lootTable(loot);
  for (const row of loot) registerLootTable(row, ctx.scope);
  await preloadSailorHead();
  installPopulationProjection(ctx, await ctx.product.json('actors/projection.json'));
}
