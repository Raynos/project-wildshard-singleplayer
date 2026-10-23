import { entryOwner, lateEntryOwner, presentEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import { clientWildlife, clientWildlifeState } from '@wildshard/game/population/wildlife';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import * as v from 'valibot';






import { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';


import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';
import { installCombatTargets, type CombatTargetOwner } from '@wildshard/game/shardfile/clientTargets';



/** The defining builders keep the published state and its consumers on one contract. */
export type Nalati = Awaited<ReturnType<typeof buildNalatiState>>;

async function buildNalatiState(ctx: NonNullable<ShardRuntime['world']>, plugin: ShardContext) {
  if (plugin.game.runtime?.world !== ctx) throw new Error('Missing original world construction owner');
  const { combatTargets: targetRows } = v.parse(v.object({ combatTargets: v.unknown() }), await plugin.product.json('sim/headless-boot.json'));
  const groups = entryOwner(plugin.scope, 'world-groups', 'nalati.world');
  const dressing = SceneDressing.current(plugin);
  const weatherLoan = lateEntryOwner(plugin.scope, 'world-weather', 'nalati.weather');
  const resolveWeather = () => {
    const rig = weatherLoan(), storm = rig.storm, painted = rig.sky;
    if (storm === null || painted === null) throw new Error('Nalati requires its painted sky and storm');
    return { clock: painted.clock, look: painted.look, dome: painted.dome, air: rig.weather, weather: storm };
  };
  let weather: ReturnType<typeof resolveWeather> | undefined;
  const readWeather = () => { weatherLoan(); weather ??= resolveWeather(); return weather; };

  // ── Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): the Wind Cairn's threshold (mounted, in a natural storm), the
  //    Titan beyond the south rim, the arena's wall / whirlwinds / riders / fire; the heart joins the Targets chain below ──
  const titan = entryOwner(plugin.scope, 'arena-room', 'nalati.titan');

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/shards/nalati-grasslands/elites.ts ──
  const eliteOwner = entryOwner(plugin.scope, 'elite-entry', 'nalati.elites');
  const { entry: elites, rows: eliteRows, models: drops, fight: charge, ledges: eliteLedges } = eliteOwner;
  const eliteProgram = eliteOwner.program.value;


  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const boss = entryOwner(plugin.scope, 'arena-room', 'nalati.king');

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const night = entryOwner(plugin.scope, 'timed-encounters', 'nalati.night');
  function eliteFrame() { const ride = presentEntryOwner(plugin.scope, 'riding-play', 'nalati.riding'); return { patrolAvailable: true, herdAvailable: clientWildlife(plugin) !== null, kills: night.riders.killsTonight,
    bonded: ride?.taming.phase === 'bonded', mount: ride?.taming.companion ?? null }; }
  const nalati = {
    get weather() { return readWeather(); }, groups, boss, elites, titan, eliteFrame, eliteRows, eliteProgram, eliteDrops: drops, eliteCharge: charge, eliteLedges,
    get elitePatrol() { return night.riders; },
    get stealth() { return presentEntryOwner(plugin.scope, 'stealth', 'nalati.stealth'); },
    get ride() { return presentEntryOwner(plugin.scope, 'riding-play', 'nalati.riding'); },
    get wildlife() { return clientWildlife(plugin); },
    get skins() { return clientCosmeticFinishes(plugin).locker; },
  };
  // ── crouch + grass stealth (melee agent, B9): the long-grass CROUCH toggle (touch disc above JUMP, C / Ctrl on desktop),
  //    the eye pip + GRASS meter + threat chevron, the sneak shot (× 2 from HIDDEN on arrows and javelins) — src/shards/nalati-grasslands/stealth.ts ──
  // ── dusk + night enemies (bow agent, B11): the balbal warriors wake at dusk, the ghost riders ride the ridges at night —
  //    src/shards/nalati-grasslands/nightEnemies.ts (balbalWarriors.ts, ghostRiders.ts); chained into attachAnimals / bindPlay / the Targets ray ──

  installCombatTargets(plugin, targetRows, new Map<string, CombatTargetOwner>([['night', night], ['titan', titan]]), clientWildlifeState(plugin));
  plugin.debug.expose('nalati', nalati);
  plugin.debug.expose('nalati.ghosts', night.riders);
  plugin.debug.expose('nalati.dressing', dressing);
  return nalati;
}

/** The public boundary keeps the defining builder's complete input and state contract. */
export const buildNalatiWorld: typeof buildNalatiState = buildNalatiState;
