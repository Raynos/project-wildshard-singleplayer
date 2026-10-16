import { Vector3 } from 'three';
import { yawWorld } from '@wildshard/engine/world/yawFrame';
import { heightAt } from '@wildshard/engine/world/Heightfield';
import { CABIN_SITES } from '../data/layout';

/** The native cabin floor point shared by the live rifle pickup and its Node spots producer. */
export function pineRifleFloor(cabins: { floorHeightAt: (x: number, z: number) => number | undefined } | null): Vector3 | null {
  const site = CABIN_SITES[0];
  if (site === undefined || cabins === null) return null;
  const [x, z] = yawWorld({ x: site.x, z: site.z, yaw: site.rot }, 1.5, -1.6);
  return new Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z);
}
