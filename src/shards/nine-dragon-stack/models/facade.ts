/**
 * The facade kit's pieces (E306 / E315 M4): every piece that dresses a Kowloon wall of the towers and the Well —
 * balconies, window cages, condensers, laundry poles, eaves, railings, rooftop shacks and tanks … Each is built once in
 * the wall's frame by the facade lab's builders (../generators/facadePieces.ts, baked: x along the wall, y up, +z out of the wall,
 * origin on the wall face), drawn by the facade's Jiehua program, and placed by the facade grammar
 * (../world/facade/batch.ts) as ONE InstancedMesh per piece over the whole fragment (E271 / E272: instancing, never
 * multi-draw), culled per copy by the fragment's E283 culler (@wildshard/sdk/cull/instanceCuller). A copy's placement matrix carries the
 * grammar's non-uniform scale; its colour the wash. The pieces with parts thinner than a pixel from a distance drop
 * them there (PIECE_LOD_FROM, E283); the small clutter shrinks into the wall between 55 and 85 m (its program) and is not
 * drawn past 85 m. The few-and-small pieces (couplets, shutters, sign boards, window ACs, the wash on street lines,
 * awnings: FACADE_BAKED, E315 second pass) are models too, baked into the facade shell — the towers' built fabric, one
 * merged mesh that is drawn anyway — so they cost no draw of their own: the grammar records every copy and batch.ts
 * registers them on the shell (`place` with `drawnInto`). SHARD-PLATFORM M3: the cards are rows (data/facadeModels.ts).
 */
import type { BufferGeometry, Matrix4 } from 'three';
import { defineModel, type ModelContext, type ModelDef, type ModelLod, type ModelPart, type ModelVariant } from '@wildshard/engine/models/model';
import { DRAWN_AS, PIECE_LOD_FROM, SMALL, type PieceId, isPiece } from '../world/facade/pieceIds';
import { FACADE_MODEL_ROWS, type FacadeModelRow } from '../data/facadeModels';
import { ndLook, need, specimen } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/facade.ts';

/** a facade piece's params: which of its aliases the Explorer shows (batch.ts draws every alias as the one geometry) */
export interface FacadeParams {
  readonly alias?: PieceId;
}

/** the piece's geometry, read once per fragment (G285: baked, ../generators/specimens.ts `facade:<id>`) */
function geo(ctx: ModelContext, id: PieceId): BufferGeometry {
  return specimen(ctx, `facade:${id}`);
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
  const from = PIECE_LOD_FROM[id];
  if (from === undefined) return {};
  return { lods: [{ from, build: (ctx) => parts(ctx, id, specimen(ctx, `facade:${id}:far`)) }] };
}

const alias = (a: PieceId, label: string): ModelVariant<FacadeParams> => ({ id: a, label, params: { alias: a } });

const pieceOf = (s: string): PieceId => { if (!isPiece(s)) throw new Error(`facade: '${s}' is no facade piece (data/facadeModels.ts)`); return s; };

/** one card of data/facadeModels.ts: the piece's geometry, its aliases as variants, its distance LOD unless the shell bakes it */
function facadeModel(row: FacadeModelRow): ModelDef<FacadeParams> {
  const id = pieceOf(row.piece);
  return defineModel<FacadeParams>({
    id: `nine-dragon-stack/${row.slug}`, name: row.name, category: row.category, pipeline: 'code', file: FILE, defaults: {},
    ...(row.variants === undefined ? {} : { variants: row.variants.map(([a, label]) => alias(pieceOf(a), label)) }),
    build: build(id), ...(row.baked === true ? {} : lods(id)),
  });
}

const CARDS = FACADE_MODEL_ROWS.map((row) => ({ row, model: facadeModel(row) }));
const byPiece = (baked: boolean): Readonly<Partial<Record<PieceId, ModelDef<FacadeParams>>>> =>
  Object.fromEntries(CARDS.filter((c) => (c.row.baked === true) === baked).map((c) => [pieceOf(c.row.piece), c.model]));

/** the model each piece baked into the shell is (BAKED) */
export const FACADE_BAKED: Readonly<Partial<Record<PieceId, ModelDef<FacadeParams>>>> = byPiece(true);

/** the model that draws each facade piece id (an alias draws as the piece it names in DRAWN_AS) */
export const FACADE_MODELS: Readonly<Partial<Record<PieceId, ModelDef<FacadeParams>>>> = byPiece(false);
