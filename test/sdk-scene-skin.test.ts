import { AnimationClip, AnimationMixer, Bone, BoxGeometry, Float32BufferAttribute, InterpolateDiscrete, InterleavedBuffer, InterleavedBufferAttribute, MeshStandardMaterial, QuaternionKeyframeTrack, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, VectorKeyframeTrack, type Object3D } from 'three';
import { expect, it } from 'vitest';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { sampleSkinClip, skinnedGlb } from '../src/sdk/bake/export';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';
import { pastelProps } from '../src/shards/pastel-plain/generators/props';

function isSkin(object: Object3D | undefined): object is SkinnedMesh { return object instanceof SkinnedMesh; }

function rig(): SkinnedMesh {
  const geometry = new BoxGeometry(), count = geometry.getAttribute('position').count;
  geometry.clearGroups();
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(Array.from({ length: count * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(Array.from({ length: count * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ color: 0x579ac3 })); mesh.name = 'pilot.skin';
  const root = new Bone(), mid = new Bone(), tip = new Bone(); root.name = 'root'; mid.name = 'mid'; tip.name = 'tip';
  mid.position.y = 0.25; tip.position.y = 0.5; mesh.add(root); root.add(mid); mid.add(tip);
  mesh.updateMatrixWorld(true); mesh.bind(new Skeleton([tip, root, mid]));
  mesh.animations = [new AnimationClip('idle', 1, [
    new VectorKeyframeTrack('mid.position', [0, 0.5, 1], [0, 0.25, 0, 0, 0.375, 0, 0, 0.25, 0]),
    new QuaternionKeyframeTrack('tip.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.19866933079506122, 0, 0.9800665778412416]),
  ]), new AnimationClip('step', 1, [new VectorKeyframeTrack('root.scale', [0, 0.5, 1], [1, 1, 1, 1.1, 1.1, 1.1, 1, 1, 1], InterpolateDiscrete)])];
  return mesh;
}

function persisted(root: Scene): SceneDescription {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Cross the actual JSON wire boundary, including typed track arrays.
  return JSON.parse(JSON.stringify(readScene(root))) as SceneDescription;
}
function samples(mesh: SkinnedMesh): ReturnType<typeof sampleSkinClip>[] {
  return mesh.animations.map(clip => {
    const mixer = new AnimationMixer(mesh); mixer.clipAction(clip).play();
    try { return sampleSkinClip(mesh, clip.name, clip.duration, time => { mixer.setTime(time); }, 30); }
    finally { mixer.stopAllAction(); mixer.uncacheRoot(mesh); }
  });
}

for (const [name, fixture] of [['Template 1', templateProps], ['Pastel Plain', pastelProps]] as const) {
  it(`${name}: an added animated author rig survives persisted scene JSON with every compiled skin/clip byte identical`, async () => {
    // Both shipping static pilots remain unchanged; the added rig exercises the new authoring capability.
    const authored = fixture(20), scene = new Scene(), before = rig(); scene.add(authored.source.static, before);
    try {
      const description = persisted(scene), afterRoot = restoreSceneGraph(description), after = afterRoot.getObjectByName(before.name);
      if (!isSkin(after)) throw new Error('Missing persisted skin');
      expect(after.skeleton.bones.map(bone => bone.name)).toEqual(['tip', 'root', 'mid']);
      expect(after.skeleton.boneInverses.map(matrix => matrix.elements)).toEqual(before.skeleton.boneInverses.map(matrix => matrix.elements));
      expect(after.animations.map(clip => [clip.name, clip.duration, clip.blendMode])).toEqual(before.animations.map(clip => [clip.name, clip.duration, clip.blendMode]));
      const oldSamples = samples(before), newSamples = samples(after); expect(newSamples).toStrictEqual(oldSamples);
      expect(await skinnedGlb(after, newSamples)).toStrictEqual(await skinnedGlb(before, oldSamples));
    } finally { authored.dispose(); before.geometry.dispose(); }
  });
}

it('retains raw normalized/interleaved integer channels without decoding and truncating their storage', () => {
  const mesh = rig(), count = mesh.geometry.getAttribute('position').count;
  const buffer = new InterleavedBuffer(new Uint8Array(Array.from({ length: count * 5 }, (_, i) => i % 5 === 0 ? 73 : i % 5 === 1 ? 255 : 0)), 5);
  mesh.geometry.setAttribute('skinWeight', new InterleavedBufferAttribute(buffer, 4, 1, true));
  const scene = new Scene(); scene.add(mesh); const rows = persisted(scene), restored = restoreSceneGraph(rows).getObjectByName(mesh.name);
  if (!isSkin(restored)) throw new Error('Missing normalized skin');
  expect(rows.geometries[0]?.attributes['skinWeight']?.array.slice(0, 4)).toEqual([255, 0, 0, 0]);
  expect(restored.geometry.getAttribute('skinWeight').getX(0)).toBe(1);
});

it('refuses outside or repeated joints, invalid influences and UUID-bound/custom animation laws', () => {
  const scene = new Scene(), mesh = rig(); scene.add(mesh);
  mesh.skeleton.bones[0] = new Bone(); expect(() => readScene(scene)).toThrow(/outside/u);
  const valid = rig(), again = new Scene(); again.add(valid);
  valid.geometry.getAttribute('skinIndex').setX(0, 99); expect(() => readScene(again)).toThrow(/influence/u);
  const uuid = rig(), third = new Scene(); third.add(uuid);
  uuid.animations = [new AnimationClip('uuid', 1, [new VectorKeyframeTrack(`${uuid.uuid}.position`, [0, 1], [0, 0, 0, 1, 0, 0])])];
  expect(() => readScene(third)).toThrow(/UUID/u);
  const repeated = rig(), fourth = new Scene(); fourth.add(repeated);
  repeated.skeleton.bones[1] = repeated.skeleton.bones[0] ?? new Bone(); expect(() => readScene(fourth)).toThrow(/distinct/u);
  const custom = rig(), fifth = new Scene(); fifth.add(custom);
  const track = custom.animations[0]?.tracks[0];
  if (track === undefined || !('createInterpolant' in track)) throw new Error('Missing fixture interpolant');
  track.createInterpolant = () => null;
  expect(() => readScene(fifth)).toThrow(/Custom/u);
});
