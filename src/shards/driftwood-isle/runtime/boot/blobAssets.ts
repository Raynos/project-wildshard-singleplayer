import { FigureCatalogue } from '@wildshard/sdk/npc/figures';
import { CollectionCatalogue } from '@wildshard/game/models/collectionDisplay';
import type { OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { fixedDraws, type FixedDraws } from '@wildshard/game/models/fixedDraws';
import type { BufferGeometry } from 'three';
import type { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { driftwoodRows, admitDriftwoodRows, driftwoodProduct } from './rows';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { FixedGeometryGroups } from '../productSections.generated.d.ts';

/** Renderer services stay behind the explicit page/Explorer load, outside offline geometry authoring. */
export async function loadDriftwoodProduct(owner: Scope = resourceScope()): Promise<ShardProduct> {
  const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
  const product = await loadFirstPartyProduct('driftwood-isle', owner);
  admitDriftwoodRows(product);
  return product;
}

export const FIGURES = new FigureCatalogue('driftwood-isle', 'people/catalogue.json');

/** The admitted fixed draws (custom/fixedLayouts.fixedDraws) as one library, made on its first use. */
let library: FixedDraws | null = null, inventory: FixedGeometryGroups | null = null;
const draws = (): FixedDraws => { library ??= fixedDraws(driftwoodProduct(), driftwoodRows('custom/fixedLayouts').fixedDraws); return library; };
/** Select an inert owned handle; admitted data declares its channels before intake. */
export function fixedDraw(slot: string): OwnedGeometry {
  return { load: bytes => bytes === undefined && !draws().ready ? loadFixedGeometry() : draws().handle(slot).load(bytes),
    adopt: geometry => { draws().handle(slot).adopt(geometry); }, copy: () => draws().handle(slot).copy(), take: () => draws().handle(slot).take() };
}
/** Typed named groups are read only after the same explicit geometry admission. */
export function fixedGeometryGroups(): FixedGeometryGroups {
  if (inventory === null) throw new Error('Baked model was not loaded: Driftwood fixed geometry inventory');
  return inventory;
}
/** The current owned templates have completed their admitted intake. */
export function fixedGeometryReady(): boolean { return library?.ready ?? false; }
/** Acquire original source draws through the existing assembler, or named blobs for cold Explorer cards. */
export async function loadFixedGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0]): Promise<void> {
  const product = bytes === undefined && owner === undefined ? await loadDriftwoodProduct() : driftwoodProduct();
  await FIGURES.admit(product);
  inventory ??= await product.json<FixedGeometryGroups>('models/fixed-geometry.json');
  await draws().load(bytes, owner);
}

/** Inert collection binding shares the original fixed-draw intake without loading the live creature roster. */
export const COLLECTIONS = new CollectionCatalogue('driftwood-isle', new Map([
  ['chime', fixedDraw('chime')], ['trophyPlaques', fixedDraw('trophyPlaques')], ['trophyDrop', fixedDraw('trophyDrop')],
]));
