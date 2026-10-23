import { entryOwner, lateEntryOwner, presentEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import { clientWildlife, clientWildlifeState } from '@wildshard/game/population/wildlife';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import * as v from 'valibot';






import { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';
import { installWorldUpdates } from '@wildshard/game/shardfile/worldUpdates';


import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';
import { installCombatTargets, type CombatTargetOwner } from '@wildshard/game/shardfile/clientTargets';



/** The defining builders keep the published state and its consumers on one contract. */
export type Nalati = Awaited<ReturnType<typeof buildNalatiState>>;

async function buildNalatiState(ctx: NonNullable<ShardRuntime['world']>, plugin: ShardContext) {
  if (plugin.game.runtime?.world !== ctx) throw new Error('Missing original world construction owner');
  const { worldUpdates, combatTargets: targetRows } = v.parse(v.object({ worldUpdates: v.unknown(), combatTargets: v.unknown() }), await plugin.product.json('sim/headless-boot.json'));
  const { practiceRoom } = await import('@wildshard/engine/core/practiceRoom');
  const updates: ((dt: number, t: number) => void)[] = [];
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
  updates.push((dt, t) => { titan.update(dt, t); });

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/shards/nalati-grasslands/elites.ts ──
  const eliteOwner = entryOwner(plugin.scope, 'elite-entry', 'nalati.elites');
  const { entry: elites, rows: eliteRows, models: drops, fight: charge, ledges: eliteLedges } = eliteOwner;
  const eliteProgram = eliteOwner.program.value;
  updates.push((dt, t) => {
    if (titan.engaged) { elites.bar?.hide(); return; }   // one boss bar at a time: the elites stand down while the Titan fights
    if (practiceRoom.open) { elites.bar?.hide(); return; }   // a practice room over the steppe: no banner, no bar, no lair found from 3 km up (E321)
    elites.update(dt, t, eliteFrame());
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const boss = entryOwner(plugin.scope, 'arena-room', 'nalati.king');
  updates.push((dt, t) => boss.update(dt, t));
  plugin.answer('weather.indoors', inside => Math.max(inside, Number(boss.inside))); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight

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

  titan.riders = night.riders;    // B14: the Titan's storm riders ride the same rig
  updates.push((dt, t) => { if (!practiceRoom.open) night.update(dt, t); });   // no night riders shooting up at a practice room (E321)
  // the frames in their original order: the weather host, the declared look (world-update rows) and the declared
  // population register their own frames (shard.nalati.weather / look / wildlife) between these
  const ids = ['titan', 'elites', 'boss', 'night'], after = [['main.world', 'shard.nalati.weather'], ['shard.nalati.look'], ['shard.nalati.elites'], ['shard.nalati.stealth']];
  if (updates.length !== ids.length) throw new Error('Nalati update registration lacks an id');
  updates.forEach((run, index) => {
    plugin.system({ id: `shard.nalati.${ids[index] ?? ''}`, phase: 'update', after: after[index] ?? [], before: ['engine.creatures.update'], run });
    if (index === 0) installWorldUpdates(plugin, worldUpdates, {arenas:new Map([['arena',boss],['fight',titan]]),elites:new Map([['elites',elites]])});
  });
  installCombatTargets(plugin, targetRows, new Map<string, CombatTargetOwner>([['night', night], ['titan', titan]]), clientWildlifeState(plugin));
  plugin.debug.expose('nalati', nalati);
  plugin.debug.expose('nalati.ghosts', night.riders);
  plugin.debug.expose('nalati.dressing', dressing);
  return nalati;
}

/** The public boundary keeps the defining builder's complete input and state contract. */
export const buildNalatiWorld: typeof buildNalatiState = buildNalatiState;
