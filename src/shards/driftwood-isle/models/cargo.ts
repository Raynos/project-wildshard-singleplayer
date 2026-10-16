/**
 * The wreck's cargo (E306 / E315 M1, second pass: models on the contract, src/engine/models/model.ts): the BARREL
 * (standing or lying), the CRATE (whole or broken) and the ROPE COIL. Their builders run offline
 * (src/shards/driftwood-isle/generators/cargo.ts): the wreck bakes them into its one kit, and the Explorer's lone
 * copies are fixed-model templates (`cargo-*`, AO'd on flat ground at the origin) loaded through the shard's geometry
 * intake. The world's copies are placed `drawnInto` the wreck's mesh (their collision stays the wreck's boxes), so only
 * a specimen ever draws one; a crate or coil of another size scales its baked template.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { CARGO_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';

type Template = (typeof CARGO_GEOMETRY)[keyof typeof CARGO_GEOMETRY];
/** a specimen of model `id`: its baked lone copy `kind` (scaled by `k`), or a loading box until the island's templates are in */
function specimen(ctx: ModelContext, id: string, kind: keyof typeof CARGO_GEOMETRY, size: readonly [number, number, number], k = 1): readonly ModelPart[] | THREE.Object3D {
  const template: Template = CARGO_GEOMETRY[kind];
  const part = (): ModelPart => ({ geometry: ctx.once(`${id}:${kind}:${k}`, () => (k === 1 ? template.copy() : template.copy().scale(k, k, k))),
    material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true });
  if (fixedGeometryReady()) return [part()];
  return loadingSpecimen(id, size, async () => {
    await loadFixedGeometry();
    const p = part(), mesh = new THREE.Mesh(p.geometry, p.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  });
}

export interface BarrelParams { readonly lying: boolean }
export const barrel = defineModel<BarrelParams>({
  id: 'driftwood-isle/barrel', name: 'Barrel', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { lying: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'lying', label: 'Lying', params: { lying: true } }],
  // the specimen: a standing barrel's foot on the origin (its centre 0.45 up), a lying one's side on it
  build: (ctx, p) => p.lying ? specimen(ctx, 'driftwood-isle/barrel', 'lying', [0.9, 0.78, 0.78])
    : specimen(ctx, 'driftwood-isle/barrel', 'barrel', [0.78, 0.9, 0.78]),
});

export interface CrateParams { readonly size: number; readonly broken: boolean }
export const crate = defineModel<CrateParams>({
  id: 'driftwood-isle/crate', name: 'Crate', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { size: 0.8, broken: false },
  variants: [
    { id: 'big', label: 'Big', params: {} }, { id: 'small', label: 'Small', params: { size: 0.55 } },
    { id: 'broken', label: 'Broken', params: { size: 0.7, broken: true } },
  ],
  build: (ctx, p) => specimen(ctx, 'driftwood-isle/crate', p.broken ? 'broken' : 'crate', [p.size, p.size, p.size],
    p.size / (p.broken ? 0.7 : 0.8)),
});

export interface CoilParams { readonly r: number }
export const ropeCoil = defineModel<CoilParams>({
  id: 'driftwood-isle/rope-coil', name: 'Rope coil', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/cargo.ts', surface: 'wood',
  defaults: { r: 0.3 },
  build: (ctx, p) => specimen(ctx, 'driftwood-isle/rope-coil', 'coil', [2 * p.r, 0.18, 2 * p.r], p.r / 0.3),
});
