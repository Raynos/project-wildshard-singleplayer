import { bakedPlaceSteps, bakedSignLettering, placer } from './placeBake';
import { fence, signpostBaked as signpost } from '../models/catalogue';
import type { PoiCtx, PoiPiece } from './types';


/** Baked road furniture and exact prepainted lettering. */

export function buildRoadFurniture(ctx: PoiCtx): PoiPiece {
  const steps = bakedPlaceSteps('roads', ctx, new Map([placer(fence), placer(signpost)]));
  for (;;) {
    const step = steps.next();
    if (step.done !== true) continue;
    const piece = step.value;
    const text = bakedSignLettering(ctx.sky, 'roads');
    piece.object.children.splice(1, 0, text); text.parent = piece.object;
    return { ...piece, tris: piece.tris + (text.geometry.index?.count ?? 0) / 3 };
  }
}
