import { retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { bindEnteredEnvironment } from './enteredEnvironment';
import { Wildlife, type SheepHit } from '../creatures/wildlife';
import { wildEnv } from '../creatures/env';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { installRide } from '../ride/input';
import { Color, Vector3, type Object3D } from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import type { ImpactSurface } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { syncPainterlySun, updatePainterly, setPainterlyLook, painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';






import { NalatiWater } from '../water';
import { buildOutcrops } from '../outcrops';
import { buildCragRock } from '../cragRock';
import { NalatiPOIs } from '../world/index';
import { NalatiDressing } from '../world/dressing/index';
import { wireKurgan, type KurganBoss } from '../combat/goldenKing';
import { wireElites, type NalatiElites } from '../combat/elites';
import { wireWeather, type NalatiWeather } from '../world/installWeather';


import type { NalatiLoadout } from '../weapons/loadout';
import { nalatiWetAt } from '../wet';
import { wireNightEnemies } from '../combat/night';
import { installStealth, type Stealth } from '../stealth';
import { wireSound, type NalatiSound } from './audio/sound';
import { loadGrassField } from '@wildshard/kit/lookApi';
import { wireLookV2 } from '../look/index';
import { reseedGrassV2 } from '../look/grass';
import { wireRide, type Ride } from '../ride/ride';
import { wireStormTitan, type StormTitan } from '../combat/stormTitan';
import { NalatiSkinLocker, NalatiSkinPainter } from '../weapons/nalatiSkins';
import { HITCHING_RAIL } from '../world/layout';
import { registerNalatiPlaces } from '../world/places';
import type { RayTargets } from '@wildshard/engine/combat/targets';

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
  /** every frame (main.ts game.onUpdate) */
  /** the river, brook and waterfall (world agent) */
  water: NalatiWater;
  /** every POI (poi agent, B5): camp, bridge, roads, summer camp, kurgans, balbals, Eagle Rock, cairn, Crags */
  pois: NalatiPOIs;
  /** the day/night clock + storms (weather agent, B10): `weather.clock.onDusk(fn)`, `weather.weather.stormActive`,
   *  `weather.bind({ audio, hurt, scare })` from main.ts once the audio and the player's health exist */
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
  sound?: NalatiSound;
  /** riding + taming (creatures agent B7 / B8; src/shards/nalati-grasslands/ride/ride.ts): built in `attachAnimals`. main.ts pushes
   *  `ride.interactable` (the one nearest horse prompt: Mount / Dismount / Break the stallion) into its interactables and
   *  hands `ride.taming` to `elites.bind` (Argymaq, BROKEN → the bucking rounds) */
  ride: Ride | null;
  /** Jel Ata the Storm Titan (B14; src/shards/nalati-grasslands/stormTitan.ts): main.ts `titan.bind({...})` once the kit / ride / HUD exist,
   *  `titan.onPlayerDeath()` in its death check; `titan.engaged` holds the storm and stands the elites down */
  titan: StormTitan;
  /** the wearable skins (B15; src/shards/nalati-grasslands/weapons/nalatiSkins.ts): the elites' drops + the Sky-Marked Saddle, owned / worn per slot —
   *  main.ts's menu lists `skins.entries()` in the Inventory tab and wears them with `skins.toggle(id)` */
  skins: NalatiSkinLocker;
}

export async function buildNalatiWorld(ctx: NalatiCtx, plugin: ShardContext): Promise<Nalati> {
  const { game, sky } = ctx;
  const [{ practiceRoom }, { modelContext }] = await Promise.all([import('@wildshard/engine/core/practiceRoom'), import('@wildshard/engine/models/model')]);
  const { trample, grassHeightAt, grassBaseHeightAt } = await loadGrassField();
  const updates: ((dt: number, t: number) => void)[] = [];
  const groups: Record<string, Object3D> = {};

  // ── look (world agent, B0): the painterly material's shared uniforms — sun, painted shadow tint, rim light ──
  syncPainterlySun(sky);
  setPainterlyLook({ shadeTint: new Color(0.1, 0.16, 0.36), rimColor: new Color(1.5, 1.28, 0.95), wind: { x: 1, z: 0.35, strength: 1 } });
  updates.push((dt) => {
    updatePainterly(dt);
    // painterly sway (spruce, flags) follows the one Wind (the painterly grass calls wind.update each frame)
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, windUniforms.uWindStrength.value);
  });

  // ── water (world agent, B0): the braided Kunes, the plateau brook, the waterfall ──
  const water = new NalatiWater(sky).build();
  game.scene.add(water.group);
  groups['water'] = water.group;
  updates.push((dt) => water.update(dt));
  await macrotask();

  // ── rock outcrops (world agent, look pass): granite breaking out of the escarpment's steep ground ──
  const outcrops = buildOutcrops(sky);
  game.scene.add(outcrops.mesh);
  // NALATI-MERGE P1: every big block as the hull of what it draws, in the world registry (never `its registry piece`) —
  // E306 / E315: its rocks are models (the granite outcrop, the rounded boulder), placed drawnInto the mesh
  const rockCtx = modelContext(sky);
  const rockPlaced = [...await outcrops.register(plugin.app.registry, rockCtx, macrotask)];
  await macrotask();
  groups['outcrops'] = outcrops.mesh;

  // ── the snow ring's crag rock (the crags pass): fins on the crests, ribs on the faces, broken towers on the shoulders ──
  const crags = buildCragRock(sky);
  game.scene.add(crags.group);
  rockPlaced.push(...await crags.register(plugin.app.registry, rockCtx, macrotask));   // the crag rock model (fins, ribs, towers), drawnInto its quadrants
  await macrotask();
  groups['crags'] = crags.group;

  // ── grass + wind (grass agent, B1): the blade rings are Grass.ts → look/grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──
  const pois = new NalatiPOIs(sky).build();
  await pois.place(game.scene, ctx.player, macrotask);   // each POI into the world registry (NALATI-MERGE P1): drawn, collides, in Explore
  groups['pois'] = pois.group;
  updates.push((dt) => pois.update(dt));
  await macrotask();

  // ── dressing (dressing agent, look-pass lever 6): rocks, road stones, gravel-bar pebbles, shrubs, flower drifts, reeds,
  //    logs + stumps, ovoo cairns + ribbon poles, camp clutter, pollen, butterflies, kites — src/shards/nalati-grasslands/world/dressing/ ──
  const dressing = await new NalatiDressing(sky, ctx.forest).build(macrotask);
  reseedGrassV2(); // the grass mask baked before the dressing regrows around its boulders / shrubs (dressingCover)
  dressing.addTo(game.scene, [...pois.colliders, ...outcrops.colliders, ...crags.colliders]);   // the clutter keeps clear of these
  const dressPlaced = await dressing.place(plugin.app.registry, macrotask);
  // every named place is a set (E315 M12): the models placed in it — the POIs', the rocks', the dressing's
  await registerNalatiPlaces({ registry: plugin.app.registry, pois: pois.placed, others: [...rockPlaced, ...dressPlaced], yieldTask: macrotask });
  groups['dressing'] = dressing.group;
  updates.push((dt) => dressing.update(dt, game.camera, ctx.player.position, game.renderer));
  await macrotask();

  // ── weather + day/night (weather agent, B10): the clock, storms, the sky rig — src/shards/nalati-grasslands/weather.ts ──
  const weather = wireWeather({ ctx: plugin, manifest: ctx.chunk, game, sky, player: ctx.player, forest: ctx.forest, colliders: pois.colliders, water: water.group });
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
  const elites = wireElites({ game, sky, player: ctx.player, ledges: pois.cragLedges, phase: () => weather.clock.dayPhase, storm: () => weather.weather.stormActive });
  updates.push((dt, t) => {
    if (titan.engaged) { elites.bar?.hide(); return; }   // one boss bar at a time: the elites stand down while the Titan fights
    if (practiceRoom.open) { elites.bar?.hide(); return; }   // a practice room over the steppe: no banner, no bar, no lair found from 3 km up (E321)
    elites.update(dt, t);
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ShardManifest.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/shards/nalati-grasslands/kurganBoss.ts ──
  const boss = wireKurgan({ game, sky, player: ctx.player, entrance: pois.kurganEntrance, registry: plugin.app.registry });
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  weather.bind({ indoors: () => boss.inside }); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight
  await macrotask();

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const player = ctx.player;
  let wildlife: Wildlife | null = null;
  let attachedAnimals: AnimalManager | null = null;
  let play: NalatiPlay | null = null;
  let now = 0;
  // the grass hides you and is trampled by every mover (GrassTrample, B1); the river corridor + the brook are water to a walker
  const previousEnv = { ...wildEnv, wind: { ...wildEnv.wind } };
  if (!retainsRuntimeServices(plugin)) {
    wildEnv.grassHeightAt = grassHeightAt;
    wildEnv.grassStandingAt = (x, z) => grassBaseHeightAt(x, z);
    wildEnv.trample = (x, z, r, s, vx, vz) => { trample.push(x, z, r, s, vx, vz); };
    wildEnv.wetAt = nalatiWetAt;
  }
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
    plugin.app.events.emit('creature.signal', { name, x, z });
    if (name === 'howl') toastOnce(name, 'A wolf howls — the pack has your scent', 60);
    else if (name === 'stampede') toastOnce(name, 'Stampede!', 20);
    else if (name === 'pack-driven-off') toastOnce(name, 'The stallion drives the wolves off', 30);
    else if (name === 'stallion-beaten') toastOnce(name, 'The stallion gives ground', 30);
  };
  if (!retainsRuntimeServices(plugin)) wildEnv.onEvent = onSignal;
  // bowled over (the stallion's charge, a stampede): shoved along the blow, a red flash
  const onKnockdown = (dirX: number, dirZ: number, strength: number): void => {
    const l = Math.hypot(dirX, dirZ) || 1, v = 7 * Math.max(0.4, Math.min(1.5, strength));
    player.dash((dirX / l) * v, (dirZ / l) * v, 0.28);
    play?.flash();
    toastOnce('knockdown', 'Knocked down!', 4);
  };
  if (!retainsRuntimeServices(plugin)) {
    wildEnv.onKnockdown = onKnockdown;
    plugin.scope.onDispose(() => { if (wildEnv.onEvent === onSignal) Object.assign(wildEnv, previousEnv); });
  } else bindEnteredEnvironment(plugin, { grassHeightAt, grassStandingAt: grassBaseHeightAt,
    trample: (x, z, r, s, vx, vz) => { trample.push(x, z, r, s, vx, vz); }, wetAt: nalatiWetAt,
    onEvent: onSignal, onKnockdown,
  });
  updates.push((dt, t) => {
    now = t;
    if (wildlife === null) return;
    wildPlayer.forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    wildPlayer.crouching = player.crouching;
    extra.health01 = play?.health01() ?? 1;
    extra.mounted = ride?.mounted ?? false;   // B9: mounting stands you up; the packs get two tokens; a gallop stampedes the herd
    wildEnv.wind.x = wind.dirX; wildEnv.wind.z = wind.dirZ; wildEnv.wind.strength = Math.min(1, wind.speed / 10);
    wildlife.update(dt, t, wildPlayer, extra);
  });

  // the flock as a weapon target: one reused TargetAnimal for "the sheep on this ray"
  let sheepHit: SheepHit | null = null;
  const sheepPoint = new Vector3();
  const sheep: TargetAnimal = {
    kind: 'sheep', position: new Vector3(), alive: true,
    damageFor: () => 100,
    applyDamage: () => {
      if (sheepHit !== null && wildlife !== null) wildlife.killSheep(sheepHit);
      sheepHit = null; sheep.alive = false;
      return true;
    },
  };
  const sheepResult: TargetHit = { animal: sheep, point: sheepPoint, distance: 0, headshot: false };

  // B9, wired below; the crouch also works on the meadow while you approach a stallion to tame (E287: the quest asks for it)
  let stealth: Stealth | null = null;
  const night = wireNightEnemies({ game, sky, player: ctx.player, forest: ctx.forest, balbals: pois.balbals, clock: weather.clock });
  let devMode: string | null = null, devT = 0, devNext: (() => void) | null | undefined;
  let painter: NalatiSkinPainter | null = null, syncT = 0;
  const nalati: Nalati = {
    water, pois, weather, groups, boss, elites, wildlife, stealth, ride, titan, skins: new NalatiSkinLocker(),
    attachAnimals(animals) {
      attachedAnimals = animals;
      animals.wetAt = nalatiWetAt;
      animals.navSteer = true; // the packs, the herd, the flock's dog steer round what the navmesh walls off (NALATI-MERGE P3)
      const w = new Wildlife(animals, { scene: game.scene, sky, seed: ctx.chunk.seed });
      w.build();
      wildlife = w; nalati.wildlife = w;
      night.attach(animals);
      weather.bind({ scare: (x, z) => { w.scare(x, z, 60); } }); // a lightning strike breaks a pack / stampedes a herd within 60 m
      return w;
    },
    bindPlay(p) {
      play = p;
      stealth = installStealth(plugin, { player, wildlife: () => wildlife, isMounted: () => extra.mounted, crouchHere: () => ride !== null && ride.taming.view.trust !== null });
      nalati.stealth = stealth;
      if (wildlife === null || attachedAnimals === null) throw new Error('Nalati creatures have not been built');
      ride = wireRide({ ctx: plugin, player, forest: ctx.forest, animals: attachedAnimals, wildlife, camera: game.camera });
      nalati.ride = ride;
      installRide(plugin, ride);

      if (p.kit !== null) stealth.bindKit(p.kit);
      night.bindKit(p.kit);
      ride.bind({ toast: p.toast });
      devMode = ctx.params.get('ride');
      painter = new NalatiSkinPainter(nalati.skins, {
        mounted: () => ride?.mount.horse ?? null,
        sabre: p.kit?.sabre ?? null, bow: p.kit?.bow ?? null,
        golden: () => boss.golden?.applied === true, naizagai: () => titan.naizagai?.applied === true,
        tulpar: () => ride?.taming.tulpar ?? null,
      });
    },
    onShot() { stealth?.noteShot(); wildEnv.lastShotT = now; },
    onImpact(_surface, point) {
      // a landing arrow / javelin (not a sabre / spear blow at arm's length)
      if (wildlife === null || Math.hypot(point.x - player.position.x, point.z - player.position.z) < 4.5) return;
      wildlife.disturb(point.x, point.z);
      ride?.noteShot(point.x, point.z);
    },
    sheepTarget(origin, dir, maxDist, hit) {
      if (wildlife === null) return hit;
      const finish = (h: TargetHit | null): TargetHit | null => titan.target(origin, dir, maxDist, night.target(origin, dir, maxDist, h));
      const sh = wildlife.raycastSheep(origin, dir, hit !== null ? Math.min(maxDist, hit.distance) : maxDist);
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
  updates.push((dt, t) => { stealth?.update(dt, t); });
  // ── dusk + night enemies (bow agent, B11): the balbal warriors wake at dusk, the ghost riders ride the ridges at night —
  //    src/shards/nalati-grasslands/nightEnemies.ts (balbalWarriors.ts, ghostRiders.ts); chained into attachAnimals / bindPlay / the Targets ray ──

  elites.ghosts = night.riders;   // B12: Qara Batyr rides B11's captain rig at the head of a line
  titan.riders = night.riders;    // B14: the Titan's storm riders ride the same rig
  updates.push((dt, t) => { if (!practiceRoom.open) night.update(dt, t); });   // no night riders shooting up at a practice room (E321)
  /** dev (`?ride=`): mount = on a camp horse at the rail · gallop = on it at the spawn, down the road · camp = at the rail on foot · herd = 30 m from the nearest wild
   *  stallion · break = the bucking rounds on him · argymaq = beside Argymaq, beaten (with `?elite=argymaq`, the break prompt) */

  const devRide = (r: Ride, w: Wildlife, mode: string): (() => void) | null => {
    const face = (x: number, z: number): void => { player.yaw = Math.atan2(-(x - player.position.x), -(z - player.position.z)); player.pitch = -0.05; };
    const put = (x: number, z: number): void => { player.position.set(x, heightAt(x, z), z); };
    if (mode === 'mount' || mode === 'camp' || mode === 'gallop') {
      const h = w.campHorses[0];
      if (h === undefined) return null;
      put(HITCHING_RAIL.x - 6, HITCHING_RAIL.z - 3); face(h.position.x, h.position.z);
      if (mode !== 'camp') r.mount.mount(h);
      // gallop: the camp horse out on the north road at the spawn, heading down it (open ground for a run)
      if (mode === 'gallop') { const sp = ctx.chunk.spawn; r.mount.teleport(sp.x, sp.z, sp.yaw + Math.PI); }
      return null;
    }
    const herd = mode === 'argymaq' ? w.herds.find((h) => h.stallion?.kind === 'argymaq') : w.herds.find((h) => h.stallion?.kind === 'horse');
    const st = herd?.stallion ?? null;
    if (herd === undefined || st === null) return null;
    const dx = st.position.x - herd.cx, dz = st.position.z - herd.cz, l = Math.hypot(dx, dz) || 1, d = mode === 'herd' ? 30 : 2.6;
    put(st.position.x + (dx / l) * d, st.position.z + (dz / l) * d); face(st.position.x, st.position.z);
    if (mode === 'argymaq') st.hp = Math.min(st.hp, st.maxHp * 0.2);   // the herd reads him BEATEN → the break prompt
    return mode === 'break' ? () => { r.taming.forceBreak(); } : null;   // once Taming has picked the nearest stallion
  };
  // ── riding + taming (creatures agent B7 / B8; src/shards/nalati-grasslands/ride/ride.ts, src/shards/nalati-grasslands/ride/Mount.ts, src/shards/nalati-grasslands/ride/Taming.ts): the camp's two
  //    saddled horses, TULPAR (or ARGYMAQ, who replaces him), the bucking rounds; `?ride=mount|gallop|camp|herd|break|argymaq` (dev) ──
    updates.push((dt) => {
      ride?.update(dt);
      // dev `?ride=`: 1 s of play in (the elites have spawned Argymaq), then the follow-up 0.8 s later
      if (devMode === null || ride === null || wildlife === null) return;
      devT += dt;
      if (devT > 1 && devNext === undefined) devNext = devRide(ride, wildlife, devMode);
      else if (devT > 1.8 && devNext !== undefined) { devNext?.(); devMode = null; }
    });
  // ── wearable skins (B15; src/shards/nalati-grasslands/weapons/nalatiSkins.ts): the elites' drops (mirrored from elites.skins once a second) and the
  //    Titan's saddle, painted on the kit and on the horse you ride / your bonded horse ──

    updates.push((dt) => {
      syncT -= dt;
      if (syncT <= 0) { syncT = 1; for (const id of elites.skins) nalati.skins.own(id); }
      painter?.update();
    });

  // ── sound (B16 audio): wraps attachAnimals / bindPlay / wildEnv.onEvent for the creatures and the kit — src/shards/nalati-grasslands/sound.ts ──
  const sound = wireSound(nalati, { player: ctx.player, weather, scope: plugin.scope, on: plugin.on, debug: plugin.debug });
  nalati.sound = sound;
  updates.push((dt) => { sound.update(dt); });

  const ids = ['painterly', 'water', 'pois', 'dressing', 'weather.fx', 'titan', 'look', 'elites', 'boss', 'wildlife', 'stealth', 'night', 'ride', 'skins', 'sound'];
  let previous = 'main.world';
  for (const [index, run] of updates.entries()) {
    const name = ids[index];
    if (name === undefined) throw new Error('Nalati update registration lacks an id');
    const id = `shard.nalati.${name}`;
    plugin.system({ id, phase: 'update', after: [previous], before: ['engine.creatures.update'], run });
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
  return nalati;
}
