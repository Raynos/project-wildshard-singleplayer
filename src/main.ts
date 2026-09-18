import * as THREE from 'three';
import { bootstrap } from './core/bootstrap';
import { CHUNK_HALF } from './core/config';
import { hasPond, heightAt, CABIN_SITES } from './world/Heightfield';
import { Boundary } from './world/Boundary';
import { Water } from './world/Water';
import { Ocean } from './world/Ocean';
import { Pier } from './world/Pier';
import { Boat } from './world/Boat';
import { Boulders } from './world/Boulders';
import { Hut } from './world/Hut';
import { Palms } from './world/Palms';
import { HUT, LOOKOUT, WRECK, SHRINE, JETTIES } from './chunks/driftwood-isle';
import { Lookout } from './world/Lookout';
import { Wreck } from './world/Wreck';
import { Shrine } from './world/Shrine';
import { Bushes } from './world/Bushes';
import { Hands } from './player/Hands';
import { ROAD_LENGTH } from './core/config';
import { Sword } from './player/Sword';
import type { Weapon } from './player/Weapon';
import { Horizon } from './world/Horizon';
import { Grass } from './world/Grass';
import { Undergrowth } from './world/Undergrowth';
import { Particles } from './world/Particles';
import { Cabins } from './world/Cabin';
import { Props } from './world/Props';
import { AnimalManager } from './entities/AnimalManager';
import { Crossbow, type Targets, type TargetHit } from './player/Crossbow';
import { Rifle } from './player/Rifle';
import { Weapons, type WeaponId } from './player/Weapons';
import { WeaponPickup } from './player/WeaponPickup';
import { TouchControls } from './player/TouchControls';
import { HUD } from './ui/HUD';
import { Loading } from './ui/Loading';
import { Perf } from './ui/Perf';
import { Minimap } from './ui/Minimap';
import { FullMap } from './ui/Map';
import { GameMenu } from './ui/Menu';
import { Progress } from './game/Progress';
import { Inventory, harvestOf, ITEMS } from './game/Inventory';
import { getNumber, onNumber } from './ui/Settings';
import { Debug } from './ui/Debug';
import { KeepAlive } from './core/KeepAlive';
import { Combat } from './ui/Combat';
import { setAimTargets } from './player/AimTargets';
import { createBootPlan, type StepRunner } from './boot/plan';
import { declareTotals, installByteCounter } from './boot/bytes';
import { chunkFiles } from './boot/manifest';
import { getActiveChunk } from './chunks/registry';
import { Audio } from './audio/Audio';
import { installErrorModal, showError } from './ui/ErrorModal';

// live animal positions for the compass, reused buffers (no per-frame allocations in the update loop)
const _animalXZ: { x: number; z: number }[] = [];
function animalPositions(list: { position: { x: number; z: number }; alive?: boolean }[]) {
  let n = 0;
  for (const a of list) { if (a.alive === false) continue; const p = _animalXZ[n] ?? (_animalXZ[n] = { x: 0, z: 0 }); p.x = a.position.x; p.z = a.position.z; n++; }
  _animalXZ.length = n;
  return _animalXZ;
}

