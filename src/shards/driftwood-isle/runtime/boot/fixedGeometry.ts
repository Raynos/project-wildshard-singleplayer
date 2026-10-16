import { loadTrailsideGeometry } from './trailsideGeometry';
import { loadCoverGeometry } from './coverGeometry';
import { loadCoveGeometry } from './coveGeometry';
import { createOwnedGeometryBatch, type OwnedGeometry as ModelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { readProductGeometry, readNamedFixedGeometry } from './modelGeometry';
import type { BufferGeometry } from 'three';
import { FIXED_MODEL_FILES } from '../const';

const preload = createOwnedGeometryBatch();
const modelGeometry = preload.geometry;

/** Prepared head; the original talk rig borrows a mutable copy, without a second source download or runtime fitter. */
export const WENDELL_HEAD_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.wendellHead);

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
/** The Explorer's lone wreck cargo (generators/cargo.ts): the world's copies are drawn into the wreck's own kit. */
export const CARGO_GEOMETRY = {
  barrel: modelGeometry(FIXED_MODEL_FILES.cargoBarrel), lying: modelGeometry(FIXED_MODEL_FILES.cargoBarrelLying),
  crate: modelGeometry(FIXED_MODEL_FILES.cargoCrate), broken: modelGeometry(FIXED_MODEL_FILES.cargoCrateBroken),
  coil: modelGeometry(FIXED_MODEL_FILES.cargoCoil),
} as const;
/** The Ring Shrine's firefly quads (generators/fireflies.ts, the shrine base's space); the graph poses each by its `aFly`. */
export const SHRINE_FIREFLIES_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.shrineFireflies, { _afly: 'aFly' });
/** The herring gull (generators/gull.ts, gull-local); the flock's graph turns each vertex's `aPart`. */
export const GULL_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.gull, { _apart: 'aPart' });
/** The castaway's campfire smoke quads (generators/smoke.ts, the fire's frame); the graph poses each by its `aPuff`. */
export const CASTAWAY_SMOKE_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.castawaySmoke, { _apuff: 'aPuff' });
/** The Explorer's lone drift logs (generators/driftLogs.ts): the world's copies are drawn into their bakes' kits. */
export const DRIFT_LOG_GEOMETRY = {
  long: modelGeometry(FIXED_MODEL_FILES.driftLogLong), short: modelGeometry(FIXED_MODEL_FILES.driftLogShort),
  pale: modelGeometry(FIXED_MODEL_FILES.driftLogPale),
} as const;
/** The reef fish (generators/reefFish.ts): the lagoon's school tints each instanced copy. */
export const REEF_FISH_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.reefFish);
/** The sailboat's mooring lines (generators/mooringLines.ts, world space); the Boat lifts each cleat end by its `aMoor`. */
export const MOORING_LINES_GEOMETRY = modelGeometry(FIXED_MODEL_FILES.mooringLines, { _amoor: 'aMoor' });
/** The trader's and the castaway's kit meshes (generators/npcKits.ts, own space; the camp about its fire). */
export const NPC_KIT_GEOMETRY = {
  trader: {
    body: modelGeometry(FIXED_MODEL_FILES.npcTraderBody, { _sway: 'aSway' }), head: modelGeometry(FIXED_MODEL_FILES.npcTraderHead, { _sway: 'aSway' }),
    upper: modelGeometry(FIXED_MODEL_FILES.npcTraderUpper), fore: modelGeometry(FIXED_MODEL_FILES.npcTraderFore),
  },
  castaway: {
    body: modelGeometry(FIXED_MODEL_FILES.npcCastawayBody), camp: modelGeometry(FIXED_MODEL_FILES.npcCastawayCamp),
    head: modelGeometry(FIXED_MODEL_FILES.npcCastawayHead), arm: modelGeometry(FIXED_MODEL_FILES.npcCastawayArm),
    flames: modelGeometry(FIXED_MODEL_FILES.npcCastawayFlames),
  },
} as const;
/** The entry road decks (generators/entryDeckGeometry.ts, own frame): the world's four entries share one; the Explorer's seabeds. */
export const ENTRY_DECK_GEOMETRY = {
  world: modelGeometry(FIXED_MODEL_FILES.entryDeckWorld), deep: modelGeometry(FIXED_MODEL_FILES.entryDeckDeep),
  shallow: modelGeometry(FIXED_MODEL_FILES.entryDeckShallow),
} as const;
const PIER_WORLD_0_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld0Deck);
const PIER_WORLD_0_CLOTH_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld0Cloth,{_sway:'aSway'});
const PIER_WORLD_1_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld1Deck);
const PIER_WORLD_1_CLOTH_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld1Cloth,{_sway:'aSway'});
const PIER_WORLD_2_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld2Deck);
const PIER_WORLD_3_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld3Deck);
const PIER_WORLD_3_CLOTH_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierWorld3Cloth,{_sway:'aSway'});
const PIER_SPECIMEN_JETTY_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierSpecimenJettyDeck);
const PIER_SPECIMEN_LONG_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierSpecimenLongDeck);
const PIER_SPECIMEN_LANDING_DECK_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierSpecimenLandingDeck);
const PIER_SPECIMEN_LANDING_CLOTH_GEOMETRY=modelGeometry(FIXED_MODEL_FILES.pierSpecimenLandingCloth,{_sway:'aSway'});
/** Immutable templates for the four world piers and three existing Explorer variants. */
export const PIER_GEOMETRIES:ReadonlyMap<string,{deck:ModelGeometry;cloth:ModelGeometry|null}>=new Map([
 ['world-0',{deck:PIER_WORLD_0_DECK_GEOMETRY,cloth:PIER_WORLD_0_CLOTH_GEOMETRY}],
 ['world-1',{deck:PIER_WORLD_1_DECK_GEOMETRY,cloth:PIER_WORLD_1_CLOTH_GEOMETRY}],
 ['world-2',{deck:PIER_WORLD_2_DECK_GEOMETRY,cloth:null}],
 ['world-3',{deck:PIER_WORLD_3_DECK_GEOMETRY,cloth:PIER_WORLD_3_CLOTH_GEOMETRY}],
 ['specimen-jetty',{deck:PIER_SPECIMEN_JETTY_DECK_GEOMETRY,cloth:null}],
 ['specimen-long',{deck:PIER_SPECIMEN_LONG_DECK_GEOMETRY,cloth:null}],
 ['specimen-landing',{deck:PIER_SPECIMEN_LANDING_DECK_GEOMETRY,cloth:PIER_SPECIMEN_LANDING_CLOTH_GEOMETRY}],
]);
let ready = false;
/** Explorer may open these models before the island's world hook has run. */
export function fixedGeometryReady(): boolean { return ready; }
/** Called explicitly by the world hook before any synchronous placement or later loot factory. Explicit bytes admit the same templates in Node fixtures. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readProductGeometry>[0]): Promise<void> {
  const product = owner === undefined ? undefined : await readProductGeometry(owner);
  const admitted = product?.templates ?? bytes ?? await readNamedFixedGeometry();
  try {
  const urls = Object.values(FIXED_MODEL_FILES);
  for (let i = 0; i < 86; i++) {
    const url = urls[i]; if (url === undefined || !admitted.has(url)) throw new Error('Missing Driftwood source draw');
  }
  await Promise.all([
    preload.load(admitted),
    loadTrailsideGeometry(admitted),
    loadCoveGeometry(admitted),
    loadCoverGeometry(admitted),
  ]);
  ready = true;
  } finally { product?.release(); }
}
