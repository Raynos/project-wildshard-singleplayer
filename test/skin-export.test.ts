import { describe, expect, it } from 'vitest';
import type { SkinnedMesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakeSkinFixture, skinFixtureSource, measureSkinFixture } from './fixtures/sim-level/skins/build';
import { bindRig } from '../src/engine/anim/rig';
import { parseGlb } from '../src/sdk/assets';
import { sampleSkinClip, skinnedGlb } from '../src/sdk/bake/export';

const isSkin = (node: Object3D): node is SkinnedMesh => (node as Partial<SkinnedMesh>).isSkinnedMesh === true;
const skin = (root: { traverse: (fn: (node: Object3D) => void) => void }): SkinnedMesh => { const meshes: SkinnedMesh[] = []; root.traverse((node) => { if (isSkin(node)) meshes.push(node); }); const mesh = meshes[0]; if (mesh === undefined || meshes.length !== 1) throw new Error('Expected one exported skin'); return mesh; };
describe('procedural skin exports', () => {
  for (const kind of ['grey-blob', 'boar', 'pine-ranger'] as const) it(`${kind}: deterministic admitted GLB retains current joints, bind, weights and sampled motion`, async () => {
    const a = await bakeSkinFixture(kind), b = await bakeSkinFixture(kind); expect(a.metadata).toEqual(b.metadata); expect(a.bytes).toEqual(b.bytes);
    const file = await new GLTFLoader().parseAsync(a.bytes.slice().buffer, ''), mesh = skin(file.scene), clips = a.metadata.rig.clips, binding = bindRig(file.scene, file.animations, { skeleton: a.metadata.rig.skeleton, clips, sockets: a.metadata.rig.sockets }, { skeleton: a.metadata.rig.skeleton, joints: a.metadata.rig.joints });
    expect(mesh.skeleton.bones.map((bone) => bone.name)).toEqual(a.metadata.rig.joints[0]); expect(binding.clips.size).toBe(clips.length); expect(a.metadata.cost.gpu).toBeGreaterThan(mesh.geometry.getAttribute('position').count * 12); expect(a.metadata.cost.draws).toBe(2);
    const motion = await measureSkinFixture(kind, a); expect(motion.maximumVertexError).toBeLessThan(0.0001); expect(motion.compared).toBeGreaterThan(100000);
    mesh.geometry.dispose(); mesh.skeleton.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; for (const material of materials) material.dispose();
  }, 60000);
  it('refuses invalid weights, missing joints and unordered clip times before runtime allocation', async () => {
    const source = await skinFixtureSource('grey-blob'); try { const clip = sampleSkinClip(source.mesh, 'idle', 1, (t, dt) => source.pose('idle', t, dt)), weights = source.mesh.geometry.getAttribute('skinWeight'); weights.setX(0, 0.4); await expect(skinnedGlb(source.mesh, [clip])).rejects.toThrow(/weights/u); weights.setX(0, 1); clip.times[1] = 0; await expect(skinnedGlb(source.mesh, [clip])).rejects.toThrow(/time/u); expect(() => parseGlb(new Uint8Array(20))).toThrow(); } finally { source.dispose(); }
  });
});
