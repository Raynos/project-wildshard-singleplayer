import { readSpawnScript } from '@wildshard/game/population/spawnScript';
import { DataPanel, readDataPanels } from '@wildshard/sdk/dataPanels';
import type { AdventurePersistence as NalatiPersistence } from '@wildshard/game/quest/persistence';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';
import { installDeclaredCrowdFrames, type PreparedCrowds } from '@wildshard/game/shardfile/crowdRuntime';
import { createNativeFlocks, readFlockBody, dogWolves, type NativeFlocks } from './flockDeclared';
import { bindEnteredEnvironment } from './enteredEnvironment';
import { PageWildlife, type WildlifeBuildStep } from '@wildshard/game/population/wildlife';
import type { CrowdDraw as Flock } from '@wildshard/game/ambient/crowdDraw';
import { setDogFlock } from '../species/sheepdog';
import { Marmots,preloadCover } from '../creatures/marmots';
import { bindEliteAdmission } from './argymaqKeeper';
import { wildEnv,bindHerdDamage } from '@wildshard/game/population/pageGroups';
import { KNOCKDOWN_TIME, knockdownDash } from '../creatures/knockdown';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { installRide } from '../ride/input';
import { Vector3, type Object3D } from 'three';
import * as v from 'valibot';
import { clientWaterSurfaces } from '@wildshard/game/shardfile/clientWaterSurfaces';
import { macrotask, slicer, type StepProgress } from '@wildshard/engine/boot/plan';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import type { ImpactSurface } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';






import { buildNalatiPOIs } from '../world/view';
import type { NalatiPOIs } from '../world/viewTypes';
import { SceneDressing } from '@wildshard/game/shardfile/sceneDressing';
import { wireKurganSliced, type KurganBoss } from '../combat/goldenKing';
import { wireElites, type NalatiElites } from '../combat/elites';
import { wireWeather, type NalatiWeather } from '../world/installWeather';
import { windEnv } from '../world/weatherStep';


import type { NalatiLoadout } from '../weapons/loadout';
import { nalatiWetAt } from '../wet';
import { wireNightEnemies } from '../combat/night';
import { StealthController, type StealthController as Stealth, type StealthThreat } from '@wildshard/game/stealth/controller';
import { clientAudioScene, type AudioSceneDirector } from '@wildshard/game/audio/sceneDirector';
import { wireLookV2 } from '../look/index';
import { reseedGrassV2 } from '../look/field';
import type { TamingPrograms as RidingPrograms } from '@wildshard/game/riding/taming';
import { admitRenderedHerds, admitRidingWind, createPageRiding, readPageRidingPreset, type PageTamingOwner } from '@wildshard/game/riding/client';
import type { Mount } from '@wildshard/game/riding/mount';
import type { MountProfile } from '@wildshard/format/riding';
import type { RideHUD } from '@wildshard/game/riding/hud';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { PanelDefinition } from '@wildshard/format/panelTemplate';
import { Reins } from '../ride/Reins';
import { SheepRaid } from '../creatures/shepherdView';
import { cleanHorseName } from '../ride/horseNames';
import { tulparSave } from '../ride/saves';
import { Bow } from '@wildshard/game/weapons/Bow';
import { Sabre, Spear } from '../weapons/nativeMelee';
import { wireStormTitan, type StormTitan } from '../combat/stormTitan';
import type { CosmeticFinishLocker, CosmeticFinishPainter } from '@wildshard/game/loadout/cosmeticFinishes';
import { clientCosmeticFinishes } from '@wildshard/game/shardfile/clientCosmeticFinishes';
import { bindClientPlaceSets } from '@wildshard/game/shardfile/clientPlaceSets';
import type { RayTargets } from '@wildshard/engine/combat/targets';


type Wildlife = PageWildlife<Flock>;
type SheepHit = NonNullable<ReturnType<Wildlife['raycastCrowd']>>;

export interface NalatiCtx { game: Game; sky: Sky; player: Player; forest: Forest; chunk: ShardManifest; params: URLSearchParams }

/** what main.ts hands the wiring once the kit and the HUD exist (`nalati.bindPlay`) */
export interface NalatiPlay {
  kit: NalatiLoadout | null;
  /** 0..1 — the wolves' alpha joins in when you're hurt */
  health01: () => number;
  toast: (text: string) => void;
  /** the red damage flash (a knock-down) */
  flash: () => void;
  /** damage with no animal behind it: the horse throws you / bolts (the death toast says so — NALATI-MERGE F3) */
  hurt?: (damage: number) => void;
}

