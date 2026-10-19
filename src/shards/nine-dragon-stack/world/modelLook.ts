// E306 / E315 M4: what Nine Dragon's models (../models/) take from the fragment's build — the Jiehua programs, the
// look's atlases, the loaded TRELLIS geometry, the sets built in the square's own rng stream — through their model
// context's `once` (src/engine/models/model.ts). One context per built fragment: build.ts makes it first, fills the look as
// each phase has made its part (the materials are created at the same points as before, so their order — which three's
// opaque sort keys on — is unchanged), and places the models; the Model Explorer's specimens read the same look later.
import { type BufferGeometry, Group, Matrix4, type Material, Mesh } from 'three';
import { modelContext, type ModelBuild, type ModelContext, type ModelPart, type ModelDef } from '@wildshard/engine/models/model';
import { defineWorldSceneCatalogue, bindWorldSceneModelSources } from '@wildshard/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { BakedSigns } from './casts';
import { createOwnedGeometryBatch, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { Scope } from '@wildshard/engine/app/scope';
import type { GeometryBoot } from '../runtime/productSections.generated';

type SpecimenBake = Map<string, OwnedGeometry>;
/** Existing owned templates hold exact boot and lazy Explorer draws. */
export async function loadSpecimens(owner: Scope, part: 'boot' | 'explorer'): Promise<SpecimenBake> {
  const product = await loadFirstPartyProduct('nine-dragon-stack', owner);
  const { library: rows } = await product.json<GeometryBoot>('geometry/layout.json');
  const views = await readWholeGeometry(owner, product.shardfile, rows[part]), batch = createOwnedGeometryBatch(), result: SpecimenBake = new Map();
  if (views.size > 86) throw new Error('Nine specimen draw bound exceeded');
  for (const [key, view] of views) {
    if (!view.matrix.equals(new Matrix4())) throw new Error(`Nine specimen ${key} changed its identity placement`);
    if (rows.specimenBoxes[key] === true) view.geometry.computeBoundingBox(); else view.geometry.boundingBox = null;
    const handle = batch.geometry(key); handle.adopt(view.geometry); view.release?.(); result.set(key, handle);
  }
  return result;
}
/** Transfer each original template exactly once to its native model context. */
export function takeSpecimen(bake: SpecimenBake, key: string): BufferGeometry {
  const handle = need(bake.get(key), `specimen ${key}`); bake.delete(key); return handle.take();
}

export interface NdLook {
  /** The explicit resident owner; Explorer requests may supply their shorter-lived view scope. */
  readonly owner: Scope;
  /** the facade kit's programs (facade/batch.ts): the pieces, and the small clutter that shrinks into the wall far off */
  facade: { readonly mat: Material; readonly small: Material } | null;
  /** the paper lanterns' look (look/lanterns.ts: the 'nine-lantern' graph) */
  lantern: Material | null;
  /** the 'nine-neon' look over the sign atlas (the drones' lights) and the atlas */
  neon: { readonly mat: Material; readonly atlas: BakedSigns } | null;
  /** meshoptimizer is ready (../runtime/cull/meshLod `lodReady`): the sculpts' distance LODs are simplified copies; else a sculpt's
   *  LOD is its own full geometry, which the fragment's culler leaves out */
  canLod: boolean;
  /** loaded geometry by name: the TRELLIS casts (`lion`, `walker-dark` …, `dragon-hook`) and the square's sets as the
   *  world built them (`booth`: its cook drew from the market row's stream, stalls.ts) */
  readonly geo: Map<string, BufferGeometry>;
  /** the Fei Zhua cast's brass (from its GLB's own material) */
  hookMat: Material | null;
  /** the banyan's painted canopy programs (world/canopy.ts `buildCanopy`: its core, its cards, the cards' depth pass;
   *  null while unbuilt, or when the leaf atlas failed and the tree stands bare) */
  canopy: { readonly core: Material; readonly cards: Material; readonly depth: Material } | null;
  /** G285: the code-built models' baked geometry (world/modelLook.ts): what the page builds at load, loaded with the layout */
  specimens: SpecimenBake | null;
  /** …and what only the Explorer's specimens draw, fetched the first time one asks (`withSpecimens`) */
  explorer: Promise<SpecimenBake> | SpecimenBake | null;
}

const KEY = 'nine-dragon-stack:look';

/** the fragment's model context and its (still empty) look */
export function ndModelContext(renderer: Renderer | null, owner: Scope, sky: SkyRig): { ctx: ModelContext; look: NdLook } {
  const look: NdLook = { owner, facade: null, lantern: null, neon: null, canLod: false, geo: new Map(), hookMat: null, canopy: null, specimens: null, explorer: null };
  const ctx = modelContext(sky, renderer);
  ctx.once(KEY, () => look);
  return { ctx, look };
}

/** the look a Nine Dragon model builds with */
export function ndLook(ctx: ModelContext): NdLook {
  return ctx.once<NdLook>(KEY, () => { throw new Error('a Nine Dragon model built outside its fragment\'s model context (world/modelLook.ts)'); });
}

/** a part of the look that must be in by now */
export function need<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Error(`Nine Dragon models: ${what} is not built yet (world/build.ts fills the look before placing)`);
  return v;
}

