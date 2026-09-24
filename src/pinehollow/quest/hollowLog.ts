/**
 * The hollow-log passage (PINE-HOLLOW-REMASTER PH-C8, a secret of PH-U22): one of the old-growth's fallen giants, 3.2 m
 * across and 11 m long, rotted out down its heart so you can walk through it — a carved token waits in the middle, and
 * the far end opens onto a ring of ferns you cannot see from the path. Built on the cabins' own PBR set (`cabinMats`:
 * bark outside, the log's split-wood inside, end grain on the rims, the chinking's grey for the rotted bed) — no new
 * programs; 4 draws inside 60 m, the shell alone (no shadow) past it.
 *
 * Collision: a flat bed you walk on (its top ≤ 0.3 m over the ground at both mouths, inside the 0.35 m step) and a
 * shell of seven boxes round the bore (the bottom eighth is the bed); the mouths are open.
 */
import * as THREE from 'three';
import { heightAt } from '../../world/Heightfield';
import type { Mats } from '../../world/Cabin';
import type { ColliderDesc } from '../../world/registry';

export const HOLLOW_LOG = { x: 112, z: -86, yaw: 0.35, len: 11, R: 1.6, r: 1.3 };

export interface HollowLog { group: THREE.Group; colliders: ColliderDesc[]; floorY: number; mid: THREE.Vector3; mouths: [THREE.Vector3, THREE.Vector3]; update: (cam: THREE.Vector3) => void }

/** the rotted bed's top inside the log: 0.25 m over the highest of the ground under its middle and its two mouths */
export function hollowLogFloor(): number {
  const { x, z, yaw, len } = HOLLOW_LOG, ax = Math.cos(yaw), az = -Math.sin(yaw);
  return Math.max(heightAt(x, z), heightAt(x - ax * len / 2, z - az * len / 2), heightAt(x + ax * len / 2, z + az * len / 2)) + 0.25;
}

export function buildHollowLog(mats: Mats): HollowLog {
  const { x, z, yaw, len, R, r } = HOLLOW_LOG;
  const ax = Math.cos(yaw), az = -Math.sin(yaw);        // the log's axis in world x / z (its local +X)
  const floorY = hollowLogFloor();                       // the rotted bed inside
  const cy = floorY + r - 0.42;                          // the bore's axis: the bed fills its bottom 0.42 m
  const group = new THREE.Group();
  group.name = 'hollow-log';
  group.position.set(x, cy, z);
  group.rotation.y = yaw;
  const along = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(Math.PI / 2);   // a Y cylinder → along local X
  const uvScale = (g: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry => {
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return g;
  };
  const outer = new THREE.Mesh(uvScale(along(new THREE.CylinderGeometry(R, R * 1.04, len, 22, 1, true)), 4, 3), mats.bark);
  const innerGeo = uvScale(along(new THREE.CylinderGeometry(r, r, len, 22, 1, true)), 3, 2.5);
  // the bore is seen from inside: flip its winding and its normals
  const idx = innerGeo.index;
  if (idx) for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const nrm = innerGeo.getAttribute('normal');
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  const inner = new THREE.Mesh(innerGeo, mats.log);
  const rimGeo = new THREE.RingGeometry(r, R, 22, 1);
  const rims = new THREE.Group();
  for (const s of [-1, 1]) { const m = new THREE.Mesh(rimGeo, mats.endGrain); m.position.x = (s * len) / 2; m.rotation.y = (s * Math.PI) / 2; rims.add(m); }
  const bedW = 2 * Math.sqrt(r * r - (r - 0.42) ** 2);
  const bed = new THREE.Mesh(uvScale(new THREE.BoxGeometry(len - 0.1, 0.1, bedW).translate(0, -r + 0.37, 0), 5, 1), mats.chink);
  for (const m of [outer, inner, bed]) { m.castShadow = m === outer; m.receiveShadow = true; }
  group.add(outer, inner, rims, bed);
  group.updateMatrixWorld(true);

  // colliders: the bed + a seven-box shell round the bore (world frame)
  const colliders: ColliderDesc[] = [];
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const mid = new THREE.Vector3(x, floorY, z);
  colliders.push({ kind: 'box', x, y: floorY - 0.25, z, hx: len / 2, hy: 0.25, hz: bedW / 2, yaw, surface: 'wood' });
  const T = R - r, midR = (R + r) / 2, N = 8, chord = 2 * midR * Math.tan(Math.PI / N) + 0.05;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;                     // 0 = up, round through the sides (the bore's cross-section)
    if (Math.abs(Math.cos(th) + 1) < 0.2) continue;       // the bottom segment: the bed is there
    const ly = Math.cos(th) * midR, lz = Math.sin(th) * midR;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), th).premultiply(qYaw);
    const c = new THREE.Vector3(0, ly, lz).applyQuaternion(qYaw).add(new THREE.Vector3(x, cy, z));
    colliders.push({ kind: 'box', x: c.x, y: c.y, z: c.z, hx: len / 2, hy: T / 2, hz: chord / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface: 'wood' });
  }
  const mouths: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(x - ax * (len / 2 + 1.2), 0, z - az * (len / 2 + 1.2)),
    new THREE.Vector3(x + ax * (len / 2 + 1.2), 0, z + az * (len / 2 + 1.2)),
  ];
  for (const m of mouths) m.y = heightAt(m.x, m.z);
  return {
    group, colliders, floorY, mid, mouths,
    update: (cam) => {
      const near = cam.distanceToSquared(mid) < 60 * 60;
      inner.visible = rims.visible = bed.visible = near;
      outer.castShadow = near;   // past 60 m its shadow is a few pixels (and a draw per cascade)
    },
  };
}
