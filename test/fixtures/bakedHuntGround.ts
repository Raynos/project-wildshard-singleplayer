import { bakedSamplers } from '../../src/format/bakedTerrainSampling';
import type { BakedGrid } from '../../src/format/bakedTerrainBytes';
import type { TerrainField } from '../../src/engine/level/data';
import type { HuntGround } from '../../src/engine/ai/huntPattern';

// Historical contract oracle; production consumers use the data-driven owners.
/**
 * Bind a baked navigation surface to live authored water/forest queries. The grid supplies only height and normal;
 * trails, pads, water, wetness and trees remain the caller's authority. Bounds are inclusive after the requested margin.
 * The stream function is captured on binding, while water level and pond are read on each query.
 */
export function bakedHuntGround(grid: BakedGrid, ports: {
  readonly field: Pick<TerrainField, 'trailDistance' | 'cabinMask' | 'streamAt' | 'waterLevel' | 'pond'>;
  readonly chunkHalf: number;
  readonly trees: HuntGround['trees'];
  readonly treeless: HuntGround['treeless'];
  readonly wetAt: HuntGround['wetAt'];
  readonly sea: HuntGround['sea'];
}): HuntGround {
  const samplers = bakedSamplers(grid), field = ports.field, stream = field.streamAt, half = ports.chunkHalf;
  return {
    heightAt: samplers.heightAt, normalY: (x, z) => samplers.normalAt(x, z)[1],
    trailDistance: field.trailDistance, cabinMask: field.cabinMask,
    inChunk: (x, z, margin) => Math.abs(x) <= half - margin && Math.abs(z) <= half - margin,
    streamAt: (x, z) => stream === undefined ? null : stream(x, z), waterLevel: () => field.waterLevel(), pond: () => field.pond,
    sea: ports.sea, wetAt: ports.wetAt, trees: ports.trees, treeless: ports.treeless, terrain: () => true, chunkHalf: half,
  };
}
