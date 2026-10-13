// oxlint-disable-next-line import/no-nodejs-modules -- Exact retained GLBs are the authored source oracle.
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { AnimationClip, InterpolateDiscrete } from 'three';
import { expect, it } from 'vitest';
import { readRigMotion } from '@wildshard/sdk/bake/rig';
import { readSceneAnimations, restoreSceneAnimations } from '../src/sdk/sceneAnimation';

const sources = ['../public/assets/models/driftwood-fp/fp-arms.glb', '../public/assets/nine-dragon/viewmodel/fp-rig.glb'];
const read = (file: string): Uint8Array => Uint8Array.from(readFileSync(new URL(file, import.meta.url)));

it('restores every real non-swim clip exactly through the scene-animation reader', async () => {
  const motion = await readRigMotion(read(sources[0] ?? ''));
  expect(motion.clips).toHaveLength(18);
  const selected = motion.clips.filter(clip => !clip.name.startsWith('swim'));
  const restored = restoreSceneAnimations(readSceneAnimations(selected));
  for (const [index, clip] of selected.entries()) {
    const result = restored[index];
    expect(result?.duration).toBe(clip.duration);
    for (const [trackIndex, track] of clip.tracks.entries()) {
      const resultTrack = result?.tracks[trackIndex];
      expect(resultTrack?.name).toBe(track.name); expect(resultTrack?.times).toEqual(track.times);
      expect(resultTrack?.values).toEqual(track.values); expect(resultTrack?.getInterpolation()).toBe(track.getInterpolation());
    }
  }
});

it('keeps every decoded Meshopt input/output key, target, interpolation and duration exact', async () => {
  await MeshoptDecoder.ready;
  for (const file of sources) {
    const bytes = read(file), root = (await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(bytes)).getRoot();
    const motion = await readRigMotion(bytes);
    for (const animation of root.listAnimations()) {
      const clip = motion.clips.find(row => row.name === animation.getName());
      expect(clip?.tracks).toHaveLength(animation.listChannels().length);
      for (const channel of animation.listChannels()) {
        const path = channel.getTargetPath(), sampler = channel.getSampler();
        const property = path === 'translation' ? 'position' : path === 'rotation' ? 'quaternion' : 'scale';
        const track = clip?.tracks.find(row => row.name === `${channel.getTargetNode()?.getName()}.${property}`);
        expect(track?.times).toEqual(sampler?.getInput()?.getArray()); expect(track?.values).toEqual(sampler?.getOutput()?.getArray());
        expect(track === undefined ? null : AnimationClip.toJSON(new AnimationClip('one', -1, [track])).tracks[0]?.interpolation).toBeUndefined();
        expect(sampler?.getInterpolation()).toBe('LINEAR');
      }
    }
    for (const node of motion.nodes) {
      const original = root.listNodes().find(row => row.getName() === node.name);
      expect(node.position).toEqual(original?.getTranslation()); expect(node.quaternion).toEqual(original?.getRotation()); expect(node.scale).toEqual(original?.getScale());
    }
  }
});

it('preserves STEP keys and refuses unsupported cubic or duplicate channels instead of approximating them', async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  // Decode with the defining extension reader before authoring malformed variants.
  await MeshoptDecoder.ready;
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(read(sources[1] ?? ''));
  for (const extension of document.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const animation = document.getRoot().listAnimations()[0], sampler = animation?.listSamplers()[0];
  if (sampler === undefined || animation === undefined) throw new Error('Missing actual animation');
  sampler.setInterpolation('STEP');
  const stepped = await readRigMotion(await io.writeBinary(document));
  expect(stepped.clips[0]?.tracks.some(track => track.getInterpolation() === InterpolateDiscrete)).toBe(true);
  const channel = animation.listChannels()[0];
  const targetPath = channel?.getTargetPath();
  if (channel === undefined || targetPath === undefined || targetPath === null) throw new Error('Missing actual channel');
  animation.addChannel(document.createAnimationChannel().setTargetNode(channel.getTargetNode()).setTargetPath(targetPath).setSampler(channel.getSampler()));
  await expect(readRigMotion(await io.writeBinary(document))).rejects.toThrow('Duplicate rig animation binding');
  animation.removeChannel(animation.listChannels().at(-1) ?? channel);
  sampler.setInterpolation('CUBICSPLINE');
  await expect(readRigMotion(await io.writeBinary(document))).rejects.toThrow();
  await expect(readRigMotion(new Uint8Array(10))).rejects.toThrow('bounded GLB');
});
