import { bakeRawColourPixels } from '@wildshard/sdk/bake/rawTexture';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { parseHeldMeshes, parseHeldRigSource, type NineHeldMesh } from './sections';

/** Existing authored rig, read only through the build's declared public asset root. */
export const NINE_HELD_RIG = '/assets/nine-dragon/viewmodel/fp-rig.glb';
export interface NineHeldProfile { readonly meshes: readonly NineHeldMesh[]; readonly standIn: Uint8Array }

/** Derive the same ordered mesh, channel and transform rows directly from the original GLB JSON chunk. */
export function nineHeldMeshes(bytes: Uint8Array): readonly NineHeldMesh[] {
  if (bytes.byteLength < 20 || bytes.byteLength > 25_000_000) throw new Error('Invalid held rig GLB bounds');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size = view.getUint32(12, true);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength
    || view.getUint32(16, true) !== 0x4e4f534a || size < 2 || size > bytes.byteLength - 20) throw new Error('Invalid held rig GLB header');
  const source = parseHeldRigSource(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + size))));
  return parseHeldMeshes(source.nodes.filter(node => node.mesh !== undefined).map((node, index) => {
    const mesh = node.mesh === undefined ? undefined : source.meshes[node.mesh];
    if (mesh === undefined || mesh.primitives.length !== 1 || node.name === undefined) throw new Error('Held rig requires named single-primitive meshes');
    const primitive = mesh.primitives[0]; if (primitive === undefined) throw new Error('Missing held rig primitive');
    const extras = node.extras ?? {}, attributes = Object.keys(primitive.attributes);
    const channels = { aMat: '_amat', ...(attributes.includes('_AFACE') ? { aFace: '_aface' } : {}),
      ...(attributes.includes('_AHULLN') ? { aHullN: '_ahulln' } : {}), ...(attributes.includes('NORMAL') ? { aNs: attributes.includes('_ANS') ? '_ans' : 'normal' } : { normal: 'aHullN' }) };
    return { name: node.name, look: `nine-vm-rig-${index}`, attributes, channels,
      hull: extras.hull === true, width: extras.hullK ?? 1, maps: extras.maps ?? '',
      rotation: extras.assetRot ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], doubleSide: node.skin !== undefined && extras.hull !== true };
  }));
}

/** Cache only the original rig's mesh declarations; the tiny exact black texel remains an owned binary. */
export async function nineHeldProfile(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<NineHeldProfile> {
  const files = await ctx.cached({ id: 'held-profile', inputs: [NINE_HELD_RIG] }, inputs => {
    const bytes = inputs.get(NINE_HELD_RIG); if (bytes === undefined) throw new Error('Missing Nine held rig source');
    return new Map([['meshes.json', new TextEncoder().encode(JSON.stringify(nineHeldMeshes(bytes)))]]);
  });
  const rows = files.get('meshes.json'); if (rows === undefined) throw new Error('Missing Nine held profile metadata');
  return { meshes: parseHeldMeshes(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rows))),
    standIn: bakeRawColourPixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 0, 255]) }, { colourSpace: 'linear' }) };
}
