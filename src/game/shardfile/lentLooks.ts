import type { Material, Texture } from 'three';
import type { ToonLook } from '@wildshard/engine/render/families/toon';
import type { GraphLiteral } from '@wildshard/format/materialGraph';

/**
 * Lent looks (SHARD-PLATFORM W2 C2): a shard's runtime compiles its look.materials graphs (`runtimeLookMaterials`) and
 * lends them here for the scope that owns them; the world's modules read a compiled look, its params and its lent textures
 * by catalogue id instead of each keeping a setter of its own. Several lends may be live at once (a second compile pass,
 * an entered world): a look id resolves to the newest lend that compiled it. A read before the lend refuses, so a module
 * built before its look was compiled fails loudly; a param write before it is a no-op.
 *
 *   lendLooks(scope, await runtimeLookMaterials(ctx, source, true, ids));   // the runtime, before the world
 *   new THREE.Mesh(geometry, lentLook('reef'));                                  // a world module
 *   setLentParam('hearth-smoke', 'sunColour', [r, g, b]);                             // once a frame
 *
 * Resident world construction and entered presentation share the same compiled material book.
 */

/** One compile pass as lent: its materials, their param and texture writers, a mesh-map binder and its live toon look. */
export interface LentLooks {
  readonly materials: ReadonlyMap<string, Material>;
  readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
  readonly setTexture: (id: string, name: string, texture: Texture) => void;
  /** a look worn over a source's own maps (a material's colour, normal, roughness and AO; a texture as its colour map) */
  readonly bindMeshMap: (id: string, map: Texture | Material) => Material;
  /** the pass's live toon family, when it compiled toon looks (a shard's day clock turns it, once a frame) */
  readonly toon?: ToonLook;
}

const lends: LentLooks[] = [];

/** Lend a compile pass's looks until `scope` ends. */
export function lendLooks(scope: { onDispose: (run: () => void) => unknown }, looks: LentLooks): void {
  lends.push(looks);
  scope.onDispose(() => { const at = lends.indexOf(looks); if (at !== -1) lends.splice(at, 1); });
}

/** the newest lend that compiled `id`, or null */
function holder(id: string): LentLooks | null {
  for (let i = lends.length - 1; i >= 0; i--) { const lend = lends[i]; if (lend?.materials.has(id)) return lend; }
  return null;
}

/** The lend that compiled `id`; throws when none did (the runtime lends its looks before the world builds). */
export function lentLooksOf(id: string): LentLooks {
  const lend = holder(id);
  if (lend === null) throw new Error(`No lent look ${id}: the runtime compiles and lends its looks before the world builds`);
  return lend;
}

/** Whether a compiled look `id` is lent (a module that may build outside its world draws nothing without it). */
export function hasLentLook(id: string): boolean { return holder(id) !== null; }

/** A compiled look by its catalogue id; throws when none is lent. */
export function lentLook(id: string): Material {
  const material = lentLooksOf(id).materials.get(id);
  if (material === undefined) throw new Error(`No lent look ${id}`);
  return material;
}

/** A lent look worn over `source`'s own maps, one per look and source; throws when none is lent. */
export function lentMappedLook(id: string, source: Texture | Material): Material { return lentLooksOf(id).bindMeshMap(id, source); }

/** Set a lent look's param (checked against its declared type and range); a no-op before the lend. */
export function setLentParam(id: string, name: string, value: GraphLiteral): void { holder(id)?.setParam(id, name, value); }

/** Lend a look's `role: 'lent'` texture param a texture the runtime made (no program change); throws when none is lent. */
export function setLentTexture(id: string, name: string, texture: Texture): void { lentLooksOf(id).setTexture(id, name, texture); }

/** The live toon look of the lend that compiled `id`; throws when none is lent. */
export function lentToon(id: string): ToonLook {
  const toon = lentLooksOf(id).toon;
  if (toon === undefined) throw new Error(`Lent look ${id} has no toon family`);
  return toon;
}

const lentParams = { setParam: setLentParam };
/** Push a channel group's graph params (`graphParamRoots(...)`) into the lent looks. */
export function pushLentParams(params: { readonly push: (looks: typeof lentParams) => void }): void { params.push(lentParams); }
