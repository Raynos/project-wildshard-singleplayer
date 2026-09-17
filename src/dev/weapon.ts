import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Crossbow, type Targets, type TargetAnimal, type TargetHit } from '../player/Crossbow';
import { heightAt } from '../world/Heightfield';

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

  const crossbow = new Crossbow({ game, sky, player, forest }, targets, { allowUnlocked: params.has('nolock') });
  crossbow.adsHeld = params.has('ads');
  crossbow.inspect = params.has('inspect') ? 1 : 0;
  crossbow.onFire = () => console.log('[weapon] fire');
  crossbow.onHit = (kind, headshot, killed) => console.log('[weapon] hit', kind, headshot ? 'HEADSHOT' : '', killed ? 'KILLED' : '');
  crossbow.onImpact = (surface) => console.log('[weapon] impact', surface);
  crossbow.onReloadStart = () => console.log('[weapon] reload start');
  crossbow.onReloadEnd = () => console.log('[weapon] reload end');

  game.onUpdate((dt, t) => { crossbow.update(dt, t); for (const d of targets.list) d.update(); });
  game.buildComposer();
  game.start();
  (window as unknown as { __world: unknown }).__world = { ...world, crossbow, targets };
}
main();
