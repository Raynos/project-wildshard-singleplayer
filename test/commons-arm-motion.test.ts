// oxlint-disable-next-line import/no-nodejs-modules -- Exact retained GLBs are the authored two-shard source oracle.
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { AnimationClip, InterpolateDiscrete } from 'three';
import { expect, it } from 'vitest';
import { starterArmMotionPack } from '@wildshard/commons/packs/arms';
import { readRigMotion } from '@wildshard/sdk/bake/rig';
import { readSceneAnimations, restoreSceneAnimations } from '../src/sdk/sceneAnimation';
import { createCatalogue } from '../src/commons/catalogue';
import { commonsRequirements } from '../src/sdk/commons';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { ContentCache } from '../src/engine/boot/contentCache';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';

const sources = ['../public/assets/models/driftwood-fp/fp-arms.glb', '../public/assets/nine-dragon/viewmodel/fp-rig.glb'];
const read = (file: string): Uint8Array => Uint8Array.from(readFileSync(new URL(file, import.meta.url)));
const provenance = { credit: 'Wildshard authored arm animation', licence: 'First-party' };

it('generates identical real clips and base joints for Driftwood and Nine, excluding their distinct meshes and extra joints', async () => {
  const packs = await Promise.all(sources.map(file => starterArmMotionPack(read(file), provenance)));
  const first = packs[0], second = packs[1];
  if (first === undefined || second === undefined) throw new Error('Missing actual arm sources');
  expect(first.entries).toHaveLength(17); expect(first).toEqual(second);
  expect(first.entries.some(row => /swim|finger|weapon/u.test(row.id))).toBe(false);
  const firstCatalogue = createCatalogue([first]), secondCatalogue = createCatalogue([second]);
  expect(firstCatalogue.json).toBe(secondCatalogue.json);
  expect(firstCatalogue.assets.size).toBe(17);
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

it('downloads the seventeen actual shared motion assets once for two independently admitted consumers', async () => {
  const pack = await starterArmMotionPack(read(sources[1] ?? ''), provenance), built = createCatalogue([pack]);
  const requirements = commonsRequirements(built, built.catalogue.entries.map(row => row.id));
  const stored = new Map<string, Response>(), products = new Map<string, CachedProduct>(), downloads = new Map<string, number>();
  const address = (request: RequestInfo | URL): string => typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  const content = new ContentCache({ origin: 'https://platform.test/', hash: bytes => Promise.resolve(contentHash(bytes)), now: () => 1,
    storage: { open: () => Promise.resolve({ match: key => Promise.resolve(stored.get(address(key))?.clone()),
      put: (key, value) => { stored.set(address(key), value.clone()); return Promise.resolve(); },
      delete: key => Promise.resolve(stored.delete(address(key))), keys: () => Promise.resolve([...stored.keys()].map(key => new Request(key))) }) } });
  const cache: ProductCache = { product: base => Promise.resolve(products.get(base) ?? null),
    putProduct: (base, product) => { products.set(base, product); return Promise.resolve(); },
    asset: (_base, hash) => content.get(hash), putAsset: (_base, hash, bytes) => content.put(hash, bytes) };
  const allocator = new ResidencyAllocator(), scopes: Scope[] = [];
  try {
    for (const slug of ['driftwood-isle', 'nine-dragon-stack']) {
      const shard = emptyShardfile({ slug, name: slug, author: 'Wildshard', seed: 1, revision: 1 });
      shard.requires = { ...shard.requires, ...requirements }; shard.library = requirements.commons.map(hash => `commons:${hash}`);
      const product = await admitProduct(shard, { base: `https://platform.test/${slug}/`, offline: false, firstParty: true, cache,
        hash: bytes => Promise.resolve(contentHash(bytes)), fetch: url => {
          const hash = new URL(url).pathname.split('/').at(-1), bytes = hash === undefined ? undefined : built.assets.get(hash);
          if (hash === undefined || bytes === undefined) throw new Error('Unexpected motion request');
          downloads.set(hash, (downloads.get(hash) ?? 0) + 1); return Promise.resolve(new Response(Uint8Array.from(bytes)));
        } });
      const scope = new Scope(slug); scopes.push(scope); leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
    }
    expect(downloads.size).toBe(17); expect([...downloads.values()].every(count => count === 1)).toBe(true);
    expect(allocator.entries()).toHaveLength(17); expect(allocator.entries().every(entry => entry.refs === 2 && entry.category === 'commons')).toBe(true);
    expect(allocator.cost().input.commons).toBe([...built.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0));
    scopes[0]?.dispose(); expect(allocator.entries().every(entry => entry.refs === 1)).toBe(true);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});
