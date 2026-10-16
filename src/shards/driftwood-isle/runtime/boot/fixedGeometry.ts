import { loadTrailsideGeometry } from './trailsideGeometry';
import { loadCoveGeometry } from './coveGeometry';
import { createOwnedGeometryBatch, type OwnedGeometry as ModelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { readProductGeometry, readNamedFixedGeometry, fixedGeometrySources, fixedGeometryHandle } from './modelGeometry';
import type { BufferGeometry } from 'three';

const preload = createOwnedGeometryBatch();
const modelGeometry = (slot: string, channels?: Readonly<Record<string, string>>) => fixedGeometryHandle(slot, channels, preload);

/** The admitted fixed source slots share one owned batch; each view receives mutable copies. */
const coverKinds = ['tuft','fern','hibiscus','daisy','pebble','shells','starfish','bush','tuftFar','fernFar','hibiscusFar','daisyFar','bushFar'] as const;
const coverTemplates = new Map(coverKinds.map(kind => [kind, modelGeometry(`cover${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)]));
export function copyCoverGeometry(): Record<string, BufferGeometry> { return Object.fromEntries([...coverTemplates].map(([kind, geometry]) => [kind, geometry.copy()])); }

/** Prepared head; the original talk rig borrows a mutable copy, without a second source download or runtime fitter. */
export const WENDELL_HEAD_GEOMETRY = modelGeometry('wendellHead');

/** Immutable CPU templates only; every model receives a deep mutable geometry copy. */
export const HAT_GEOMETRY = modelGeometry('hat', { _sway: 'aSway' });
export const CHIME_GEOMETRY = modelGeometry('chime', { _sway: 'aSway' });
export const CAPE_GEOMETRY = modelGeometry('cape', { _sway: 'aSway' });
export const BOAT_HULL_GEOMETRY = modelGeometry('boatHull');
export const BOAT_SAIL_GEOMETRY = modelGeometry('boatSail', { _sway: 'aSway' });
export const BOAT_GEAR_GEOMETRY = modelGeometry('boatGear');
export const TROPHY_PLAQUES_GEOMETRY = modelGeometry('trophyPlaques');
export const TROPHY_DROP_GEOMETRY = modelGeometry('trophyDrop');
export const COUNTER_GEOMETRY = modelGeometry('tradeCounter', { _sway: 'aSway' });
/** The castaway's hut on its site (own space): the kit mesh and the unlit flames. */
export const HUT_KIT_GEOMETRY = modelGeometry('hutKit');
export const HUT_FLAMES_GEOMETRY = modelGeometry('hutFlames');
/** The lookout tower on its site (own space), the banner's sway channel kept. */
export const LOOKOUT_GEOMETRY = modelGeometry('lookout', { _sway: 'aSway' });
/** Pickup parts retain their native materials and local centring. */
export const IRON_SWORD_BLADE_GEOMETRY = modelGeometry('ironSwordBlade');
export const IRON_SWORD_FITTINGS_GEOMETRY = modelGeometry('ironSwordFittings');
export const WRECK_KIT_GEOMETRY = modelGeometry('wreckKit', { _sway: 'aSway' });
export const WRECK_GLOW_GEOMETRY = modelGeometry('wreckGlow');
export const WRECK_ROCKS_GEOMETRY = modelGeometry('wreckRocks');
export const SHIPWRECK_KIT_GEOMETRY = modelGeometry('shipwreckKit', { _sway: 'aSway' });
export const SHIPWRECK_GLOW_GEOMETRY = modelGeometry('shipwreckGlow');
export const SHRINE_KIT_GEOMETRY=modelGeometry('shrineKit');
export const SHRINE_WATER_GEOMETRY=modelGeometry('shrineWater');
export const SHRINE_GLYPHS_GEOMETRY=modelGeometry('shrineGlyphs');
export const SHRINE_SPECIMEN_KIT_GEOMETRY=modelGeometry('shrineSpecimenKit');
export const SHRINE_SPECIMEN_WATER_GEOMETRY=modelGeometry('shrineSpecimenWater');
export const SHRINE_SPECIMEN_GLYPHS_GEOMETRY=modelGeometry('shrineSpecimenGlyphs');
/** The world owns the static dune ring; transfer its buffer instead of retaining a template. */
export const DUNE_LOGS_GEOMETRY = modelGeometry('duneLogs');
/** The rope bridge's four anchor posts (own space) on the island span and the Explorer span; the deck stays live. */
export const BRIDGE_POSTS_GEOMETRY = modelGeometry('bridgePosts');
export const BRIDGE_SPECIMEN_POSTS_GEOMETRY = modelGeometry('bridgeSpecimenPosts');
/** The cove's toon cascade (generators/cascade.ts, world space): its curtain, pool rings and foam puffs. */
export const WATERFALL_SHEET_GEOMETRY = modelGeometry('waterfallSheet', { _astep: 'aStep' });
export const WATERFALL_RINGS_GEOMETRY = modelGeometry('waterfallRings');
export const WATERFALL_PUFFS_GEOMETRY = modelGeometry('waterfallPuffs', { _acentre: 'aCentre', _ainfo: 'aInfo' });
/** The Explorer's lone wreck cargo (generators/cargo.ts): the world's copies are drawn into the wreck's own kit. */
export const CARGO_GEOMETRY = {
  barrel: modelGeometry('cargoBarrel'), lying: modelGeometry('cargoBarrelLying'),
  crate: modelGeometry('cargoCrate'), broken: modelGeometry('cargoCrateBroken'),
  coil: modelGeometry('cargoCoil'),
} as const;
/** The Ring Shrine's firefly quads (generators/fireflies.ts, the shrine base's space); the graph poses each by its `aFly`. */
export const SHRINE_FIREFLIES_GEOMETRY = modelGeometry('shrineFireflies', { _afly: 'aFly' });
/** The herring gull (generators/gull.ts, gull-local); the flock's graph turns each vertex's `aPart`. */
export const GULL_GEOMETRY = modelGeometry('gull', { _apart: 'aPart' });
/** The castaway's campfire smoke quads (generators/smoke.ts, the fire's frame); the graph poses each by its `aPuff`. */
export const CASTAWAY_SMOKE_GEOMETRY = modelGeometry('castawaySmoke', { _apuff: 'aPuff' });
/** The Explorer's lone drift logs (generators/driftLogs.ts): the world's copies are drawn into their bakes' kits. */
export const DRIFT_LOG_GEOMETRY = {
  long: modelGeometry('driftLogLong'), short: modelGeometry('driftLogShort'),
  pale: modelGeometry('driftLogPale'),
} as const;
/** The reef fish (generators/reefFish.ts): the lagoon's school tints each instanced copy. */
export const REEF_FISH_GEOMETRY = modelGeometry('reefFish');
/** The sailboat's mooring lines (generators/mooringLines.ts, world space); the Boat lifts each cleat end by its `aMoor`. */
export const MOORING_LINES_GEOMETRY = modelGeometry('mooringLines', { _amoor: 'aMoor' });
/** The trader's and the castaway's kit meshes (generators/npcKits.ts, own space; the camp about its fire). */
export const NPC_KIT_GEOMETRY = {
  trader: {
    body: modelGeometry('npcTraderBody', { _sway: 'aSway' }), head: modelGeometry('npcTraderHead', { _sway: 'aSway' }),
    upper: modelGeometry('npcTraderUpper'), fore: modelGeometry('npcTraderFore'),
  },
  castaway: {
    body: modelGeometry('npcCastawayBody'), camp: modelGeometry('npcCastawayCamp'),
    head: modelGeometry('npcCastawayHead'), arm: modelGeometry('npcCastawayArm'),
    flames: modelGeometry('npcCastawayFlames'),
  },
} as const;
/** The entry road decks (generators/entryDeckGeometry.ts, own frame): the world's four entries share one; the Explorer's seabeds. */
export const ENTRY_DECK_GEOMETRY = {
  world: modelGeometry('entryDeckWorld'), deep: modelGeometry('entryDeckDeep'),
  shallow: modelGeometry('entryDeckShallow'),
} as const;
const PIER_WORLD_0_DECK_GEOMETRY=modelGeometry('pierWorld0Deck');
const PIER_WORLD_0_CLOTH_GEOMETRY=modelGeometry('pierWorld0Cloth',{_sway:'aSway'});
const PIER_WORLD_1_DECK_GEOMETRY=modelGeometry('pierWorld1Deck');
const PIER_WORLD_1_CLOTH_GEOMETRY=modelGeometry('pierWorld1Cloth',{_sway:'aSway'});
const PIER_WORLD_2_DECK_GEOMETRY=modelGeometry('pierWorld2Deck');
const PIER_WORLD_3_DECK_GEOMETRY=modelGeometry('pierWorld3Deck');
const PIER_WORLD_3_CLOTH_GEOMETRY=modelGeometry('pierWorld3Cloth',{_sway:'aSway'});
const PIER_SPECIMEN_JETTY_DECK_GEOMETRY=modelGeometry('pierSpecimenJettyDeck');
const PIER_SPECIMEN_LONG_DECK_GEOMETRY=modelGeometry('pierSpecimenLongDeck');
const PIER_SPECIMEN_LANDING_DECK_GEOMETRY=modelGeometry('pierSpecimenLandingDeck');
const PIER_SPECIMEN_LANDING_CLOTH_GEOMETRY=modelGeometry('pierSpecimenLandingCloth',{_sway:'aSway'});
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
  const sources = fixedGeometrySources(), slots = new Map<string, Uint8Array | BufferGeometry>();
  if (sources.length !== 86) throw new Error('Missing Driftwood source draw');
  for (let i = 0; i < 86; i++) {
    const row = sources[i], value = row === undefined ? undefined : admitted.get(row[1]);
    if (row === undefined || value === undefined) throw new Error('Missing Driftwood source draw');
    slots.set(row[0], value);
  }
  await Promise.all([
    preload.load(slots),
    loadTrailsideGeometry(slots),
    loadCoveGeometry(slots),
  ]);
  ready = true;
  } finally { product?.release(); }
}
