/**
 * The facade kit's pieces (E306 / E315 M4): every piece that dresses a Kowloon wall of the towers and the Well —
 * balconies, window cages, condensers, laundry poles, eaves, railings, rooftop shacks and tanks … Each is built once in
 * the wall's frame by the facade lab's builders (../world/facade/pieces.ts: x along the wall, y up, +z out of the wall,
 * origin on the wall face), drawn by the facade's Jiehua program, and placed by the facade grammar
 * (../world/facade/batch.ts) as ONE InstancedMesh per piece over the whole fragment (E271 / E272: instancing, never
 * multi-draw), culled per copy by the fragment's E283 culler (../world/cull.ts). A copy's placement matrix carries the
 * grammar's non-uniform scale; its colour the wash. The pieces with parts thinner than a pixel from a distance drop
 * them there (PIECE_LODS, E283); the small clutter shrinks into the wall between 55 and 85 m (its program) and is not
 * drawn past 85 m. The few-and-small pieces (couplets, shutters, sign boards, window ACs, the wash on street lines,
 * awnings: FACADE_BAKED, E315 second pass) are models too, baked into the facade shell — the towers' built fabric, one
 * merged mesh that is drawn anyway — so they cost no draw of their own: the grammar records every copy and batch.ts
 * registers them on the shell (`place` with `drawnInto`).
 */
import type { BufferGeometry, Matrix4 } from 'three';
import { defineModel, type ModelContext, type ModelLod, type ModelPart, type ModelVariant } from '@wildshard/engine/models/model';
import { DRAWN_AS, PIECES, PIECE_LODS, SMALL, type PieceId } from '../world/facade/pieces';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/facade.ts';

/** a facade piece's params: which of its aliases the Explorer shows (batch.ts draws every alias as the one geometry) */
export interface FacadeParams {
  readonly alias?: PieceId;
}

/** the piece's geometry, built once per fragment */
function geo(ctx: ModelContext, id: PieceId): BufferGeometry {
  return ctx.once(`nds:facade:${id}`, () => PIECES[id]().build());
}

/** an alias's look for the Explorer: the drawn piece under the alias's own local transform */
function aliasGeo(ctx: ModelContext, id: PieceId, alias: PieceId): BufferGeometry {
  const a = DRAWN_AS[alias];
  const local: Matrix4 | undefined = a?.local;
  return local === undefined ? geo(ctx, id) : ctx.once(`nds:facade:${alias}@${id}`, () => geo(ctx, id).clone().applyMatrix4(local));
}

function parts(ctx: ModelContext, id: PieceId, geometry: BufferGeometry): readonly ModelPart[] {
  const f = need(ndLook(ctx).facade, 'the facade programs');
  return [{ geometry, material: SMALL.has(id) ? f.small : f.mat }];
}

const build = (id: PieceId) => (ctx: ModelContext, p: FacadeParams): readonly ModelPart[] =>
  parts(ctx, id, p.alias === undefined ? geo(ctx, id) : aliasGeo(ctx, id, p.alias));

/** the piece's distance LOD (E283 PIECE_LODS), if it has one */
function lods(id: PieceId): { lods: readonly ModelLod<FacadeParams>[] } | Record<never, never> {
  const l = PIECE_LODS[id];
  if (l === undefined) return {};
  return { lods: [{ from: l.from, build: (ctx) => parts(ctx, id, ctx.once(`nds:facade:${id}:far`, () => l.far().build())) }] };
}

const alias = (a: PieceId, label: string): ModelVariant<FacadeParams> => ({ id: a, label, params: { alias: a } });

