import type { CommonsPack } from '@wildshard/sdk/commons';
import { readRigMotion } from '@wildshard/sdk/bake/rig';
import { parseGlb } from '@wildshard/sdk/assets';

/** Generate a pinned v1 pack from the original eighteen-clip practice motion GLB.
 * Each of the three ordinary practice figures uses idle plus five reactions. The retained authored GLB is copied
 * verbatim: node transforms, target bindings, Float32 curves and timings stay unchanged. No arena is installed. */
export async function practiceMotionPack(glb: Uint8Array, provenance: { credit: string; licence: string }): Promise<CommonsPack> {
  parseGlb(glb);
  const motion = await readRigMotion(glb);
  const names = ['wood', 'straw-cloth', 'wood-steel'].flatMap(variant => ['idle', 'body-hit', 'head-hit', 'hit-left', 'hit-right', 'heavy-hit'].map(action => `${variant}:${action}`));
  if (motion.clips.length !== names.length || names.some(name => motion.clips.filter(clip => clip.name === name).length !== 1)) throw new Error('Practice motion requires all eighteen distinct authored clips');
  return { id: 'practice-motion', version: '1.0.0', entries: [{ id: 'clips', kind: 'glb',
    bytes: Uint8Array.from(glb), credit: provenance.credit, licence: provenance.licence }] };
}
