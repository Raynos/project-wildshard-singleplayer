import type { ShardContext } from '@wildshard/game/shard/context';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { DRIFTWOOD_SPECIES, DRIFTWOOD_LOOKS } from '../species/install';
import { registerDriftwoodToonPaints } from '../species/toonPaints';
import { installDriftwoodLootTables, DRIFTWOOD_COINS, DRIFTWOOD_TROPHIES } from '../loot/tables';
import { driftwoodWorld } from '../world/build';
import { PRACTICE_CRAB } from '../manifest';
import { ISLAND_BOAR, ISLAND_BEAR } from './species';
import { DRIFTWOOD_FAUNA, DRIFTWOOD_ENEMIES, DRIFTWOOD_PRACTICE } from './tables';
import { Enemies } from './Enemies';

/** Kit rows precede AnimalManager construction; the ready hook preserves the original placement stage. */
export function installDriftwoodCreatures(ctx: ShardContext, species = DRIFTWOOD_SPECIES): void {
  ctx.rows.species([...species, ISLAND_BOAR, ISLAND_BEAR]);
  ctx.rows.speciesLook(DRIFTWOOD_LOOKS);
  registerDriftwoodToonPaints(ctx.scope); // the boar / deer / elk / bear toon palettes (B50)
  ctx.rows.spawnTable([DRIFTWOOD_FAUNA, DRIFTWOOD_ENEMIES, DRIFTWOOD_PRACTICE]);
  ctx.rows.lootTable([DRIFTWOOD_COINS, DRIFTWOOD_TROPHIES]);
  installDriftwoodLootTables(ctx.scope);
  const shell = ctx.game.runtime;
  if (shell === undefined) throw new Error('Driftwood creatures require the world host');
  if (shell.world === null) throw new Error('Driftwood creatures require a built world');
  const world = shell.world, previousReady = shell.hooks.animalsReady, previousUpdate = shell.hooks.worldUpdate;
  let enemies: Enemies | null = null;
  const ready = (animals: AnimalManager): void => {
    previousReady?.(animals);
    const built = driftwoodWorld(shell);
    enemies = new Enemies(animals, { scope: ctx.scope, scene: world.game.scene, sky: world.sky,
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
