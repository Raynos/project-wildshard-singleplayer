import { modelGeometry } from '@wildshard/sdk/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';

/** Immutable CPU templates only; every model receives a deep mutable geometry copy. */
export const HAT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.hat, { _sway: 'aSway' });
export const CHIME_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.chime, { _sway: 'aSway' });
export const CAPE_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.cape, { _sway: 'aSway' });
export const BOAT_HULL_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatHull);
export const BOAT_SAIL_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatSail, { _sway: 'aSway' });
export const BOAT_GEAR_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatGear);
let ready = false;
/** Explorer may open these models before the island's world hook has run. */
export function fixedGeometryReady(): boolean { return ready; }
/** Called explicitly by the world hook before any synchronous placement or later loot factory. Explicit bytes admit the same templates in Node fixtures. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array>): Promise<void> {
  await Promise.all([
    HAT_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.hat)), CHIME_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.chime)),
    CAPE_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.cape)), BOAT_HULL_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatHull)),
    BOAT_SAIL_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatSail)), BOAT_GEAR_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatGear)),
  ]);
  ready = true;
}
