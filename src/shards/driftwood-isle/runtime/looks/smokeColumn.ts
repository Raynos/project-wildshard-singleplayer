import * as THREE from 'three';
import type { SmokeColumnRow } from './rows';
import { SMOKE_LOOK } from '../const';
import { CASTAWAY_SMOKE_GEOMETRY, fixedGeometryReady } from '../boot/fixedGeometry';

/**
 * A thin, broken smoke column off a fire (SHARD-PLATFORM W2 C2): ONE mesh of camera-facing puff quads that the smoke's
 * material graph (data/smokeLook.ts, the shardfile's look.materials) poses and fades on the frame clock; nothing moves on
 * the CPU. Its quads (each puff's corner, uv and `aPuff` from the row's LCG) are baked offline (generators/smoke.ts) and
 * loaded as the fixed-model template `castaway-smoke`. Without the compiled graph or the templates (a page that builds
 * the castaway outside the hybrid world) the column is not drawn.
 *
 *   const smoke = new SmokeColumn(row, fireLocal);   // in the parent's frame
 *   group.add(smoke.mesh);
 */

let look: THREE.Material | null = null;
/** hand the smoke its compiled graph (look.materials, data/smokeLook.ts) before the castaway builds */
export function setSmokeLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(SMOKE_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the smoke graph');
  look = material;
}

/** A smoke column (one draw) rising from a fire in its parent's frame. */
export class SmokeColumn {
  /** the column: add it to the fire's parent */
  readonly mesh: THREE.Mesh;

  constructor(row: SmokeColumnRow, at: THREE.Vector3) {
    // the column's quads are baked offline (generators/smoke.ts: the castaway's row), a fixed-model template
    const g = fixedGeometryReady() ? CASTAWAY_SMOKE_GEOMETRY.copy() : new THREE.BufferGeometry();
    const o = row.bounds.offset;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(o[0], o[1], o[2]), row.bounds.radius);
    this.mesh = new THREE.Mesh(g, look ?? undefined);
    this.mesh.name = row.name;
    this.mesh.position.copy(at);
    this.mesh.renderOrder = row.renderOrder;
    this.mesh.visible = look !== null && fixedGeometryReady();
  }
}
