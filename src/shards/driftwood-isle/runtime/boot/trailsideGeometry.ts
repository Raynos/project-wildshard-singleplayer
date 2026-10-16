import type { BufferGeometry } from 'three';
import { fixedGeometryHandle as modelGeometry } from './modelGeometry';
import { driftwoodRows } from './rows';

const template = modelGeometry('trailside');
/** the trail weld's baked rows, from the admitted product (`custom/trailside`, from data/trailsideBake.json) */
type TrailsideBake = ReturnType<typeof driftwoodRows<'custom/trailside'>>;
/** Explicit immutable template intake; tests and offline tools may supply bytes directly. */
export async function loadTrailsideGeometry(bytes: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await template.load(bytes.get('trailside'));
}
/** Independent admitted geometry and placement rows; an explicit author key must match the fixed bake. */
export function copyTrailsideGeometry(key?: string): { geometry: BufferGeometry; metadata: Omit<TrailsideBake, 'worldColliders'>; worldColliders: TrailsideBake['worldColliders'] } {
  const bake = driftwoodRows('custom/trailside');
  if (key !== undefined && key !== bake.specKey) throw new Error('Trailside layout changed; regenerate its fixed geometry');
  const { worldColliders, ...metadata } = bake;
  return { geometry: template.copy(), metadata: structuredClone(metadata), worldColliders };
}
