import { Group, type BufferGeometry, type Material } from 'three';
import type { ColliderSpec, ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { UnitParts, type UnitDrawn, type WeldPart } from '@wildshard/engine/models/weld';

/**
 * A model drawn from a shard's whole-geometry library (SHARD-PLATFORM W2): a baked, site-fitted or authored piece whose
 * parts are named geometries the shard already read (`readWholeGeometry`, `@wildshard/game/plugin/geometry`), each on a
 * material the shard names by key, merged by the engine's weld unit (`UnitParts`: one mesh per material and band, the
 * position-only shadow proxies of its `'proxy'` parts). It is the `build` and `colliders` of an ordinary model, so
 * `place` draws, registers and lists it (its Explorer card, its floors and colliders) like any other:
 *
 *   export const pier = defineModel({ id: '<slug>/pier', …, ...libraryModel({ draws, geometry, material, colliders }) });
 *
 * `draws` gives a copy's parts by its params, `geometry` a fresh geometry for a library name (the unit merges it),
 * `material` the material for a key, `colliders` the copy's own-space colliders, and `finish` (optional) tags the drawn
 * meshes and proxies (a shard's distance bands, a tier's shadows) before `place` takes them.
 */

/** One part of a library model's copy: a library geometry by name, its material's key and its weld flags. */
export interface LibraryDraw<K extends string> extends Omit<WeldPart, 'material' | 'geometries'> {
  readonly draw: string;
  readonly material: K;
}

/** What a library model is built from (see the module comment). */
export interface LibraryModelSpec<P extends object, K extends string> {
  readonly draws: (params: P) => readonly LibraryDraw<K>[];
  readonly geometry: (ctx: ModelContext, draw: string) => BufferGeometry;
  readonly material: (ctx: ModelContext, key: K) => Material;
  readonly colliders: (params: P) => readonly ColliderSpec[];
  readonly finish?: (drawn: UnitDrawn, params: P) => void;
}

/** The `build` and `colliders` of a model drawn from a whole-geometry library. */
export function libraryModel<P extends object, K extends string>(spec: LibraryModelSpec<P, K>): Pick<ModelDef<P>, 'build' | 'colliders'> {
  return {
    build: (ctx, params) => {
      const unit = new UnitParts(), root = new Group();
      for (const { draw, material, ...flags } of spec.draws(params)) unit.add([{ ...flags, material: spec.material(ctx, material), geometries: [spec.geometry(ctx, draw)] }]);
      spec.finish?.(unit.draw(root, false), params);
      return root;
    },
    colliders: (params) => spec.colliders(params),
  };
}
