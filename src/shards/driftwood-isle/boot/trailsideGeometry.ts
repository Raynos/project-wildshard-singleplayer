import type { BufferGeometry } from 'three';
import { modelGeometry } from '@wildshard/sdk/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';
import bake from '../data/trailsideBake.json' with { type: 'json' };
import { trailsideSpecKey, type TrailsideSpec } from '../world/trailsideLayout';

const template = modelGeometry(FIXED_MODEL_FILES.trailside);
/** Explicit immutable template intake; tests and offline tools may supply bytes directly. */
export async function loadTrailsideGeometry(bytes?: ReadonlyMap<string, Uint8Array>): Promise<void> {
  await template.load(bytes?.get(FIXED_MODEL_FILES.trailside));
}
/** Independent geometry and placement rows for the admitted native layout; changed layouts require a new bake. */
export function copyTrailsideGeometry(spec: TrailsideSpec): { geometry: BufferGeometry; metadata: typeof bake } {
  if (trailsideSpecKey(spec) !== bake.specKey) throw new Error('Trailside layout changed; regenerate its fixed geometry');
  return { geometry: template.copy(), metadata: structuredClone(bake) };
}
