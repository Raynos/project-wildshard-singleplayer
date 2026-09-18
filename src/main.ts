import * as THREE from 'three';
import { bootstrap } from './core/bootstrap';
import { CHUNK_HALF } from './core/config';
import { hasPond } from './world/Heightfield';
import { Boundary } from './world/Boundary';
import { Water } from './world/Water';
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
import { createBootPlan, type StepRunner } from './boot/plan';
import { declareTotals, installByteCounter } from './boot/bytes';
import { chunkFiles } from './boot/manifest';
import { getActiveChunk } from './chunks/registry';
import { TIER } from './core/tier';
import { Audio } from './audio/Audio';

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
  const respawn = () => player.spawn(chunk.spawn.x, chunk.spawn.z, chunk.spawn.yaw);

  // ── world dressing ──
  const { boundary, water, horizon } = await step('edge', () => {
    const boundary = new Boundary(sky).build();
    game.scene.add(boundary.group);
    const water = hasPond() ? new Water(sky).build() : null;
    if (water) game.scene.add(water.mesh);
    const horizon = new Horizon(sky).build();
    game.scene.add(horizon.group);
    return { boundary, water, horizon };
  });

  const { grass, under, particles } = await step('grass', () => {
    const grass = new Grass(sky, forest).build();
    const under = new Undergrowth(sky, forest).build();
    const particles = new Particles(sky, forest).build();
    game.scene.add(grass.group, under.group, particles.group);
    return { grass, under, particles };
  });

  const { cabins, interactables } = await step('cabins', async () => {
    const cabins = new Cabins(sky);
    const { group: cabinGroup, colliders, interactables } = await cabins.build();
    game.scene.add(cabinGroup);
    player.colliders.push(...colliders);
    player.platforms.push((x, z) => cabins.floorHeightAt(x, z));
    return { cabins, interactables };
  });
  const props = await step('props', async () => {
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
      return h ? { animal: h.animal, point: h.point, distance: h.distance, headshot: h.headshot } : null;
    },
  };
  const crossbow = new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  new TouchControls(player, crossbow, params.has('touch')); // on-screen FPS controls on coarse-pointer devices (?touch=1 forces)
  crossbow.adsHeld = params.has('ads');
  const hud = new HUD({ pointerLock: !nolock });
  const audio = new Audio();
  let kills = 0, health = 100, lastHurt = 0, pelts = 0;
  const harvested = new Set<object>();

  crossbow.onFire = () => audio.crossbowFire();
  crossbow.onDry = () => audio.dryFire();
  crossbow.onReloadStart = () => audio.reload();
  crossbow.onImpact = (surface, point) => {
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    audio.boltImpact(surface, d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, 1 / (1 + d / 12));
  };
  crossbow.onHit = (kind, headshot, killed) => {
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); }
  };
  animals.onKill = (a) => hud.killFeed(`${a.kind} · ${Math.round(a.position.distanceTo(player.position))} m`);
  animals.onSound = (name, pos) => audio.animal(name, pos, player.position, player.yaw);
  animals.onCharge = (_a, dmg) => { health = Math.max(0, health - dmg); lastHurt = performance.now(); hud.damageFlash(); audio.land(true); };
  player.onStep = (sprinting) => audio.footstep(sprinting);
  player.onJump = () => audio.jump();
  player.onLand = (hard) => { audio.land(hard); if (hard) { health = Math.max(0, health - 8); hud.damageFlash(); } };
  hud.onSoundToggle = (on) => { audio.muted = !on; };

  // ── intro: attract camera drifts through the hollow until the player enters ──
  const tour = world.tour;
  const attract = !params.has('skipintro') && !params.has('tour');
  let attractT = 12;
  if (attract) { tour.active = true; tour.setTime(attractT); }
  const enter = () => {
    audio.resume();
    crossbow.enabled = true;
    crossbow.model.visible = true;
    if (tour.active && !params.has('tour')) { tour.active = false; respawn(); }
    if (!nolock) player.lock();
  };
  hud.onResume = enter;
  if (attract) { crossbow.enabled = false; crossbow.model.visible = false; hud.showIntro(enter); }
  else { hud.markEntered(); crossbow.enabled = !nolock || params.has('skipintro'); }
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
      hud.toast(`${carcass.kind === 'deer' ? 'Venison + deer hide' : 'Boar meat + hide'} harvested · ${pelts} total`);
      audio.hitMarker();
      carcass.fadeOut();
    }
  });

  game.onUpdate((dt, t) => {
    // phones hold the hero frame: at 15–17 fps the drift judders and the 14 s wrap hard-cuts
    if (attract && tour.active && TIER !== 'phone') { attractT += dt * 0.3; tour.setTime(12 + ((attractT - 12) % 14)); }
    boundary.update(dt, t);
    water?.update(dt);
    horizon.update(dt, game.camera);
    grass.update(dt, player.position);
    under.update(dt, player.position);
    particles.update(dt, player.position, game.camera);
    cabins.update(dt, t);
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
    if (health <= 0) { health = 100; hud.toast('Gored — respawning at the south gate'); hud.damageFlash(); respawn(); crossbow.addBolts(30 - crossbow.state.bolts); }

    const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
    hud.setBoundaryWarning(edge < 14 && hud.entered);
    hud.setAimInfo(crossbow.aimInfo);
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
  await step('shaders', (p) => game.precompile((d, n) => p.set(d, n, `${d} / ${n} materials · ${programs()}`)));
  await step('firstFrame', (p) => game.firstFrame((d, n, what) => p.set(d, n, `${what} · ${programs()}`)));
  (plan as unknown as { done(): void }).done(); // throws unless both tracks are exactly 1
  game.start();
  await loading.done();
  (window as unknown as { __world: unknown }).__world = { ...world, boundary, water, grass, under, particles, cabins, props, animals, crossbow, hud, audio };
}
main();
