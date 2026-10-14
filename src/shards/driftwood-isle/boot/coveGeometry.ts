import type { BufferGeometry } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { staticColliders } from '../runtime/boot/staticColliders';
import { modelGeometry } from '../runtime/boot/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';
import bake from '../data/coveBake.json' with { type: 'json' };
import { coveSpecKey, type CoveSpec } from '../world/coveLayout';

const templates = {
  structure: modelGeometry(FIXED_MODEL_FILES.coveStructure),
  rocks: modelGeometry(FIXED_MODEL_FILES.coveRocks),
  glow: modelGeometry(FIXED_MODEL_FILES.coveGlow),
  pools: modelGeometry(FIXED_MODEL_FILES.covePools),
};

/** Explicit intake; a fixture can admit these same immutable templates without fetch. */
export async function loadCoveGeometry(bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await Promise.all([
    templates.structure.load(bytes?.get(FIXED_MODEL_FILES.coveStructure)),
    templates.rocks.load(bytes?.get(FIXED_MODEL_FILES.coveRocks)),
    templates.glow.load(bytes?.get(FIXED_MODEL_FILES.coveGlow)),
    templates.pools.load(bytes?.get(FIXED_MODEL_FILES.covePools)),
  ]);
}

/** The authored island is one admitted layout. Refuse a different spec rather than draw geometry with mismatched collision. */
export function copyCoveGeometry(spec: CoveSpec): {
  geometry: Record<keyof typeof templates, BufferGeometry>;
  catalogue: typeof bake.catalogue;
  native: typeof bake.native;
} {
  if (coveSpecKey(spec) !== bake.specKey) throw new Error('Cove layout changed; regenerate its fixed geometry');
  return {
    geometry: {
      structure: templates.structure.copy(), rocks: templates.rocks.copy(),
      glow: templates.glow.copy(), pools: templates.pools.copy(),
    },
    catalogue: bake.catalogue,
    native:bake.native,
  };
}

/** Fresh native descriptors from the admitted static cave facts. */
export function coveColliderDescs(): ColliderDesc[] {
  return staticColliders(bake.native.descs, 'rock');
}
