import type { ViewmodelSet } from '@wildshard/engine/combat/view/ranged';
import { loadPainted, painted } from '../looks/paintedTextures';

/** The coat's waxed-canvas maps (generators/coatCanvas.ts, baked offline), loaded ahead of `coatSet`. */
export function loadCoatTextures(): Promise<unknown> {
  return Promise.all([loadPainted('coatMap'), loadPainted('coatNormal'), loadPainted('coatArm')]);
}
/** The coat sleeve's texture set (generators/handsLook.ts COAT_MATERIAL's `coat`: its five map slots all filled by the canvas). */
export function coatSet(): ViewmodelSet { return { map: painted('coatMap'), normalMap: painted('coatNormal'), armMap: painted('coatArm') }; }
