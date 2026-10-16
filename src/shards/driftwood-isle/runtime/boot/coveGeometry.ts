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
export function coveFloorFacts(): CoveBake['floor'] { return bake().floor; }
function coveSpecKey(spec: CoveSpec): string {
  const { cave: c, caveBounds: b, fall: f } = spec;
  return [spec.pools.length, ...spec.pools.flatMap(p => [p.x, p.z, p.r]),
    spec.crabSites.length, ...spec.crabSites.flatMap(p => [p.x, p.z]),
    ...f.top, ...f.foot, f.width, c.x, c.z, c.yaw, c.w, c.h, c.depth,
    b.x, b.z, b.r, b.yMin, b.yMax].join(',');
}

/** Explicit intake; a fixture can admit these same immutable templates without fetch. */
export async function loadCoveGeometry(bytes: ReadonlyMap<string, Uint8Array | BufferGeometry>): Promise<void> {
  await Promise.all([
    templates.structure.load(bytes.get('coveStructure')),
    templates.rocks.load(bytes.get('coveRocks')),
    templates.glow.load(bytes.get('coveGlow')),
    templates.pools.load(bytes.get('covePools')),
  ]);
}

/** The authored island is one admitted layout. Refuse a different spec rather than draw geometry with mismatched collision. */
export function copyCoveGeometry(spec: CoveSpec): {
  geometry: Record<keyof typeof templates, BufferGeometry>;
  catalogue: CoveBake['catalogue'];
  native: CoveBake['native'];
} {
  const { specKey, catalogue, native } = bake();
  if (coveSpecKey(spec) !== specKey) throw new Error('Cove layout changed; regenerate its fixed geometry');
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
