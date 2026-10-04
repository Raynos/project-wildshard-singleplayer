// E306 / E315 M4: the models the fragment draws into its kits (../models/inKit.ts), registered on the kits' meshes once
// they are built — `place` with `drawnInto` (src/engine/models/place.ts): it draws nothing (the copy is the kit's geometry, with
// the region's neon spill baked in), carries each copy's world box and registers the model's catalog entry and a tap
// target on the kit's mesh. One `place` per model per kit.
import { Box3, type Mesh } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { poseOf } from '@wildshard/engine/models/colliders';
import { type ModelContext, type ModelDef, type ModelPart, type Placement, paramsOf } from '@wildshard/engine/models/model';
import { type Placed, place } from '@wildshard/engine/models/place';
import type { InKit } from './ctx';
import type { Kit } from './kit';

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

/** one `place` of a model on one kit's mesh (`kit`: the kit's name — which region of the fragment it is, for its Sets) */
export interface InKitPlaced { readonly kit: string; readonly placed: Placed }

/**
 * Register the recorded copies of one model on the meshes of the kits they were drawn into (`meshOf`: the mesh a Kit
 * became), one `place` per kit. A copy's params are the ones its builder was called with (recorded as they were drawn).
 */
export function registerInKit<P extends object>(ctx: ModelContext, copies: readonly InKit[], model: ModelDef<P>, meshOf: (k: Kit) => Mesh | undefined): InKitPlaced[] {
  const groups = new Map<Mesh, InKit[]>();
  for (const c of copies) {
    if (c.model !== model.id) continue;
    const mesh = meshOf(c.kit);
    if (mesh === undefined) throw new Error(`nine-dragon: a ${c.model} drawn into a kit that is no mesh of the fragment's`);
    let list = groups.get(mesh);
    if (list === undefined) { list = []; groups.set(mesh, list); }
    list.push(c);
  }
  const out: InKitPlaced[] = [];
  for (const [mesh, copiesHere] of groups) {
    const pls: Placement<P>[] = copiesHere.map((c) => c.at);
    const boxes = new Float32Array(pls.length * 6);
    pls.forEach((at, i) => { copyBox(ctx, model, at, copiesHere[i]?.box, boxes, i); });
    const placed = place(model, pls, { ctx, draw: 'merged', drawnInto: { object: mesh, boxes }, piece: { id: `nds-${model.id.slice(model.id.indexOf('/') + 1)}@${mesh.name.slice(4)}` } });
    out.push({ kit: mesh.name.slice(4), placed });
  }
  return out;
}