export interface Nalati {
  readonly persistence: NalatiPersistence | undefined;
  /** every frame (main.ts game.onUpdate) */
  /** every POI (poi agent, B5): camp, bridge, roads, summer camp, kurgans, balbals, Eagle Rock, cairn, Crags */
  pois: NalatiPOIs;
  /** the day/night clock + storms (weather agent, B10): `weather.clock.onDusk(fn)`, `weather.weather.stormActive`,
   *  `weather.bind({ audio, hurt })` from main.ts once the audio and the player's health exist */
  weather: NalatiWeather;
  /** the great kurgan's dungeon + the Golden King (boss agent, B13; src/shards/nalati-grasslands/kurganBoss.ts): `boss.bind(play)` from main.ts
   *  once the animals, the kit and the HUD exist; `boss.onPlayerDeath()` in main's death check (true = the boss fight
   *  handled it: the player is back at the phase checkpoint); `boss.inside` while the player is in the dungeon */
  boss: KurganBoss;
  /** the named elites (elites agent, B12; src/shards/nalati-grasslands/elites.ts): Aqbars, Kokbori, Qyran, Qara Batyr, Argymaq — `elites.bind(play)`
   *  from main.ts once the animals, the wildlife and the HUD exist */
  elites: NalatiElites;
  /** the creatures (creatures agent, B4; src/engine/entities/Wildlife.ts): wolf packs, the horse herd + stallion, the sheep flock +
   *  its dog, marmots, the camp's saddled horses. main.ts calls `attachAnimals(animals)` right after its animals step. */
  attachAnimals: (animals: AnimalManager) => Wildlife;
  /** `attachAnimals`, a task apart per wildlife group and before the night enemies' models (SF67: the shard's boot) */
  attachAnimalsSliced: (animals: AnimalManager, yieldTask: () => Promise<void>) => Promise<Wildlife>;
  wildlife: Wildlife | null;
  /** main.ts once the kit + HUD exist: knock-downs, howl / stampede toasts */
  bindPlay: (play: NalatiPlay) => void;
  /** weapons.onFire: a shot reveals you for a second (the stealth model) */
  onShot: () => void;
  /** weapons.onImpact: an arrow / javelin landing near a herd or the flock spooks it */
  onImpact: (surface: ImpactSurface, point: Vector3) => void;
  /** main's Targets.raycast: the nearer of `hit` (the animals) and a sheep on the ray — the flock is not an AnimalManager crowd */
  sheepTarget: (origin: Vector3, dir: Vector3, maxDist: number, hit: TargetHit | null) => TargetHit | null;
  /** anything a later system wants to find: named groups added to the scene by this wiring */
  groups: Record<string, Object3D>;
  /** crouch + grass stealth (melee agent, B9; src/shards/nalati-grasslands/stealth.ts): `stealth.state` (hidden / visible / noticed /
   *  detected), `stealth.cover`, `stealth.latched` — taming reads it (TRUST builds only crouched) */
  stealth: Stealth | null;
  /** the steppe's sound (B16 audio; src/shards/nalati-grasslands/sound.ts): creatures, hooves, the grassland bed, the kit's voices — set just
   *  before wireNalati returns; main.ts: `sound.bind(audio, music)`, `sound.fire(id)` / `sound.impact(…)` in the weapon hooks */
  sound?: AudioSceneDirector;
  /** riding + taming (creatures agent B7 / B8; src/shards/nalati-grasslands/ride/ride.ts): built in `attachAnimals`. main.ts pushes
   *  `ride.interactable` (the one nearest horse prompt: Mount / Dismount / Break the stallion) into its interactables and
   *  hands `ride.taming` to `elites.bind` (Argymaq, BROKEN → the bucking rounds) */
  ride: Ride | null;
  /** Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): main.ts `titan.bind({...})` once the kit / ride / HUD exist,
   *  `titan.onPlayerDeath()` in its death check; `titan.engaged` holds the storm and stands the elites down */
  titan: StormTitan;
  /** the wearable skins (B15; src/shards/nalati-grasslands/weapons/nalatiSkins.ts): the elites' drops + the Sky-Marked Saddle, owned / worn per slot —
   *  main.ts's menu lists `skins.entries()` in the Inventory tab and wears them with `skins.toggle(id)` */
  skins: CosmeticFinishLocker;
}

