import { expect, test } from 'vitest';
import * as THREE from 'three';
import { SkyRig } from '../src/engine/world/skyRig';
import { Flock, type SheepPose, type FlockController } from '../src/shards/nalati-grasslands/creatures/flock';

test('flock lends live poses to the shared draw and keeps prey and paused uploads authoritative', async () => {
  const rows: SheepPose[] = [
    { x: 4, y: 2, z: 8, yaw: .3, speed: 3, phase: .2, graze: .4, dead: false, deathTime: 0, scale: 1.2, wool: 2 },
    { x: 9, y: 1, z: -3, yaw: -.2, speed: 0, phase: .1, graze: 0, dead: true, deathTime: .5, scale: .8, wool: 0 },
  ];
  const controller: FlockController = { n: 2, get alive() { return rows.filter(p => !p.dead).length; }, cx: 5, cz: 6, panicking: false,
    readPose: (i, out) => { const pose = rows[i]; if (pose === undefined) throw new Error('Missing test pose'); return Object.assign(out, pose); },
    kill: i => { const p = rows[i]; if (p !== undefined) p.dead = true; }, scare: () => undefined, straggler: () => -1, nearest: () => 0 };
  const rig = new THREE.BoxGeometry(), n = rig.getAttribute('position').count;
  rig.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  rig.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4), 4));
  rig.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  const sky: unknown = Object.create(SkyRig.prototype); if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const geometry = new THREE.BoxGeometry(), parts = Array.from({ length: 7 }, (_, i) => String(i));
  const flock = new Flock(sky, { x: 5, z: 6, count: 2, seed: 1 }, { geometry, parts, pivots: parts.map(() => [0, 0, 0]) }, controller).build({ material: new THREE.MeshLambertMaterial(), rig: Promise.resolve({ geometry: rig, map: null, normalMap: null, joints: parts.map(name => ({ name, pos: new THREE.Vector3() })) }) });
  const mesh = flock.mesh, oldGeometry = mesh.geometry;
  const anim = oldGeometry.getAttribute('iAnim');
  await Promise.resolve();
  expect(mesh.geometry).not.toBe(oldGeometry);
  expect(mesh.geometry.getAttribute('iAnim')).toBe(anim);
  expect(mesh.geometry.getAttribute('aRig').count).toBeGreaterThan(0);
  expect(mesh.count).toBe(2);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(); mesh.getMatrixAt(0, matrix); point.setFromMatrixPosition(matrix);
  expect(point.x).toBeCloseTo(4); expect(point.y).toBeCloseTo(1.98); expect(point.z).toBeCloseTo(8);
  expect(anim.getW(1)).toBeCloseTo(.5);
  const version = mesh.instanceMatrix.version, first = rows[0]; if (first === undefined) throw new Error('Missing first sheep');
  first.x = 12; first.yaw = 1.1;
  flock.project(); expect(mesh.instanceMatrix.version).toBe(version);
  const prey = flock.prey(0); expect(prey.position.x).toBe(12); expect(prey.yaw).toBe(1.1);
  expect(flock.raycast(new THREE.Vector3(12, 2.6, 3), new THREE.Vector3(0, 0, 1), 10)).toBe(0);
  flock.project(1); expect(mesh.instanceMatrix.version).toBeGreaterThan(version);
  mesh.getMatrixAt(0, matrix); expect(point.setFromMatrixPosition(matrix).x).toBe(12);
  prey.applyDamage(); expect(prey.alive).toBe(false); expect(flock.alive).toBe(0);
  expect(flock.raycast(new THREE.Vector3(12, 2.6, 3), new THREE.Vector3(0, 0, 1), 10)).toBe(-1);
  mesh.geometry.dispose(); geometry.dispose(); rig.dispose();
});
