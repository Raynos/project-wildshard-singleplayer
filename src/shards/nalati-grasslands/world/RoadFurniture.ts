import { bakedPlaceSteps, bakedPlaceAnchors, placer } from './placeBake';
import { boardSpots } from './painted';
import { fence } from '../models/catalogue';
import { signpost, letteringMesh } from '../models/signpost';
import type { PoiCtx, PoiPiece } from './types';


/** Baked road furniture with its live canvas lettering atlas. */

export function buildRoadFurniture(ctx: PoiCtx): PoiPiece {
  const steps = bakedPlaceSteps('roads', ctx, new Map([placer(fence), placer(signpost)]));
  for (;;) {
    const step = steps.next();
    if (step.done !== true) continue;
    const piece = step.value;
    const text = letteringMesh(ctx.sky, (bakedPlaceAnchors('roads').signposts ?? []).map(s => ({ spots: boardSpots(s.x, s.z, s.y, s.boards), boards: s.boards })));
    piece.object.children.splice(1, 0, text); text.parent = piece.object;
    return { ...piece, tris: piece.tris + (text.geometry.index?.count ?? 0) / 3 };
  }
}
