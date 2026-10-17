import { createOwnedGeometryBatch, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { BufferGeometry } from 'three';
import type { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { driftwoodRows, admitDriftwoodRows, driftwoodProduct } from './rows';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import * as v from 'valibot';
import { SECTIONS, FixedGeometryGroupsSchema } from '../sections';

/** Legacy labels identify existing authored parts; only the product decides their named bytes and URLs. */
export function driftwoodBlobName(product: ShardProduct, label: string): string {
  if (product.hasFile(label)) return label;
  const name = product.section('custom/assets', SECTIONS).byUrl[label];
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

const fixed = createOwnedGeometryBatch(), templates = new Map<string, OwnedGeometry>();
let inventory: v.InferOutput<typeof FixedGeometryGroupsSchema> | null = null;
let fixedReady = false;
function prepareFixedTemplates(): void {
  if (templates.size > 0) return;
  const rows = driftwoodRows('custom/fixedLayouts').fixedDraws;
  for (let i = 0; i < 86; i++) {
    const row = rows[i]; if (row === undefined) throw new Error('Missing fixed geometry declaration');
    templates.set(row.slot, fixed.geometry(row.slot, Object.fromEntries(row.channels)));
  }
}
function fixedTemplate(slot: string): OwnedGeometry {
  const template = templates.get(slot);
  if (template === undefined) throw new Error(`Baked model was not loaded: ${slot}`);
  return template;
}
/** Select an inert owned handle; admitted data declares its channels before intake. */
export function fixedDraw(slot: string): OwnedGeometry {
  return { load: bytes => { if (bytes === undefined && !fixedReady) return loadFixedGeometry(); prepareFixedTemplates(); return fixedTemplate(slot).load(bytes); },
    adopt: geometry => { prepareFixedTemplates(); fixedTemplate(slot).adopt(geometry); }, copy: () => fixedTemplate(slot).copy(), take: () => fixedTemplate(slot).take() };
}
/** Typed named groups are read only after the same explicit geometry admission. */
export function fixedGeometryGroups(): v.InferOutput<typeof FixedGeometryGroupsSchema> {
  if (inventory === null) throw new Error('Baked model was not loaded: Driftwood fixed geometry inventory');
  return inventory;
}
/** The current owned templates have completed their admitted intake. */
export function fixedGeometryReady(): boolean { return fixedReady; }
/** Acquire original source draws through the existing assembler, or named blobs for cold Explorer cards. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0]): Promise<void> {
  const product = bytes === undefined && owner === undefined ? await loadDriftwoodProduct() : driftwoodProduct();
  const rows = product.section('custom/fixedLayouts', SECTIONS).fixedDraws;
  const aliases = Object.entries(driftwoodRows('custom/assets').byUrl).filter(([key]) => key.startsWith('fixed:'));
  if (rows.length !== 86 || aliases.length !== rows.length || aliases.some(([key]) => !rows.some(row => row.slot === key.slice(6)))) throw new Error('Undeclared fixed draw slots');
  inventory ??= v.parse(FixedGeometryGroupsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('models/fixed-geometry.json'))));
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
    await fixed.load(admitted); fixedReady = true;
  } finally { for (let i = 0, views = [...assembled?.values() ?? []]; i < 86; i++) { const view = views[i]; if (view === undefined) break; view.release?.(); } }
}
