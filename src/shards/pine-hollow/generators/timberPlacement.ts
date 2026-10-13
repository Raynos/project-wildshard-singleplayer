/** The original Pine placement arithmetic, evaluated over explicit renderer queries at author time only. */
import * as THREE from 'three';
import { ZIPLINE, E_ROAD, CREEK_BRIDGE } from '../data/layout';

/** The unchanged tower and landing yaw, in radians. */
export const ZIP_YAW = Math.atan2(ZIPLINE.from.x - ZIPLINE.to.x, ZIPLINE.from.z - ZIPLINE.to.z);
/** Native footbridge half-length, in metres. */
export const BRIDGE_HALF = 12;
/** Original landing identity and stream salt. */
export const LANDING = { name: 'zipline-landing', seed: 902 } as const;
/** Original creek footbridge identity and stream salt. */
export const BRIDGE = { name: 'creek-footbridge', seed: 903 } as const;
/** Use the original Euler/quaternion composition, rather than replacing it with a different matrix formula. */
export function timberFrame(x: number, y: number, z: number, yaw: number): THREE.Matrix4 {
  const root = new THREE.Object3D(); root.position.set(x, y, z); root.rotation.y = yaw; root.updateMatrixWorld(true);
  return root.matrixWorld.clone();
}
/** Original landing frame, on the retained renderer ground. */
export function landingSite(heightAt: (x: number, z: number) => number): { at: THREE.Matrix4; y: number } {
  const y = heightAt(ZIPLINE.to.x, ZIPLINE.to.z);
  return { at: timberFrame(ZIPLINE.to.x, y, ZIPLINE.to.z, ZIP_YAW), y };
}
/** Original road-aligned bridge frame, with its exact two-bank height arithmetic. */
export function bridgeSite(heightAt: (x: number, z: number) => number): { at: THREE.Matrix4; y: number; yaw: number } {
  const i = E_ROAD.findIndex(([x, z]) => x === CREEK_BRIDGE.x && z === CREEK_BRIDGE.z);
  const a = E_ROAD[i - 1] ?? E_ROAD[0], b = E_ROAD[i + 1] ?? E_ROAD[1];
  const dx = (b?.[0] ?? 1) - (a?.[0] ?? 0), dz = (b?.[1] ?? 0) - (a?.[1] ?? 0);
  const { x, z } = CREEK_BRIDGE, yaw = Math.atan2(-dz, dx);
  const y = (heightAt(x - BRIDGE_HALF, z) + heightAt(x + BRIDGE_HALF, z)) / 2;
  return { at: timberFrame(x, y, z, yaw), y, yaw };
}
