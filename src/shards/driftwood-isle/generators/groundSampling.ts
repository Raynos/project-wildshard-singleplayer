import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { WORLD_DROP } from '../data/landscapeRows';
import { driftwoodGroundBytes } from './groundRows';

/** The native bilinear height law and datum, evaluated from cold authored bytes. */
export function driftwoodGroundSampler(): (x: number, z: number) => number {
  const bytes = driftwoodGroundBytes(), g = parseBakedTerrain(new Uint8Array(bytes).buffer);
  if (g === null) throw new Error('Invalid authored native height lattice');
  const heightAt = bakedSamplers(g).heightAt;
  return (x, z) => heightAt(x, z) - WORLD_DROP;
}
