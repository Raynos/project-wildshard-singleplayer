import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Crossbow, type Targets, type TargetAnimal, type TargetHit } from '../player/Crossbow';
import { heightAt, inChunk } from '../world/Heightfield';
import { HUD } from '../ui/HUD';
import { Audio } from '../audio/Audio';
import { CHUNK_HALF } from '../core/config';

/** Dev harness: crossbow + stub targets. ?nolock=1 lets F/R/ads=1 work without pointer lock. */
class DummyTarget implements TargetAnimal {
  kind: 'deer' | 'boar';
  position = new THREE.Vector3();
  alive = true;
  hp = 100;
  body: THREE.Mesh; head: THREE.Mesh;
  private respawnAt = 0;
  constructor(scene: THREE.Scene, x: number, z: number, kind: 'deer' | 'boar', setup: (m: THREE.Material) => void) {
    this.kind = kind;
    const r = kind === 'boar' ? 0.45 : 0.6;
    const mat = new THREE.MeshStandardMaterial({ color: kind === 'boar' ? 0x4a3a2c : 0x8a6a48, roughness: 0.9 });
    setup(mat);
    this.body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 16, 12), mat);
    this.body.castShadow = this.head.castShadow = true;
    this.position.set(x, heightAt(x, z) + r, z);
    this.body.position.copy(this.position);
    this.head.position.copy(this.position).add(new THREE.Vector3(0, r * 0.9, 0));
    scene.add(this.body, this.head);
  }
  applyDamage(amount: number) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.alive = false; this.respawnAt = performance.now() + 5000; (this.body.material as THREE.MeshStandardMaterial).color.set(0x333333); return true; }
    return false;
  }
  update() {
    if (!this.alive && performance.now() > this.respawnAt) { this.alive = true; this.hp = 100; (this.body.material as THREE.MeshStandardMaterial).color.set(this.kind === 'boar' ? 0x4a3a2c : 0x8a6a48); }
    this.body.position.y = this.position.y - (this.alive ? 0 : 0.35);
    this.head.position.y = this.position.y + (this.alive ? 0.55 : 0.2);
  }
}

const _ray = new THREE.Ray(), _sphere = new THREE.Sphere(), _pt = new THREE.Vector3();
class StubTargets implements Targets {
  list: DummyTarget[] = [];
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    _ray.set(origin, dir);
    let best: TargetHit | null = null;
    for (const t of this.list) {
      if (!t.alive) continue;
      for (const [mesh, head] of [[t.head, true], [t.body, false]] as [THREE.Mesh, boolean][]) {
        _sphere.set(mesh.position, (mesh.geometry as THREE.SphereGeometry).parameters.radius);
        const hit = _ray.intersectSphere(_sphere, _pt);
        if (!hit) continue;
        const d = origin.distanceTo(_pt);
        if (d > maxDist) continue;
        if (!best || d < best.distance) best = { animal: t, point: _pt.clone(), distance: d, headshot: head };
      }
    }
    return best;
  }
}

