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
import { fixedDraw, loadFixedGeometry, fixedGeometryGroups } from '../boot/blobAssets';

/** Every wooden card copies the same prepared template before applying its authored scale. */
function specimen(ctx: ModelContext, key: string, template: { copy: () => ModelPart['geometry'] }, sx = 1, sy = sx, sz = sy): readonly ModelPart[] {
  return [{ geometry: ctx.once(key, () => {
    const geometry = template.copy();
    return sx === 1 && sy === 1 && sz === 1 ? geometry : geometry.scale(sx, sy, sz);
  }), material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: true, receiveShadow: true }];
}
function cargoSpecimen(ctx: ModelContext, id: string, kind: keyof ReturnType<typeof fixedGeometryGroups>['cargo'], k = 1): readonly ModelPart[] {
  return specimen(ctx, `${id}:${kind}:${k}`, fixedDraw(fixedGeometryGroups().cargo[kind]), k);
}

/** Existing card differences, with one preparation and catalog declaration for the cargo family. */
function cargoModel<P extends object>(row: Pick<ModelDef<P>, 'id' | 'name' | 'defaults' | 'variants' | 'build'> & { readonly category?: 'props' | 'nature' }): ModelDef<P> {
  return defineModel({ ...row, category: row.category ?? 'props', pipeline: 'code', surface: 'wood',
    file: 'src/shards/driftwood-isle/runtime/models/cargo.ts', prepare: loadFixedGeometry });
}

export interface BarrelParams { readonly lying: boolean }
export const barrel = cargoModel<BarrelParams>({
  id: 'driftwood-isle/barrel', name: 'Barrel',
  defaults: { lying: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'lying', label: 'Lying', params: { lying: true } }],
  // the specimen: a standing barrel's foot on the origin (its centre 0.45 up), a lying one's side on it
  build: (ctx, p) => p.lying ? cargoSpecimen(ctx, 'driftwood-isle/barrel', 'lying')
    : cargoSpecimen(ctx, 'driftwood-isle/barrel', 'barrel'),
});

export interface CrateParams { readonly size: number; readonly broken: boolean }
export const crate = cargoModel<CrateParams>({
  id: 'driftwood-isle/crate', name: 'Crate',
  defaults: { size: 0.8, broken: false },
  variants: [
    { id: 'big', label: 'Big', params: {} }, { id: 'small', label: 'Small', params: { size: 0.55 } },
    { id: 'broken', label: 'Broken', params: { size: 0.7, broken: true } },
  ],
  build: (ctx, p) => cargoSpecimen(ctx, 'driftwood-isle/crate', p.broken ? 'broken' : 'crate',
    p.size / (p.broken ? 0.7 : 0.8)),
});

export interface CoilParams { readonly r: number }
export const ropeCoil = cargoModel<CoilParams>({
  id: 'driftwood-isle/rope-coil', name: 'Rope coil',
  defaults: { r: 0.3 },
  build: (ctx, p) => cargoSpecimen(ctx, 'driftwood-isle/rope-coil', 'coil', p.r / 0.3),
});

export interface DriftLogParams {
  /** length, metres */
  readonly len: number;
  /** radius at either end */
  readonly r0: number;
  readonly r1: number;
  /** body tone (0–2) */
  readonly tone: number;
}

/** each tone's baked template and the log it was baked at (generators/driftLogs.ts DRIFT_SPECIMENS) */
const DRIFT_LOG_TEMPLATES = [
  { kind: 'long', len: 4, r0: 0.26 }, { kind: 'short', len: 2.6, r0: 0.18 }, { kind: 'pale', len: 4, r0: 0.26 },
] as const;

export const driftLog = cargoModel<DriftLogParams>({
  id: 'driftwood-isle/drift-log', name: 'Drift log', category: 'nature',
  defaults: { len: 4, r0: 0.26, r1: 0.19, tone: 0 },
  variants: [
    { id: 'long', label: 'Long', params: {} }, { id: 'short', label: 'Short', params: { len: 2.6, r0: 0.18, r1: 0.12, tone: 1 } },
    { id: 'pale', label: 'Pale', params: { tone: 2 } },
  ],
  build: (ctx, p) => {
    const t = DRIFT_LOG_TEMPLATES[((Math.round(p.tone) % 3) + 3) % 3] ?? DRIFT_LOG_TEMPLATES[0], sx = p.len / t.len, sr = p.r0 / t.r0;
    return specimen(ctx, `driftwood-isle/drift-log:${t.kind}:${sx}:${sr}`, fixedDraw(fixedGeometryGroups().driftLogs[t.kind]), sx, sr, sr);
  },
});
