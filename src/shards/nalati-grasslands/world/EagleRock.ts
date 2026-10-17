/**
 * EagleRock — the granite tor on the west rim (map-01 "EAGLE ROCK", the Tianjie-terrace view): places the Eagle Rock
 * model (E306 / E315 M3 — the tor, its scramble and its summit deck) on B0's knoll, painted into its own mesh.
 * SHARD-PLATFORM M3 (the places bake): painted offline (../generators/places.ts), drawn from
 * the bake here (./placeBake.ts); its floor (the scramble + the summit) is data (`torFloor`).
 *
 *   const rock = buildEagleRock(ctx);   // PoiPiece: the tor registers itself (`register`: one `place`)
 */
import { bakedPlaceSteps, placer } from './placeBake';
import type { PoiCtx, PoiPiece } from './types';
import { eagleRock } from '../models/campProps';

export function buildEagleRock(ctx: PoiCtx): PoiPiece {
  const steps = bakedPlaceSteps('eagleRock', ctx, new Map([placer(eagleRock)]));
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}
