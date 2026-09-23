/**
 * The Nalati Grasslands wiring — everything this shard adds on top of the shared boot (docs/plans/NALATI.md).
 *
 * `main.ts` calls `wireNalati(ctx)` once, inside its `props` step, when `chunk.style === 'painterly'`, and
 * `nalati.update(dt, t)` every frame. Nothing here runs for Pine Hollow or Driftwood Isle.
 *
 * Already done by the shared boot for this shard (driven by `src/chunks/nalati-grasslands.ts`):
 *   · the painted terrain + slab (Terrain.ts painterly branch), the painted sky / sun / planet / clouds (Sky.ts),
 *     the Nalati horizon ring (Horizon.ts, `ChunkDef.horizon`), fog + grade (the def's values)
 *   · grass: main.ts still builds `Grass` for every dry shard — the grass agent's painterly mode lives in Grass.ts
 *   · trees: bootstrap's Forest from `trees.factory` (the spruce agent's `'spruce'` factory + `forest.mask`)
 *   · animals: AnimalManager from `fauna` (wolves / horses / sheep register as species)
 *   · the weapon: `ChunkDef.weapon` (the Driftwood sword until the bow / sabre land)
 *
 * Each section below is one system; its owner fills it in. Keep main.ts untouched — add here.
 */
import { Color, Material, Mesh, Vector3, type Object3D } from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { ChunkDef } from '../chunks/ChunkDef';
import { syncPainterlySun, updatePainterly, setPainterlyLook, painterlyUniforms } from '../world/painterly';
import { wind } from '../world/Wind';
import { windUniforms } from '../world/TreeFactory';
import { NalatiWater } from './water';
import { buildOutcrops } from './outcrops';
import { NalatiPOIs } from '../world/nalati';
import { NalatiDressing } from '../world/nalati/dressing';
import { reseedPainterlyGrass } from '../world/GrassPainterly';
import { wireKurgan, type KurganBoss } from './kurganBoss';
import { wireElites, type NalatiElites } from './elites';
import { wireWeather, type NalatiWeather } from './weather';
import { macrotask } from '../boot/plan';
import type { AnimalManager } from '../entities/AnimalManager';
import { Wildlife, type SheepHit } from '../entities/Wildlife';
import { wildEnv } from '../entities/wildEnv';
import { isLunging } from '../entities/Pack';
import { trample, grassHeightAt } from '../world/GrassTrample';
import type { ImpactSurface, TargetAnimal, TargetHit } from '../player/Crossbow';
import type { NalatiKit } from '../player/nalatiKit';
import { nalatiWetAt } from './wet';
import { wireNightEnemies } from './nightEnemies';
import { Stealth } from './stealth';
import { PaintedBackdrop } from '../world/PaintedBackdrop';
import { wireSound, type NalatiSound } from './sound';
import { LOOK_V2, wireLookV2 } from './look';
import { wireRide, type Ride } from './ride';
import { HITCHING_RAIL } from '../world/nalati/layout';
import { heightAt } from '../world/Heightfield';

export interface NalatiCtx { game: Game; sky: Sky; player: Player; forest: Forest; chunk: ChunkDef }

/** what main.ts hands the wiring once the kit and the HUD exist (`nalati.bindPlay`) */
export interface NalatiPlay {
  kit: NalatiKit | null;
  /** 0..1 — the wolves' alpha joins in when you're hurt */
  health01: () => number;
  toast: (text: string) => void;
  /** the red damage flash (a knock-down) */
  flash: () => void;
}