/** a code-built model's geometry from the specimens bakes (world/modelLook.ts), read once per model context under `key`
 *  (the page's bake hands its bytes over: the context keeps the geometry) */
export function specimen(ctx: ModelContext, key: string): BufferGeometry {
  return ctx.once(`nds:${key}`, () => {
    const look = ndLook(ctx), boot = need(look.specimens, 'the specimens bake'), explorer = look.explorer;
    if (!boot.has(key) && explorer !== null && !(explorer instanceof Promise)) return need(explorer.get(key), `specimen ${key}`).copy();
    return takeSpecimen(boot, key);
  });
}

/** a fresh copy of a baked model geometry (a model whose every build drew its own, as the movers' do) */
export function bakedSpecimen(ctx: ModelContext, key: string): BufferGeometry {
  return need(need(ndLook(ctx).specimens, 'the specimens bake').get(key), `specimen ${key}`).copy();
}

/**
 * An Explorer specimen whose geometry is in the Explorer's bake: its parts once the bake is in; until then the engine's
 * loading box, filled when the bake lands (`loadingSpecimen`: the Explorer re-frames the card on `ws:model-ready`).
 */
export function withSpecimens(ctx: ModelContext, id: string, parts: () => readonly ModelPart[]): ModelBuild {
  const look = ndLook(ctx);
  if (look.explorer !== null && !(look.explorer instanceof Promise)) return parts();
  const pending = look.explorer ?? loadSpecimens(ctx.specimenScope ?? look.owner, 'explorer').catch((e: unknown) => { look.explorer = null; throw e; });
  look.explorer = pending;
  return loadingSpecimen(id, [1, 1, 1], async () => {
    look.explorer = await pending;
    const group = new Group();
    for (const part of parts()) {
      const mesh = new Mesh(part.geometry, part.material);
      if (part.renderOrder !== undefined) mesh.renderOrder = part.renderOrder;
      group.add(mesh);
    }
    return group;
  });
}

const catalogueRows = parseWorldSceneModels(metadata.explorerModels.catalogue), catalogue = defineWorldSceneCatalogue(catalogueRows);
const sources = new Map(metadata.explorerModels.sources.map(row => [row.id, row]));
const yaws = new Map(Object.entries(metadata.explorerModels.yaw));
const sourceBooks = new WeakMap<ModelContext, { catalogue: typeof catalogueRows; geometries: Map<string, BufferGeometry>; materials: Map<string, Material> }>();
/** The native page lends its existing geometry and programs; the shared catalogue
 * owns choices, draw flags, colliders and LODs. Lazy cards retain their intake. */
export function nativeSpecimen(key: string): ModelDef<Record<string, unknown>> {
  const row = catalogueRows.models.find(entry => entry.key === key);
  if (row === undefined) throw new Error(`No Nine specimen row: ${key}`);
  // Native cards retain their page-owned geometry and GPU bindings as before.
  const { colliders, specimenLifetime: _specimenLifetime, ...model } = catalogue.model(key), yaw = yaws.get(key);
  const parts = (ctx: ModelContext, params: Record<string, unknown>, rng: Parameters<typeof model.build>[2]): readonly ModelPart[] => {
    const choice = row.choices.find(entry => Object.keys(params).length === Object.keys(entry.params).length && Object.entries(entry.params).every(([name, value]) => params[name] === value));
    if (choice === undefined) throw new Error(`No native specimen profile: ${key}`);
    const look = ndLook(ctx);
    let book = sourceBooks.get(ctx);
    if (book === undefined) {
      book = { catalogue: catalogueRows, geometries: new Map<string, BufferGeometry>(), materials: new Map<string, Material>() };
      bindWorldSceneModelSources(ctx, catalogueRows.product, book, look.owner); sourceBooks.set(ctx, book);
    }
    const materials = new Map([['kit', lowPolyLookMaterial(ctx.sky, 'nine-architecture')], ['facade', look.facade?.mat], ['small', look.facade?.small]]);
    for (const draw of choice.draws.concat(choice.lods.flatMap(level => level.draws))) {
      const id = JSON.stringify([draw.library, draw.model]);
      if (!book.geometries.has(id)) {
        const source = sources.get(draw.model);
        if (source === undefined) throw new Error(`No Nine specimen source: ${draw.model}`);
        let geometry = source.resident === undefined ? specimen(ctx, source.key) : look.geo.get(source.resident) ?? specimen(ctx, source.key);
        if (source.transform !== undefined) geometry = geometry.clone().applyMatrix4(new Matrix4().fromArray(source.transform));
        book.geometries.set(id, geometry);
      }
      book.materials.set(draw.material, need(materials.get(draw.material), `specimen look ${draw.material}`));
    }
    const built = model.build(ctx, params, rng);
    if (!Array.isArray(built)) throw new Error('Nine specimen requires its prepared parts');
    return built as readonly ModelPart[];
  };
  return { ...model, ...(metadata.explorerModels.colliding.includes(key) ? { colliders } : {}), ...(yaw === undefined ? {} : { specimenYaw: yaw }),
    build: (ctx, params, rng) => metadata.explorerModels.lazy.includes(key) ? withSpecimens(ctx, model.id, () => parts(ctx, params, rng)) : parts(ctx, params, rng) };
}
