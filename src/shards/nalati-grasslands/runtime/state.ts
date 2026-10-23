import { entryOwner, presentEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import { clientWildlife } from '@wildshard/game/population/wildlife';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';

import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';

/** Transitional diagnostic aliases; declared features own construction and frames. */
export type Nalati = Awaited<ReturnType<typeof buildNalatiState>>;

function buildNalatiState(ctx: NonNullable<ShardRuntime['world']>, plugin: ShardContext) {
  if (plugin.game.runtime?.world !== ctx) throw new Error('Missing original world construction owner');
  const groups = entryOwner(plugin.scope, 'world-groups', 'nalati.world');
  const titan = entryOwner(plugin.scope, 'arena-room', 'nalati.titan');

  const eliteOwner = entryOwner(plugin.scope, 'elite-entry', 'nalati.elites');
  const { entry: elites, rows: eliteRows, models: drops, fight: charge, ledges: eliteLedges } = eliteOwner;
  const eliteProgram = eliteOwner.program.value;

  const boss = entryOwner(plugin.scope, 'arena-room', 'nalati.king');

  const night = entryOwner(plugin.scope, 'timed-encounters', 'nalati.night');
  function eliteFrame() { const ride = presentEntryOwner(plugin.scope, 'riding-play', 'nalati.riding'); return { patrolAvailable: true, herdAvailable: clientWildlife(plugin) !== null, kills: night.riders.killsTonight,
    bonded: ride?.taming.phase === 'bonded', mount: ride?.taming.companion ?? null }; }
  const nalati = {
    groups, boss, elites, titan, eliteFrame, eliteRows, eliteProgram, eliteDrops: drops, eliteCharge: charge, eliteLedges,
    get elitePatrol() { return night.riders; },
    get stealth() { return presentEntryOwner(plugin.scope, 'stealth', 'nalati.stealth'); },
    get ride() { return presentEntryOwner(plugin.scope, 'riding-play', 'nalati.riding'); },
    get wildlife() { return clientWildlife(plugin); },
    get skins() { return clientCosmeticFinishes(plugin).locker; },
  };

  return nalati;
}

/** The public boundary keeps the defining builder's complete input and state contract. */
export const buildNalatiWorld: typeof buildNalatiState = buildNalatiState;
