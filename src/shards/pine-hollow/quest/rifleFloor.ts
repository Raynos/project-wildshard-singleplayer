import { Vector3 } from 'three';
import { heightAt } from '@wildshard/engine/world/Heightfield';
import { CABIN_SITES } from '../layout';

/** The native cabin floor point shared by the live rifle pickup and its Node spots producer. */
export function pineRifleFloor(cabins: { floorHeightAt: (x: number, z: number) => number | undefined } | null): Vector3 | null {
  const site = CABIN_SITES[0];
  if (site === undefined || cabins === null) return null;
  const lx = 1.5, lz = -1.6, c = Math.cos(site.rot), sn = Math.sin(site.rot);
  const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
  return new Vector3(x, cabins.floorHeightAt(x, z) ?? heightAt(x, z), z);
}
