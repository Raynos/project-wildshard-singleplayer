/**
 * modelProps — the camp pieces as the generated GLB models (glbPaint.ts) instead of PaintKit geometry, for the POI
 * builders when `modelsOn()`. Each twin keeps the procedural piece's footprint, colliders and return value (the flue's
 * mouth, the fire's centre), so smoke, pennants, the yard wear and the player's collision are unchanged; only the
 * look moves to the model. The model goes into a `ModelSink` (one InstancedMesh per model per POI); anything the
 * model lacks is still painted into the POI's kit.
 *
 *   const sink = new ModelSink();
 *   addChestModel(sink, ground, x, z, yaw, colliders);           // like addChest
 *   …  void sink.flush(group, sky);
 *
 * The GLBs face +Z; the procedural kit faces −z at yaw 0, so every twin turns the model by `yaw + π`.
 */
import type * as THREE from 'three';
import { v3 } from './paint';
import { MODEL_SIZE, type ModelSink } from './glbPaint';
import type { Collider } from '../../player/Player';
import type { Ground } from './types';

const FLIP = Math.PI;

/** the kazan on its tripod over the fire ring (the cauldron GLB); returns the fire's centre for a plume, like addKazan */
export function addKazanModel(sink: ModelSink, ground: Ground, x: number, z: number, colliders: Collider[], yaw = 0.4): THREE.Vector3 {
  const y = ground(x, z);
  sink.add('cauldron', { x, y: y - 0.04, z, rot: yaw, scale: 1.05 });
  colliders.push({ x, z, hw: 0.7, hd: 0.7, rot: 0, yBottom: y - 1, yTop: y + 0.95 });
  return v3(x, y + 0.9, z);
}

/** a painted sandyq chest (1.05 m long), like addChest */
export function addChestModel(sink: ModelSink, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z);
  sink.add('chest', { x, y: y - 0.02, z, rot: yaw + FLIP, scale: 1.2 });
  colliders.push({ x, z, hw: 0.55, hd: 0.3, rot: -yaw, yBottom: y - 1, yTop: y + 0.75 });
}

/** a firewood stack: two birch stacks side by side along the pile, like addWoodpile */
export function addWoodpileModel(sink: ModelSink, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  for (const [o, dy] of [[-0.45, 0.2], [0.45, -0.15]] as const) {
    const px = x + o * cs, pz = z - o * sn;
    sink.add('firewood', { x: px, y: ground(px, pz) - 0.03, z: pz, rot: yaw + FLIP + dy, scale: 1.45 });
  }
  colliders.push({ x, z, hw: 0.8, hd: 0.85, rot: -yaw, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.85 });
}

/** the kumis corner: a churn by the yurt and a bigger one where the saba stood, like addChurn */
export function addChurnModel(sink: ModelSink, ground: Ground, x: number, z: number, colliders: Collider[]): void {
  const y = ground(x, z);
  sink.add('kumis-churn', { x, y: y - 0.02, z, rot: 0.6, scale: 1 });
  colliders.push({ x, z, hw: 0.28, hd: 0.28, rot: 0, yBottom: y - 1, yTop: y + 1.1 });
  const sx = x + 1.1, sz = z + 0.2, sy = ground(sx, sz);
  sink.add('kumis-churn', { x: sx, y: sy - 0.02, z: sz, rot: 2.4, scale: 1.15 });
  colliders.push({ x: sx, z: sz, hw: 0.34, hd: 0.34, rot: 0, yBottom: sy - 1, yTop: sy + 1.25 });
}

/** a saddle set down on the grass, like addGroundSaddle */
export function addGroundSaddleModel(sink: ModelSink, ground: Ground, x: number, z: number, yaw: number): void {
  sink.add('saddle', { x, y: ground(x, z) - 0.02, z, rot: yaw + FLIP, scale: 1.25 });
}

/** the golden eagle standing on `feet` (a perch), facing `yaw` like addEagle */
export function addEagleModel(sink: ModelSink, feet: THREE.Vector3, yaw: number, height = 0.85): void {
  sink.add('eagle', { x: feet.x, y: feet.y - 0.02, z: feet.z, rot: yaw + FLIP, scale: height / MODEL_SIZE.eagle[1] });
}
