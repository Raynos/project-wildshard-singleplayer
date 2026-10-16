/**
 * The wreck's cargo (E306 / E315 M1, second pass: models on the contract, src/engine/models/model.ts): the BARREL
 * (standing or lying), the CRATE (whole or broken) and the ROPE COIL. Their builders run offline
 * (src/shards/driftwood-isle/generators/cargo.ts): the wreck bakes them into its one kit, and the Explorer's lone
 * copies are fixed-model templates (`cargo-*`, AO'd on flat ground at the origin) loaded through the shard's geometry
 * intake. The world's copies are placed `drawnInto` the wreck's mesh (their collision stays the wreck's boxes), so only
 * a specimen ever draws one; a crate or coil of another size scales its baked template.
 */
import { defineModel, type ModelContext, type ModelPart, type ModelDef } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { CARGO_GEOMETRY, loadFixedGeometry } from '../boot/fixedGeometry';

type Template = (typeof CARGO_GEOMETRY)[keyof typeof CARGO_GEOMETRY];
/** A prepared specimen's baked lone copy, scaled without changing its template. */
function specimen(ctx: ModelContext, id: string, kind: keyof typeof CARGO_GEOMETRY, k = 1): readonly ModelPart[] {
  const template: Template = CARGO_GEOMETRY[kind];
  return [{ geometry: ctx.once(`${id}:${kind}:${k}`, () => (k === 1 ? template.copy() : template.copy().scale(k, k, k))),
    material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true }];
}

/** Existing card differences, with one preparation and catalog declaration for the cargo family. */
function cargoModel<P extends object>(row: Pick<ModelDef<P>, 'id' | 'name' | 'defaults' | 'variants' | 'build'>): ModelDef<P> {
  return defineModel({ ...row, category: 'props', pipeline: 'code', surface: 'wood',
    file: 'src/shards/driftwood-isle/runtime/models/cargo.ts', prepare: loadFixedGeometry });
}

export interface BarrelParams { readonly lying: boolean }
export const barrel = cargoModel<BarrelParams>({
  id: 'driftwood-isle/barrel', name: 'Barrel',
  defaults: { lying: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'lying', label: 'Lying', params: { lying: true } }],
  // the specimen: a standing barrel's foot on the origin (its centre 0.45 up), a lying one's side on it
  build: (ctx, p) => p.lying ? specimen(ctx, 'driftwood-isle/barrel', 'lying')
    : specimen(ctx, 'driftwood-isle/barrel', 'barrel'),
});

export interface CrateParams { readonly size: number; readonly broken: boolean }
export const crate = cargoModel<CrateParams>({
  id: 'driftwood-isle/crate', name: 'Crate',
  defaults: { size: 0.8, broken: false },
  variants: [
    { id: 'big', label: 'Big', params: {} }, { id: 'small', label: 'Small', params: { size: 0.55 } },
    { id: 'broken', label: 'Broken', params: { size: 0.7, broken: true } },
  ],
  build: (ctx, p) => specimen(ctx, 'driftwood-isle/crate', p.broken ? 'broken' : 'crate',
    p.size / (p.broken ? 0.7 : 0.8)),
});

export interface CoilParams { readonly r: number }
export const ropeCoil = cargoModel<CoilParams>({
  id: 'driftwood-isle/rope-coil', name: 'Rope coil',
  defaults: { r: 0.3 },
  build: (ctx, p) => specimen(ctx, 'driftwood-isle/rope-coil', 'coil', p.r / 0.3),
});
