/**
 * The drift log (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts): a sun-bleached beached log,
 * faceted and painted per facet by the one driftwood painter (src/shards/driftwood-isle/world/driftLogs.ts, E149) — silver on top, brown
 * underneath, a crack now and then, dark end grain. Every code-built log on the island is one: the wreck's piles on the
 * cove beach (src/shards/driftwood-isle/world/Wreck.ts) and the dune line's logs (src/shards/driftwood-isle/world/GroundCover.ts).
 *
 * Its own space: the log lies along x through the origin, its underside on the ground. The world lays each one between
 * two points on the terrain, painted where it lies (its facing picks its bleach), inside its own kit, and places the
 * model `drawnInto` that mesh. The Blender cove's TRELLIS driftwood is a different model (src/shards/driftwood-isle/models/cove.ts).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { addDriftLog } from '../world/driftLogs';

export interface DriftLogParams {
  /** length, metres */
  readonly len: number;
  /** radius at either end */
  readonly r0: number;
  readonly r1: number;
  /** body tone (0–2) */
  readonly tone: number;
}

export const driftLog = defineModel<DriftLogParams>({
  id: 'driftwood-isle/drift-log', name: 'Drift log', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/driftLog.ts', surface: 'wood',
  defaults: { len: 4, r0: 0.26, r1: 0.19, tone: 0 },
  variants: [
    { id: 'long', label: 'Long', params: {} }, { id: 'short', label: 'Short', params: { len: 2.6, r0: 0.18, r1: 0.12, tone: 1 } },
    { id: 'pale', label: 'Pale', params: { tone: 2 } },
  ],
  build: (ctx, p) => {
    const kit = new LowPolyKit(0xd21f7 ^ p.tone);
    addDriftLog(kit, new THREE.Vector3(-p.len / 2, p.r0 * 0.8, 0), new THREE.Vector3(p.len / 2, p.r1 * 0.8, 0), p.r0, p.r1, { sides: 7, twist: 0.3, tone: p.tone, wobble: 0.03 });
    return [{ geometry: kit.finish({ ao: { floorY: 0 } }), material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true }];
  },
});

/** a log laid from a to b (world) with radius r: its world box (a drawn-into copy's) */
export function driftLogBox(a: THREE.Vector3, b: THREE.Vector3, r: number, target: THREE.Box3): THREE.Box3 {
  return target.setFromPoints([a, b]).expandByScalar(r);
}
