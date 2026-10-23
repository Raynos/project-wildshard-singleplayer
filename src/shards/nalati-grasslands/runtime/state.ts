import { entryOwner, lateEntryOwner, publishEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import { readSpawnScript } from '@wildshard/game/population/spawnScript';
import { clientWildlife, clientWildlifeState, type PageWildlife } from '@wildshard/game/population/wildlife';
import type { CrowdDraw as Flock } from '@wildshard/game/ambient/crowdDraw';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { wildEnv } from '@wildshard/game/population/pageGroups';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import * as v from 'valibot';
import { slicer, type StepProgress } from '@wildshard/engine/boot/plan';






import { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';
import { buildArenaRoomEncounter } from '@wildshard/game/boss/arenaRoom';
import { DeclaredEliteEntry } from '@wildshard/engine/ai/view/eliteEntry';
import { parseEliteEntryPageRows } from '@wildshard/format/eliteEntryRows';
import { WorldAssembly } from '@wildshard/game/shardfile/worldAssembly';
import prefix from '../data/worldPrefix.json' with { type: 'json' };
import { installWorldUpdates } from '@wildshard/game/shardfile/worldUpdates';


import type { HeldSlotKit } from '@wildshard/game/loadout/claims';
import { TimedEncounters } from '@wildshard/game/boss/timedEncounters';
import type { SpeciesCatalogue } from '@wildshard/game/looks/speciesBook';
import { StealthController, type StealthController as Stealth } from '@wildshard/game/stealth/controller';
import { enterClientRiding, type PageRidingView as Ride } from '@wildshard/game/riding/client';
import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';
import { installCombatTargets, type CombatTargetOwner } from '@wildshard/game/shardfile/clientTargets';



/** The defining builders keep the published state and its consumers on one contract. */
export type Nalati = Awaited<ReturnType<typeof buildNalatiState>>;

async function buildNalatiState(ctx: NonNullable<ShardRuntime['world']>, plugin: ShardContext, species: SpeciesCatalogue, progress?: StepProgress) {
  const { admission, worldUpdates, combatTargets: targetRows } = v.parse(v.object({ admission: v.unknown(), worldUpdates: v.unknown(), combatTargets: v.unknown() }), await plugin.product.json('sim/headless-boot.json'));
  const shapes = await WorldAssembly.prepareNative(prefix, plugin);
  const eliteProgram = ReturnProgram.page(admission, plugin.scope);
  const { game, sky } = ctx;
  const slice = slicer(0, progress);
  const total = 7;
  progress?.set(0, total, 'Preparing world builders');
  const { practiceRoom } = await import('@wildshard/engine/core/practiceRoom');
  const updates: ((dt: number, t: number) => void)[] = [];
  const runtime = plugin.game.runtime;
  if (runtime === undefined || runtime.world !== ctx) throw new Error('Missing original world construction owner');
  const groups = await WorldAssembly.construct(prefix, { runtime, native: plugin, product: plugin.product, scope: plugin.scope, draws: shapes, baked: new Map(), ...(progress === undefined ? {} : { progress }) });
  const dressing = SceneDressing.current(plugin);
  const anchors = (place: string, name: string) => dressing.pieces.get(place)?.anchors[name] ?? [];
  updates.push(() => undefined); // The dressing owns this frame slot.
  const weatherLoan = lateEntryOwner(plugin.scope, 'world-weather', 'nalati.weather');
  const resolveWeather = () => {
    const rig = weatherLoan(), storm = rig.storm, painted = rig.sky;
    if (storm === null || painted === null) throw new Error('Nalati requires its painted sky and storm');
    return { clock: painted.clock, look: painted.look, dome: painted.dome, air: rig.weather, weather: storm };
  };
  let weather: ReturnType<typeof resolveWeather> | undefined;
  const readWeather = () => { weatherLoan(); weather ??= resolveWeather(); return weather; };
  updates.push(() => undefined); // The weather host owns this frame slot.

  // ── Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): the Wind Cairn's threshold (mounted, in a natural storm), the
  //    Titan beyond the south rim, the arena's wall / whirlwinds / riders / fire; the heart joins the Targets chain below ──
  const titan = entryOwner(plugin.scope, 'arena-room', 'nalati.titan');
  updates.push((dt, t) => { titan.update(dt, t); });

  // ── the look (src/shards/nalati-grasslands/look/): ONE seamless 360° panorama on a sky dome — the painting is the sky, the clouds, the
  //    planet, the sun and the far range; the fog takes its colour from it (docs/design/nalati/handoff/port-v2.md) ──
  updates.push(() => undefined); // The declared painted-world owns this frame slot.

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/shards/nalati-grasslands/elites.ts ──
  const charge = await readSpawnScript(plugin.product, 'nalati.qara-charge');
  const { constants: { pageElites: eliteInput, trophies } } = await plugin.product.json<{ constants: { pageElites: unknown; trophies: unknown } }>('sim/headless-assembly.json');
  const eliteRows = parseEliteEntryPageRows(eliteInput);
  // the lairs' trophies: drawn from the shape book at this slot (data/worldTrophies.json, a drawn-models stage)
  await WorldAssembly.construct(trophies, { runtime, native: plugin, product: plugin.product, scope: plugin.scope, draws: shapes, baked: new Map() });
  const drops = entryOwner(plugin.scope, 'drawn-models', 'nalati.trophies');
  const eliteLedges = anchors('crags', 'ledges');
  const elites = new DeclaredEliteEntry(eliteRows.entry, game.levelScope);
  updates.push((dt, t) => {
    if (titan.engaged) { elites.bar?.hide(); return; }   // one boss bar at a time: the elites stand down while the Titan fights
    if (practiceRoom.open) { elites.bar?.hide(); return; }   // a practice room over the steppe: no banner, no bar, no lair found from 3 km up (E321)
    elites.update(dt, t, eliteFrame());
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const kingRows = v.parse(v.object({ king: v.record(v.string(),v.unknown()), arenaRoom: v.unknown(), programs: v.object({ attack: v.unknown() }) }), await plugin.product.json('combat/titan-fight.json'));
  const boss = await buildArenaRoomEncounter(plugin,kingRows.arenaRoom,{ ...kingRows.king,definition: kingRows.king['encounter'],program: kingRows.programs.attack },shapes,anchors('kurgans', 'entrance')[0] ?? null);
  publishEntryOwner(plugin.scope, 'arena-room', 'nalati.king', boss);
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  plugin.answer('weather.indoors', inside => Math.max(inside, Number(boss.inside))); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight
  await slice(total - 1, total, 'Dungeon and weather');

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const player = ctx.player;
  const stealthRows=plugin.product.section('player/stealth');
  let wildlife: PageWildlife<Flock> | null = null;
  let playKit: HeldSlotKit | null = null;
  let ride: Ride | null = null;
  updates.push(() => undefined); // The declared population owns this frame slot.

  // B9, wired below; the crouch also works on the meadow while you approach a stallion to tame (E287: the quest asks for it)
  let stealth: Stealth | null = null;
  const riderFigure = game.levelScope.own(shapes.handle('ghost-rider').copy()), captainFigure = game.levelScope.own(shapes.handle('ghost-captain').copy());
  const night = await TimedEncounters.install(plugin, { game, sky, player: ctx.player, forest: ctx.forest, sites: dressing.sites.get('balbals')?.sites ?? null, get clock() { return readWeather().clock; } },
    'combat/timed-encounters.json', { rider: riderFigure, captain: captainFigure, storm: riderFigure }, species.program('balbal'));
  function eliteFrame() { return { patrolAvailable: true, herdAvailable: wildlife !== null, kills: night.riders.killsTonight,
    bonded: ride?.taming.phase === 'bonded', mount: ride?.taming.companion ?? null }; }
  const nalati = {
    get weather() { return readWeather(); }, groups, boss, elites, titan, eliteFrame, eliteRows, eliteProgram, eliteDrops: drops, eliteCharge: charge, eliteLedges,
    get elitePatrol() { return night.riders; },
    get stealth(): Stealth | null { return stealth; },
    get ride(): Ride | null { return ride; },
    get wildlife() { return clientWildlife(plugin); },
    get skins() { return clientCosmeticFinishes(plugin).locker; },
    bindPlay(p: HeldSlotKit): void {
      playKit = p;
      wildlife = clientWildlife(plugin);
      const attachedAnimals = plugin.game.runtime?.play?.animals;
      if (attachedAnimals === undefined) throw new Error('Missing animal play owner');
      night.attach(attachedAnimals);
      stealth = new StealthController(plugin,player,stealthRows);
      if (wildlife === null) throw new Error('Nalati creatures have not been built');
      ride = enterClientRiding(plugin, entryOwner(plugin.scope, 'claims', 'nalati.arsenal'));
      plugin.debug.expose('nalati.ride',ride);

      const bow=p.bow('bow'),prevBow=bow.damageMultiplier;bow.damageMultiplier=hit=>(prevBow?.(hit)??1)*(stealth?.sneakMultiplier()??1);
    },
  };
  // ── crouch + grass stealth (melee agent, B9): the long-grass CROUCH toggle (touch disc above JUMP, C / Ctrl on desktop),
  //    the eye pip + GRASS meter + threat chevron, the sneak shot (× 2 from HIDDEN on arrows and javelins) — src/shards/nalati-grasslands/stealth.ts ──
  updates.push((dt,t)=>{stealth?.updateSources(dt,t,{population:wildlife,riding:ride,kit:playKit,grass:wildEnv});});
  // ── dusk + night enemies (bow agent, B11): the balbal warriors wake at dusk, the ghost riders ride the ridges at night —
  //    src/shards/nalati-grasslands/nightEnemies.ts (balbalWarriors.ts, ghostRiders.ts); chained into attachAnimals / bindPlay / the Targets ray ──

  titan.riders = night.riders;    // B14: the Titan's storm riders ride the same rig
  updates.push((dt, t) => { if (!practiceRoom.open) night.update(dt, t); });   // no night riders shooting up at a practice room (E321)
  const ids = ['pois', 'weather.fx', 'titan', 'look', 'elites', 'boss', 'wildlife', 'stealth', 'night'];
  let previous = 'main.world';
  if (updates.length !== ids.length) throw new Error('Nalati update registration lacks an id');
  for (let index = 0; index < 9; index++) {
    const name = ids[index], run = updates[index];
    if (name === undefined || run === undefined) throw new Error('Nalati update registration lacks an id');
    const id = `shard.nalati.${name}`;
    if (name === 'look') installWorldUpdates(plugin, worldUpdates, {arenas:new Map([['arena',boss],['fight',titan]]),elites:new Map([['elites',elites]])});
    else if (name !== 'wildlife') plugin.system({ id, phase: 'update', after: [previous], before: ['engine.creatures.update'], run });
    previous = id;
  }
  plugin.on('weapon.fired', () => { stealth?.noteShot(); if(playKit!==null)playKit.polearm('polearm').damageScale=stealth?.sneakMultiplier()??1; wildEnv.lastShotT = plugin.app.clock.now; });
  // A landing arrow or javelin, preserving the original exclusion around the player.
  plugin.on('weapon.impact', ({ point }) => {
    if (wildlife === null || Math.hypot(point.x - player.position.x, point.z - player.position.z) < 4.5) return;
    wildlife.disturb(point.x, point.z);
    ride?.noteShot(point.x, point.z);
  });
  installCombatTargets(plugin, targetRows, new Map<string, CombatTargetOwner>([['night', night], ['titan', titan]]), clientWildlifeState(plugin));
  plugin.debug.expose('nalati', nalati);
  plugin.debug.expose('nalati.ghosts', night.riders);
  plugin.debug.expose('nalati.dressing', dressing);
  await slice(total, total, 'World services');
  publishEntryOwner(plugin.scope, 'elite-entry', 'nalati.elites', {
    entry: elites, rows: eliteRows, construction: game.levelScope, models: drops, population: clientWildlifeState(plugin),
    program: { id: 'elite.rules', scope: game.levelScope, value: eliteProgram }, fight: charge,
    environment: wildEnv, get clock() { return readWeather().clock; }, get weather() { return readWeather().weather; },
    ledges: eliteLedges, patrol: night.riders,
  });
  return nalati;
}

/** The public boundary keeps the defining builder's complete input and state contract. */
export const buildNalatiWorld: typeof buildNalatiState = buildNalatiState;