installErrorModal(); // before anything can throw
async function main() {
  const loading = new Loading();
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  const files = chunkFiles(getActiveChunk());
  const plan = createBootPlan((view) => loading.paint(view), { totals: declareTotals(files) });
  installByteCounter(plan, files);
  // a boot that throws shows WHY: the loading panel's foot line + the uncaught-exception modal (src/ui/ErrorModal.ts)
  window.addEventListener('unhandledrejection', (e) => plan.fail(`BOOT FAILED · ${String((e.reason as { message?: string })?.message ?? e.reason)}`.slice(0, 300)));
  window.addEventListener('error', (e) => plan.fail(`BOOT FAILED · ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`.slice(0, 300)));
  const step: StepRunner = (key, work) => plan.step(key, work).then((p) => p.value);
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached
  await window.__ws_sw?.ready;
  const world = await bootstrap(step);
  const { game, sky, player, forest, params, chunk } = world;
  const nolock = params.has('nolock');
  const isOcean = !!chunk.ocean; // open-water shard (Driftwood Isle): ocean + pier, no forest carpet / cabins / props
  const respawn = () => { player.spawn(chunk.spawn.x, chunk.spawn.z, chunk.spawn.yaw); if (pier) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; } };

  // ── world dressing ──
  const { boundary, water, ocean, pier, jetties, boat, palms, hut, lookout, wreck, shrine, bushes, horizon } = await step('edge', () => {
    const boundary = new Boundary(sky).build();
    game.scene.add(boundary.group);
    const water = !isOcean && hasPond() ? new Water(sky).build() : null;
    if (water) game.scene.add(water.mesh);
    const ocean = isOcean ? new Ocean(sky).build() : null;
    if (ocean) game.scene.add(ocean.group);
    // the south entry road is a wooden pier over the water; the player spawns on its deck
    const pier = isOcean ? new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: chunk.ocean!.level + 1.2 }).build() : null;
    if (pier) {
      game.scene.add(pier.group);
      player.colliders.push(...pier.colliders);
      player.platforms.push((x, z) => pier.floorHeightAt(x, z));
      const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y;
    }
    // the little sailboat you arrived in, moored to the pier's sea-end bollards; you can drop into it
    const boat = pier ? new Boat(sky, { x: -4.2, z: -CHUNK_HALF + 6, heading: 0, waterY: chunk.ocean!.level, moorTo: pier.mooringsFor(-4.2, -CHUNK_HALF + 6) }).build() : null;
    if (boat) {
      game.scene.add(boat.group); if (boat.ropes) game.scene.add(boat.ropes);
      player.colliders.push(...boat.colliders);
      player.platforms.push((x, z) => boat.floorHeightAt(x, z));
    }
    // faceted shore boulders along the beach
    const rocks = isOcean ? new Boulders(sky).build(Boulders.scatterShore(chunk.seed)) : null;
    if (rocks) { game.scene.add(rocks.mesh); player.colliders.push(...rocks.colliders); }
    // the thatched stilt hut on the plateau (porch, floor and front steps are walkable)
    const hut = isOcean ? new Hut(sky, HUT).build() : null;
    if (hut) { game.scene.add(hut.group); player.colliders.push(...hut.colliders); player.platforms.push((x, z) => hut.floorHeightAt(x, z)); }
    // the NE headland's lookout tower (platform + stair ramp walkable) and the wreck heeled on the east reef (deck walkable)
    const lookout = isOcean ? new Lookout(sky, LOOKOUT).build() : null;
    if (lookout) { game.scene.add(lookout.group); player.colliders.push(...lookout.colliders); player.platforms.push((x, z) => lookout.floorHeightAt(x, z)); }
    const wreck = isOcean ? new Wreck(sky, WRECK).build() : null;
    if (wreck) { game.scene.add(wreck.group); player.colliders.push(...wreck.colliders); player.platforms.push((x, z) => wreck.floorHeightAt(x, z)); }
    // the ring shrine in the NW jungle; the N / W / E jetties (the other entry roads); hibiscus bushes
    const shrine = isOcean ? new Shrine(sky, SHRINE).build() : null;
    if (shrine) { game.scene.add(shrine.group); player.colliders.push(...shrine.colliders); player.platforms.push((x, z) => shrine.floorHeightAt(x, z)); }
    const jetties = isOcean ? JETTIES.map((j) => new Pier(sky, { x: j.x, z: j.z, rot: j.rot, length: j.length, width: 3, deckY: chunk.ocean!.level + 1.2 }).build()) : [];
    for (const j of jetties) { game.scene.add(j.group); player.colliders.push(...j.colliders); player.platforms.push((x, z) => j.floorHeightAt(x, z)); }
    const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
    const bushes = isOcean ? new Bushes(sky).build(Bushes.scatterIsland(chunk.seed, 260, AVOID)) : null;
    if (bushes) game.scene.add(bushes.mesh);
    // coconut palms (one draw call, fronds sway in update)
    const palms = isOcean ? new Palms(sky).build(Palms.scatterIsland(chunk.seed, 150, AVOID)) : null;
    if (palms) { game.scene.add(palms.mesh); player.colliders.push(...palms.colliders); }
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    return { boundary, water, ocean, pier, jetties, boat, palms, hut, lookout, wreck, shrine, bushes, horizon };
  });

  const { grass, under, particles } = await step('grass', () => {
    // no forest carpet over open water (grass scattered the whole sea floor for 19 s)
    const grass = isOcean ? null : new Grass(sky, forest).build();
    const under = isOcean ? null : new Undergrowth(sky, forest).build();
    const particles = new Particles(sky, forest).build();
    if (grass && under) game.scene.add(grass.group, under.group);
    game.scene.add(particles.group);
    return { grass, under, particles };
  });

  const { cabins, interactables } = await step('cabins', async () => {
    if (isOcean) return { cabins: null, interactables: [] as Awaited<ReturnType<Cabins['build']>>['interactables'] };
    const cabins = new Cabins(sky);
    const { group: cabinGroup, colliders, interactables } = await cabins.build();
    game.scene.add(cabinGroup);
    player.colliders.push(...colliders);
    player.platforms.push((x, z) => cabins.floorHeightAt(x, z));
    return { cabins, interactables };
  });
  const props = await step('props', async () => {
    if (isOcean) return null;
    const props = new Props(sky, forest);
    game.scene.add(await props.build());
    player.colliders.push(...props.colliders);
    return props;
  });

  const animals = await step('animals', (p) => {
    const a = new AnimalManager(game.scene, sky, forest).build();
    p.detail(`${a.animals.length} animals`);
    return a;
  });

  // ── player kit: the shard's weapon + the AR-15 (Weapons.ts: 1 / 2 / Q, touch SWAP; the rifle is a cabin pickup), HUD, audio ──
  await step('weapon', () => undefined); // synchronous below; the step marks it in the log
  const targets: Targets = {
    raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
      const h = animals.raycast(origin, dir, maxDist);
      return h ? { animal: h.animal as unknown as TargetHit['animal'], point: h.point, distance: h.distance, headshot: h.headshot } : null; // Animal.kind is any species id; the weapons only read deer / boar
    },
  };
  // the shard hands the player its weapon (ChunkDef.weapon): the wooden sword on Driftwood Isle, the crossbow elsewhere
  const crossbow: Weapon = chunk.weapon === 'sword'
    ? new Sword({ game, sky, player, forest }, targets, { allowUnlocked: nolock })
    : new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  const weapons = new Weapons(crossbow, rifle); // held weapon = weapons.current; the hooks below are wired once here and forwarded; the rifle is locked until its pickup
  new TouchControls(player, weapons, params.has('touch')); // on-screen FPS controls on coarse-pointer devices (?touch=1 forces)
  weapons.adsHeld = params.has('ads');
  const hud = new HUD({ pointerLock: !nolock });
  const perf = new Perf(game); // frame meter top-right (?perf=0 hides)
  const minimap = new Minimap(); // circular minimap (Heightfield is installed by now)
  const fullMap = new FullMap(minimap); // the menu's MAP tab (Menu.ts mounts it); tap the minimap / M to open
  const keepAlive = new KeepAlive();
  const debug = new Debug(() => perf.refresh()); // TEMPORARY: tier/dpr/aa/meter knobs (src/ui/Debug.ts)
  const audio = new Audio();
  let kills = 0, health = 100, lastHurt = 0, pelts = 0, swimHold = false;
  const harvested = new Set<object>();
  // ── the in-game menu: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (src/ui/Menu.ts) ──
  const progress = new Progress(getActiveChunk().id);     // shard achievements → titles (src/game/achievements.ts)
  const inventory = new Inventory(getActiveChunk().id);   // the pack: harvest drops
  const menu = new GameMenu({
    fullMap, progress, inventory,
    kit: () => weapons.available.map((w) => ({ id: w.id, name: w.id === 'crossbow' ? 'Hunting crossbow' : w.id === 'sword' ? 'Wooden sword' : w.name, ammoLabel: w.id === 'crossbow' ? 'Iron bolts' : w.id === 'rifle' ? 'Rounds' : '', ammo: w.state.ammo ?? 0, magazine: w.state.magazine, reserve: w.state.reserve, equipped: w === weapons.current, icon: w.id === 'rifle' ? 'rifle' : 'crossbow' })),
    onEquip: (id) => weapons.select(id as WeaponId),
  });
  hud.menu = menu; // pause → Settings tab; the menu's CLOSE → hud.onResume
  fullMap.bindMinimap(() => { if (hud.entered) menu.open('map'); });
  document.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && hud.entered && !menu.isOpen) menu.open('map'); });
  menu.onOpen = () => { if (document.pointerLockElement) document.exitPointerLock?.(); }; // the map wants a cursor; the lock comes back on close (onResume)
  progress.onEarned = (d) => { hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); audio.hitMarker(); };
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera); // white-gloved swimming hands (shown only while player.swimming)
  weapons.onFire = () => (weapons.current.id === 'rifle' ? audio.rifleFire() : chunk.weapon === 'sword' ? audio.swordSwing() : audio.crossbowFire());
  weapons.onDry = () => audio.dryFire();
  weapons.onReloadStart = () => (weapons.current.id === 'rifle' ? audio.rifleReload() : audio.reload());
  weapons.onSwap = () => audio.weaponSwap();
  weapons.onImpact = (surface, point) => {
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const pan = d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, gain = 1 / (1 + d / 12);
    if (weapons.current.id !== 'rifle' && chunk.weapon === 'sword') audio.swordHit(surface, pan, gain); else audio.boltImpact(surface, pan, gain);
  };
  weapons.onHit = (_kind, headshot, killed) => {
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); }
  };
  animals.onKill = (a) => { hud.killFeed(`${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant); };
  setAimTargets(animals.animals); // aim assist reads the live array
  // the AR-15 is found, not issued: a floating pickup on the floor of cabin 1 (the hollow), inside by the door wall
  // (cabin local frame: door on +X, chimney end -Z — Cabin.ts); "[E] Take AR-15" through the door / harvest prompt path
  const rifleDrop = (() => {
    const site = CABIN_SITES[0]; if (!site || !cabins) return null;
    const lx = 1.5, lz = -1.6, c = Math.cos(site.rot), sn = Math.sin(site.rot);
    const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
    const drop = new WeaponPickup({ scene: game.scene, item: rifle.displayModel(), position: new THREE.Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z), tier: 'common', prompt: 'Take AR-15' });
    interactables.push(drop.interactable);
    drop.onPickup = () => { weapons.unlock('rifle'); weapons.select('rifle'); audio.hitMarker(); hud.toast('AR-15 acquired · 1/2 to switch, Q to swap'); };
    return drop;
  })();
  if (params.get('weapon') === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle', true); rifleDrop?.dispose(); } // dev: start with it
  new Combat(game, animals, weapons as unknown as Crossbow, game.camera); // health bars over animals + MMO-style damage / MISS floats (self-wiring); Combat only taps onFire / onImpact, which the manager forwards for every weapon
  animals.onSound = (name, pos) => audio.animal(name, pos, player.position, player.yaw);
  animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); audio.land(true); };
  player.onStep = (sprinting) => (player.wading ? audio.wadeStep(player.depth, sprinting) : audio.footstep(sprinting));
  player.onEnterWater = (impact) => audio.splash(impact);
  player.onExitWater = () => audio.waterExit();
  player.onStroke = () => audio.swimStroke();
  player.onJump = () => audio.jump();
  player.onLand = (hard) => { audio.land(hard); if (hard) { health = Math.max(0, health - 8); hud.damageFlash(); } };
  hud.onSoundToggle = (on) => { audio.muted = !on; masterGain(); };

  // ── menu ↔ world: the world is fully loaded, then sits frozen and silent under the menu (hero art
  // covers the canvas) until ENTER WORLD; "Exit to main menu" freezes it again — no reload, no
  // loading screen. `?skipintro=1` (bench / screenshots) and `?tour=1` go straight to the world.
  const tour = world.tour;
  const menuFirst = !params.has('skipintro') && !params.has('tour');
  const enter = () => {
    audio.resume();
    void keepAlive.start(); // screen wake lock — needs this user gesture
    weapons.setEnabled(true);
    weapons.visible = true;
    perf.setActive(true); debug.setActive(true);
    if (tour.active && !params.has('tour')) { tour.active = false; respawn(); }
    if (!nolock) player.lock();
  };
  hud.onResume = enter;
  hud.onExitToMenu = () => { weapons.setEnabled(false); perf.setActive(false); debug.setActive(false); }; // the HUD mutes audio and clears `entered`; the gate does the rest
  // Not a frame is rendered or ticked while the menu is up: hud.entered is the gate.
  game.frameGate = () => hud.entered;
  if (menuFirst) { weapons.setEnabled(false); weapons.visible = false; perf.setActive(false); audio.muted = true; hud.showIntro(enter); }
  else { hud.markEntered(); weapons.setEnabled(!nolock || params.has('skipintro')); debug.setActive(true); }
  document.addEventListener('keydown', () => audio.resume(), { once: true });
  document.addEventListener('mousedown', () => audio.resume(), { once: true });

  // ── interaction (doors) ──
  let prompt: string | undefined;
  let nearest: (typeof interactables)[number] | undefined;
  let carcass: (typeof animals.animals)[number] | undefined;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !hud.entered) return;
    if (nearest) nearest.onInteract();
    else if (carcass) {
      harvested.add(carcass); pelts++;
      const drops = harvestOf(carcass.kind, carcass.variant);
      for (const id of drops) inventory.add(id);
      hud.toast(`${drops.map((id) => ITEMS[id].label).join(' + ') || 'Nothing'} harvested · ${inventory.total} in the pack`);
      audio.hitMarker();
      carcass.fadeOut();
    }
  });

  game.onUpdate((dt, t) => {
    boundary.update(dt, t);
    water?.update(dt);
    ocean?.update(dt);
    boat?.update(dt);
    palms?.update(dt);
    hands.update(dt, player);
    horizon.update(dt, game.camera);
    grass?.update(dt, player.position);
    under?.update(dt, player.position);
    particles.update(dt, player.position, game.camera);
    cabins?.update(dt, t);
    // swimming holsters the weapon (hands only; Hands.ts follows)
    if (player.swimming !== swimHold) { swimHold = player.swimming; weapons.visible = !swimHold; weapons.setEnabled(!swimHold); }
    animals.update(dt, t, player.position, player.sprinting);
    weapons.update(dt, t); // every weapon ticks (bolts in flight keep flying while the rifle is out)
    rifleDrop?.update(dt, t, game.renderer, game.camera);
    audio.listenerYaw = player.yaw;

    // nearest interactable
    nearest = undefined; let best = 1e9;
    for (const it of interactables) { const d = it.position.distanceTo(game.camera.position); if (d < it.radius && d < best) { best = d; nearest = it; } }
    carcass = undefined;
    if (!nearest) for (const a of animals.animals) { if (!a.alive && !harvested.has(a) && a.position.distanceTo(player.position) < 2.6) { carcass = a; break; } }
    prompt = nearest ? `[E] ${nearest.label}` : carcass ? `[E] Harvest ${carcass.kind}` : undefined;

    // slow health regen; death → respawn at the gate
    if (health < 100 && performance.now() - lastHurt > 6000) health = Math.min(100, health + dt * 4);
    if (health <= 0) { health = 100; hud.toast('Gored — respawning at the south gate'); hud.damageFlash(); respawn(); crossbow.addBolts(30 - (crossbow.state.bolts ?? 30)); }

    const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
    hud.setBoundaryWarning(edge < 14 && hud.entered);
    hud.setAimInfo(weapons.aimInfo);
    if (hud.entered) { hud.setAnimals(animalPositions(animals.animals)); minimap.update(player.position, player.yaw, animals.animals); fullMap.update(player.position, player.yaw); } // compass paw + minimap (hidden under the menu)
    hud.setState({
      bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, reserve: weapons.state.reserve, loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
      ammoLabel: weapons.current.ammoLabel, weaponName: weapons.current.name, segments: weapons.current.segments,
      health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: weapons.state.ads,
    });
  });

  game.buildComposer();
  // Compile programs in batches with a visible count, then draw the first frames as a step —
  // instead of the first render() compiling ~100 programs in one stall (minutes on iOS).
  const programs = () => `${game.renderer.info.programs?.length ?? 0} programs`;
  await step('shaders', (p) => game.precompile((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
  await step('firstFrame', (p) => game.firstFrame((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
  (plan as unknown as { done(): void }).done(); // throws unless both tracks are exactly 1
  game.start();
  await loading.done();
  (window as unknown as { __world: unknown }).__world = { ...world, boundary, water, ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, hands, grass, under, particles, cabins, props, animals, crossbow, hud, audio };
}
main().catch((e: unknown) => showError(e instanceof Error ? `${e.name}: ${e.message}` : String(e), e instanceof Error ? e.stack ?? '' : ''));
