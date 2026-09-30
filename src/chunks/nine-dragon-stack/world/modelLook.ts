// E306 / E315 M4: what Nine Dragon's models (../models/) take from the fragment's build — the Jiehua programs, the
// look's atlases, the loaded TRELLIS geometry, the sets built in the square's own rng stream — through their model
// context's `once` (src/models/model.ts). One context per built fragment: build.ts makes it first, fills the look as
// each phase has made its part (the materials are created at the same points as before, so their order — which three's
// opaque sort keys on — is unchanged), and places the models; the Model Explorer's specimens read the same look later.
import type { BufferGeometry, Material, ShaderMaterial, WebGLRenderer } from 'three';
import { modelContext, type ModelContext } from '../../../models/model';
import type { SignAtlas } from '../look/signs';

export interface NdLook {
  /** the Jiehua kit program (build.ts `mat`): the kits, the square's props and sets, the crowd, the dressing, the movers */
  mat: ShaderMaterial | null;
  /** the facade kit's programs (facade/batch.ts): the pieces, and the small clutter that shrinks into the wall far off */
  facade: { readonly mat: ShaderMaterial; readonly small: ShaderMaterial } | null;
  /** the paper lanterns' program (look/lanterns.ts) */
  lantern: ShaderMaterial | null;
  /** the neon program over the sign atlas (the drones' lights) and the atlas */
  neon: { readonly mat: ShaderMaterial; readonly atlas: SignAtlas } | null;
  /** meshoptimizer is ready (world/lod.ts `lodReady`): the sculpts' distance LODs are simplified copies; else a sculpt's
   *  LOD is its own full geometry, which the fragment's culler leaves out */
  canLod: boolean;
  /** loaded geometry by name: the TRELLIS casts (`lion`, `walker-dark` …, `dragon-hook`) and the square's sets as the
   *  world built them (`booth`: its cook drew from the market row's stream, stalls.ts) */
  readonly geo: Map<string, BufferGeometry>;
  /** the Fei Zhua cast's brass (from its GLB's own material) */
  hookMat: Material | null;
}

const KEY = 'nine-dragon-stack:look';

/** the fragment's model context and its (still empty) look */
export function ndModelContext(renderer: WebGLRenderer | null): { ctx: ModelContext; look: NdLook } {
  const look: NdLook = { mat: null, facade: null, lantern: null, neon: null, canLod: false, geo: new Map(), hookMat: null };
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
