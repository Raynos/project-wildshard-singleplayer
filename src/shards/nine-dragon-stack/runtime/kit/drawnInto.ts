// drawnInto — models drawn into merged kit meshes, registered on them once they are built (SHARD-PLATFORM M3, ex Nine
// Dragon's world/inKit.ts, E306 / E315 M4). A builder writes a model's geometry straight into a kit (merged with its
// region, its baked light in it) and records the copy; once the kits are meshes, `place` with `drawnInto` (engine
// models/place.ts) draws nothing, carries each copy's world box as drawn (the layout bake measures every copy) and
// registers the model's catalog entry and a tap target on the kit's mesh. One `place` per model per kit mesh.
//
//   registerDrawnInto(ctx, copies, lionModel, (kit) => meshOf.get(kit), 'my-');   // piece ids `my-<model>@<kit>`
import type { Box3, Mesh } from 'three';
import type { ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
import { type Placed, place } from '@wildshard/engine/models/place';

/** one copy of a model drawn into a kit: the model's id, the kit builder, its placement and its world box as drawn */
export interface DrawnCopy<K> { readonly model: string; readonly kit: K; readonly at: Placement<Record<string, unknown>>; readonly box: Box3 }

/** one `place` of a model on one kit's mesh (`kit`: the mesh's name after its `<lane>:` prefix) */
export interface DrawnPlaced { readonly kit: string; readonly placed: Placed }

/**
 * Register the recorded copies of one model on the meshes of the kits they were drawn into (`meshOf`: the mesh a kit
 * became; a kit mesh is named `<lane>:<kit>`), one `place` per kit mesh, its piece `<prefix><model>@<kit>` (the model's id
 * after its `<shard>/`). A copy's params are the ones its builder was called with.
 */
export function registerDrawnInto<K>(ctx: ModelContext, copies: readonly DrawnCopy<K>[], model: ModelDef<Record<string, unknown>>, meshOf: (k: K) => Mesh | undefined, prefix: string): DrawnPlaced[] {
  const mine = copies.filter(c => c.model === model.id), meshFor = (c: DrawnCopy<K>): Mesh => {
    const mesh = meshOf(c.kit);
    if (mesh === undefined) throw new Error(`drawnInto: a ${c.model} drawn into a kit that is no mesh of the world's`);
    return mesh;
  };
  return [...new Set(mine.map(meshFor))].map(mesh => {
    const copiesHere = mine.filter(c => meshFor(c) === mesh), pls = copiesHere.map(c => c.at), boxes = new Float32Array(pls.length * 6);
    copiesHere.forEach(({ box }, i) => { boxes.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z], i * 6); });
    const kit = mesh.name.slice(mesh.name.indexOf(':') + 1);
    return { kit, placed: place(model, pls, { ctx, draw: 'merged', drawnInto: { object: mesh, boxes }, piece: { id: `${prefix}${model.id.slice(model.id.indexOf('/') + 1)}@${kit}` } }) };
  });
}
