import * as THREE from 'three';
import * as v from 'valibot';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { CullOptions, CullView } from '@wildshard/engine/models/cull';
import type { Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { BOULDER_SHAPES, loadMossyBoulder, mossyBoulder, type MossyBoulderParams } from '../models/mossyBoulder';
import { loadTreeStump, treeStump } from '../models/treeStump';
import { fallenLog, loadFallenLog } from '../models/fallenLog';
import { pineModels } from './context';
import propJson from '../data/props.json' with { type: 'json' };

/**
 * Pine Hollow's forest props (E315 M2: the scatter; the things are models in ../models/): mossy boulders
 * (`pine-hollow/mossy-boulder`, six shapes), cut stumps (`pine-hollow/tree-stump`) and fallen logs
 * (`pine-hollow/fallen-log`), all Poly Haven CC0 photoscans.
 *
 *   const props = new Props(sky, forest, renderer);
 *   await props.build(registry, macrotask);      // places and registers them; `registry` null: a dev page / the bake
 *
 * Where they stand is an offline bake (G285, SF72 "bake the code-built worlds"): `../generators/props.ts` scatters them at
 * build time over the page's own baked terrain, the scans' footprints and the forest's trunks (`scripts/bake-pine-props.mjs`),
 * and `../data/props.json` holds every copy's pose. Drawing is `place`'s: the six rock shapes share the scan's material, so
 * they are ONE BatchedMesh where multi-draw exists (one InstancedMesh per shape without), stumps and logs one InstancedMesh
 * per scan part; every copy is culled by range, angular size and the forest's padded view frustum (`cull.view`: the
 * forest's buckets refill).
 *
 * PHYSICS P3: rocks showing more than ROCK_SOLID_ABOVE above the ground and every stump collide as the hull of their
 * support points, fallen logs as one capsule lying along the log (the models' own-space colliders, placed per copy).
 */

const num = v.pipe(v.number(), v.finite());
/** a copy's pose: position, rotation (quaternion x, y, z, w), uniform scale */
const Pose = v.tuple([num, num, num, num, num, num, num, num]);
export type PropPose = v.InferOutput<typeof Pose>;
/** a rock: its shape (0–5), solid (1: it shows more than ROCK_SOLID_ABOVE above the ground), its pose */
const Rock = v.tuple([v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(BOULDER_SHAPES.length - 1)), v.picklist([0, 1]), num, num, num, num, num, num, num, num]);
export const PropRowsSchema = v.strictObject({ rocks: v.array(Rock), stumps: v.array(Pose), logs: v.array(Pose) });
export type PropRows = v.InferOutput<typeof PropRowsSchema>;
/** the bake's rows, parsed strictly once */
export const PROP_ROWS: PropRows = v.parse(PropRowsSchema, propJson);

/** a placement at a baked pose (the matrix the scatter composed, from the same numbers) */
function at<P extends object>([x, y, z, qx, qy, qz, qw, s]: PropPose, extra: Omit<Placement<P>, 'x' | 'y' | 'z' | 'matrix'> = {}): Placement<P> {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(qx, qy, qz, qw), new THREE.Vector3(s, s, s));
  return { x, y, z, matrix, ...extra };
}

export class Props {
  /** what the dev page / the bake add to a scene (registered builds are added by the registry) */
  readonly group = new THREE.Group();
  readonly counts = { rocks: PROP_ROWS.rocks.length, stumps: PROP_ROWS.stumps.length, logs: PROP_ROWS.logs.length };
  /** the three place calls: boulders, stumps, logs */
  readonly placed: Placed[] = [];

  constructor(private sky: Sky, private forest: CullView, private renderer: Renderer | null = null) {}

  /** load the scans and place them at the baked poses — registered on `registry` (the colliders a task apart), or only built */
  async build(registry: WorldRegistry | null = null, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<THREE.Group> {
    const ctx = pineModels(this.sky, this.renderer);
    await Promise.all([loadMossyBoulder(ctx), loadTreeStump(ctx), loadFallenLog(ctx)]);
    const cull: CullOptions = { far: TIER_CONFIG.propsFar, keepNear: 40, minAngular: TIER_CONFIG.propsMinAngular, view: this.forest, bounds: 'sphere' };
    const rocks = PROP_ROWS.rocks.map(([k, solid, ...pose]) => at<MossyBoulderParams>(pose, { variant: BOULDER_SHAPES[k] ?? 'a', params: { solid: solid === 1 } }));
    const solid = rocks.filter((p) => p.params?.solid === true).length;
    // P3: rocks and stumps as hulls, logs as capsules — the rocks' hulls in two pieces a task apart, the wood in a third
    // (the phone's 30 ms per-task collider budget)
    const boulders = place(mossyBoulder, rocks, { ctx, draw: 'batched', sortObjects: false, cull, registry,
      piece: { id: 'props', split: { every: Math.max(1, Math.ceil(solid / 2)), yieldTask } } });
    await boulders.registered;
    await yieldTask();
    const stumps = place(treeStump, PROP_ROWS.stumps.map((p) => at(p)), { ctx, draw: 'instanced', cull, registry, piece: { id: 'props-stumps' } });
    const logs = place(fallenLog, PROP_ROWS.logs.map((p) => at(p)), { ctx, draw: 'instanced', cull, registry, piece: { id: 'props-wood' } });
    this.placed.push(boulders, stumps, logs);
    if (registry === null) this.group.add(boulders.object, stumps.object, logs.object);
    return this.group;
  }

  /** every placed collider, world space (the navmesh bake) */
  colliderDescs(): ColliderDesc[] { return this.placed.flatMap((p) => p.colliders); }
}
