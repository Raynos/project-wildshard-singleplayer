// oxlint-disable-next-line import/no-nodejs-modules -- Trusted author fixture writes immutable products to the supplied local directory.
import { mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Artifact paths are controlled by the local baker CLI.
import { join } from 'node:path';
import { AnimationMixer, LoopOnce, Vector3, type SkinnedMesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bindRig } from '../../../../src/engine/anim/rig';
import type { ClipName } from '../../../../src/engine/anim/rig';
import { creatureSkinSource, rangerSkinSource, type SkinSource } from './sources';
import { sampleSkinClip, skinnedGlb, type SampledSkinClip } from '../../../../src/sdk/bake/export';
import { contentHash, canonicalJson } from '../../../../src/sdk/project';
import { parseGlb } from '../../../../src/sdk/assets';

/** The three required export representatives, created independently for every clip to reset closure-owned state. */
export type SkinFixtureKind = 'grey-blob' | 'boar' | 'pine-ranger';
/** The original engine/kit rig and its exact pose closure; Opus uses it for side-by-side motion playback. */
export async function skinFixtureSource(kind: SkinFixtureKind): Promise<SkinSource> { return kind === 'pine-ranger' ? rangerSkinSource() : creatureSkinSource(kind); }
/** Produce deterministic GLB bytes and a data rig binding, never a procedural runtime identifier. */
export async function bakeSkinFixture(kind: SkinFixtureKind): Promise<{ bytes: Uint8Array; metadata: { id: string; file: string; family: string; rig: { skeleton: string; joints: string[][]; clips: readonly ClipName[]; sockets: string[] }; cost: ReturnType<typeof parseGlb>; materialNote: string } }> {
  const source = await skinFixtureSource(kind), clips: SampledSkinClip[] = [];
  try {
    for (const name of source.clips) { const fresh = await skinFixtureSource(kind); try { clips.push(sampleSkinClip(fresh.mesh, name, name === 'walk' ? 1 : 2, (time, dt) => fresh.pose(name, time, dt))); } finally { fresh.dispose(); } }
    const bytes = await skinnedGlb(source.mesh, clips, kind);
    return { bytes, metadata: { id: kind, file: contentHash(bytes), family: kind === 'pine-ranger' ? 'pbr' : 'toon', rig: { skeleton: source.skeleton, joints: [source.mesh.skeleton.bones.map((bone) => bone.name)], clips: source.clips, sockets: source.sockets }, cost: parseGlb(bytes), materialNote: kind === 'pine-ranger' ? 'Exact phone hull, UVs and current NPC rig; atlas and normal map remain external KTX2 bindings for the playback builder.' : 'Exact template factory facets, palette, joints and current Animal pose; untextured toon material.' } };
  } finally { source.dispose(); }
}
/** Measure every source vertex at every 60 Hz frame through today's loader, rig binding and animation mixer. */
export async function measureSkinFixture(kind: SkinFixtureKind, result: Awaited<ReturnType<typeof bakeSkinFixture>>): Promise<{ compared: number; maximumVertexError: number }> {
  const isSkin = (node: Object3D): node is SkinnedMesh => (node as Partial<SkinnedMesh>).isSkinnedMesh === true;
  const file = await new GLTFLoader().parseAsync(result.bytes.slice().buffer, ''), meshes: SkinnedMesh[] = []; file.scene.traverse((node) => { if (isSkin(node)) meshes.push(node); }); const mesh = meshes[0]; if (mesh === undefined || meshes.length !== 1) throw new Error('Expected one exported skin');
  const rig = result.metadata.rig, binding = bindRig(file.scene, file.animations, { skeleton: rig.skeleton, clips: rig.clips, sockets: rig.sockets }, { skeleton: rig.skeleton, joints: rig.joints });
  let worst = 0, compared = 0;
  try { for (const name of rig.clips) {
    const original = await skinFixtureSource(kind), mixer = new AnimationMixer(file.scene), clip = binding.clips.get(name); if (clip === undefined) throw new Error('Missing exported clip'); const action = mixer.clipAction(clip).setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
    try { const frames = Math.round(clip.duration * 60); for (let frame = 0; frame <= frames; frame++) { const time = frame / 60; original.pose(name, time, frame === 0 ? 0 : 1 / 60); original.mesh.updateMatrixWorld(true); mixer.setTime(time); file.scene.updateMatrixWorld(true);
      const position = original.mesh.geometry.getAttribute('position'); for (let index = 0; index < position.count; index++) { const expected = original.mesh.getVertexPosition(index, new Vector3()).applyMatrix4(original.mesh.matrixWorld), actual = mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld); worst = Math.max(worst, actual.distanceTo(expected)); compared++; }
    } } finally { original.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(file.scene); }
  } } finally { mesh.geometry.dispose(); mesh.skeleton.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; for (const material of materials) material.dispose(); }
  return { compared, maximumVertexError: worst };
}
/** Write the three immutable assets and their cost/rig receipt for the engine playback fixture. */
export async function writeSkinFixtures(directory: string): Promise<void> { mkdirSync(directory, { recursive: true }); const rows = []; for (const kind of ['grey-blob', 'boar', 'pine-ranger'] as const) { const result = await bakeSkinFixture(kind); writeFileSync(join(directory, result.metadata.file), result.bytes); const motion = await measureSkinFixture(kind, result); if (motion.maximumVertexError >= 0.0001) throw new Error('Exported skin motion differs from its source'); rows.push({ ...result.metadata, motion }); } writeFileSync(join(directory, 'skins.json'), canonicalJson(rows)); }
