/**
 * The mossy boulder (E315 M2): Poly Haven's CC0 `rock_moss_set_01` photoscan, meshoptimizer-simplified
 * (`public/assets/models/rock_moss_set_01/rock_moss_set_01_lod.glb`, scripts/simplify-models.mjs). The set holds six
 * rocks: each is a variant, recentred so it stands on its own base at the origin. All six share the scan's one
 * material, so a forest of them is ONE BatchedMesh draw where multi-draw exists (else one InstancedMesh per shape).
 * A copy that shows more than ROCK_SOLID_ABOVE above the ground collides as its support-point hull (src/engine/models/hull.ts);
 * a lower one is walked over (the capsule's 0.35 m autostep). Placed by src/shards/pine-hollow/world/props.ts along the
 * trails and slopes.
 *
 *   await loadMossyBoulder(ctx);   // place() is synchronous: the GLB first
 */
import * as THREE from 'three';
import { loadLod, prepModel } from '../world/homestead';
import { bakePart, supportPoints } from '@wildshard/engine/models/hull';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';

/** a copy collides once this much of it shows above the ground (P3); lower ones the capsule's autostep walks over */
export const ROCK_SOLID_ABOVE = 0.35;

export const BOULDER_SHAPES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export interface MossyBoulderParams {
  /** which of the set's six rocks (0–5) */
  readonly shape: number;
  /** collides (its placement decided: enough of it shows above the ground) */
  readonly solid: boolean;
}

/** one rock of the set in its own space: the drawn part and its hull (its footprint is the props bake's, ../generators/props.ts) */
interface Shape { geometry: THREE.BufferGeometry; material: THREE.Material; hull: Float32Array }

const KEY = 'pine-hollow/mossy-boulder';

/** Load the scan into this shard's context (once). */
export async function loadMossyBoulder(ctx: ModelContext): Promise<void> {
  const gltf = await loadLod('rock_moss_set_01');
  ctx.once(KEY, () => prepModel(gltf.scene, ctx.sky).map((p): Shape => {
    const g = p.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox ?? new THREE.Box3(), c = bb.getCenter(new THREE.Vector3());
    const local = new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z); // centred, base on y = 0
    const hull = supportPoints(g, local);
    return { geometry: bakePart(g, local), material: p.material, hull };
  }));
}

const shapes = (ctx: ModelContext): Shape[] => ctx.once<Shape[]>(KEY, () => { throw new Error('[mossy-boulder] loadMossyBoulder(ctx) first'); });

export const mossyBoulder = defineModel<MossyBoulderParams>({
  id: 'pine-hollow/mossy-boulder', name: 'Mossy boulder', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/mossyBoulder.ts', surface: 'rock',
  defaults: { shape: 0, solid: true },
  variants: BOULDER_SHAPES.map((id, k) => ({ id, label: `Rock ${id.toUpperCase()}`, params: { shape: k } })),
  build: (ctx, p) => {
    const s = shapes(ctx)[p.shape];
    return s ? [{ geometry: s.geometry, material: s.material, castShadow: true, receiveShadow: true }] : [];
  },
  colliders: (p, ctx) => {
    const s = shapes(ctx)[p.shape];
    return p.solid && s ? [{ kind: 'hull', x: 0, y: 0, z: 0, points: s.hull }] : [];
  },
});
