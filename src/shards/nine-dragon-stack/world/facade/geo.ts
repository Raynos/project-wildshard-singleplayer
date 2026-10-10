// The facade kit's builder is the SDK's tangent kit (@wildshard/sdk/kit/tangentKit, SHARD-PLATFORM M3, the kit system):
// this keeps the names the facade grammar uses, and the pattern kinds the Jiehua program draws (aPat.x).
import { AXIS_X, AXIS_Y, AXIS_Z, TangentKit, type TangentLook } from '@wildshard/sdk/kit/tangentKit';
import { EDGE } from '@wildshard/sdk/kit/ruledKit';

/** pattern kinds the material draws (aPat.x) */
export const K = {
  plain: 0, wall: 1, tiles: 2, bars: 3, cloth: 4, leaf: 5, ac: 6, slats: 7, pipe: 8, sign: 9, panel: 10, painted: 11,
  /** a row of round glazed tile ends (瓦当) along an eave's lip, one every p1 */
  tileEnd: 12,
} as const;

/** edge mask bits: which borders of a face get a ruled ink line */
export const E: typeof EDGE = EDGE;
/** how a facade face looks */
export type Look = TangentLook;
/** the world axes */
export const X: typeof AXIS_X = AXIS_X;
export const Y: typeof AXIS_Y = AXIS_Y;
export const Z: typeof AXIS_Z = AXIS_Z;
/** the facade kit's geometry builder */
export class Builder extends TangentKit {}
