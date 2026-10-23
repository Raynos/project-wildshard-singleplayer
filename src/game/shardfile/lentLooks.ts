import type { IUniform, Material, Texture } from 'three';
import type { ToonLook } from '@wildshard/engine/render/families/toon';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import type { Scope } from '@wildshard/engine/app/scope';
import { enteredOwner } from '@wildshard/engine/app/ownership';

/**
 * Lent looks (SHARD-PLATFORM W2 C2): a shard's runtime compiles its look.materials graphs (`runtimeLookMaterials`) and
 * lends them here for the scope that owns them; the world's modules read a compiled look, its params and its lent textures
 * by catalogue id instead of each keeping a setter of its own. Several lends may be live at once (a second compile pass,
 * an entered world): a look id resolves to the newest lend that compiled it, preferring one whose scope owns the caller
 * (G580 T1: two live copies of one product lend the same ids, and each copy's systems run under its own scope). A read
 * before the lend refuses, so a module
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
  /** a further compile of graph look `id` with its own params (a pooled effect's copy that moves alone) */
  readonly instance?: (id: string) => LookInstance;
  /** compile the still-deferred looks among `ids`, one build step each */
  readonly prepare?: (ids: readonly string[]) => Promise<void>;
}
/** One compiled copy of a graph look: its own material and its own param writer (checked as the look's are). */
export interface LookInstance {
  readonly material: Material;
  readonly setParam: (name: string, value: GraphLiteral) => void;
}

const lends: { readonly looks: LentLooks; readonly scope: Scope | null }[] = [];
const sceneMaterials = new WeakMap<Scope, Map<string, ReadonlyMap<string, Material>>>();

/** Internal terrain loan, isolated to its resident and product identity. Scene
 * construction can overlap other worlds that happen to name the same family. */
export function lendSceneMaterials(scope: Scope, slug: string, materials: ReadonlyMap<string, Material>): void {
  if (scope.disposed) throw new Error('Scene material loan needs a live resident');
  let rows = sceneMaterials.get(scope);
  if (rows === undefined) { rows = new Map(); sceneMaterials.set(scope, rows); scope.onDispose(() => { sceneMaterials.delete(scope); }); }
  if (rows.has(slug)) throw new Error('Scene material book is already lent');
  rows.set(slug, materials);
}

/** A loan is optional; an unloaned graph still follows normal scene compilation. */
export function sceneMaterial(scope: Scope, slug: string, id: string): Material | undefined {
  return sceneMaterials.get(scope)?.get(slug)?.get(id);
}

/** Lend a compile pass's looks until `scope` ends. */
export function lendLooks(scope: { onDispose: (run: () => void) => unknown }, looks: LentLooks): void {
  const lend = { looks, scope: 'belongsTo' in scope && typeof scope.belongsTo === 'function' ? scope as Scope : null };
  lends.push(lend);
  scope.onDispose(() => { const at = lends.indexOf(lend); if (at !== -1) lends.splice(at, 1); });
}

/** the newest lend that compiled `id` within the caller's owner, else the newest that compiled it, or null */
function holder(id: string): LentLooks | null {
  const owner = enteredOwner();
  let newest: LentLooks | null = null;
  for (let i = lends.length - 1; i >= 0; i--) {
    const lend = lends[i]; if (lend === undefined || !lend.looks.materials.has(id)) continue;
    if (owner === null || (lend.scope !== null && owner.belongsTo(lend.scope))) return lend.looks;
    newest ??= lend.looks;
  }
  return newest;
}

/** The lend that compiled `id`; throws when none did (the runtime lends its looks before the world builds). */
export function lentLooksOf(id: string): LentLooks {
  const lend = holder(id);
  if (lend === null) throw new Error(`No lent look ${id}: the runtime compiles and lends its looks before the world builds`);
  return lend;
}

/** Compile the still-deferred lent looks among `ids` one build step each, before a synchronous pass touches them all (a
 *  deferred graph look otherwise compiles inside its first lookup's frame, several in one task); ids no lend holds, or
 *  whose lend compiles eagerly, are skipped. */
export async function prepareLentLooks(ids: readonly string[]): Promise<void> {
  const held = new Map<LentLooks, string[]>();
  for (const id of new Set(ids)) { const lend = holder(id); if (lend?.prepare !== undefined) held.set(lend, [...(held.get(lend) ?? []), id]); }
  for (const [lend, owned] of held) await lend.prepare?.(owned);
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

/** A further copy of lent graph look `id` (its own material and params, owned by the lend's scope); throws when none is
 *  lent or the lend compiles no copies. */
export function lentLookInstance(id: string): LookInstance {
  const lend = lentLooksOf(id);
  if (lend.instance === undefined) throw new Error(`Lent look ${id} has no instances`);
  return lend.instance(id);
}

/** The live toon look of the lend that compiled `id`; throws when none is lent. */
export function lentToon(id: string): ToonLook {
  const toon = lentLooksOf(id).toon;
  if (toon === undefined) throw new Error(`Lent look ${id} has no toon family`);
  return toon;
}

const lentParams = { setParam: setLentParam };
/** Push a channel group's graph params (`graphParamRoots(...)`) into the lent looks. */
export function pushLentParams(params: { readonly push: (looks: typeof lentParams) => void }): void { params.push(lentParams); }

const uniformLends: { readonly id: string; readonly uniforms: Readonly<Record<string, IUniform>>; readonly scope: Scope }[] = [];
/** Lend a live uniform set (one `{ value }` object per name, the same objects its programs read) as `id` until `scope` ends. */
export function lendUniforms(scope: Scope, id: string, uniforms: Readonly<Record<string, IUniform>>): void {
  if (scope.disposed) throw new Error('Uniform loan needs a live scope');
  const lend = { id, uniforms, scope };
  uniformLends.push(lend);
  scope.onDispose(() => { const at = uniformLends.indexOf(lend); if (at !== -1) uniformLends.splice(at, 1); });
}
/** The newest lent uniform set `id` within the caller's owner, else the newest; throws when none is lent. */
export function lentUniforms(id: string): Readonly<Record<string, IUniform>> {
  const owner = enteredOwner();
  let newest: Readonly<Record<string, IUniform>> | null = null;
  for (let i = uniformLends.length - 1; i >= 0; i--) {
    const lend = uniformLends[i]; if (lend?.id !== id) continue;
    if (owner === null || owner.belongsTo(lend.scope)) return lend.uniforms;
    newest ??= lend.uniforms;
  }
  if (newest === null) throw new Error(`No lent uniforms ${id}: the world lends them before its look composes`);
  return newest;
}
