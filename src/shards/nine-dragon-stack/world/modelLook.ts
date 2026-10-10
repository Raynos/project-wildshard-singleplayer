// E306 / E315 M4: what Nine Dragon's models (../models/) take from the fragment's build — the Jiehua programs, the
// look's atlases, the loaded TRELLIS geometry, the sets built in the square's own rng stream — through their model
// context's `once` (src/engine/models/model.ts). One context per built fragment: build.ts makes it first, fills the look as
// each phase has made its part (the materials are created at the same points as before, so their order — which three's
// opaque sort keys on — is unchanged), and places the models; the Model Explorer's specimens read the same look later.
import { type BufferGeometry, Group, type Material, Mesh, type ShaderMaterial } from 'three';
import { modelContext, type ModelBuild, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { SignAtlasView } from '@wildshard/sdk/looks/signs';
import type { NeonTextView } from '@wildshard/sdk/looks/neonText';
import type { SignStyle } from '../data/signs';
import { type SpecimenBake, loadSpecimens } from './specimens';

export interface NdLook {
  /** the Jiehua kit program (build.ts `mat`): the kits, the square's props and sets, the crowd, the dressing, the movers */
  mat: ShaderMaterial | null;
  /** the facade kit's programs (facade/batch.ts): the pieces, and the small clutter that shrinks into the wall far off */
  facade: { readonly mat: ShaderMaterial; readonly small: ShaderMaterial } | null;
  /** the paper lanterns' program (look/lanterns.ts) */
  lantern: ShaderMaterial | null;
  /** the neon program over the sign atlas (the drones' lights) and the atlas */
  neon: { readonly mat: ShaderMaterial; readonly atlas: SignAtlasView<SignStyle> } | null;
  /** meshoptimizer is ready (world/lod.ts `lodReady`): the sculpts' distance LODs are simplified copies; else a sculpt's
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
  /** the neon calligraphy (@wildshard/sdk/looks/neonText over data/signs.ts NEON_LOOK: its glyph field and its board / tube programs), the neon sign's specimen */
  calligraphy: NeonTextView | null;
  /** G285: the code-built models' baked geometry (world/specimens.ts): what the page builds at load, loaded with the layout */
  specimens: SpecimenBake | null;
  /** …and what only the Explorer's specimens draw, fetched the first time one asks (`withSpecimens`) */
  explorer: Promise<SpecimenBake> | SpecimenBake | null;
}

const KEY = 'nine-dragon-stack:look';

/** the fragment's model context and its (still empty) look */
export function ndModelContext(renderer: Renderer | null): { ctx: ModelContext; look: NdLook } {
  const look: NdLook = { mat: null, facade: null, lantern: null, neon: null, canLod: false, geo: new Map(), hookMat: null, canopy: null, calligraphy: null, specimens: null, explorer: null };
  const ctx = modelContext(null, renderer);
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

/** a code-built model's geometry from the specimens bakes (world/specimens.ts), read once per model context under `key`
 *  (the page's bake hands its bytes over: the context keeps the geometry) */
export function specimen(ctx: ModelContext, key: string): BufferGeometry {
  return ctx.once(`nds:${key}`, () => {
    const look = ndLook(ctx), boot = need(look.specimens, 'the specimens bake'), explorer = look.explorer;
    if (!boot.has(key) && explorer !== null && !(explorer instanceof Promise)) return explorer.geometry(key);
    return boot.take(key);
  });
}

/** a fresh copy of a baked model geometry (a model whose every build drew its own, as the movers' do) */
export function bakedSpecimen(ctx: ModelContext, key: string): BufferGeometry {
  return need(ndLook(ctx).specimens, 'the specimens bake').geometry(key);
}

/**
 * An Explorer specimen whose geometry is in the Explorer's bake: its parts once the bake is in; until then the engine's
 * loading box, filled when the bake lands (`loadingSpecimen`: the Explorer re-frames the card on `ws:model-ready`).
 */
export function withSpecimens(ctx: ModelContext, id: string, parts: () => readonly ModelPart[]): ModelBuild {
  const look = ndLook(ctx);
  if (look.explorer !== null && !(look.explorer instanceof Promise)) return parts();
  const pending = look.explorer ?? loadSpecimens('explorer').catch((e: unknown) => { look.explorer = null; throw e; });
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
