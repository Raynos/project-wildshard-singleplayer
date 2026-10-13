import { BufferGeometry, Mesh, MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { ISLE_PAINT, ISLE_PAINT_EDITS, isleNode } from '../data/isleLook';
import isleRows from '../data/isles.json' with { type: 'json' };
import { onPaintedDispose } from '../look/image';

/**
 * The islands' painted textures (E392, toward the targets: moss-streaked grey cliffs, a flowered meadow): the keels' rock
 * sampled triplanar in world space (no UVs needed) and multiplied into the strata colours, the meadow ground projected
 * from above onto the green faces. The plugin loads them behind the loading screen and sets them before the world is
 * built; without them the islands keep their painted vertex colours.
 */
let TEX: { rock: Texture | null; meadow: Texture | null } = { rock: null, meadow: null };
export function setIsleTextures(tex: { rock: Texture | null; meadow: Texture | null }): void {
  TEX = tex;
  for (const key of ['rock', 'meadow'] as const) {
    const texture = tex[key];
    onPaintedDispose(texture, () => { if (TEX[key] === texture) TEX[key] = null; });
  }
}

let pack: InstanceType<typeof GeometryPack> | null = null;
/** Take the islands' bake (generators/isles.ts → baked/isles.bin, loaded with the other baked pieces); null leaves them undrawn. */
export function setIslePack(bytes: Uint8Array | null): void { pack = bytes === null ? null : new GeometryPack(bytes, packedRows(isleRows), 'far-reach isles'); }

/** The painted island material, faceted: the crags read as cut rock, the meadow top as a low-poly painted lawn. */
export const isleMaterial = (): MeshStandardMaterial => paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));

/** A moving islet (`islet.<edge>`) from its bake, in the painted island material. */
export function islandMesh(id: string): Mesh<BufferGeometry, MeshStandardMaterial> {
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
/** A static island from its tile, at the tile node's own position, painted (an island whose tile did not load stands undrawn). */
export function staticIsle(meshes: IsleMeshes, id: string): Mesh<BufferGeometry, MeshStandardMaterial> {
  const node = meshes.get(isleNode(id)), mesh = new Mesh(node?.geometry ?? new BufferGeometry(), isleMaterial());
  if (node !== undefined) { mesh.position.copy(node.position); mesh.quaternion.copy(node.quaternion); mesh.scale.copy(node.scale); node.removeFromParent(); }
  return mesh;
}

/**
 * The islands' paint (E392), on any vertex-coloured material (the islands, the boulders): green faces get the painted
 * meadow, tonal patches and daisies; the rest the painted cliff rock, triplanar in world space. `rockMix` is how much of
 * the rock texture replaces the vertex colour (the boulders and the islands 0.85).
 */
export function paintIsleMaterial(material: MeshStandardMaterial, rockMix = 0.85): MeshStandardMaterial {
  // the meadow from above (E392, the aerial targets): tonal patches and scattered daisies painted in world space on the
  // green faces, so a top reads as a flowered meadow, not one smooth green
  const { rock, meadow } = TEX;
  patchShader(material, 'far.isle-meadow', PATCH_ORDER.decorate, (shader) => {
    if (rock !== null) shader.uniforms['farRock'] = { value: rock };
    if (meadow !== null) shader.uniforms['farMeadow'] = { value: meadow };
    editShader(shader, spliceEdits(ISLE_PAINT_EDITS, { textures: `${rock !== null ? ISLE_PAINT.rockTex : ''}${meadow !== null ? ISLE_PAINT.meadowTex : ''}`, rockMix: rockMix.toFixed(2) }));
  // its own program key: three caches programs by the last patch's text, and the scene-wide fog patch (look/render.ts)
  // is the same text on every material, so without a key the islands reuse an unpatched program
  }, { key: (prior) => `${prior}|far.isle-meadow:${rock !== null ? 'r' : ''}${meadow !== null ? 'm' : ''}:${rockMix}` });
  return material;
}
