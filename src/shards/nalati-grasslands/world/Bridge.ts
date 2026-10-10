/**
 * Bridge — the timber bridge carrying the N road over the Kunes at (0, 160) (map-01 "BRIDGE", deck −6): places the
 * Kunes bridge model (E306 / E315 M3, src/shards/nalati-grasslands/models/kunesBridge.ts), painted into its own mesh.
 * It finds its ends from the terrain, so a terrain tweak doesn't leave it floating or buried. SHARD-PLATFORM M3 (the places
 * bake): painted offline (../generators/places.ts), drawn from the bake here (./placeBake.ts).
 *
 *   const bridge = buildBridge(ctx);  // PoiPiece: the bridge registers itself (`register`: one `place` — the deck as plank
 *                                     // slabs, rails / cribs as boxes, its floor the deck)
 */
import { bakedPlaceSteps, placer } from './placeBake';
import type { PoiCtx, PoiPiece } from './types';
import { kunesBridge } from '../models/kunesBridge';

const PLACERS = new Map([placer(kunesBridge)]);

export function buildBridge(ctx: PoiCtx): PoiPiece {
  const steps = bakedPlaceSteps('bridge', ctx, PLACERS);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}
