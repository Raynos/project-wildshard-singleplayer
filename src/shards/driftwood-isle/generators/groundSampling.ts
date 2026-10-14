import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { WORLD_DROP } from '../data/landscapeRows';
import { driftwoodGroundBytes } from './groundRows';

/** The native bilinear height law and datum, evaluated from cold authored bytes. */
export function driftwoodGroundSampler(): (x: number, z: number) => number {
  const heightAt = readNativeTerrain(driftwoodGroundBytes()).heightAt;
  return (x, z) => heightAt(x, z) - WORLD_DROP;
}
