import { describe, expect, it } from 'vitest';
import { AnimationClip, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, QuaternionKeyframeTrack, Uint16BufferAttribute, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { skinnedGlb, type SkinnedBone } from '../src/sdk/bake/skinned';
import { skinnedModel } from '../src/sdk/skinnedModel';

const BONES: SkinnedBone[] = [{ name: 'body', parent: null, pos: [0, 1.6, 0] }, { name: 'head', parent: 'body', pos: [0.1, 2.0000000001, 1.3] }, { name: 'tail', parent: 'body', pos: [0, 1.5, -1.4] }];
/** A soup of two triangles sharing an edge (the weld shares the one corner that matches in every channel), weights that do not sum to exactly 1. */
function fixture(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('color', new Float32BufferAttribute([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.4, 0.5, 0.6, 1, 1, 1, 0.7, 0.8, 0.9], 3));
  g.setAttribute('aSway', new Float32BufferAttribute([0.5, 1.5, 2.5, 1.5, 3.5, 2.5], 1));
  g.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 0, 2, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute([0.3, 0.3, 0.4000001, 0, 0.7, 0.30000001, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.1, 0.2, 0.7, 0, 1, 0, 0, 0], 4));
  return g;
}
const clip = (): AnimationClip => new AnimationClip('fly', 1, [
  new QuaternionKeyframeTrack('head.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 0, 0.2, 0, 0.9797959, 0, 0, 0, 1]),
  new VectorKeyframeTrack('tail.position', [0, 1], [0, -0.1, -1.4, 0, 0.1, -1.4]),
]);

describe('SDK offline skinned model bake', () => {
  it('round-trips a skinned soup bit-exact: channels, unnormalized weights, joints, clips and extras', async () => {
    const geometry = fixture(), material = new MeshStandardMaterial({ name: 'fixture', vertexColors: true });
    const { glb } = skinnedGlb({ name: 'fixture', bones: BONES, parts: [{ geometry, material }], clips: [clip()], extras: { dims: { halfWidth: 8 } } });
    expect(skinnedGlb({ name: 'fixture', bones: BONES, parts: [{ geometry, material }], clips: [clip()], extras: { dims: { halfWidth: 8 } } }).glb).toEqual(glb);
    const asset = skinnedModel('fixture.glb');
    expect(() => asset.copy()).toThrow('not loaded');
    await asset.load(glb);
    const copy = asset.copy(), [part] = copy.parts;
    if (part === undefined) throw new Error('missing part');
    expect(part.geometry.index).toBeNull();
    expect(Object.keys(part.geometry.attributes).sort()).toEqual(Object.keys(geometry.attributes).sort());
    for (const name of Object.keys(geometry.attributes)) {
      const a = part.geometry.getAttribute(name), b = geometry.getAttribute(name);
      expect(a.array.constructor).toBe(b.array.constructor);
      expect(Array.from(a.array)).toEqual(Array.from(b.array));
    }
    expect(copy.bones).toEqual(BONES);
    expect(copy.extras).toEqual({ dims: { halfWidth: 8 } });
    expect(copy.clips.map(c => c.name)).toEqual(['fly']);
    const [rotation] = copy.clips[0]?.tracks ?? [];
    expect(rotation?.name).toBe('head.quaternion');
    expect(Array.from(rotation?.values ?? [])).toEqual(Array.from(Float32Array.from(clip().tracks[0]?.values ?? [])));
    part.geometry.dispose(); geometry.dispose(); material.dispose();
  });
  it('writes a standard skin any glTF loader reads, welds the soup and embeds the exact map bytes', async () => {
    const geometry = fixture(), material = new MeshStandardMaterial({ name: 'painted' });
    const image = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
    const { glb } = skinnedGlb({ name: 'painted', bones: BONES, parts: [{ geometry, material, texture: { image, mimeType: 'image/webp', sampler: { magFilter: 9729, wrapS: 10497 } } }] });
    const view = new DataView(glb.buffer, glb.byteOffset), doc = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + view.getUint32(12, true)))) as { images: { bufferView: number; mimeType: string }[]; bufferViews: { byteOffset: number; byteLength: number }[]; textures: unknown; accessors: { count: number }[]; extensionsRequired: unknown; meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[] };
    expect(doc.images.map(i => i.mimeType)).toEqual(['image/webp']);
    const imageView = doc.bufferViews[doc.images[0]?.bufferView ?? -1], bin = 28 + view.getUint32(12, true);
    expect(glb.subarray(bin + (imageView?.byteOffset ?? 0), bin + (imageView?.byteOffset ?? 0) + (imageView?.byteLength ?? 0))).toEqual(image);
    expect(doc.textures).toEqual([{ sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } }]);
    expect(doc.extensionsRequired).toEqual(['EXT_texture_webp']);
    const primitive = doc.meshes[0]?.primitives[0];
    expect(doc.accessors[primitive?.attributes['POSITION'] ?? -1]?.count).toBe(5);
    expect(doc.accessors[primitive?.indices ?? -1]?.count).toBe(6);
    const plain = skinnedGlb({ name: 'plain', bones: BONES, parts: [{ geometry, material }] }).glb;
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(plain).buffer, '');
    let skinned = 0;
    gltf.scene.traverse((node) => { if ('isSkinnedMesh' in node && node.isSkinnedMesh === true) skinned++; });
    expect(skinned).toBe(1);
    geometry.dispose(); material.dispose();
  });
  it('refuses bones out of order and joints past the skeleton', () => {
    const geometry = fixture(), material = new MeshStandardMaterial();
    expect(() => skinnedGlb({ name: 'x', bones: [{ name: 'head', parent: 'body', pos: [0, 0, 0] }, { name: 'body', parent: null, pos: [0, 0, 0] }], parts: [{ geometry, material }] })).toThrow('parent');
    expect(() => skinnedGlb({ name: 'x', bones: BONES.slice(0, 2), parts: [{ geometry, material }] })).toThrow('within the bones');
    geometry.dispose(); material.dispose();
  });
});
