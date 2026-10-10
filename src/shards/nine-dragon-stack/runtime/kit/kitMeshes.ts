// kitMeshes — a world's converted kits as meshes (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts): one mesh per kit,
// named `kit:<name>` for the budget ruler's lanes, its attributes made GPU-only (E264: nothing rewrites a kit after the
// build), the opaque kits on one material and the alpha-cut ones on another, added to the root in that order. The opaque
// meshes are found again by name (the models drawn into them register there), and a kit with a draw distance
// (kitSet `far`) is handed back with it for the instance culler's `addFar`.
//
//   const kits = addKitMeshes(root, { solid, alpha }, { solid: mat, alpha: matA }, set.farOf, 'my static geometry');
import { type BufferGeometry, type Material, Mesh, type Object3D } from 'three';
import { gpuOnlyAttributes } from '@wildshard/engine/core/gpuOnly';

/** the kits' meshes: the opaque ones by kit name, and every mesh with a draw distance (m) */
export interface KitMeshes { readonly byName: Map<string, Mesh>; readonly far: [Mesh, number][] }

/** Add a mesh per converted kit to `root` (`label`: the GPU-only geometry's tag), opaque first, then alpha-cut. */
export function addKitMeshes(root: Object3D, geos: { readonly solid: readonly (readonly [string, BufferGeometry])[]; readonly alpha: readonly (readonly [string, BufferGeometry])[] }, mats: { readonly solid: Material; readonly alpha: Material }, farOf: ReadonlyMap<string, number>, label: string): KitMeshes {
  const byName = new Map<string, Mesh>(), far: [Mesh, number][] = [];
  const add = (name: string, g: BufferGeometry, m: Material, solid: boolean): void => {
    gpuOnlyAttributes(g, label);
    const mesh = new Mesh(g, m);
    mesh.name = `kit:${name}`;
    root.add(mesh);
    if (solid) byName.set(name, mesh);
    const d = farOf.get(name);
    if (d !== undefined) far.push([mesh, d]);
  };
  for (const [name, g] of geos.solid) add(name, g, mats.solid, true);
  for (const [name, g] of geos.alpha) add(name, g, mats.alpha, false);
  return { byName, far };
}
