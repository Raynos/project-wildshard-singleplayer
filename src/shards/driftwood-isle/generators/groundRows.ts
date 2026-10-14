import type { TerrainBakeSource } from '@wildshard/sdk/bake/terrain';
import { CHUNK_HALF } from '@wildshard/format/contentBounds';
import { SEED, SHORE_LEVEL, WORLD_DROP, GRADED, TRAILS } from '../data/landscapeRows';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { buildDriftwoodField, landscapeHash } from './groundField';
import { driftwoodLandscape } from './landscape';

/** Retained unquantized author field for original mover rows and cold lattice compilation. */
export function driftwoodGroundField(seed = SEED): ReturnType<typeof buildDriftwoodField> {
  return buildDriftwoodField(seed, { landscape: driftwoodLandscape, oceanLevel: SHORE_LEVEL,
    graded: GRADED, trails: TRAILS, cabinSites: [] });
}

/** Exact unshifted native height lattice; collision consumers apply the declared datum. */
export interface DriftwoodGroundRows {
  notice: string; resolution: number; size: number; datum: number; heights: number[];
}

/** Cold native floor lattice compiled from retained equations, with no terrain.bin or runtime seed. */
export function driftwoodGroundRows(seed = SEED): DriftwoodGroundRows {
  const field = driftwoodGroundField(seed);
  const heightAt: TerrainBakeSource['heightAt'] = field.heightAt;
  const resolution = 256, size = CHUNK_HALF * 2, stride = size / (resolution - 1), heights = new Float32Array(resolution ** 2);
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    // bake-chunk preserves this drop/unshift order before Float32 quantisation.
    heights[z * resolution + x] = (heightAt(-CHUNK_HALF + x * stride, -CHUNK_HALF + z * stride) - WORLD_DROP) + WORLD_DROP;
  }
  return { notice: 'DO NOT EDIT: generated from retained authoring ground equations through the verified cache.',
    resolution, size, datum: -WORLD_DROP, heights: Array.from(heights) };
}

/** Compile the original WSTR v1 transport from source, never from a retained native grid. */
export function driftwoodGroundBytes(): Uint8Array {
  const rows = driftwoodGroundRows(), field = driftwoodGroundField();
  const source = { heightAt: (x: number, z: number): number => (field.heightAt(x, z) - WORLD_DROP) + WORLD_DROP };
  const count = rows.resolution ** 2, header = 24, buffer = new ArrayBuffer(header + count * 8), view = new DataView(buffer);
  view.setUint8(0, 0x57); view.setUint8(1, 0x53); view.setUint8(2, 0x54); view.setUint8(3, 0x52);
  view.setUint32(4, 1, true); view.setUint32(8, rows.resolution, true); view.setFloat32(12, rows.size, true);
  view.setUint32(16, SEED >>> 0, true); view.setUint32(20, landscapeHash(source, rows.size), true);
  new Float32Array(buffer, header, count).set(rows.heights);
  const splat = new Uint8Array(buffer, header + count * 4, count * 4);
  for (let i = 0; i < count; i++) splat[i * 4] = 255;
  if (parseBakedTerrain(buffer) === null) throw new Error('Authored native ground did not satisfy its byte contract');
  return new Uint8Array(buffer);
}
