import * as THREE from 'three';
import { bootstrap } from './core/bootstrap';
import { CHUNK_HALF } from './core/config';
import { hasPond } from './world/Heightfield';
import { Boundary } from './world/Boundary';
import { Water } from './world/Water';
import { Ocean } from './world/Ocean';
import { Pier } from './world/Pier';
import { Boat } from './world/Boat';
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

// live animal positions for the compass, reused buffers (no per-frame allocations in the update loop)
const _animalXZ: { x: number; z: number }[] = [];
function animalPositions(list: { position: { x: number; z: number }; alive?: boolean }[]) {
  let n = 0;
  for (const a of list) { if (a.alive === false) continue; const p = _animalXZ[n] ?? (_animalXZ[n] = { x: 0, z: 0 }); p.x = a.position.x; p.z = a.position.z; n++; }
  _animalXZ.length = n;
  return _animalXZ;
}

async function main() {
  const loading = new Loading();
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  const files = chunkFiles(getActiveChunk());
  const plan = createBootPlan((view) => loading.paint(view), { totals: declareTotals(files) });
  installByteCounter(plan, files);
  const step: StepRunner = (key, work) => plan.step(key, work).then((p) => p.value);
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached
  await window.__ws_sw?.ready;
  const world = await bootstrap(step);
  const { game, sky, player, forest, params, chunk } = world;
  const nolock = params.has('nolock');
  const isOcean = !!chunk.ocean; // open-water shard (Driftwood Isle): ocean + pier, no forest carpet / cabins / props
  const respawn = () => { player.spawn(chunk.spawn.x, chunk.spawn.z, chunk.spawn.yaw); if (pier) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; } };

  // ── world dressing ──
  const { boundary, water, ocean, pier, boat, horizon } = await step('edge', () => {
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
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    return { boundary, water, ocean, pier, boat, horizon };
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

  // ── player kit: crossbow, HUD, audio ──
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
  new TouchControls(player, crossbow as Crossbow, params.has('touch')); // on-screen FPS controls on coarse-pointer devices (?touch=1 forces)
  crossbow.adsHeld = params.has('ads');
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
    kit: () => [{ id: 'crossbow', name: 'Hunting crossbow', ammoLabel: 'Iron bolts', ammo: crossbow.state.bolts ?? 0, magazine: 30, reserve: 0, equipped: true, icon: 'crossbow' }],
  });
  hud.menu = menu; // pause → Settings tab; the menu's CLOSE → hud.onResume
  fullMap.bindMinimap(() => { if (hud.entered) menu.open('map'); });
  document.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && hud.entered && !menu.isOpen) menu.open('map'); });
  menu.onOpen = () => { if (document.pointerLockElement) document.exitPointerLock?.(); }; // the map wants a cursor; the lock comes back on close (onResume)
  progress.onEarned = (d) => { hud.toast(`Achievement · ${d.name} — title unlocked: ${d.title}`); audio.hitMarker(); };
  const masterGain = () => { if (!audio.muted) audio.master.gain.setTargetAtTime(0.6 * getNumber('volume'), audio.ctx.currentTime, 0.05); };
  onNumber('volume', masterGain);

  const hands = new Hands(sky, game.camera); // white-gloved swimming hands (shown only while player.swimming)
  crossbow.onFire = () => (chunk.weapon === 'sword' ? audio.swordSwing() : audio.crossbowFire());
  crossbow.onDry = () => audio.dryFire();
  crossbow.onReloadStart = () => audio.reload();
  crossbow.onImpact = (surface, point) => {
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const pan = d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, gain = 1 / (1 + d / 12);
    if (chunk.weapon === 'sword') audio.swordHit(surface, pan, gain); else audio.boltImpact(surface, pan, gain);
  };
  crossbow.onHit = (kind, headshot, killed) => {
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); }
  };
  animals.onKill = (a) => { hud.killFeed(`${a.label} · ${Math.round(a.position.distanceTo(player.position))} m`); progress.recordKill(a.kind, a.variant); };
  setAimTargets(animals.animals); // aim assist reads the live array
  new Combat(game, animals, crossbow, game.camera); // health bars over animals + MMO-style damage / MISS floats (self-wiring)
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
    crossbow.enabled = true;
    crossbow.model.visible = true;
    perf.setActive(true); debug.setActive(true);
    if (tour.active && !params.has('tour')) { tour.active = false; respawn(); }
    if (!nolock) player.lock();
  };
  hud.onResume = enter;
  hud.onExitToMenu = () => { crossbow.enabled = false; perf.setActive(false); debug.setActive(false); }; // the HUD mutes audio and clears `entered`; the gate does the rest
  // Not a frame is rendered or ticked while the menu is up: hud.entered is the gate.
  game.frameGate = () => hud.entered;
  if (menuFirst) { crossbow.enabled = false; crossbow.model.visible = false; perf.setActive(false); audio.muted = true; hud.showIntro(enter); }
  else { hud.markEntered(); crossbow.enabled = !nolock || params.has('skipintro'); debug.setActive(true); }
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
    hands.update(dt, player);
    horizon.update(dt, game.camera);
    grass?.update(dt, player.position);
    under?.update(dt, player.position);
    particles.update(dt, player.position, game.camera);
    cabins?.update(dt, t);
    // swimming holsters the weapon (hands only; Hands.ts follows)
    if (player.swimming !== swimHold) { swimHold = player.swimming; crossbow.model.visible = !swimHold; crossbow.enabled = !swimHold; }
    animals.update(dt, t, player.position, player.sprinting);
    crossbow.update(dt, t);
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
    hud.setAimInfo(crossbow.aimInfo);
    if (hud.entered) { hud.setAnimals(animalPositions(animals.animals)); minimap.update(player.position, player.yaw, animals.animals); fullMap.update(player.position, player.yaw); } // compass paw + minimap (hidden under the menu)
    hud.setState({
      bolts: crossbow.state.bolts, loaded: crossbow.state.loaded, reloading: crossbow.state.reloading, reloadProgress: crossbow.state.reloadProgress,
      health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: crossbow.state.ads,
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
  (window as unknown as { __world: unknown }).__world = { ...world, boundary, water, ocean, pier, boat, hands, grass, under, particles, cabins, props, animals, crossbow, hud, audio };
}
main();
