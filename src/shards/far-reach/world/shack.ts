import { MeshStandardMaterial } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { SHACK_EDITS, SHACK_KINDS } from '../data/shackLook';

/**
 * The weathered-timber surfaces of Sky Reach's small buildings (E392, round 18): the procedural program that draws a baked
 * shack part, its GLSL and kinds the rows of data/shackLook.ts. The geometry is built at bake time
 * (`generators/shackKit.ts`, SHARD-PLATFORM SF72); the client only draws it.
 */
export type ShackKind = keyof typeof SHACK_KINDS;

/** The material for a kind: vertex-coloured, the kind's pattern patched in. */
export function shackMaterial(kind: ShackKind): MeshStandardMaterial {
  const { mode, roughness } = SHACK_KINDS[kind], material = new MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  material.defines = { SHK_MODE: mode };
  patchShader(material, `far.shack.${kind}`, PATCH_ORDER.material, (shader) => { editShader(shader, SHACK_EDITS); }, { key: (prior) => `${prior}|far.shack.${kind}` });
  return material;
}
