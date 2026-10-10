// E306 / E315 M4: the models the fragment draws into its kits (../models/inKit.ts), registered on the kits' meshes once
// they are built, by the SDK's drawn-into registration (@wildshard/sdk/kit/drawnInto): it draws nothing (the copy is the
// kit's geometry, with the region's neon spill baked in), carries each copy's world box and registers the model's catalog
// entry and a tap target on the kit's mesh, one `place` per model per kit, its piece `nds-<model>@<kit>`.
import type { Mesh } from 'three';
import type { ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { type DrawnPlaced, registerDrawnInto } from '@wildshard/sdk/kit/drawnInto';
import type { InKit } from './ctx';
import type { Kit } from './kit';

/** one `place` of a model on one kit's mesh (`kit`: the kit's name — which region of the fragment it is, for its Sets) */
export type InKitPlaced = DrawnPlaced;

/** Register the recorded copies of one model on the meshes of the kits they were drawn into (`meshOf`: the mesh a Kit became). */
export function registerInKit<P extends object>(ctx: ModelContext, copies: readonly InKit[], model: ModelDef<P>, meshOf: (k: Kit) => Mesh | undefined): InKitPlaced[] {
  return registerDrawnInto(ctx, copies, model, meshOf, 'nds-');
}