export interface Nalati {
  /** every frame (main.ts game.onUpdate) */
  update: (dt: number, t: number) => void;
  /** the river, brook and waterfall (world agent) */
  water: NalatiWater;
  /** every POI (poi agent, B5): camp, bridge, roads, summer camp, kurgans, balbals, Eagle Rock, cairn, Crags */
  pois: NalatiPOIs;
  /** the day/night clock + storms (weather agent, B10): `weather.clock.onDusk(fn)`, `weather.weather.stormActive`,
   *  `weather.bind({ audio, hurt, scare })` from main.ts once the audio and the player's health exist */
  weather: NalatiWeather;
  /** the great kurgan's dungeon + the Golden King (boss agent, B13; src/nalati/kurganBoss.ts): `boss.bind(play)` from main.ts
   *  once the animals, the kit and the HUD exist; `boss.onPlayerDeath()` in main's death check (true = the boss fight
   *  handled it: the player is back at the phase checkpoint); `boss.inside` while the player is in the dungeon */
  boss: KurganBoss;
  /** the named elites (elites agent, B12; src/nalati/elites.ts): Aqbars, Kokbori, Qyran, Qara Batyr, Argymaq — `elites.bind(play)`
   *  from main.ts once the animals, the wildlife and the HUD exist */
  elites: NalatiElites;
  /** the creatures (creatures agent, B4; src/entities/Wildlife.ts): wolf packs, the horse herd + stallion, the sheep flock +
   *  its dog, marmots, the camp's saddled horses. main.ts calls `attachAnimals(animals)` right after its animals step. */
  attachAnimals: (animals: AnimalManager) => Wildlife;
  wildlife: Wildlife | null;
  /** main.ts once the kit + HUD exist: the braced spear stops a lunging wolf, knock-downs, howl / stampede toasts */
  bindPlay: (play: NalatiPlay) => void;
  /** weapons.onFire: a shot reveals you for a second (the stealth model) */
  onShot: () => void;
  /** weapons.onImpact: an arrow / javelin landing near a herd or the flock spooks it */
  onImpact: (surface: ImpactSurface, point: Vector3) => void;
  /** main's Targets.raycast: the nearer of `hit` (the animals) and a sheep on the ray — the flock is not an AnimalManager crowd */
  sheepTarget: (origin: Vector3, dir: Vector3, maxDist: number, hit: TargetHit | null) => TargetHit | null;
  /** anything a later system wants to find: named groups added to the scene by this wiring */
  groups: Record<string, Object3D>;
  /** crouch + grass stealth (melee agent, B9; src/nalati/stealth.ts): `stealth.state` (hidden / visible / noticed /
   *  detected), `stealth.cover`, `stealth.latched` — taming reads it (TRUST builds only crouched) */
  stealth: Stealth;
  /** the steppe's sound (B16 audio; src/nalati/sound.ts): creatures, hooves, the grassland bed, the kit's voices — set just
   *  before wireNalati returns; main.ts: `sound.bind(audio, music)`, `sound.fire(id)` / `sound.impact(…)` in the weapon hooks */
  sound?: NalatiSound;
  /** riding + taming (creatures agent B7 / B8; src/nalati/ride.ts): built in `attachAnimals`. main.ts pushes
   *  `ride.interactable` (the one nearest horse prompt: Mount / Dismount / Break the stallion) into its interactables and
   *  hands `ride.taming` to `elites.bind` (Argymaq, BROKEN → the bucking rounds) */
  ride: Ride | null;
}

