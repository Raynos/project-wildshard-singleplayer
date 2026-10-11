import type { CommonsPack } from '@wildshard/sdk/commons';
import { readRigRest, readRigMotion } from '@wildshard/sdk/bake/rig';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';

/** Generate the model-space rest-joint fragment shared by a procedural species and its authored hull.
 * Joint order, exact positions and parent identities come from the retained GLB. Geometry, inverse binds,
 * coats, animation and gameplay remain with their owners; this is not a replacement model or a runtime host. */
export async function speciesRestPack(kind: string, glb: Uint8Array,
  provenance: { credit: string; licence: string }): Promise<CommonsPack> {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(kind)) throw new Error('Invalid species rest kind');
  const rest = await readRigRest(glb);
  try {
    const motion = await readRigMotion(glb), seen = new Set<string>();
    if (rest.bones.length === 0 || rest.bones.length > 128) throw new Error('Species rest requires bounded joints');
    const bones = rest.bones.map(bone => {
      const matches = motion.nodes.filter(node => node.name === bone.name), node = matches[0];
      if (matches.length !== 1 || node === undefined || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/u.test(bone.name) ||
        seen.has(bone.name) || node.parent !== null && !seen.has(node.parent) ||
        bone.pos.some(value => !Number.isFinite(value) || Math.abs(value) > 1000)) throw new Error('Species rest requires unique ordered bounded joints');
      seen.add(bone.name);
      return { name: bone.name, parent: node.parent, pos: [...bone.pos] };
    });
    return { id: `species-rest/${kind}`, version: '1.0.0', entries: [{ id: 'joints', kind: 'binary',
      bytes: new TextEncoder().encode(encodeCanonicalJson({ version: 1, space: 'model', bones })),
      credit: provenance.credit, licence: provenance.licence }] };
  } finally { rest.geometry.dispose(); }
}
