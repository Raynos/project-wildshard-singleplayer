import * as THREE from 'three';
import { bootstrap } from './core/bootstrap';
import { CHUNK_HALF } from './core/config';
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
import { HUD } from './ui/HUD';
import { Loading } from './ui/Loading';
import { Audio } from './audio/Audio';

async function main() {
  const loading = new Loading();
  const world = await bootstrap((label, frac) => loading.step(label, frac));
  const { game, sky, player, forest, params } = world;
  const nolock = params.has('nolock');

  // ── world dressing ──
  loading.step('Raising the chunk boundary', 0.6);
  const boundary = new Boundary(sky).build();
  game.scene.add(boundary.group);
  const water = new Water(sky).build();
  game.scene.add(water.mesh);
  const horizon = new Horizon(sky).build();
  game.scene.add(horizon.group);

  loading.step('Seeding grass and ferns', 0.68);
  const grass = new Grass(sky, forest).build();
  const under = new Undergrowth(sky, forest).build();
  const particles = new Particles(sky, forest).build();
  game.scene.add(grass.group, under.group, particles.group);

  loading.step('Building the cabins', 0.78);
  const cabins = new Cabins(sky);
  const { group: cabinGroup, colliders, interactables } = await cabins.build();
  game.scene.add(cabinGroup);
  player.colliders.push(...colliders);
  player.platforms.push((x, z) => cabins.floorHeightAt(x, z));
  const props = new Props(sky, forest);
  game.scene.add(await props.build());
  player.colliders.push(...props.colliders);

  loading.step('Waking the herds', 0.9);
  const animals = new AnimalManager(game.scene, sky, forest).build();

  // ── player kit: crossbow, HUD, audio ──
  loading.step('Spanning the crossbow', 0.96);
  const targets: Targets = {
    raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
      const h = animals.raycast(origin, dir, maxDist);
      return h ? { animal: h.animal, point: h.point, distance: h.distance, headshot: h.headshot } : null;
    },
  };
  const crossbow = new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
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
  let attractT = 9;
  if (attract) { tour.active = true; tour.setTime(attractT); }
  const enter = () => {
    audio.resume();
    crossbow.enabled = true;
    crossbow.model.visible = true;
    if (tour.active && !params.has('tour')) { tour.active = false; player.spawn(0, -236, Math.PI); }
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
      carcass.mesh.visible = false;
    }
  });

  game.onUpdate((dt, t) => {
    if (attract && tour.active) { attractT += dt * 0.35; tour.setTime(9 + ((attractT - 9) % 22)); }
    boundary.update(dt, t);
    water.update(dt);
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
    if (health <= 0) { health = 100; hud.toast('Gored — respawning at the south gate'); hud.damageFlash(); player.spawn(0, -236, Math.PI); crossbow.addBolts(30 - crossbow.state.bolts); }

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
  game.start();
  await loading.done();
  (window as unknown as { __world: unknown }).__world = { ...world, boundary, water, grass, under, particles, cabins, props, animals, crossbow, hud, audio };
}
main();