export async function wireNalati(ctx: NalatiCtx): Promise<Nalati> {
  const { game, sky } = ctx;
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
  ctx.player.colliders.push(...outcrops.colliders);
  groups['outcrops'] = outcrops.mesh;
  await macrotask();

  // ── grass + wind (grass agent, B1): the painterly carpet is Grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──
  const pois = new NalatiPOIs(sky).build();
  pois.addTo(game.scene, ctx.player);
  groups['pois'] = pois.group;
  updates.push((dt) => pois.update(dt));
  await macrotask();

  // ── dressing (dressing agent, look-pass lever 6): rocks, road stones, gravel-bar pebbles, shrubs, flower drifts, reeds,
  //    logs + stumps, ovoo cairns + ribbon poles, camp clutter, pollen, butterflies, kites — src/world/nalati/dressing/ ──
  const dressing = await new NalatiDressing(sky, ctx.forest).build(macrotask);
  reseedPainterlyGrass(); // grass seeded before the dressing regrows around its boulders / shrubs (dressingCover)
  dressing.addTo(game.scene, ctx.player);
  groups['dressing'] = dressing.group;
  updates.push((dt) => dressing.update(dt, game.camera, ctx.player.position, game.renderer));
  await macrotask();

  // ── weather + day/night (weather agent, B10): the clock, storms, the sky rig — src/nalati/weather.ts ──
  const weather = wireWeather({ game, sky, player: ctx.player, forest: ctx.forest, colliders: pois.colliders, water: water.group });
  groups['weather'] = weather.fx.group;
  updates.push((dt) => weather.update(dt));

  // ── painted backdrop (painted-asset agent, look pass): the 360° matte painting of the real Nalati past the horizon rings —
  //    src/world/PaintedBackdrop.ts (loads on its own, the boot does not wait). It takes the far range over from the
  //    procedural PainterlyRange (hidden while the painting shows). `?backdrop=0` = off, for before / after shots. ──
  // Look v2 (?look=v2, src/nalati/look/): ONE seamless 360° panorama on a sky dome instead — the painting is the sky, the
  // clouds, the planet, the sun and the far range; the fog takes its colour from it (docs/design/nalati/handoff/port-v2.md)
  if (LOOK_V2) await wireLookV2({ game, sky, weather, updates, groups });
  else if (new URLSearchParams(location.search).get('backdrop') !== '0') {
    void (async () => {
      const bd = await PaintedBackdrop.load(game.renderer);
      if (bd === null) return;
      sky.clouds.add(bd.mesh);
      const range = sky.clouds.getObjectByName('painted-range');
      if (range) range.visible = false;
      // the painting is the far snow range: the geometric Nalati range rings (Horizon.ts rings 2 + 3, r 1950 / 2480) stand
      // down; rings 0 + 1 (800 / 1400 m: the plateau rolling on, the Avral foothills) stay in front as the near / mid parallax
      game.scene.traverse((o) => { if (o instanceof Mesh && o.material instanceof Material && /^ridge[23]$/.test(o.material.name)) o.visible = false; });
      groups['backdrop'] = bd.mesh;
      updates.push(() => { bd.update(weather.look, weather.weather.overcast, weather.weather.rain, weather.weather.flash); });
    })();
  }

  // ── named elites (elites agent, B12): the five lairs, their spawn rules on the clock / the storm — src/nalati/elites.ts ──
  const elites = wireElites({ game, sky, player: ctx.player, ledges: pois.cragLedges, phase: () => weather.clock.phase, storm: () => weather.weather.stormActive });
  updates.push((dt, t) => {
    elites.update(dt, t);
    for (const s of elites.scripts) if (s.animal !== null) s.animal.mem['noHeadBar'] = 1;   // the elite's own bar, not the combat one
  });

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager — `attachAnimals` below (main.ts calls it after its animals step) ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ChunkDef.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/nalati/kurganBoss.ts ──
  const boss = wireKurgan({ game, sky, player: ctx.player, entrance: pois.kurganEntrance });
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  weather.bind({ indoors: () => boss.inside }); // weather agent (B10): no lightning / rain in the dungeon, and no storm starts during the fight
  await macrotask();

  // ── creatures (creatures agent, B4): Wildlife over main's AnimalManager, fed the grass, the wind, the water, the player ──
  const player = ctx.player;
  let wildlife: Wildlife | null = null;
  let play: NalatiPlay | null = null;
  let now = 0;
  // the grass hides you and is trampled by every mover (GrassTrample, B1); the river corridor + the brook are water to a walker
  wildEnv.grassHeightAt = grassHeightAt;
  wildEnv.trample = (x, z, r, s, vx, vz) => { trample.push(x, z, r, s, vx, vz); };
  wildEnv.wetAt = nalatiWetAt;
  // Wildlife reads position / forward / crouching; Player.forward allocates, so a reused view of it
  const wildPlayer = { position: player.position, forward: new Vector3(0, 0, -1), crouching: false };
  const extra = { mounted: false, health01: 1 };
  let ride: Ride | null = null;   // riding + taming (B7 / B8) — wired in the riding section below
  // the braced spear kills a lunging wolf outright (combat.md): checked a little outside the spear's own contact reach, so
  // it lands before a glancing brace hit could stagger the wolf out of its lunge
  const BRACE_KILL_REACH = 3.1, BRACE_KILL_COS = Math.cos(32 * Math.PI / 180);
  const _hitDir = new Vector3(), _hitPt = new Vector3();
  const braceKills = (): void => {
    const kit = play?.kit;
    if (!kit?.spear.bracing || wildlife === null) return;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    for (const w of wildlife.livingWolves) {
      if (!w.alive || !isLunging(w)) continue;
      const dx = w.position.x - player.position.x, dz = w.position.z - player.position.z, d = Math.hypot(dx, dz);
      if (d < 1e-3 || d - 0.6 * w.scale > BRACE_KILL_REACH || (dx * fx + dz * fz) / d < BRACE_KILL_COS) continue;
      _hitDir.set(dx / d, 0, dz / d);
      _hitPt.set(w.position.x, w.position.y + 0.55 * w.scale, w.position.z);
      const killed = w.applyDamage(w.hp + 1, _hitPt, _hitDir);
      kit.spear.onHit?.(w.kind, false, killed);
      kit.spear.onImpact?.('flesh', _hitPt);
    }
  };
  // toasts for the herd / pack moments, each at most once in a while
  const lastToast = new Map<string, number>();
  const toastOnce = (key: string, text: string, every: number): void => {
    if (now - (lastToast.get(key) ?? -1e9) < every) return;
    lastToast.set(key, now); play?.toast(text);
  };
  wildEnv.onEvent = (name) => {
    if (name === 'howl') toastOnce(name, 'A wolf howls — the pack has your scent', 60);
    else if (name === 'stampede') toastOnce(name, 'Stampede!', 20);
    else if (name === 'pack-driven-off') toastOnce(name, 'The stallion drives the wolves off', 30);
    else if (name === 'stallion-beaten') toastOnce(name, 'The stallion gives ground', 30);
  };
  // bowled over (the stallion's charge, a stampede): shoved along the blow, a red flash
  wildEnv.onKnockdown = (dirX, dirZ, strength) => {
    const l = Math.hypot(dirX, dirZ) || 1, v = 7 * Math.max(0.4, Math.min(1.5, strength));
    player.dash((dirX / l) * v, (dirZ / l) * v, 0.28);
    play?.flash();
    toastOnce('knockdown', 'Knocked down!', 4);
  };
  updates.push((dt, t) => {
    now = t;
    if (wildlife === null) return;
    wildPlayer.forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    wildPlayer.crouching = player.crouching;
    extra.health01 = play?.health01() ?? 1;
    extra.mounted = ride?.mounted ?? false;   // B9: mounting stands you up; the packs get two tokens; a gallop stampedes the herd
    wildEnv.wind.x = wind.dirX; wildEnv.wind.z = wind.dirZ; wildEnv.wind.strength = Math.min(1, wind.speed / 10);
    wildlife.update(dt, t, wildPlayer, extra);
    braceKills();
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

  const stealth = new Stealth({ player, wildlife: () => wildlife, isMounted: () => extra.mounted }); // B9, wired below
  const nalati: Nalati = {
    water, pois, weather, groups, boss, elites, wildlife, stealth, ride,
    attachAnimals(animals) {
      animals.wetAt = nalatiWetAt;
      const w = new Wildlife(animals, { scene: game.scene, sky, seed: ctx.chunk.seed }).build();
      wildlife = w; nalati.wildlife = w;
      weather.bind({ scare: (x, z) => { w.scare(x, z, 60); } }); // a lightning strike breaks a pack / stampedes a herd within 60 m
      return w;
    },
    bindPlay(p) { play = p; },
    onShot() { wildEnv.lastShotT = now; },
    onImpact(_surface, point) {
      // a landing arrow / javelin (not a sabre / spear blow at arm's length)
      if (wildlife === null || Math.hypot(point.x - player.position.x, point.z - player.position.z) < 4.5) return;
      wildlife.disturb(point.x, point.z);
    },
    sheepTarget(origin, dir, maxDist, hit) {
      if (wildlife === null) return hit;
      const sh = wildlife.raycastSheep(origin, dir, hit !== null ? Math.min(maxDist, hit.distance) : maxDist);
      if (sh === null) return hit;
      sheepHit = { flock: sh.flock, index: sh.index, distance: sh.distance };
      sh.flock.positions(sh.index, sheep.position);
      sheep.alive = true;
      sheepPoint.copy(sheep.position);
      sheepResult.distance = sh.distance;
      return sheepResult;
    },
    update(dt, t) { for (const u of updates) u(dt, t); },
  };
  // ── crouch + grass stealth (melee agent, B9): the long-grass CROUCH toggle (touch disc above JUMP, C / Ctrl on desktop),
  //    the eye pip + GRASS meter + threat chevron, the sneak shot (× 2 from HIDDEN on arrows and javelins) — src/nalati/stealth.ts ──
  updates.push((dt, t) => { stealth.update(dt, t); });
  const bindPlay = nalati.bindPlay, onShot = nalati.onShot;
  nalati.bindPlay = (p) => { bindPlay(p); if (p.kit !== null) stealth.bindKit(p.kit); };
  nalati.onShot = () => { stealth.noteShot(); onShot(); }; // before onShot marks the shot (a loose reveals you)

  // ── dusk + night enemies (bow agent, B11): the balbal warriors wake at dusk, the ghost riders ride the ridges at night —
  //    src/nalati/nightEnemies.ts (balbalWarriors.ts, ghostRiders.ts); chained into attachAnimals / bindPlay / the Targets ray ──
  const night = wireNightEnemies({ game, sky, player: ctx.player, forest: ctx.forest, balbals: pois.balbals, clock: weather.clock });
  elites.ghosts = night.riders;   // B12: Qara Batyr rides B11's captain rig at the head of a line
  updates.push((dt, t) => { night.update(dt, t); });
  {
    const attach = nalati.attachAnimals, bind = nalati.bindPlay, sheepT = nalati.sheepTarget;
    nalati.attachAnimals = (animals) => { const w = attach(animals); night.attach(animals); return w; };   // night.attach never throws (it logs)
    nalati.bindPlay = (p) => { bind(p); night.bindKit(p.kit); };
    nalati.sheepTarget = (o, d, m, h) => night.target(o, d, m, sheepT(o, d, m, h));
  }

  /** dev (`?ride=`): mount = on a camp horse at the rail · gallop = on it at the spawn, down the road · camp = at the rail on foot · herd = 30 m from the nearest wild
   *  stallion · break = the bucking rounds on him · argymaq = beside Argymaq, beaten (with `?elite=argymaq`, the break prompt) */
  let devMode: string | null = null, devT = 0, devNext: (() => void) | null | undefined;
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
  // ── riding + taming (creatures agent B7 / B8; src/nalati/ride.ts, src/player/Mount.ts, src/game/Taming.ts): the camp's two
  //    saddled horses, TULPAR (or ARGYMAQ, who replaces him), the bucking rounds; `?ride=mount|gallop|camp|herd|break|argymaq` (dev) ──
  {
    const attach = nalati.attachAnimals, bind = nalati.bindPlay, impact = nalati.onImpact;
    nalati.attachAnimals = (animals) => {
      const w = attach(animals);
      ride = wireRide({ player, forest: ctx.forest, animals, wildlife: w, camera: game.camera });
      nalati.ride = ride;
      return w;
    };
    nalati.bindPlay = (p) => {
      bind(p);
      ride?.bind({ kit: p.kit, toast: p.toast });   // hurt → animals.onCharge (main's damage path)
      devMode = new URLSearchParams(location.search).get('ride');
    };
    nalati.onImpact = (surface, point) => {
      impact(surface, point);
      // a landing arrow / javelin (not a blow at arm's length): TRUST −30 near a stallion
      if (Math.hypot(point.x - player.position.x, point.z - player.position.z) >= 4.5) ride?.noteShot(point.x, point.z);
    };
    updates.push((dt) => {
      ride?.update(dt);
      // dev `?ride=`: 1 s of play in (the elites have spawned Argymaq), then the follow-up 0.8 s later
      if (devMode === null || ride === null || wildlife === null) return;
      devT += dt;
      if (devT > 1 && devNext === undefined) devNext = devRide(ride, wildlife, devMode);
      else if (devT > 1.8 && devNext !== undefined) { devNext?.(); devMode = null; }
    });
  }
  // ── sound (B16 audio): wraps attachAnimals / bindPlay / wildEnv.onEvent for the creatures and the kit — src/nalati/sound.ts ──
  const sound = wireSound(nalati, { player: ctx.player, weather });
  nalati.sound = sound;
  updates.push((dt) => { sound.update(dt); });

  return nalati;
}
