/**
 * NomadCamp — the spring camp (kystau) in the Kunes valley, the shard's hub (map-01 "NOMAD CAMP", (95, 205)).
 * Six white felt yurts in an arc round a yard that opens east toward the N road; a round pole corral to the west;
 * the hitching rail on the road side where TULPAR waits (`HITCHING_RAIL`); an eagle perch (a lashed tripod with a
 * T-bar) with a static golden eagle; a ribbon pole in the yard streaming seven colours; felt rugs drying on a rack
 * and laid at two doors; an iron stove and a kazan on a tripod, both smoking; a cart, barrels, chests, a woodpile,
 * a saddle rack, a water trough and a hay pile.
 *
 *   const camp = buildNomadCamp(ctx);      // PoiPiece: the camp registers itself (`register`: one `place` per model)
 *
 * SHARD-PLATFORM M3 (the places bake): the camp is built offline (../generators/places.ts, its builder moved there verbatim)
 * and drawn from the bake here (./placeBake.ts). E306 / E315 second pass: the camp places models (src/shards/nalati-grasslands/models/: yurt.ts, campProps.ts,
 * campGenerated.ts) through a NalatiSet (./painted.ts), in the old builder's order — the code models painted into the
 * camp's one mesh (+ its felt and timber layers), the generated GLBs (kazan, chests, woodpile, churns, ground saddles,
 * the eagle) one InstancedMesh per model, added when they have loaded — and NalatiPOIs names them the Spring camp set.
 * The ribbons / pennants go into `ctx.flutter`, the plumes into `ctx.smoke`; the trodden earth of the yard is a decal
 * draped over the terrain (./Yard.ts: world, welded to the ground).
 * Terrain request: a flat pad r 30 at (95, 205) (the valley floor, ≈ −8).
 */
import { bakedPlaceSteps, placer } from './placeBake';
import type { PoiCtx, PoiPiece } from './types';
import { yurt } from '../models/yurt';
import {
  ribbonPole, eaglePerch, stove, campBench, rugRack, feltRug, cart, barrel, hitchingRail, waterTrough, saddleRack,
  corral, hayPile, feedTrough, rugLine, choppingBlock, milkCans,
} from '../models/campProps';
import { kazan, chest, firewood, kumisChurn, groundSaddle, perchedEagle } from '../models/campGenerated';

/** the models the camp places, by id */
const PLACERS = new Map([
  placer(yurt), placer(ribbonPole), placer(eaglePerch), placer(perchedEagle), placer(stove), placer(kazan), placer(firewood), placer(campBench),
  placer(rugRack), placer(feltRug), placer(cart), placer(barrel), placer(chest), placer(hitchingRail), placer(waterTrough), placer(saddleRack),
  placer(corral), placer(hayPile), placer(feedTrough), placer(kumisChurn), placer(rugLine), placer(choppingBlock), placer(groundSaddle), placer(milkCans),
]);

export function buildNomadCamp(ctx: PoiCtx): PoiPiece {
  const steps = nomadCampSteps(ctx);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}

/** `buildNomadCamp` with a yield between its parts (SF67): each baked mesh a task */
export function nomadCampSteps(ctx: PoiCtx): Generator<void, PoiPiece> { return bakedPlaceSteps('camp', ctx, PLACERS); }
