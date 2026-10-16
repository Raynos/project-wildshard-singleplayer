import { createOwnedGeometry, type OwnedGeometryBatch } from '@wildshard/engine/models/ownedGeometry';
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

/** Draw handles are inert slot keys until this admitted asset index resolves their exact named bytes. */
const declaredSlots = new Set<string>();
/** Existing owned handles retain their declaration and channel mapping; no data is read at module evaluation. */
export function fixedGeometryHandle(slot: string, channels: Readonly<Record<string, string>> = {}, batch?: OwnedGeometryBatch): ReturnType<typeof createOwnedGeometry> {
  if (declaredSlots.has(slot)) throw new Error('Duplicate fixed draw slot');
  declaredSlots.add(slot);
  return batch === undefined ? createOwnedGeometry(slot, channels) : batch.geometry(slot, channels);
}
export function fixedGeometrySources(): readonly (readonly [string, string])[] {
  const sources = Object.entries(driftwoodRows('custom/assets').byUrl).filter(([key]) => key.startsWith('fixed:')).map(([key, name]) => [key.slice(6), name] as const);
  if (sources.length !== declaredSlots.size || sources.some(([slot]) => !declaredSlots.has(slot))) throw new Error('Undeclared fixed draw slots');
  return sources;
}
