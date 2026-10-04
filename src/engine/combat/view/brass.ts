import { app } from '../../app/runtime';
import type * as THREE from 'three';
import { terrainHeight as heightAt } from '../../world/terrainHeight';
import { floorBelow } from '../../physics/query';

export function brassFloor(p: THREE.Vector3, v: THREE.Vector3): number {
  const physics = app.physics;
  if (physics === null) return heightAt(p.x, p.z);
  const f0 = floorBelow(physics, p.x, p.z, p.y, 8) ?? heightAt(p.x, p.z);
  const t = (v.y + Math.sqrt(v.y * v.y + 2 * 9.8 * Math.max(0, p.y - f0))) / 9.8;
  const x = p.x + v.x * t, z = p.z + v.z * t;
  return floorBelow(physics, x, z, p.y, 8) ?? heightAt(x, z);
}

export interface BrassCase { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; down: boolean; floor: number }
export function stepBrass(cases: readonly BrassCase[], dt: number): void {
  for (const b of cases) {
    if (b.life <= 0) continue;
    b.life -= dt;
    if (b.life <= 0) { b.mesh.visible = false; continue; }
    if (b.down) continue;
    b.vel.y -= 9.8 * dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    b.mesh.rotation.x += b.spin.x * dt; b.mesh.rotation.y += b.spin.y * dt; b.mesh.rotation.z += b.spin.z * dt;
    if (b.mesh.position.y < b.floor) { b.mesh.position.y = b.floor; b.down = true; b.mesh.rotation.set(0, app.rng.stream('cosmetic').next() * Math.PI, Math.PI / 2 + (app.rng.stream('cosmetic').next() - 0.5) * 0.3); }
  }
}