export async function buildNalatiWorld(ctx: NalatiCtx, plugin: ShardContext, progress?: StepProgress, persistence?: NalatiPersistence): Promise<Nalati> {
  const { admission, roads, rest } = v.parse(v.object({ admission: v.unknown(),
    roads: v.array(v.array(v.tuple([v.number(),v.number()]))), rest: v.object({ x: v.number(), z: v.number(), face: v.object({ x:v.number(),z:v.number() }) }) }), await plugin.product.json('sim/headless-boot.json'));
  const ridingPrograms = await plugin.product.json<RidingPrograms>('ride/rules.json');
  const { constants: { nativeTaming, nativeRide,pageGroups,pageWildlife } } = v.parse(v.object({ constants: v.object({
    pageWildlife: v.unknown(),pageGroups: v.unknown(),nativeTaming: v.object({ binding: v.unknown(), rail: v.object({ x:v.number(),z:v.number() }) }),
    nativeRide: v.object({ speeds:v.object({ walk:v.number(),trot:v.number(),canter:v.number(),gallop:v.number() }),thrownDamage:v.number(),thrownLabel:v.string() }) }) }), await plugin.product.json('sim/headless-assembly.json'));
  const ridingPreset = readPageRidingPreset(v.parse(v.object({ client:v.unknown() }),ridingPrograms).client);
  bindEliteAdmission(admission); bindHerdDamage(pageGroups, plugin.scope); bindEnteredEnvironment(plugin,pageGroups);
  const flockBody = await readFlockBody(plugin.product); plugin.scope.own(flockBody.geometry);
  const panels = await readDataPanels(plugin.product), namePanel = panels['name'];
  if (namePanel === undefined) throw new Error('Nalati requires its named horse panel');
  const { game, sky } = ctx;
  const slice = slicer(0, progress);
  let completed = 0;
  const total = 7;
  progress?.set(0, total, 'Preparing world builders');
  const { practiceRoom } = await import('@wildshard/engine/core/practiceRoom');
  let declaredCrowds: NativeFlocks | null = null;
  const updates: ((dt: number, t: number) => void)[] = [];
  const groups: Record<string, Object3D> = {};

  // ── water (world agent, B0): the braided Kunes and the plateau brook, baked (generators/waterStrips.ts), on the water-surface
  // host in their look (data/lookGraphs.json 'nalati-water', lit by world/installWeather.ts) ──
  const river=clientWaterSurfaces(plugin).get('river');if(river===undefined)throw new Error('Missing declared river');
  groups['water'] = river.group;
  await slice(++completed, total, 'Water');

  const dressing = SceneDressing.current(plugin), outcrops = dressing.pieces.get('outcrops');
  if (outcrops === undefined) throw new Error('Missing declared outcrops');
  const rockPlaced = [...outcrops.placed];
  groups['outcrops'] = outcrops.object;
  await slice(++completed, total, 'Outcrops');

  // ── the snow ring's crag rock (the crags pass): fins on the crests, ribs on the faces, broken towers on the shoulders ──
  const crags=dressing.pieces.get('cragRocks');if(crags===undefined)throw new Error('Missing declared crag rocks');
  rockPlaced.push(...crags.placed);
  await slice(++completed, total, 'Crag rocks');
  groups['crags'] = crags.object;

  // ── grass + wind (grass agent, B1): the blade rings are Grass.ts → look/grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──
  const pois = await buildNalatiPOIs(sky, game.scene, ctx.player, macrotask, plugin.app.registry, dressing);
  groups['pois'] = pois.group;
  updates.push((dt) => pois.update(dt));
  await slice(++completed, total, 'Places');

  // ── dressing (dressing agent, look-pass lever 6): rocks, road stones, gravel-bar pebbles, shrubs, flower drifts, reeds,
  //    logs + stumps, ovoo cairns + ribbon poles, camp clutter, pollen, butterflies, kites — src/shards/nalati-grasslands/world/dressing/ ──
  reseedGrassV2(); // the grass mask baked before the dressing regrows around its boulders / shrubs (dressingCover)
  const dressPlaced = dressing.placed;
  await bindClientPlaceSets(plugin,pois.placed,[...new Set([...rockPlaced,...dressPlaced])]);
  groups['dressing'] = dressing.group;
  await slice(++completed, total, 'Dressing');

  // ── weather + day/night (weather agent, B10): the clock, storms, the sky rig — src/shards/nalati-grasslands/weather.ts ──
  const weather = await wireWeather({ ctx: plugin, manifest: ctx.chunk, game, sky, player: ctx.player, forest: ctx.forest, colliders: pois.colliders });
  groups['weather'] = weather.fx.group;
  updates.push((dt) => weather.update(dt));

  // ── Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): the Wind Cairn's threshold (mounted, in a natural storm), the
  //    Titan beyond the south rim, the arena's wall / whirlwinds / riders / fire; the heart joins the Targets chain below ──
  const titan = wireStormTitan({ game, player: ctx.player, weather, tieSpot: pois.cairnTieSpot });
  weather.bind({ stormHold: () => titan.engaged });   // the storm that called him rages on until he falls
  updates.push((dt, t) => { titan.update(dt, t); });

  // ── the look (src/shards/nalati-grasslands/look/): ONE seamless 360° panorama on a sky dome — the painting is the sky, the clouds, the
  //    planet, the sun and the far range; the fog takes its colour from it (docs/design/nalati/handoff/port-v2.md) ──
  const lookSlot = updates.length;
  await wireLookV2({ game, sky, weather, updates, groups, forest: ctx.forest });
  if (updates.length === lookSlot) updates.push(() => undefined);

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/shards/nalati-grasslands/elites.ts ──
  const charge = await readSpawnScript(plugin.product, 'nalati.qara-charge');
  const elites = wireElites({ charge, game, sky, player: ctx.player, ledges: pois.cragLedges, phase: () => weather.clock.dayPhase, storm: () => weather.weather.stormActive });
  updates.push((dt, t) => {
    if (titan.engaged) { elites.bar?.hide(); return; }   // one boss bar at a time: the elites stand down while the Titan fights
    if (practiceRoom.open) { elites.bar?.hide(); return; }   // a practice room over the steppe: no banner, no bar, no lair found from 3 km up (E321)
    elites.update(dt, t);
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const boss = await wireKurganSliced({ game, sky, player: ctx.player, entrance: pois.kurganEntrance, registry: plugin.app.registry }, plugin.product, macrotask); // SF67: its static interior a task apart per part
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  weather.bind({ indoors: () => boss.inside }); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight
  await slice(completed + 1, total, 'Dungeon and weather');

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const player = ctx.player;
  const stealthRows=plugin.product.section('player/stealth');
  let wildlife: Wildlife | null = null;
  let foragerView: Marmots | null = null;
  let attachedAnimals: AnimalManager | null = null;
  let play: NalatiPlay | null = null;
  let now = 0;
  // the grass hides you and is trampled by every mover (GrassTrample, B1); the river corridor + the brook are water to a walker
  // Wildlife reads position / forward / crouching; Player.forward allocates, so a reused view of it
  const wildPlayer = { position: player.position, forward: new Vector3(0, 0, -1), crouching: false };
  const extra = { mounted: false, health01: 1 };
  let ride: Ride | null = null;   // riding + taming (B7 / B8) — wired in the riding section below
  // toasts for the herd / pack moments, each at most once in a while
  const lastToast = new Map<string, number>();
  const toastOnce = (key: string, text: string, every: number): void => {
    if (now - (lastToast.get(key) ?? -1e9) < every) return;
    lastToast.set(key, now); play?.toast(text);
  };
  const onSignal = (name: string, x: number, z: number): void => {
    void x; void z;
    if (name === 'howl') toastOnce(name, 'A wolf howls — the pack has your scent', 60);
    else if (name === 'stampede') toastOnce(name, 'Stampede!', 20);
    else if (name === 'pack-driven-off') toastOnce(name, 'The stallion drives the wolves off', 30);
    else if (name === 'stallion-beaten') toastOnce(name, 'The stallion gives ground', 30);
  };
  installEnteredRuntimeService(plugin,scope => { plugin.app.events.on('creature.signal',({ name,x,z }) => { onSignal(name,x,z); },scope); });
  // bowled over (the stallion's charge, a stampede): shoved along the blow (creatures/knockdown.ts, the host's rule too), a red flash
  const knocked = { x: 0, z: 0 };
  const onKnockdown = (dirX: number, dirZ: number, strength: number): void => {
    knockdownDash(dirX, dirZ, strength, knocked);
    player.dash(knocked.x, knocked.z, KNOCKDOWN_TIME);
    play?.flash();
    toastOnce('knockdown', 'Knocked down!', 4);
  };
  installEnteredRuntimeService(plugin,scope => { plugin.app.events.on('creature.knockdown',({ x,z,strength }) => { onKnockdown(x,z,strength); },scope); });
  let flockDelta = 0, flockTime = 0, flockAdvance: PreparedCrowds['advance'] | undefined;
  const missingCrowdFrame = new Error('Missing declared native crowd frame');
  const advanceFlock = (view: Flock,index: number,speed: number): void => {
    if (declaredCrowds === null || flockAdvance === undefined) throw new Error('Missing declared native crowd owner');
    declaredCrowds.advance(view, index, speed, wildPlayer.position, flockDelta, flockTime, flockAdvance);
  };
  const wildlifeFrame = (dt: number, t: number, advance?: PreparedCrowds['advance']): void => {
    now = t;
    if (wildlife === null) return;
    wildPlayer.forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    wildPlayer.crouching = player.crouching;
    extra.health01 = play?.health01() ?? 1;
    extra.mounted = ride?.mounted ?? false;   // B9: mounting stands you up; the packs get two tokens; a gallop stampedes the herd
    windEnv(wildEnv, wind);
    if (advance === undefined) throw missingCrowdFrame;
    flockDelta = dt; flockTime = t; flockAdvance = advance;
    const speed = wildlife.beginFrame(dt,wildPlayer,extra);
    dogWolves.length = 0;
    for (let i=0;i<64;i++) { const actor=wildlife.predators[i]; if(actor===undefined)break; dogWolves.push(actor); }
    for (let index=0;index<4;index++) { const view=wildlife.flocks[index];if(view===undefined)break;advanceFlock(view,index,speed); }
    wildlife.endFrame(dt,wildPlayer.position,speed,wildPlayer.crouching); foragerView?.project();
  };
  updates.push(wildlifeFrame);

  // the flock as a weapon target: one reused TargetAnimal for "the sheep on this ray"
  let sheepHit: SheepHit | null = null;
  const sheepPoint = new Vector3();
  const sheep: TargetAnimal = {
    kind: 'sheep', position: new Vector3(), alive: true,
    damageFor: () => 100,
    applyDamage: () => {
      if (sheepHit !== null && wildlife !== null) wildlife.killCrowd(sheepHit);
      sheepHit = null; sheep.alive = false;
      return true;
    },
  };
  const sheepResult: TargetHit = { animal: sheep, point: sheepPoint, distance: 0, headshot: false };

  // B9, wired below; the crouch also works on the meadow while you approach a stallion to tame (E287: the quest asks for it)
  let stealth: Stealth | null = null;
  const night = await wireNightEnemies({ game, sky, player: ctx.player, forest: ctx.forest, balbals: pois.balbals, clock: weather.clock });
  await preloadCover(); // the small-model pack the marmots and the ambient wings draw from (creatures/marmots.ts)
  let painter: CosmeticFinishPainter | null = null, syncT = 0;
  const prepareWildlife = (animals: AnimalManager): Wildlife => {
    attachedAnimals = animals;
    animals.wetAt = nalatiWetAt;
    animals.navSteer = true; // the packs, the herd, the flock's dog steer round what the navmesh walls off (NALATI-MERGE P3)
    declaredCrowds = createNativeFlocks(sky, ctx.chunk.seed, flockBody);
    return new PageWildlife<Flock>(animals,pageWildlife);
  };
  const buildWildlifeStep = (w: Wildlife,step: WildlifeBuildStep): void => {
    if (step.kind === 'crowd') {
      if (declaredCrowds === null) throw new Error('Missing population crowd views');
      const view = declaredCrowds.factory(step.options,step.index); game.scene.add(view.mesh);
      const dog = w.attachCrowd(step.index,view); if (dog !== null) { view.dog=dog;setDogFlock(dog,{flock:view,wolves:dogWolves,rng:plugin.app.rng.stream('ai'),bark:(x,z)=>{w.sound('dog_bark',x,z);}},w.placement); }
    } else if (step.kind === 'foragers' && w.foragers !== null) {
      foragerView = new Marmots(sky,ctx.chunk.seed,w.foragers.rules).build(); game.scene.add(foragerView.mesh);
    }
  };
  const finishWildlife = (animals: AnimalManager, w: Wildlife): Wildlife => {
    wildlife = w;
    night.attach(animals);
    weather.weather.on('strike', (e) => { w.scare(e['x'] ?? 0, e['z'] ?? 0, 60); }); // a lightning strike breaks a pack / stampedes a herd within 60 m
    return w;
  };
  const nalati: Nalati = {
    persistence, pois, weather, groups, boss, elites, wildlife, stealth, ride, titan,
    get skins() { return clientCosmeticFinishes(plugin).locker; },
    attachAnimals(animals) {
      const w = prepareWildlife(animals);
      const steps=w.buildSteps();for(let i=0;i<24;i++){const next=steps.next();if(next.done===true)break;buildWildlifeStep(w,next.value);}
      nalati.wildlife = w;
      return finishWildlife(animals, w);
    },
    async attachAnimalsSliced(animals, yieldTask) {
      const w = prepareWildlife(animals);
      const steps=w.buildSteps();for(let i=0;i<24;i++){const next=steps.next();if(next.done===true)break;buildWildlifeStep(w,next.value);await yieldTask();}
      await yieldTask();
      nalati.wildlife = w;
      return finishWildlife(animals, w);
    },
    bindPlay(p) {
      play = p;
      stealth = new StealthController(plugin,player,stealthRows);
      nalati.stealth = stealth;
      if (wildlife === null || attachedAnimals === null) throw new Error('Nalati creatures have not been built');
      ride = wireRide({ roads, rest, nativeTaming, nativeRide, preset: ridingPreset, programs: ridingPrograms, namePanel, ...(persistence === undefined ? {} : { persistence }), ctx: plugin, player, animals: attachedAnimals, wildlife, camera: game.camera });
      nalati.ride = ride;
      installRide(plugin, ride);

      if(p.kit!==null){const bow=p.kit.bow,prevBow=bow.damageMultiplier;bow.damageMultiplier=hit=>(prevBow?.(hit)??1)*(stealth?.sneakMultiplier()??1);}
      ride.bind({ toast: p.toast });
      painter = clientCosmeticFinishes(plugin).painter;
    },
    onShot() { stealth?.noteShot(); if(play!==null&&play.kit!==null)play.kit.spear.damageScale=stealth?.sneakMultiplier()??1; wildEnv.lastShotT = now; },
    onImpact(_surface, point) {
      // a landing arrow / javelin (not a sabre / spear blow at arm's length)
      if (wildlife === null || Math.hypot(point.x - player.position.x, point.z - player.position.z) < 4.5) return;
      wildlife.disturb(point.x, point.z);
      ride?.noteShot(point.x, point.z);
    },
    sheepTarget(origin, dir, maxDist, hit) {
      if (wildlife === null) return hit;
      const finish = (h: TargetHit | null): TargetHit | null => titan.target(origin, dir, maxDist, night.target(origin, dir, maxDist, h));
      const sh = wildlife.raycastCrowd(origin, dir, hit !== null ? Math.min(maxDist, hit.distance) : maxDist);
      if (sh === null) return finish(hit);
      sheepHit = { flock: sh.flock, index: sh.index, distance: sh.distance };
      sh.flock.positions(sh.index, sheep.position);
      sheep.alive = true;
      sheepPoint.copy(sheep.position);
      sheepResult.distance = sh.distance;
      return finish(sheepResult);
    },
  };
  // ── crouch + grass stealth (melee agent, B9): the long-grass CROUCH toggle (touch disc above JUMP, C / Ctrl on desktop),
  //    the eye pip + GRASS meter + threat chevron, the sneak shot (× 2 from HIDDEN on arrows and javelins) — src/shards/nalati-grasslands/stealth.ts ──
  updates.push((dt,t)=>{
    if(stealth===null)return;const threats:StealthThreat[]=[];
    for(let i=0;i<96;i++){const pack=wildlife?.packs[i];if(pack===undefined)break;for(let j=0;j<96;j++){const actor=pack.members[j];if(actor===undefined)break;if(actor.alive)threats.push({x:actor.position.x,z:actor.position.z,awareness:pack.awareness,alert:.35,hunting:Number(pack.phase==='shadow'||pack.phase==='encircle'||pack.phase==='regroup')});}}
    for(let i=0;i<96;i++){const herd=wildlife?.herds[i];if(herd===undefined)break;for(let j=0;j<96;j++){const actor=herd.members[j];if(actor===undefined)break;if(actor.alive&&(actor.mem['ridden']??0)!==1&&(actor.mem['owned']??0)!==1)threats.push({x:actor.position.x,z:actor.position.z,awareness:actor.mem['aw']??0,alert:.45,hunting:0});}}
    stealth.update(dt,t,{grass:wildEnv.grassStandingAt(player.position.x,player.position.z),mounted:extra.mounted,forced:ride!==null&&ride.taming.view.trust!==null,threats:threats.sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z)).slice(0,8)});
    if(play!==null&&play.kit!==null)play.kit.spear.damageScale=stealth.sneakMultiplier();
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
      const kit = play?.kit, mounted = ride?.mount.horse, bonded = ride?.taming.companion;
      painter?.update({ objects: new Map([
        ['blade', kit === null || kit === undefined ? [] : [kit.sabre.model]],
        ['arrows', kit === null || kit === undefined ? [] : [kit.bow.arrows.mesh]],
        ['mounts', [...new Set([...(mounted === null || mounted === undefined ? [] : [mounted.mesh]), ...(bonded?.alive === true && !bonded.hidden ? [bonded.mesh] : [])])]],
      ]),
      facts: new Set([...(boss.golden?.applied === true ? ['golden'] : []), ...(titan.naizagai?.applied === true ? ['storm'] : [])]) });
      if (kit !== null && kit !== undefined) for (const style of ['recurve', 'golden', 'sky-wolf'] as const)
        if (style === painter?.selectedFinishes.get('bow') && kit.bow.style !== style) kit.bow.setStyle(style);
    });

  // ── sound (B16 audio): wraps attachAnimals / bindPlay / wildEnv.onEvent for the creatures and the kit — src/shards/nalati-grasslands/sound.ts ──
  const sound=clientAudioScene(plugin);nalati.sound=sound;
  updates.push(dt=>{const clock=weather.clock;sound.update(dt,{wind:wind.speed,gust:wind.gustAt(player.position.x,player.position.z),sun:clock.sunElevation,dark:Number(clock.dayPhase==='dusk'||clock.dayPhase==='night'),storm:Number(weather.weather.stormActive),inside:Number(nalati.boss.inside),engaged:Number(nalati.titan.engaged)});});

  const ids = ['pois', 'weather.fx', 'titan', 'look', 'elites', 'boss', 'wildlife', 'stealth', 'night', 'ride', 'skins', 'sound'];
  let previous = 'main.world';
  if (updates.length !== ids.length) throw new Error('Nalati update registration lacks an id');
  for (let index = 0; index < 12; index++) {
    const name = ids[index], run = updates[index];
    if (name === undefined || run === undefined) throw new Error('Nalati update registration lacks an id');
    const id = `shard.nalati.${name}`;
    if (name === 'wildlife') installDeclaredCrowdFrames(plugin, { systemId: id, after: [previous], before: ['engine.creatures.update'],
      current: () => declaredCrowds?.runtime ?? null, frame: wildlifeFrame });
    else plugin.system({ id, phase: 'update', after: [previous], before: ['engine.creatures.update'], run });
    previous = id;
  }
  plugin.system({ id: 'shard.nalati.reins', phase: 'late', run: (dt) => { ride?.late(dt); } });
  plugin.on('weapon.fired', () => { nalati.onShot(); });
  plugin.on('weapon.impact', ({ surface, point }) => { nalati.onImpact(surface, point); });
  plugin.answer('combat.targets.ray', (request: RayTargets): RayTargets => ({ ...request, hit: nalati.sheepTarget(request.origin, request.dir, request.maxDist, request.hit) }));
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

export interface Ride {
  refuse: ((x:number,z:number)=>boolean) | null; mount: Mount; taming: PageTamingOwner; hud: RideHUD; interactable: Interactable;
  readonly mounted: boolean; bind: (play: { toast:(text:string)=>void })=>void; update:(dt:number)=>void; late:(dt:number)=>void;
  reins: Reins; raid: SheepRaid; noteShot:(x:number,z:number)=>void;
}
interface RideCtx {
  ctx: ShardContext; player: Player; camera: Game['camera']; animals: AnimalManager; wildlife: Wildlife; programs: RidingPrograms;
  preset: ReturnType<typeof readPageRidingPreset>; rest: {x:number;z:number;face:{x:number;z:number}}; roads: NonNullable<MountProfile['roads']>;
  nativeTaming: {binding:unknown;rail:{x:number;z:number}}; nativeRide: Pick<MountProfile,'speeds'|'thrownDamage'|'thrownLabel'>;
  namePanel: PanelDefinition; persistence?: NalatiPersistence;
}
/** Bind this shard's remaining presentation and persistence to the game owner. */
function wireRide(ctx: RideCtx): Ride {
  let play: { toast: (text: string) => void } | null = null, savedBond: string | null = null, namingActor: string | null = null;
  try { savedBond = ctx.persistence?.bond.read() ?? tulparSave.read('nalati-grasslands'); } catch { /* unavailable storage */ }
  admitRenderedHerds(ctx.ctx.scope, ctx.preset.taming.herds, ctx.wildlife.herds);
  admitRidingWind(ctx.ctx.scope, wildEnv.wind);
  const names = ctx.persistence?.names.read() ?? {};
  const session = createPageRiding(ctx.ctx, ctx.player, ctx.animals, ctx.camera, {
    profile: { ...ctx.nativeRide, names, roads: ctx.roads, restAt: ctx.rest }, mode: ctx.preset.mode,
    taming: { ...ctx.preset.taming, programs: ctx.programs, binding: ctx.nativeTaming.binding, savedBond, rest: ctx.rest },
    actions: { ...ctx.preset.actions, program: ctx.programs.riding, rail: ctx.nativeTaming.rail },
    mountables: ctx.wildlife.mountables.map(actor => ({ id: actor.entityId, name: ctx.preset.mountableLabel })),
  });
  const { mount, taming, hud, interactable } = session, reins = new Reins(ctx.camera, ctx.ctx.scope), namer = new DataPanel(ctx.namePanel);
  const publishRaidNotice = (text: string): void => { play?.toast(text); };
  const raid = new SheepRaid({ animals: ctx.animals, wildlife: ctx.wildlife, toast: publishRaidNotice }), nameValues = { current: '' };
  const nameActions = new Map<string, (value: unknown) => void>([['save', value => {
    if (typeof value !== 'string') throw new Error('Name input requires text');
    const name = cleanHorseName(value);
    if (name.length > 0 && namingActor !== null) {
      mount.rename(namingActor, name); ctx.persistence?.names.write(names); play?.toast(`Your horse is ${name}`);
    }
  }]]);
  ctx.ctx.scope.onDispose(() => { namer.close(); });
  const advanceSession = session.update, advanceRaid = raid.update.bind(raid), advanceReins = reins.update.bind(reins);
  const weaponMount = { speed: 0, yaw: 0 }, noEquipment: [] = [];
  const ride: Ride = {
    refuse: null, mount, taming, hud, interactable, reins, raid,
    get mounted() { return mount.mounted; },
    bind(next) { play = next; },
    noteShot(x, z) { taming.noteShot(x, z); },
    update(dt) {
      const ahead = 2 + mount.speed * .4;
      const wet = wildEnv.wetAt(mount.feet.x, mount.feet.z);
      const blocked = ride.refuse?.(mount.feet.x + Math.sin(mount.heading) * ahead, mount.feet.z + Math.cos(mount.heading) * ahead) === true;
      advanceSession(dt, wet, blocked, namer.isOpen);
      wildEnv.playerMounted = mount.mounted;
      const events = session.drainEvents();
      for (let i = 0; i < 64; i++) {
        const event = events[i]; if (event === undefined) break;
        if (event.kind === 'notice') play?.toast(event.text);
        else if (event.kind === 'bond') ctx.persistence?.bond.write(event.value);
        else if (event.kind === 'bonded') ctx.persistence?.feat('tame');
        else if (event.kind === 'name') {
          namingActor = event.actor; nameValues.current = event.current; namer.open(nameValues, nameActions);
        }
      }
      advanceRaid(dt, ctx.player.position);
    },
    late(dt) {
      weaponMount.speed = mount.speed; weaponMount.yaw = mount.heading - Math.PI;
      const state = mount.mounted ? weaponMount : null, available = ctx.ctx.app.equipment?.available ?? noEquipment;
      for (let i = 0; i < 64; i++) {
        const weapon = available[i]; if (weapon === undefined) break;
        if (weapon instanceof Bow) { weapon.setMount(state); if (mount.gallopFloat) weapon.extraSpreadDeg *= .5; }
        else if (weapon instanceof Sabre || weapon instanceof Spear) weapon.mount = state;
      }
      const weapon = ctx.ctx.app.equipment?.current, drawing = weapon instanceof Bow && (weapon.adsHeld || weapon.drawing);
      advanceReins(dt, mount.horse, mount.mounted, mount.breaking || drawing);
    },
  };
  return ride;
}
