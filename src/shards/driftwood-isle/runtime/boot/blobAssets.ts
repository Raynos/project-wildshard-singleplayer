import { FigureCatalogue } from '@wildshard/sdk/npc/figures';
import { CollectionCatalogue } from '@wildshard/game/models/collectionDisplay';
import { createOwnedGeometry, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { BufferGeometry } from 'three';
import type { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { driftwoodRows, admitDriftwoodRows, driftwoodProduct } from './rows';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { CustomSections, FixedGeometryGroups } from '../productSections.generated.d.ts';

/** Legacy labels identify existing authored parts; only the product decides their named bytes and URLs. */
export function driftwoodBlobName(product: ShardProduct, label: string): string {
  if (product.hasFile(label)) return label;
  const name = product.section<CustomSections['custom/assets']>('custom/assets').byUrl[label];
  if (name === undefined || !product.hasFile(name)) throw new Error(`Driftwood product is missing its named asset: ${label}`);
  return name;
}

/** Renderer services stay behind the explicit page/Explorer load, outside offline geometry authoring. */
export async function loadDriftwoodProduct(owner: Scope = resourceScope()): Promise<ShardProduct> {
  const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
  const product = await loadFirstPartyProduct('driftwood-isle', owner);
  admitDriftwoodRows(product);
  return product;
}

/** Both world owners and cold Explorer cards read the same verified immutable product content. */
export async function readDriftwoodBlob(label: string, admitted?: ShardProduct): Promise<Uint8Array> {
  const product = admitted ?? await loadDriftwoodProduct();
  return product.file(driftwoodBlobName(product, label));
}

export const FIGURES = new FigureCatalogue('driftwood-isle', 'people/catalogue.json');

/** One owned template per admitted fixed draw slot (its GLB channels renamed as declared), loaded together. */
const fixed = new Map<string, OwnedGeometry>();
let inventory: FixedGeometryGroups | null = null, fixedReady = false;
/** The admitted fixed library stays bounded as authored units are added. */
const MAX_FIXED_DRAWS = 128;
function prepareFixedTemplates(): void {
  const rows = driftwoodRows('custom/fixedLayouts').fixedDraws; if (fixed.size > 0) return;
  for (let i = 0; i < MAX_FIXED_DRAWS; i++) { const row = rows[i]; if (row === undefined) break; fixed.set(row.slot, createOwnedGeometry(row.slot, Object.fromEntries(row.channels))); }
}
function fixedHandle(slot: string): OwnedGeometry { const handle = fixed.get(slot); if (handle === undefined) throw new Error(`Baked model was not loaded: ${slot}`); return handle; }
/** Select an inert owned handle; admitted data declares its channels before intake. */
export function fixedDraw(slot: string): OwnedGeometry {
  return { load: bytes => { if (bytes === undefined && !fixedReady) return loadFixedGeometry(); prepareFixedTemplates(); return fixedHandle(slot).load(bytes); },
    adopt: geometry => { prepareFixedTemplates(); fixedHandle(slot).adopt(geometry); }, copy: () => fixedHandle(slot).copy(), take: () => fixedHandle(slot).take() };
}
/** Typed named groups are read only after the same explicit geometry admission. */
export function fixedGeometryGroups(): FixedGeometryGroups {
  if (inventory === null) throw new Error('Baked model was not loaded: Driftwood fixed geometry inventory');
  return inventory;
}
/** The current owned templates have completed their admitted intake. */
export function fixedGeometryReady(): boolean { return fixedReady; }
/** Acquire original source draws through the existing assembler, or named blobs for cold Explorer cards. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0]): Promise<void> {
  const product = bytes === undefined && owner === undefined ? await loadDriftwoodProduct() : driftwoodProduct();
  await FIGURES.admit(product);
  const rows = product.section<CustomSections['custom/fixedLayouts']>('custom/fixedLayouts').fixedDraws;
  const aliases = Object.entries(driftwoodRows('custom/assets').byUrl).filter(([key]) => key.startsWith('fixed:'));
  if (rows.length === 0 || rows.length > MAX_FIXED_DRAWS || aliases.length !== rows.length || aliases.some(([key]) => !rows.some(row => row.slot === key.slice(6)))) throw new Error('Undeclared fixed draw slots');
  inventory ??= await product.json<FixedGeometryGroups>('models/fixed-geometry.json');
  prepareFixedTemplates();
  const sources = new Map(aliases.map(([key, name]) => [key.slice(6), name]));
  const assembled = owner === undefined ? undefined : await (await import('@wildshard/game/plugin/geometry')).readWholeGeometry(owner, 'driftwood-isle');
  try {
    const admitted = new Map(await Promise.all(rows.map(async row => {
      const name = sources.get(row.slot);
      if (name === undefined) throw new Error('Missing Driftwood source draw');
      const geometry = assembled?.get(name.slice(name.lastIndexOf('/') + 1, -4))?.geometry;
      const value = assembled === undefined ? bytes?.get(name) ?? (bytes === undefined ? await product.file(name) : undefined) : geometry;
      if (value === undefined) throw new Error('Missing Driftwood source draw');
      return [row.slot, value] as const;
    })));
    if (assembled !== undefined && assembled.size !== admitted.size) throw new Error('Unexpected admitted Driftwood source draw');
    await Promise.all([...fixed].map(([slot, geometry]) => geometry.load(admitted.get(slot)))); fixedReady = true;
  } finally { for (let i = 0, views = [...assembled?.values() ?? []]; i < MAX_FIXED_DRAWS; i++) { const view = views[i]; if (view === undefined) break; view.release?.(); } }
}

/** Inert collection binding shares the original fixed-draw intake without loading the live creature roster. */
export const COLLECTIONS = new CollectionCatalogue('driftwood-isle', new Map([
  ['chime', fixedDraw('chime')], ['trophyPlaques', fixedDraw('trophyPlaques')], ['trophyDrop', fixedDraw('trophyDrop')],
]));