async function main() {
  const world = await bootstrap();
  const { game, sky, player, forest, params } = world;
  const targets = new StubTargets();
  const yaw = player.yaw, px = player.position.x, pz = player.position.z;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  targets.list.push(new DummyTarget(game.scene, px + fx * 16 - rx * 2, pz + fz * 16 - rz * 2, 'boar', (m) => sky.setupMaterial(m)));
  targets.list.push(new DummyTarget(game.scene, px + fx * 22 + rx * 3, pz + fz * 22 + rz * 3, 'deer', (m) => sky.setupMaterial(m)));
  targets.list.push(new DummyTarget(game.scene, px + fx * 25 - rx * 6, pz + fz * 25 - rz * 6, 'deer', (m) => sky.setupMaterial(m)));

  const nolock = params.has('nolock');
  const crossbow = new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
  crossbow.adsHeld = params.has('ads');
  crossbow.inspect = params.has('inspect') ? 1 : 0;
  crossbow.reloadScale = params.has('slowreload') ? 6 : 1;
  const hud = new HUD({ pointerLock: !nolock });
  const audio = new Audio();
  let kills = 0, health = 100;

  // ── crossbow → hud / audio ──
  crossbow.onFire = () => { audio.crossbowFire(); };
  crossbow.onDry = () => { audio.dryFire(); };
  crossbow.onReloadStart = () => { audio.reload(); };
  crossbow.onImpact = (surface, point) => {
    const dx = point.x - player.position.x, dz = point.z - player.position.z, d = Math.hypot(dx, dz);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    audio.boltImpact(surface, d > 1 ? ((dx * rx + dz * rz) / d) * 0.7 : 0, 1 / (1 + d / 12));
  };
  crossbow.onHit = (kind, headshot, killed) => {
    hud.showHitMarker(headshot, killed);
    audio.hitMarker();
    if (killed) { kills++; audio.kill(); hud.killFeed(`${kind} ${headshot ? 'headshot' : 'killed'} · ${Math.round(player.position.distanceTo(targets.list[0].position))} m`); }
  };
  // ── player → audio ──
  player.onStep = (sprinting) => audio.footstep(sprinting);
  player.onJump = () => audio.jump();
  player.onLand = (hard) => { audio.land(hard); if (hard) { health = Math.max(0, health - 12); hud.damageFlash(); } };
  // ── intro / pointer lock ──
  const enter = () => { audio.resume(); crossbow.enabled = true; if (!nolock) player.lock(); };
  hud.onResume = enter;
  if (params.has('skipintro')) { hud.markEntered(); if (!nolock) crossbow.enabled = false; }
  else { crossbow.enabled = false; hud.showIntro(enter, { 'Targets': `${targets.list.length} stub spheres` }); }
  document.addEventListener('keydown', () => audio.resume(), { once: true });
  document.addEventListener('mousedown', () => audio.resume(), { once: true });
  // dev keys: T = deer call from target 0, G = boar grunt, H = hoofsteps, B = boar squeal, K = damage flash, P = toast
  document.addEventListener('keydown', (e) => {
    const t0 = targets.list[0], t1 = targets.list[1];
    if (e.code === 'KeyT') audio.animal('deer_call', t1.position, player.position, player.yaw);
    if (e.code === 'KeyG') audio.animal('boar_grunt', t0.position, player.position, player.yaw);
    if (e.code === 'KeyH') audio.animal('hoofsteps', t1.position, player.position, player.yaw);
    if (e.code === 'KeyB') audio.animal('boar_squeal', t0.position, player.position, player.yaw);
    if (e.code === 'KeyK') { health = Math.max(0, health - 15); hud.damageFlash(); }
    if (e.code === 'KeyP') hud.toast('Bolt recovered');
  });

  let prompt: string | undefined;
  game.onUpdate((dt, t) => {
    crossbow.update(dt, t);
    for (const d of targets.list) d.update();
    audio.listenerYaw = player.yaw;
    const near = targets.list.find((d) => d.alive === false && d.position.distanceTo(player.position) < 3);
    prompt = near ? '[E] Harvest carcass' : params.has('prompt') ? '[E] Open door' : undefined;
    const edge = CHUNK_HALF - Math.max(Math.abs(player.position.x), Math.abs(player.position.z));
    hud.setBoundaryWarning(edge < 14 || params.has('boundary'));
    void inChunk;
    hud.setState({
      bolts: crossbow.state.bolts, loaded: crossbow.state.loaded, reloading: crossbow.state.reloading, reloadProgress: crossbow.state.reloadProgress,
      health, fps: game.stats.fps, pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills,
      prompt, speed: player.speedFactor, ads: crossbow.state.ads,
    });
  });
  game.buildComposer();
  game.start();
  (window as unknown as { __world: unknown }).__world = { ...world, crossbow, targets, hud, audio };
}
main();
