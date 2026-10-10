/**
 * SummerCamp — the jailau camp on the Sky Grassland (the real "Nomad Home" stop at the foot of the south mountain):
 * three yurts round a small hearth, a kazan smoking over it, a tether line on two posts for the horses, a drying
 * board of kurt (curd balls), felts airing on the grass, a cart and a ribbon post.
 *
 *   const summer = buildSummerCamp(ctx);   // PoiPiece: the camp registers itself (`register`: one `place` per model)
 *
 * SHARD-PLATFORM M3 (the places bake): built offline (../generators/places.ts, its builder moved there verbatim), drawn from
 * the bake here (./placeBake.ts). E306 / E315 second pass: the camp places models (src/shards/nalati-grasslands/models/: yurt.ts, campProps.ts,
 * campGenerated.ts) through a NalatiSet (./painted.ts), in the old builder's order, like the spring camp
 * (./NomadCamp.ts); NalatiPOIs names them the Summer camp set. The yard's trodden earth is a decal (world).
 */
import { bakedPlaceSteps, placer } from './placeBake';
import type { PoiCtx, PoiPiece } from './types';
import { yurt } from '../models/yurt';
import { cart, barrel, feltRug, tetherLine, kurtBoard, ribbonPost } from '../models/campProps';
import { kazan, chest } from '../models/campGenerated';

/** the models the camp places, by id */
const PLACERS = new Map([placer(yurt), placer(kazan), placer(cart), placer(chest), placer(barrel), placer(feltRug), placer(tetherLine), placer(kurtBoard), placer(ribbonPost)]);

export function buildSummerCamp(ctx: PoiCtx): PoiPiece {
  const steps = summerCampSteps(ctx);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}

/** `buildSummerCamp` a part a step (SF67): each baked mesh a task */
export function summerCampSteps(ctx: PoiCtx): Generator<void, PoiPiece> { return bakedPlaceSteps('summerCamp', ctx, PLACERS); }
