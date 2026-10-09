/**
 * The hollow-log passage (PINE-HOLLOW-REMASTER PH-C8, a secret of PH-U22): where one of the old-growth's fallen giants
 * lies — 3.2 m across and 11 m long, rotted out down its heart so you can walk through it; a carved token waits in the
 * middle, and the far end opens onto a ring of ferns you cannot see from the path. The log itself is a model
 * (E315 M2: src/shards/pine-hollow/models/hollowLog.ts — its drawing, LOD and colliders); this is its site: where it
 * lies, the bed you stand on inside, its mouths.
 */
import * as THREE from 'three';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

export const HOLLOW_LOG = { x: 112, z: -86, yaw: 0.35, len: 11, R: 1.6, r: 1.3 };

/** the passage's facts, world space: the bed's top inside, its middle, the two mouths (on the ground) */
export interface HollowLog { floorY: number; mid: THREE.Vector3; mouths: [THREE.Vector3, THREE.Vector3] }

/** the rotted bed's top inside the log: 0.25 m over the highest of the ground under its middle and its two mouths */
export function hollowLogFloor(): number {
  const { x, z, yaw, len } = HOLLOW_LOG, ax = Math.cos(yaw), az = -Math.sin(yaw);
  return Math.max(heightAt(x, z), heightAt(x - ax * len / 2, z - az * len / 2), heightAt(x + ax * len / 2, z + az * len / 2)) + 0.25;
}

export function hollowLogSite(): HollowLog {
  const { x, z, yaw, len } = HOLLOW_LOG;
  const ax = Math.cos(yaw), az = -Math.sin(yaw);        // the log's axis in world x / z (its local +X)
  const floorY = hollowLogFloor();
  const mouths: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(x - ax * (len / 2 + 1.2), 0, z - az * (len / 2 + 1.2)),
    new THREE.Vector3(x + ax * (len / 2 + 1.2), 0, z + az * (len / 2 + 1.2)),
  ];
  for (const m of mouths) m.y = heightAt(m.x, m.z);
  return { floorY, mid: new THREE.Vector3(x, floorY, z), mouths };
}

/** inside the bore (the bed's floor function) */
export function insideHollowLog(x: number, z: number): boolean {
  const c = Math.cos(HOLLOW_LOG.yaw), s = Math.sin(HOLLOW_LOG.yaw), dx = x - HOLLOW_LOG.x, dz = z - HOLLOW_LOG.z;
  return Math.abs(dx * c - dz * s) < HOLLOW_LOG.len / 2 && Math.abs(dx * s + dz * c) < HOLLOW_LOG.r * 0.8;
}
