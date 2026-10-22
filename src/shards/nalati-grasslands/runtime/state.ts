import { entryOwner } from '@wildshard/game/shardfile/entryOwners';
import poiLayout from '../boot/poiLayout.generated.json' with { type: 'json' };
import { readSpawnScript } from '@wildshard/game/population/spawnScript';
import { clientWildlife, type PageWildlife } from '@wildshard/game/population/wildlife';
import type { CrowdDraw as Flock } from '@wildshard/game/ambient/crowdDraw';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { wildEnv } from '@wildshard/game/population/pageGroups';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardRuntime } from '@wildshard/game/shard/runtime';
import { Group, Mesh, Vector3, type Object3D } from 'three';
import * as v from 'valibot';
import { clientWaterSurfaces } from '@wildshard/game/shardfile/clientWaterSurfaces';
import { slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import { wind } from '@wildshard/engine/world/steppeWind';






import { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';
import { arenaRoomGeometryIds, buildArenaRoomEncounter } from '@wildshard/game/boss/arenaRoom';
import { shapeBook } from '@wildshard/game/models/shapeBook';
import shapeRows from '../boot/shapeBook.generated.json' with { type: 'json' };
import { EliteRosterPage, type EliteRosterRows } from '@wildshard/game/quest/eliteRosterPage';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { installAssemblyWeather } from '@wildshard/game/shardfile/worldAssembly';


import type { NalatiLoadout } from '../weapons/loadout';
import { TimedEncounters } from '@wildshard/game/boss/timedEncounters';
import { creatureGuest } from '../species/balbal';
import { StealthController, type StealthController as Stealth, type StealthThreat } from '@wildshard/game/stealth/controller';
import { wireLookV2 } from '../look/index';
import { reseedGrassV2 } from '../look/field';
import { enterClientRiding, type PageRidingView as Ride } from '@wildshard/game/riding/client';
import { ArenaScriptEncounter,readArenaScriptData } from '@wildshard/game/boss/arenaScript';
import type { CosmeticFinishPainter } from '@wildshard/game/loadout/cosmeticFinishes';
import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';
import { bindClientPlaceSets } from '@wildshard/game/shardfile/clientPlaceSets';
import type { RayTargets } from '@wildshard/engine/combat/targets';



/** The defining builders keep the published state and its consumers on one contract. */
export type Nalati = Awaited<ReturnType<typeof buildNalatiState>>;
export type NalatiWeather = Nalati['weather'];

async function buildNalatiState(ctx: NonNullable<ShardRuntime['world']>, plugin: ShardContext, progress?: StepProgress) {
  const { admission } = v.parse(v.object({ admission: v.unknown() }), await plugin.product.json('sim/headless-boot.json'));
  const eliteProgram = ReturnProgram.page(admission, plugin.scope);
  const { game, sky } = ctx;
  const slice = slicer(0, progress);
  let completed = 0;
  const total = 7;
  progress?.set(0, total, 'Preparing world builders');
  const { practiceRoom } = await import('@wildshard/engine/core/practiceRoom');
  const updates: ((dt: number, t: number) => void)[] = [];
  const groups: Record<string, Object3D> = {};

  // ── water (world agent, B0): the braided Kunes and the plateau brook, baked (generators/waterStrips.ts), on the water-surface
  // host in their look (data/lookGraphs.json 'nalati-water', lit by the painted sky's tint rows) ──
  const river=clientWaterSurfaces(plugin).get('river');if(river===undefined)throw new Error('Missing declared river');
  groups['water'] = river.group;
  await slice(++completed, total, 'Water');

  const dressing = SceneDressing.current(plugin), outcrops = dressing.pieces.get('outcrops');
  if (outcrops === undefined) throw new Error('Missing declared outcrops');
  groups['outcrops'] = outcrops.object;
  await slice(++completed, total, 'Outcrops');

  // ── the snow ring's crag rock (the crags pass): fins on the crests, ribs on the faces, broken towers on the shoulders ──
  const crags=dressing.pieces.get('cragRocks');if(crags===undefined)throw new Error('Missing declared crag rocks');
  await slice(++completed, total, 'Crag rocks');
  groups['crags'] = crags.object;

  // ── grass + wind (grass agent, B1): the blade rings are Grass.ts → look/grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──
  //    are the dressing's rows: its statics, the balbal sites, the road lettering, the camp smoke and the places' anchors
  await shapeBook(shapeRows).load();
  const anchors = (place: string, name: string) => dressing.pieces.get(place)?.anchors[name] ?? [], tie = anchors('cairn', 'tie')[0];
  updates.push(() => undefined); // The dressing owns this frame slot.
  await slice(++completed, total, 'Places');

  // ── dressing (dressing agent, look-pass lever 6): rocks, road stones, gravel-bar pebbles, shrubs, flower drifts, reeds,
  //    logs + stumps, ovoo cairns + ribbon poles, camp clutter, pollen, butterflies, kites — src/shards/nalati-grasslands/world/dressing/ ──
  reseedGrassV2(); // the grass mask baked before the dressing regrows around its boulders / shrubs (dressingCover)
  await bindClientPlaceSets(plugin,dressing.placedGroups(),dressing.placed);
  groups['dressing'] = dressing.group;
  await slice(++completed, total, 'Dressing');

  // ── weather + day/night (weather agent, B10): the painted sky, its clock and the storm, all rows of the page's weather host ──
  await installAssemblyWeather({ scope: plugin.scope, weatherContext: plugin, context: { sky } }, { kind: 'weather', id: 'nalati.weather', file: 'world/weather.json' });
  const rig = entryOwner(plugin.scope, 'world-weather', 'nalati.weather'), storm = rig.storm, painted = rig.sky;
  if (storm === null || painted === null) throw new Error('Nalati requires its painted sky and storm');
  const weather = { clock: painted.clock, look: painted.look, dome: painted.dome, air: rig.weather, weather: storm };
  groups['weather'] = rig.group;
  updates.push(() => undefined); // The weather host owns this frame slot.

  // ── Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): the Wind Cairn's threshold (mounted, in a natural storm), the
  //    Titan beyond the south rim, the arena's wall / whirlwinds / riders / fire; the heart joins the Targets chain below ──
  const titan = new ArenaScriptEncounter({ game,player: ctx.player,weather: weather.weather,air: weather.air,tieSpot: tie === undefined ? null : new Vector3(tie.x, tie.y, tie.z) },await readArenaScriptData(plugin.product,{ fight: 'combat/titan-fight.json',geometry: 'combat/titan-geometry.json' }));
  plugin.answer('weather.storm-hold', held => Math.max(held, Number(titan.engaged)));   // the storm that called him rages on until he falls
  updates.push((dt, t) => { titan.update(dt, t); });

  // ── the look (src/shards/nalati-grasslands/look/): ONE seamless 360° panorama on a sky dome — the painting is the sky, the clouds, the
  //    planet, the sun and the far range; the fog takes its colour from it (docs/design/nalati/handoff/port-v2.md) ──
  const lookSlot = updates.length;
  await wireLookV2({ game, sky, weather, updates, groups, forest: ctx.forest });
  if (updates.length === lookSlot) updates.push(() => undefined);

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/shards/nalati-grasslands/elites.ts ──
  const charge = await readSpawnScript(plugin.product, 'nalati.qara-charge');
  const { constants: { pageElites } } = await plugin.product.json<{ constants: { pageElites: EliteRosterRows } }>('sim/headless-assembly.json');
  const dropMaterial = painterlyMaterial(sky, { rim: .6 });
  const drops = new Map([...pageElites.keepers, ...pageElites.external].map(row => { const model = new Group(); model.add(new Mesh(shapeBook(shapeRows).geometry(`trophy:${row.def.id}`), dropMaterial)); return [row.def.id, model] as const; }));
  const elites = new EliteRosterPage<Flock>({ game, player: ctx.player, ledges: anchors('crags', 'ledges'), rock: poiLayout.EAGLE_ROCK, clock: weather.clock, weather: weather.weather },
    pageElites, eliteProgram, drops, charge);
  updates.push((dt, t) => {
    if (titan.engaged) { elites.bar?.hide(); return; }   // one boss bar at a time: the elites stand down while the Titan fights
    if (practiceRoom.open) { elites.bar?.hide(); return; }   // a practice room over the steppe: no banner, no bar, no lair found from 3 km up (E321)
    elites.update(dt, t);
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const kingRows = v.parse(v.object({ king: v.record(v.string(),v.unknown()), arenaRoom: v.unknown(), programs: v.object({ rules: v.unknown() }) }), await plugin.product.json('combat/titan-fight.json'));
  const boss = await buildArenaRoomEncounter(plugin,kingRows.arenaRoom,{ ...kingRows.king,definition: kingRows.king['encounter'],program: kingRows.programs.rules },shapeBook(shapeRows).geometries(arenaRoomGeometryIds(kingRows.arenaRoom)),anchors('kurgans', 'entrance')[0] ?? null);
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  plugin.answer('weather.indoors', inside => Math.max(inside, Number(boss.inside))); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight
  await slice(completed + 1, total, 'Dungeon and weather');

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const player = ctx.player;
  const stealthRows=plugin.product.section('player/stealth');
  let wildlife: PageWildlife<Flock> | null = null;
  let playKit: NalatiLoadout | null = null;
  let ride: Ride | null = null;
  updates.push(() => undefined); // The declared population owns this frame slot.

  // B9, wired below; the crouch also works on the meadow while you approach a stallion to tame (E287: the quest asks for it)
  let stealth: Stealth | null = null;
  const riderFigure = game.levelScope.own(shapeBook(shapeRows).geometry('ghost-rider')), captainFigure = game.levelScope.own(shapeBook(shapeRows).geometry('ghost-captain'));
  const night = await TimedEncounters.install(plugin, { game, sky, player: ctx.player, forest: ctx.forest, sites: dressing.sites.get('balbals')?.sites ?? null, clock: weather.clock },
    'combat/timed-encounters.json', { rider: riderFigure, captain: captainFigure, storm: riderFigure }, creatureGuest().program());
  let painter: CosmeticFinishPainter | null = null, syncT = 0;
  const nalati = {
    weather, groups, boss, elites, titan,
    get stealth(): Stealth | null { return stealth; },
    get ride(): Ride | null { return ride; },
    get wildlife() { return clientWildlife(plugin); },
    get skins() { return clientCosmeticFinishes(plugin).locker; },
    bindPlay(p: NalatiLoadout): void {
      playKit = p;
      wildlife = clientWildlife(plugin);
      const attachedAnimals = plugin.game.runtime?.play?.animals;
      if (attachedAnimals === undefined) throw new Error('Missing animal play owner');
      night.attach(attachedAnimals);
      stealth = new StealthController(plugin,player,stealthRows);
      if (wildlife === null) throw new Error('Nalati creatures have not been built');
      ride = enterClientRiding(plugin);
      plugin.debug.expose('nalati.ride',ride);

      const bow=p.bow,prevBow=bow.damageMultiplier;bow.damageMultiplier=hit=>(prevBow?.(hit)??1)*(stealth?.sneakMultiplier()??1);
      painter = clientCosmeticFinishes(plugin).painter;
    },
  };
  // ── crouch + grass stealth (melee agent, B9): the long-grass CROUCH toggle (touch disc above JUMP, C / Ctrl on desktop),
  //    the eye pip + GRASS meter + threat chevron, the sneak shot (× 2 from HIDDEN on arrows and javelins) — src/shards/nalati-grasslands/stealth.ts ──
  updates.push((dt,t)=>{
    if(stealth===null)return;const threats:StealthThreat[]=[];
    for(let i=0;i<96;i++){const pack=wildlife?.packs[i];if(pack===undefined)break;for(let j=0;j<96;j++){const actor=pack.members[j];if(actor===undefined)break;if(actor.alive)threats.push({x:actor.position.x,z:actor.position.z,awareness:pack.awareness,alert:.35,hunting:Number(pack.phase==='shadow'||pack.phase==='encircle'||pack.phase==='regroup')});}}
    for(let i=0;i<96;i++){const herd=wildlife?.herds[i];if(herd===undefined)break;for(let j=0;j<96;j++){const actor=herd.members[j];if(actor===undefined)break;if(actor.alive&&(actor.mem['ridden']??0)!==1&&(actor.mem['owned']??0)!==1)threats.push({x:actor.position.x,z:actor.position.z,awareness:actor.mem['aw']??0,alert:.45,hunting:0});}}
    stealth.update(dt,t,{grass:wildEnv.grassStandingAt(player.position.x,player.position.z),mounted:ride?.mounted ?? false,forced:ride!==null&&ride.taming.view.trust!==null,threats:threats.sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z)).slice(0,8)});
    if(playKit!==null)playKit.spear.damageScale=stealth.sneakMultiplier();
  });
  // ── dusk + night enemies (bow agent, B11): the balbal warriors wake at dusk, the ghost riders ride the ridges at night —
  //    src/shards/nalati-grasslands/nightEnemies.ts (balbalWarriors.ts, ghostRiders.ts); chained into attachAnimals / bindPlay / the Targets ray ──

  elites.ghosts = night.riders;   // B12: Qara Batyr rides B11's captain rig at the head of a line
  titan.riders = night.riders;    // B14: the Titan's storm riders ride the same rig
  updates.push((dt, t) => { if (!practiceRoom.open) night.update(dt, t); });   // no night riders shooting up at a practice room (E321)
  updates.push(dt => { ride?.update(dt); });
  // ── wearable skins (B15; src/shards/nalati-grasslands/weapons/nalatiSkins.ts): the elites' drops (mirrored from elites.skins once a second) and the
  //    Titan's saddle, painted on the kit and on the horse you ride / your bonded horse ──

    updates.push((dt) => {
      syncT -= dt;
      if (syncT <= 0) { syncT = 1; for (const id of elites.skins) nalati.skins.own(id); }
      const kit = playKit, mounted = ride?.mount.horse, bonded = ride?.taming.companion;
      painter?.update({ objects: new Map([
        ['blade', kit === null ? [] : [kit.sabre.model]],
        ['arrows', kit === null ? [] : [kit.bow.arrows.mesh]],
        ['mounts', [...new Set([...(mounted === null || mounted === undefined ? [] : [mounted.mesh]), ...(bonded?.alive === true && !bonded.hidden ? [bonded.mesh] : [])])]],
      ]),
      facts: new Set([...(boss.power?.applied === true ? ['golden'] : []), ...(titan.power?.applied === true ? ['storm'] : [])]) });
      if (kit !== null) for (const style of ['recurve', 'golden', 'sky-wolf'] as const)
        if (style === painter?.selectedFinishes.get('bow') && kit.bow.style !== style) kit.bow.setStyle(style);
    });

  // ── sound (B16 audio): wraps attachAnimals / bindPlay / wildEnv.onEvent for the creatures and the kit — src/shards/nalati-grasslands/sound.ts ──
  updates.push(dt=>{const clock=weather.clock;plugin.app.events.emit('audio.scene-frame',{delta:dt,inputs:{wind:wind.speed,gust:wind.gustAt(player.position.x,player.position.z),sun:clock.sunElevation,dark:Number(clock.dayPhase==='dusk'||clock.dayPhase==='night'),storm:Number(weather.weather.stormActive),inside:Number(nalati.boss.inside),engaged:Number(nalati.titan.engaged)}});});

  const ids = ['pois', 'weather.fx', 'titan', 'look', 'elites', 'boss', 'wildlife', 'stealth', 'night', 'ride', 'skins', 'sound'];
  let previous = 'main.world';
  if (updates.length !== ids.length) throw new Error('Nalati update registration lacks an id');
  for (let index = 0; index < 12; index++) {
    const name = ids[index], run = updates[index];
    if (name === undefined || run === undefined) throw new Error('Nalati update registration lacks an id');
    const id = `shard.nalati.${name}`;
    if (name !== 'wildlife') plugin.system({ id, phase: 'update', after: [previous], before: ['engine.creatures.update'], run });
    previous = id;
  }
  plugin.system({ id: 'shard.nalati.reins', phase: 'late', run: (dt) => { ride?.late(dt); } });
  plugin.on('weapon.fired', () => { stealth?.noteShot(); if(playKit!==null)playKit.spear.damageScale=stealth?.sneakMultiplier()??1; wildEnv.lastShotT = plugin.app.clock.now; });
  // A landing arrow or javelin, preserving the original exclusion around the player.
  plugin.on('weapon.impact', ({ point }) => {
    if (wildlife === null || Math.hypot(point.x - player.position.x, point.z - player.position.z) < 4.5) return;
    wildlife.disturb(point.x, point.z);
    ride?.noteShot(point.x, point.z);
  });
  plugin.answer('combat.targets.ray', (request: RayTargets): RayTargets => ({ ...request,
    hit: wildlife === null ? request.hit : titan.target(request.origin,request.dir,request.maxDist,
      night.target(request.origin,request.dir,request.maxDist,wildlife.raycastWeapon(request.origin,request.dir,request.maxDist,request.hit))) }));
  plugin.answer('combat.aimTargets', (list) => {
    const filtered = list.filter((a) => !('mem' in a) || typeof a.mem !== 'object' || a.mem === null || (!('hidden' in a.mem) || a.mem.hidden !== 1) && (!('owned' in a.mem) || a.mem.owned !== 1));
    const heart = titan.lockTarget();
    if (heart !== null) filtered.push(heart);
    return filtered;
  });
  plugin.debug.expose('nalati', nalati);
  plugin.debug.expose('nalati.ghosts', night.riders);
  plugin.debug.expose('nalati.dressing', dressing);
  await slice(total, total, 'World services');
  return nalati;
}

/** The public boundary keeps the defining builder's complete input and state contract. */
export const buildNalatiWorld: typeof buildNalatiState = buildNalatiState;
