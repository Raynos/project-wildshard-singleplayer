import type { BufferGeometry } from 'three';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { FIXED_MODEL_FILES } from '../../data/modelFiles';
import { driftwoodRows } from './rows';
import { trailsideSpecKey, type TrailsideSpec } from '../../world/trailsideLayout';

const template = modelGeometry(FIXED_MODEL_FILES.trailside);
/** the trail weld's baked rows, from the admitted product (`custom/trailside`, from data/trailsideBake.json) */
type TrailsideBake = ReturnType<typeof driftwoodRows<'custom/trailside'>>;
/** Explicit immutable template intake; tests and offline tools may supply bytes directly. */
export async function loadTrailsideGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await template.load(bytes?.get(FIXED_MODEL_FILES.trailside));
}
/** Independent geometry and placement rows for the admitted native layout; changed layouts require a new bake. */
export function copyTrailsideGeometry(spec: TrailsideSpec): { geometry: BufferGeometry; metadata: Omit<TrailsideBake, 'worldColliders'>; worldColliders: TrailsideBake['worldColliders'] } {
  const bake = driftwoodRows('custom/trailside');
  if (trailsideSpecKey(spec) !== bake.specKey) throw new Error('Trailside layout changed; regenerate its fixed geometry');
  const { worldColliders, ...metadata } = bake;
  return { geometry: template.copy(), metadata: structuredClone(metadata), worldColliders };
}
