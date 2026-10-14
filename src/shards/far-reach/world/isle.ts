import { SKY_LIBRARY } from './meshes';
import { BufferGeometry, Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import isleRows from '../data/isles.json' with { type: 'json' };

let pack: InstanceType<typeof GeometryPack> | null = null;
/** Take the islands' bake (generators/isles.ts → baked/isles.bin, loaded with the other baked pieces); null leaves them undrawn. */
export function setIslePack(bytes: Uint8Array | null): void { pack = bytes === null ? null : new GeometryPack(bytes, packedRows(isleRows), 'far-reach isles'); }

/** The islands' looks (data/isleLook.ts ISLE_GRAPHS): whole, or cut over a playable island's keel model. */
export type IsleLook = 'isle-paint' | 'isle-paint-cut' | 'isle-paint-cut-mill';
/** The painted island material (`look.materials[look]`, the islands' paint graph), faceted: the crags read as cut rock, the
 *  meadow top as a low-poly painted lawn; before the looks are set (the Model Explorer, a test) plain faceted vertex colour. */
export const isleMaterial = (look: IsleLook = 'isle-paint'): Material =>
  SKY_LIBRARY.look(look) ?? new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });

/** A moving islet (`islet.<edge>`) from its bake, in the painted island material. */
export function islandMesh(id: string): Mesh<BufferGeometry, Material> {
  const at = isleRows.isles.indexOf(id), g = pack !== null && at !== -1 ? pack.geometry(at) : new BufferGeometry(); g.computeVertexNormals();
  return new Mesh(g, isleMaterial());
}

/** The static islands drawn from their props tiles (generators/isleProps.ts), by island id; the world build paints each. */
export type IsleMeshes = ReadonlyMap<string, Mesh>;
/** The runtime's props view: take a tile's islands (each at its own position, its baked triangles and paint as built). */
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
export function adoptIsleTile(tile: Object3D, into: Map<string, Mesh>): void {
  tile.traverse((node) => {
    if (!isMesh(node) || !node.name.startsWith('isle_')) return;
    // the sphere from the shape's own points (the loader's is the box's), so each island culls as it always did
    node.geometry.computeBoundingSphere(); into.set(node.name, node);
  });
}
