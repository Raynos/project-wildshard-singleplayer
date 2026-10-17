import * as THREE from 'three';
import { bakedPlaceSteps, placer } from './placeBake';
import { WIND_CAIRN } from './layout';
import type { PoiCtx, PoiPiece } from './types';
import { windCairn } from '../models/catalogue';


/**
 * Cairn — the Wind Cairn (Jel Ata the Storm Titan's threshold, B14) on the bowl's south rim: places the Wind Cairn model
 * (E306 / E315 M3 — the heap, the pole bundle, the lines to the stakes; its cloth strips go into `ctx.flutter`), painted
 * into its own mesh. SHARD-PLATFORM M3 (the places bake): painted offline (../generators/places.ts), drawn from the
 * bake here (./placeBake.ts).
 *
 *   const { piece, tieSpot } = buildCairn(ctx);   // tieSpot: where a rider stops to TIE A CLOTH STRIP (B14)
 */

export function buildCairn(ctx: PoiCtx): { piece: PoiPiece; tieSpot: THREE.Vector3 } {
  const steps = bakedPlaceSteps('cairn', ctx, new Map([placer(windCairn)]));
  let step = steps.next();
  while (step.done !== true) step = steps.next();
  return { piece: step.value, tieSpot: new THREE.Vector3(WIND_CAIRN.x + 3.6, ctx.ground(WIND_CAIRN.x, WIND_CAIRN.z), WIND_CAIRN.z) };
}
