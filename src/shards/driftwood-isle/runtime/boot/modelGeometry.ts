import { createOwnedGeometryBatch, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { driftwoodBlobName, loadDriftwoodProduct } from './blobAssets';
import type { BufferGeometry } from 'three';
import type { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { driftwoodRows } from './rows';

/** Decode the admitted scene's subsets through the shared assembler; original materials and placements stay local. */
export type ProductGeometryOwner = Parameters<typeof readWholeGeometry>[0];
export async function readProductGeometry(owner: ProductGeometryOwner): Promise<{ templates: Map<string, BufferGeometry>; release: () => void }> {
  const { readWholeGeometry } = await import('@wildshard/game/plugin/geometry');
  const assembled = await readWholeGeometry(owner, 'driftwood-isle'), result = new Map<string, BufferGeometry>();
  const urls = fixedGeometrySources().map(([, name]) => name);
  if (urls.length !== 86) throw new Error('Driftwood requires all authored source draws');
  for (let i = 0; i < 86; i++) {
    const url = urls[i]; if (url === undefined) throw new Error('Missing Driftwood source draw URL');
    const id = url.slice(url.lastIndexOf('/') + 1, -4), view = assembled.get(id);
    if (view === undefined) throw new Error(`Missing admitted Driftwood source draw: ${id}`);
    result.set(url, view.geometry);
  }
  if (assembled.size !== result.size) throw new Error('Unexpected admitted Driftwood source draw');
  return { templates: result, release: () => {
    for (let i = 0; i < 86; i++) {
      const url = urls[i]; if (url === undefined) throw new Error('Missing Driftwood source draw URL');
      const id = url.slice(url.lastIndexOf('/') + 1, -4);
      assembled.get(id)?.release?.();
    }
  } };
}

/** Cold Explorer templates come from named product blobs, while the world keeps its existing assembled geometry loan. */
export async function readNamedFixedGeometry(): Promise<Map<string, Uint8Array>> {
  const product = await loadDriftwoodProduct();
  return new Map(await Promise.all(fixedGeometrySources().map(([, name]) => name).map(async url => [url, await product.file(driftwoodBlobName(product, url))] as const)));
}

/** Source labels and declaration rows are independently checked before any bytes are loaded. */
export function fixedGeometrySources(): readonly (readonly [string, string])[] {
  const rows = driftwoodRows('custom/fixedLayouts').fixedDraws, slots = new Set(rows.map(row => row.slot));
  const sources = Object.entries(driftwoodRows('custom/assets').byUrl).filter(([key]) => key.startsWith('fixed:')).map(([key, name]) => [key.slice(6), name] as const);
  if (slots.size !== 86 || sources.length !== slots.size || sources.some(([slot]) => !slots.has(slot))) throw new Error('Undeclared fixed draw slots');
  return sources;
}
let ready = false;
let preload: ReturnType<typeof createOwnedGeometryBatch> | undefined;
const templates = new Map<string, OwnedGeometry>();
function prepared(slot: string): OwnedGeometry {
  const geometry = templates.get(slot);
  if (geometry === undefined) throw new Error(`Baked model was not loaded: ${slot}`);
  return geometry;
}
/** Inert selectors are safe at module evaluation; the product supplies every source and alias at boot. */
function initialize(): ReturnType<typeof createOwnedGeometryBatch> {
  if (preload === undefined) {
    fixedGeometrySources();
    preload = createOwnedGeometryBatch();
    const rows = driftwoodRows('custom/fixedLayouts').fixedDraws;
    for (let i = 0; i < 86; i++) {
      const row = rows[i];
      if (row === undefined) throw new Error('Missing Driftwood fixed declaration');
      templates.set(row.slot, preload.geometry(row.slot, Object.fromEntries(row.channels)));
    }
  }
  return preload;
}
export function fixedDraw(slot: string): OwnedGeometry {
  return {
    load: bytes => {
      if (bytes === undefined) return ready ? prepared(slot).load() : loadFixedGeometry();
      initialize(); return prepared(slot).load(bytes);
    },
    adopt: geometry => { initialize(); prepared(slot).adopt(geometry); },
    copy: () => prepared(slot).copy(), take: () => prepared(slot).take(),
  };
}
export function fixedGeometryReady(): boolean { return ready; }
/** One existing owned batch loads every declared source; no parallel preload list or decoded copy. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: ProductGeometryOwner): Promise<void> {
  const product = owner === undefined ? undefined : await readProductGeometry(owner);
  const admitted = product?.templates ?? bytes ?? await readNamedFixedGeometry();
  try {
    const sources = fixedGeometrySources(), slots = new Map<string, Uint8Array | BufferGeometry>();
    for (let i = 0; i < 86; i++) {
      const row = sources[i], value = row === undefined ? undefined : admitted.get(row[1]);
      if (row === undefined || value === undefined) throw new Error('Missing Driftwood source draw');
      slots.set(row[0], value);
    }
    await initialize().load(slots); ready = true;
  } finally { product?.release(); }
}
const coverKinds = ['tuft','fern','hibiscus','daisy','pebble','shells','starfish','bush','tuftFar','fernFar','hibiscusFar','daisyFar','bushFar'] as const;
export function copyCoverGeometry(): Record<string, BufferGeometry> {
  return Object.fromEntries(coverKinds.map(kind => [kind, fixedDraw(`cover${kind.charAt(0).toUpperCase()}${kind.slice(1)}`).copy()]));
}
export const CARGO_GEOMETRY = {
  barrel: fixedDraw('cargoBarrel'), lying: fixedDraw('cargoBarrelLying'),
  crate: fixedDraw('cargoCrate'), broken: fixedDraw('cargoCrateBroken'),
  coil: fixedDraw('cargoCoil'),
} as const;
export const DRIFT_LOG_GEOMETRY = {
  long: fixedDraw('driftLogLong'), short: fixedDraw('driftLogShort'),
  pale: fixedDraw('driftLogPale'),
} as const;
export const NPC_KIT_GEOMETRY = {
  trader: {
    body: fixedDraw('npcTraderBody'), head: fixedDraw('npcTraderHead'),
    upper: fixedDraw('npcTraderUpper'), fore: fixedDraw('npcTraderFore'),
  },
  castaway: {
    body: fixedDraw('npcCastawayBody'), camp: fixedDraw('npcCastawayCamp'),
    head: fixedDraw('npcCastawayHead'), arm: fixedDraw('npcCastawayArm'),
    flames: fixedDraw('npcCastawayFlames'),
  },
} as const;
export const ENTRY_DECK_GEOMETRY = {
  world: fixedDraw('entryDeckWorld'), deep: fixedDraw('entryDeckDeep'),
  shallow: fixedDraw('entryDeckShallow'),
} as const;
export const PIER_GEOMETRIES = new Map([
 ['world-0',{deck:fixedDraw('pierWorld0Deck'),cloth:fixedDraw('pierWorld0Cloth')}],
 ['world-1',{deck:fixedDraw('pierWorld1Deck'),cloth:fixedDraw('pierWorld1Cloth')}],
 ['world-2',{deck:fixedDraw('pierWorld2Deck'),cloth:null}],
 ['world-3',{deck:fixedDraw('pierWorld3Deck'),cloth:fixedDraw('pierWorld3Cloth')}],
 ['specimen-jetty',{deck:fixedDraw('pierSpecimenJettyDeck'),cloth:null}],
 ['specimen-long',{deck:fixedDraw('pierSpecimenLongDeck'),cloth:null}],
 ['specimen-landing',{deck:fixedDraw('pierSpecimenLandingDeck'),cloth:fixedDraw('pierSpecimenLandingCloth')}],
]);
