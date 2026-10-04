/**
 * Pine Hollow's water bodies (E357 X5; app.world.water, registered at level.data): the still pond (the engine's basin body
 * over the terrain's pond dish, drawn by src/engine/world/pond.ts) and the running creek (PH-L9: the outlet, the riffle
 * and the beaver pool, whose level drives `creekWaterAt`; drawn by ./streams.ts and ./beaverPool.ts). Both are drawn
 * with the shared photoreal water, so both carry its reflect hook. Swimming and wading ask the pond first, then the creek.
 */
import { basinBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { surfaceReflect } from '@wildshard/engine/world/water/view';
import { creekWaterAt } from '../layout';
import { TERRAIN } from './terrain';

/** the creek: water wherever `creekWaterAt` answers, at the surface it answers */
function creekBody(): WaterBody {
  return {
    id: 'creek', get level() { return TERRAIN.waterLevel(); }, // it runs out of the pond
    restAt: creekWaterAt,
    surfaceAt: (x, z) => creekWaterAt(x, z) ?? TERRAIN.waterLevel(),
    inside: (x, z, y) => { const s = creekWaterAt(x, z); return s !== null && y < s; },
    reflect: surfaceReflect,
  };
}

export const PINE_WATER: readonly WaterBody[] = [basinBody('pond', TERRAIN, surfaceReflect), creekBody()];
