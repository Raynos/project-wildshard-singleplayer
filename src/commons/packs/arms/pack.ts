import type { CommonsPack } from '@wildshard/sdk/commons';
import { readRigMotion } from '@wildshard/sdk/bake/rig';
import { readSceneAnimations } from '@wildshard/sdk/sceneAnimation';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import aliases from './aliases.json' with { type: 'json' };

/** Emit the unchanged clip aliases shared by Driftwood and Nine; no rig or playback service runs here. */
export function starterArmClipsPack(provenance: { credit: string; licence: string }): CommonsPack {
  return { id: 'arm-clips', version: '1.0.0', entries: [{ id: 'aliases', kind: 'binary',
    bytes: new TextEncoder().encode(JSON.stringify(aliases)), ...provenance }] };
}

/** Generate the sixteen original arm clips and shared base transform fragment from a retained authored GLB.
 * Driftwood and Nine use identical curves and base joints, while their meshes, weapon offsets, fingers and swim clips
 * stay shard-owned. No track is trimmed, optimized, retargeted or resampled; the generator runs only at build time. */
export async function starterArmMotionPack(glb: Uint8Array, provenance: { credit: string; licence: string }): Promise<CommonsPack> {
  const motion = await readRigMotion(glb), names = Object.values(aliases.arm);
  const clips = names.map(name => {
    const matching = motion.clips.filter(clip => clip.name === name);
    const clip = matching[0];
    if (matching.length !== 1 || clip === undefined) throw new Error(`Missing or duplicate shared arm clip: ${name}`);
    return clip;
  });
  const joints = ['vm_root', ...['R', 'L'].flatMap(side => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].map(joint => `${side}_${joint}`))];
  const transforms = joints.map(name => {
    const matching = motion.nodes.filter(node => node.name === name), node = matching[0];
    if (matching.length !== 1 || node === undefined || node.parent !== null && !joints.includes(node.parent) ||
      [...node.position, ...node.quaternion, ...node.scale].some(value => !Number.isFinite(value))) throw new Error(`Invalid shared arm transform: ${name}`);
    return node;
  });
  return { id: 'arm-motion', version: '1.0.0', entries: [
    { id: 'base-joints', kind: 'binary', bytes: new TextEncoder().encode(encodeCanonicalJson({ version: 1, nodes: transforms })), ...provenance },
    ...readSceneAnimations(clips).map(clip => ({ id: clip.name.toLowerCase().replaceAll('_', '-'), kind: 'binary' as const,
      bytes: new TextEncoder().encode(encodeCanonicalJson(clip)), credit: provenance.credit, licence: provenance.licence })),
  ] };
}
