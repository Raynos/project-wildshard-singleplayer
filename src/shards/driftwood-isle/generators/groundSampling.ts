import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { WORLD_DROP } from '../data/landscapeRows';
import { driftwoodGroundBytes } from './groundRows';

/** The native bilinear height law and datum, evaluated from cold authored bytes. */
export function driftwoodGroundSampler(): (x: number, z: number) => number {
  const bytes = driftwoodGroundBytes(), g = parseBakedTerrain(new Uint8Array(bytes).buffer);
  if (g === null) throw new Error('Invalid authored native height lattice');
  const { res, size, heights } = g;
  const half = size / 2, inv = (res - 1) / size, last = res - 2;
  return (x, z) => {
    const ux = Math.min(res - 1, Math.max(0, (x + half) * inv)), uz = Math.min(res - 1, Math.max(0, (z + half) * inv));
    const ix = Math.min(last, Math.floor(ux)), iz = Math.min(last, Math.floor(uz)), fx = ux - ix, fz = uz - iz;
    const i = iz * res + ix;
    const h00 = heights[i] ?? 0, h10 = heights[i + 1] ?? 0, h01 = heights[i + res] ?? 0, h11 = heights[i + res + 1] ?? 0;
    const a = h00 + (h10 - h00) * fx;
    const b = h01 + (h11 - h01) * fx;
    return (a + (b - a) * fz) - WORLD_DROP;
  };
}
