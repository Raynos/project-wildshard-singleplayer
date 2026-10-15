import { loadTrailsideGeometry } from './trailsideGeometry';
import { loadCoverGeometry } from './coverGeometry';
import { loadCoveGeometry } from './coveGeometry';
import { modelGeometry, readProductGeometry } from '../runtime/boot/modelGeometry';
import type { BufferGeometry } from 'three';
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
export const WRECK_KIT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.wreckKit, { _sway: 'aSway' });
export const WRECK_GLOW_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.wreckGlow);
export const WRECK_ROCKS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.wreckRocks);
export const SHIPWRECK_KIT_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.shipwreckKit, { _sway: 'aSway' });
export const SHIPWRECK_GLOW_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.shipwreckGlow);
export const SHRINE_KIT_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineKit);
export const SHRINE_WATER_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineWater);
export const SHRINE_GLYPHS_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineGlyphs);
export const SHRINE_SPECIMEN_KIT_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineSpecimenKit);
export const SHRINE_SPECIMEN_WATER_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineSpecimenWater);
export const SHRINE_SPECIMEN_GLYPHS_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.shrineSpecimenGlyphs);
/** The world owns the static dune ring; transfer its buffer instead of retaining a template. */
export const DUNE_LOGS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.duneLogs);
/** The rope bridge's four anchor posts (own space) on the island span and the Explorer span; the deck stays live. */
export const BRIDGE_POSTS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.bridgePosts);
export const BRIDGE_SPECIMEN_POSTS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.bridgeSpecimenPosts);
/** The cove's toon cascade (generators/cascade.ts, world space): its curtain, pool rings and foam puffs. */
export const WATERFALL_SHEET_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.waterfallSheet, { _astep: 'aStep' });
export const WATERFALL_RINGS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.waterfallRings);
export const WATERFALL_PUFFS_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.waterfallPuffs, { _acentre: 'aCentre', _ainfo: 'aInfo' });
let ready = false;
/** Explorer may open these models before the island's world hook has run. */
export function fixedGeometryReady(): boolean { return ready; }
/** Called explicitly by the world hook before any synchronous placement or later loot factory. Explicit bytes admit the same templates in Node fixtures. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readProductGeometry>[0]): Promise<void> {
  const product = owner === undefined ? undefined : await readProductGeometry(owner);
  const admitted = product?.templates ?? bytes;
  try {
  await Promise.all([
    SHRINE_KIT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineKit)),
    SHRINE_WATER_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineWater)),
    SHRINE_GLYPHS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineGlyphs)),
    SHRINE_SPECIMEN_KIT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineSpecimenKit)),
    SHRINE_SPECIMEN_WATER_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineSpecimenWater)),
    SHRINE_SPECIMEN_GLYPHS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shrineSpecimenGlyphs)),
    loadTrailsideGeometry(admitted),
    loadCoveGeometry(admitted),
    loadCoverGeometry(admitted),
    DUNE_LOGS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.duneLogs)),
    BRIDGE_POSTS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.bridgePosts)), BRIDGE_SPECIMEN_POSTS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.bridgeSpecimenPosts)),
    WATERFALL_SHEET_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.waterfallSheet)), WATERFALL_RINGS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.waterfallRings)),
    WATERFALL_PUFFS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.waterfallPuffs)),
    IRON_SWORD_BLADE_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.ironSwordBlade)), IRON_SWORD_FITTINGS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.ironSwordFittings)),
    HAT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.hat)), CHIME_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.chime)),
    CAPE_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.cape)), BOAT_HULL_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.boatHull)),
    BOAT_SAIL_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.boatSail)), BOAT_GEAR_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.boatGear)),
    TROPHY_PLAQUES_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.trophyPlaques)), TROPHY_DROP_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.trophyDrop)),
    COUNTER_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.tradeCounter)),
    HUT_KIT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.hutKit)), HUT_FLAMES_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.hutFlames)),
    LOOKOUT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.lookout)),
    WRECK_KIT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.wreckKit)),
    WRECK_GLOW_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.wreckGlow)),
    WRECK_ROCKS_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.wreckRocks)),
    SHIPWRECK_KIT_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shipwreckKit)),
    SHIPWRECK_GLOW_GEOMETRY.load(admitted?.get(FIXED_MODEL_FILES.shipwreckGlow)),

  ]);
  ready = true;
  } finally { product?.release(); }
}
