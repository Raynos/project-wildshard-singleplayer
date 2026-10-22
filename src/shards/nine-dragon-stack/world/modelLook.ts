// What Nine Dragon's sign model (../models/signs.ts) takes from the fragment's build through its model context's `once`
// (src/engine/models/model.ts): the sign atlas. One context per built fragment; every code-built model is a world-scene
// catalogue row (generators/worldScenes.ts).
import type { Material } from 'three';
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { BakedSigns } from './casts';

export interface NdLook {
  /** the 'nine-neon' look over the sign atlas and the atlas */
  neon: { readonly mat: Material; readonly atlas: BakedSigns } | null;
}

const KEY = 'nine-dragon-stack:look';

/** the fragment's model context and its (still empty) look */
export function ndModelContext(renderer: Renderer | null, sky: SkyRig): { ctx: ModelContext; look: NdLook } {
  const look: NdLook = { neon: null };
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
