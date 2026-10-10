// drawnInto — models drawn into merged kit meshes, registered on them once they are built (SHARD-PLATFORM M3, ex Nine
// Dragon's world/inKit.ts, E306 / E315 M4). A builder writes a model's geometry straight into a kit (merged with its
// region, its baked light in it) and records the copy; once the kits are meshes, `place` with `drawnInto` (engine
// models/place.ts) draws nothing, carries each copy's world box and registers the model's catalog entry and a tap target
// on the kit's mesh. One `place` per model per kit mesh.
//
//   registerDrawnInto(ctx, copies, lionModel, (kit) => meshOf.get(kit), 'my-');   // piece ids `my-<model>@<kit>`
import { Box3, type Mesh } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { poseOf } from '@wildshard/engine/models/colliders';
import { type ModelContext, type ModelDef, type ModelPart, type Placement, paramsOf } from '@wildshard/engine/models/model';
import { type Placed, place } from '@wildshard/engine/models/place';

/** one copy of a model drawn into a kit: the model's id, the kit builder, its placement and, when measured, its world box */
export interface DrawnCopy<K> { readonly model: string; readonly kit: K; readonly at: Placement<object>; /** the copy's world bounds as drawn (else from its own build) */ readonly box?: Box3 }

/** one `place` of a model on one kit's mesh (`kit`: the mesh's name after its `<lane>:` prefix) */
export interface DrawnPlaced { readonly kit: string; readonly placed: Placed }

const _box = new Box3();

/** a copy's world box: as drawn when the world measured it, else its own build's bounds (built once per params, cached by
 *  the model) at its pose */
function copyBox<P extends object>(ctx: ModelContext, model: ModelDef<P>, at: Placement<P>, drawn: Box3 | undefined, out: Float32Array, i: number): void {
  if (drawn !== undefined) { out.set([drawn.min.x, drawn.min.y, drawn.min.z, drawn.max.x, drawn.max.y, drawn.max.z], i * 6); return; }
  const built = model.build(ctx, paramsOf(model, at.variant, at.params), new Rng(0));
  const box = new Box3();
  if (Array.isArray(built)) {
    for (const part of built as readonly ModelPart[]) {
      if (part.geometry.boundingBox === null) part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) box.union(_box.copy(part.geometry.boundingBox));
    }
  }
  box.applyMatrix4(poseOf(at).matrix);
  out.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z], i * 6);
}

/**
 * Register the recorded copies of one model on the meshes of the kits they were drawn into (`meshOf`: the mesh a kit
 * became; a kit mesh is named `<lane>:<kit>`), one `place` per kit mesh, its piece `<prefix><model>@<kit>` (the model's id
 * after its `<shard>/`). A copy's params are the ones its builder was called with.
 */
export function registerDrawnInto<P extends object, K>(ctx: ModelContext, copies: readonly DrawnCopy<K>[], model: ModelDef<P>, meshOf: (k: K) => Mesh | undefined, prefix: string): DrawnPlaced[] {
  const groups = new Map<Mesh, DrawnCopy<K>[]>();
  for (const c of copies) {
    if (c.model !== model.id) continue;
    const mesh = meshOf(c.kit);
    if (mesh === undefined) throw new Error(`drawnInto: a ${c.model} drawn into a kit that is no mesh of the world's`);
    let list = groups.get(mesh);
    if (list === undefined) { list = []; groups.set(mesh, list); }
    list.push(c);
  }
  const out: DrawnPlaced[] = [];
  for (const [mesh, copiesHere] of groups) {
    const pls: Placement<P>[] = copiesHere.map((c) => c.at);
    const boxes = new Float32Array(pls.length * 6);
    pls.forEach((at, i) => { copyBox(ctx, model, at, copiesHere[i]?.box, boxes, i); });
    const kit = mesh.name.slice(mesh.name.indexOf(':') + 1);
    const placed = place(model, pls, { ctx, draw: 'merged', drawnInto: { object: mesh, boxes }, piece: { id: `${prefix}${model.id.slice(model.id.indexOf('/') + 1)}@${kit}` } });
    out.push({ kit, placed });
  }
  return out;
}