export const facadeBalcony = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-balcony', name: 'Balcony (railed)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('balcony'), ...lods('balcony'),
});
export const facadeBalconySolid = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-balcony-solid', name: 'Balcony (carved parapet)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('balconySolid'), ...lods('balconySolid'),
});
export const facadeBalconyTimber = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-balcony-timber', name: 'Timber veranda balcony', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('balconyTimber'), ...lods('balconyTimber'),
});
export const facadeCage = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-cage', name: 'Window cage', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  variants: [alias('cageS', 'Narrow (1.5 m)'), alias('cageW', 'Wide (2.7 m)')],
  build: build('cage'), ...lods('cage'),
});
export const facadeAcUnit = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-ac-unit', name: 'Air-con condenser', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('acUnit'), ...lods('acUnit'),
});
export const facadePipe = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-pipe', name: 'Drain pipe', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('pipe'), ...lods('pipe'),
});
export const facadeLaundryOut = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-laundry-out', name: 'Laundry pole (out from the wall)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('laundryOut'), ...lods('laundryOut'),
});
export const facadeLaundryAlong = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-laundry-along', name: 'Laundry pole (along the wall)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('laundryAlong'), ...lods('laundryAlong'),
});
export const facadePlant = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-plant', name: 'Potted plant (sill)', category: 'nature', pipeline: 'code', file: FILE, defaults: {},
  build: build('plant'), ...lods('plant'),
});
export const facadePlanter = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-planter', name: 'Planter trough', category: 'nature', pipeline: 'code', file: FILE, defaults: {},
  build: build('planter'), ...lods('planter'),
});
export const facadeTank = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-tank', name: 'Rooftop water tank', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('tank'), ...lods('tank'),
});
export const facadeShack = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-shack', name: 'Rooftop shack (malachite · azurite roof)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('shack'), ...lods('shack'),
});
export const facadeBox = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-box', name: 'Wall box (ledge · bay box · gallery post)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  variants: [alias('ledge', 'Ledge'), alias('bayBox', 'Bay box'), alias('post', 'Gallery post')],
  build: build('box'), ...lods('box'),
});
export const facadeEave = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-eave', name: 'Pent eave strip', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('eave'), ...lods('eave'),
});
export const facadeRail = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-rail', name: 'Lattice railing', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('rail'), ...lods('rail'),
});
export const facadeAntenna = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-antenna', name: 'Antenna mast', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('antenna'), ...lods('antenna'),
});
export const facadeDish = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-dish', name: 'Satellite dish', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('dish'), ...lods('dish'),
});
export const facadeLantern = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-lantern', name: 'Wall lantern (red paper, facade)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('lantern'), ...lods('lantern'),
});

// ── the few-and-small pieces baked into the shell (BAKED) ──

export const facadeCouplet = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-couplet', name: 'Red paper couplet (春聯)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('couplet'),
});
export const facadeShutter = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-shutter', name: 'Roll shutter (a closed shop)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: build('shutter'),
});
export const facadeSignFlat = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-sign-flat', name: 'Flat sign board', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('signFlat'),
});
export const facadeSignBox = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-sign-box', name: 'Lit sign box', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('signBox'),
});
export const facadeAcBox = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-ac-box', name: 'Window air-con box', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('acBox'),
});
export const facadeWashLine = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-wash-line', name: 'Wash on a street line', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('washLine'),
});
export const facadeAwning = defineModel<FacadeParams>({
  id: 'nine-dragon-stack/facade-awning', name: 'Striped window awning', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: build('awning'),
});

/** the model each piece baked into the shell is (BAKED) */
export const FACADE_BAKED: Readonly<Partial<Record<PieceId, typeof facadeBalcony>>> = {
  couplet: facadeCouplet, shutter: facadeShutter, signFlat: facadeSignFlat, signBox: facadeSignBox, acBox: facadeAcBox, washLine: facadeWashLine, awning: facadeAwning,
};

/** the model that draws each facade piece id (an alias draws as the piece it names in DRAWN_AS) */
export const FACADE_MODELS: Readonly<Partial<Record<PieceId, typeof facadeBalcony>>> = {
  balcony: facadeBalcony, balconySolid: facadeBalconySolid, balconyTimber: facadeBalconyTimber, cage: facadeCage, acUnit: facadeAcUnit,
  pipe: facadePipe, laundryOut: facadeLaundryOut, laundryAlong: facadeLaundryAlong, plant: facadePlant, planter: facadePlanter, tank: facadeTank,
  shack: facadeShack, box: facadeBox, eave: facadeEave, rail: facadeRail, antenna: facadeAntenna, dish: facadeDish, lantern: facadeLantern,
};
