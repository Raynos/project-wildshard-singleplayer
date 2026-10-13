import type { StallRect } from '../data/specimenDims';

/** a stall's footprint about the origin (the stall models' own space, ../models/stalls.ts) */
export const centred = (r: StallRect): StallRect => {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return { x0: r.x0 - cx, x1: r.x1 - cx, z0: r.z0 - cz, z1: r.z1 - cz };
};

