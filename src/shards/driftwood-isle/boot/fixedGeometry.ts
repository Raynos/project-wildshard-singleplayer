import { loadTrailsideGeometry } from './trailsideGeometry';
import { loadCoverGeometry } from './coverGeometry';
import { loadCoveGeometry } from './coveGeometry';
import { modelGeometry } from '@wildshard/sdk/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';

/** Immutable CPU templates only; every model receives a deep mutable geometry copy. */
export const HAT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.hat, { _sway: 'aSway' });
export const CHIME_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.chime, { _sway: 'aSway' });
export const CAPE_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.cape, { _sway: 'aSway' });
export const BOAT_HULL_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatHull);
export const BOAT_SAIL_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatSail, { _sway: 'aSway' });
export const BOAT_GEAR_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.boatGear);
export const TROPHY_PLAQUES_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.trophyPlaques);
export const TROPHY_DROP_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.trophyDrop);
export const COUNTER_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.tradeCounter, { _sway: 'aSway' });
/** The castaway's hut on its site (own space): the kit mesh and the unlit flames. */
export const HUT_KIT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.hutKit);
export const HUT_FLAMES_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.hutFlames);
/** The lookout tower on its site (own space), the banner's sway channel kept. */
export const LOOKOUT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.lookout, { _sway: 'aSway' });
/** Pickup parts retain their native materials and local centring. */
export const IRON_SWORD_BLADE_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.ironSwordBlade);
export const IRON_SWORD_FITTINGS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.ironSwordFittings);
let ready = false;
/** Explorer may open these models before the island's world hook has run. */
export function fixedGeometryReady(): boolean { return ready; }
/** Called explicitly by the world hook before any synchronous placement or later loot factory. Explicit bytes admit the same templates in Node fixtures. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array>): Promise<void> {
  await Promise.all([
    loadTrailsideGeometry(bytes),
    loadCoveGeometry(bytes),
    loadCoverGeometry(bytes),
    IRON_SWORD_BLADE_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.ironSwordBlade)), IRON_SWORD_FITTINGS_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.ironSwordFittings)),
    HAT_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.hat)), CHIME_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.chime)),
    CAPE_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.cape)), BOAT_HULL_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatHull)),
    BOAT_SAIL_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatSail)), BOAT_GEAR_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.boatGear)),
    TROPHY_PLAQUES_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.trophyPlaques)), TROPHY_DROP_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.trophyDrop)),
    COUNTER_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.tradeCounter)),
    HUT_KIT_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.hutKit)), HUT_FLAMES_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.hutFlames)),
    LOOKOUT_GEOMETRY.load(bytes?.get(FIXED_MODEL_FILES.lookout)),
  ]);
  ready = true;
}
