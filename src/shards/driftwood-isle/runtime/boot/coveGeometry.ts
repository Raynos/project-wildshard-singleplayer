import type { BufferGeometry } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { fixedGeometryHandle as modelGeometry } from './modelGeometry';
import { driftwoodRows } from './rows';

const templates = {
  structure: modelGeometry('coveStructure'),
  rocks: modelGeometry('coveRocks'),
  glow: modelGeometry('coveGlow'),
  pools: modelGeometry('covePools'),
};

/** the cave's baked facts, from the admitted product (`custom/fixedLayouts`, from data/coveBake.json) */
const bake = () => driftwoodRows('custom/fixedLayouts').cove;
type CoveBake = ReturnType<typeof bake>;
export type CoveSpec = CoveBake['spec'];
export type CaveBounds = CoveSpec['caveBounds'];
export type CoveAnchor = CoveBake['native']['anchors'][string];
/** Fresh authored layout from the admitted static model section. */
export function islandCoveSpec(): CoveSpec { return structuredClone(bake().spec); }
/** The cave's walkable floor as baked FloorRect rows (generators/coveLayout.ts `coveFloors`). */
export function coveFloors(): CoveBake['floors'] { return bake().floors; }

/** Explicit intake; a fixture can admit these same immutable templates without fetch. */
export async function loadCoveGeometry(bytes: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await Promise.all([
    templates.structure.load(bytes.get('coveStructure')),
    templates.rocks.load(bytes.get('coveRocks')),
    templates.glow.load(bytes.get('coveGlow')),
    templates.pools.load(bytes.get('covePools')),
  ]);
}

/** The authored island's one baked layout: fresh copies of its geometry with the catalogue and native facts it was baked with. */
export function copyCoveGeometry(): {
  geometry: Record<keyof typeof templates, BufferGeometry>;
  catalogue: CoveBake['catalogue'];
  native: CoveBake['native'];
} {
  const { catalogue, native } = bake();
  return {
    geometry: {
      structure: templates.structure.copy(), rocks: templates.rocks.copy(),
      glow: templates.glow.copy(), pools: templates.pools.copy(),
    },
    catalogue,
    native,
  };
}

/** Fresh native descriptors from the admitted static cave facts. */
export function coveColliderDescs(): ColliderDesc[] {
  return readColliderRows(bake().native.descs, { kinds: ['box', 'treads'], surfaces: ['rock'], requireSurface: true });
}
