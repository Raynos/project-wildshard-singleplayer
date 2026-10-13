import { BufferGeometry, Mesh, MeshStandardMaterial, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { ISLE_PAINT, ISLE_PAINT_EDITS } from '../data/isleLook';
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

/** An island (`id`: a playable or gate isle's, or `islet.<edge>`) from its bake, faceted in the painted island material. */
export function islandMesh(id: string): Mesh<BufferGeometry, MeshStandardMaterial> {
  const at = isleRows.isles.indexOf(id), g = pack !== null && at !== -1 ? pack.geometry(at) : new BufferGeometry(); g.computeVertexNormals();
  // faceted: the crags read as cut rock, the meadow top as a low-poly painted lawn
  return new Mesh(g, paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true })));
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
