import { expect, test } from 'vitest';
import { nameBlob } from '../src/sdk/blobs';
import { originalSkyRigs } from './fixtures/sky-original-rigs';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { sceneRigFiles } from '../src/game/shardfile/sceneRigFiles';
import type { ModelLibraryRows } from '../src/game/plugin/geometry';
import { bootFileList, bootSourceFiles, bootLateReads } from '../src/engine/boot/filePolicy';
import { registerGpuFiles, standIn } from '../src/engine/boot/gpuFiles';
import { TIER, initializeTier } from '../src/engine/core/tier';
import { parseDiscoveryValues } from '../src/format/discoveryValues';
import { skyRigAssetSources } from '../src/shards/far-reach/generators/rigAssetSources';
import { SKY_RIG_LIBRARY, skyRigLibrary } from '../src/shards/far-reach/generators/rigLibrary';
import { SKY_PAGE_PROGRAM } from '../src/shards/far-reach/generators/rows/population';
import { skyModelSource } from '../src/shards/far-reach/generators/sceneSources';
import { skyProductBoot, LATE_READS } from '../src/shards/far-reach/generators/bootInventory';
import { SKY_CREATURES, SKY_CREATURE_RIGS } from '../src/shards/far-reach/generators/fileInventory';
import { GPU_FILES } from '../src/shards/far-reach/ktx2.generated';

const blobs = [...originalSkyRigs()].map(([name, bytes]) => nameBlob(`world/rigs/${name}`, 'glb', bytes));
const files = blobs.map(blob => blob.file);
const admitted = skyRigAssetSources(files, GPU_FILES);
const roc = files[0], phone = files[4];
if (roc === undefined || phone === undefined) throw new Error('Missing complete rig fixture');
const url = (path: string): string => `/shardfiles/far-reach/${path}`;

test('all original rig bytes resolve through the native product with only the admitted phone substitution', async () => {
  expect(SKY_PAGE_PROGRAM.species.library).toBe(SKY_RIG_LIBRARY);
  const product = createShardProduct({ slug: 'far-reach', revision: 1,
    shardfile: emptyShardfile({ slug: 'far-reach', name: 'Sky', author: 'Fixture', revision: 1, seed: 6417 }),
    sections: new Map(), files: new Map(files.map(file => [file.name ?? '', { hash: file.hash, url: url(file.path) }])),
    read: hash => {
      const blob = blobs.find(row => row.file.hash === hash);
      if (blob === undefined) throw new Error('Missing verified rig');
      return Promise.resolve(blob.bytes);
    } });
  const rigs = skyRigLibrary(admitted.urls);
  const rows: ModelLibraryRows<string, string> = { meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 0, rigs };
  const resolved = sceneRigFiles(rows, product);
  expect(sceneRigFiles({ ...rows, rigs: SKY_RIG_LIBRARY }, product).rigs).toBe(SKY_RIG_LIBRARY);
  expect(rigs).toEqual({ ...SKY_RIG_LIBRARY, bodies: { ...SKY_RIG_LIBRARY.bodies, urls: admitted.urls } });
  expect(rigs.bodies.urls).not.toBe(admitted.urls);
  for (const creature of SKY_CREATURES) {
    const name = admitted.urls[creature], file = files.find(row => row.name === name);
    if (file === undefined) throw new Error('Missing admitted creature');
    expect(resolved.rigs?.bodies.urls[creature]).toBe(url(file.path));
    expect(rows.rigs?.bodies.urls[creature]).toBe(`world/rigs/${creature}.glb`);
    expect(await product.file(name)).toEqual(blobs.find(blob => blob.file.name === name)?.bytes);
  }
  expect(resolved.rigs).toEqual({ ...rigs, bodies: { ...rigs.bodies,
    urls: Object.fromEntries(SKY_CREATURES.map(creature => [creature, product.url(admitted.urls[creature])])) } });
  expect(admitted.gpuFiles.phone[url(roc.path)]).toBe(url(phone.path));
  for (const tier of ['phone', 'desktop'] as const) {
    expect(Object.entries(admitted.gpuFiles[tier]).filter(([source]) => source !== url(roc.path)))
      .toEqual(Object.entries(GPU_FILES[tier]).filter(([source]) => source !== SKY_CREATURE_RIGS['storm-roc']));
  }
  const previous = TIER;
  registerGpuFiles(admitted.gpuFiles);
  try {
    for (const tier of ['phone', 'desktop'] as const) {
      initializeTier(tier);
      expect(standIn(url(roc.path), 'ktx2')).toBe(tier === 'phone' ? url(phone.path) : undefined);
      for (const file of files) expect(standIn(url(file.path), 'img')).toBeUndefined();
    }
  } finally { initializeTier(previous); }
});

test('rig metadata changes only native URLs and omits their public boot rows across both tiers and policies', () => {
  const original = skyProductBoot(), owned = skyProductBoot(admitted);
  expect(parseDiscoveryValues(owned)).toEqual(owned);
  expect(owned.ktx2).toEqual(admitted.gpuFiles);
  expect(owned['boot.sources'].gpuFiles).toEqual(admitted.gpuFiles);
  const publicRigs = new Set<string>(Object.values(SKY_CREATURE_RIGS));
  const originalPhone = GPU_FILES.phone[SKY_CREATURE_RIGS['storm-roc']];
  if (originalPhone === undefined) throw new Error('Missing original phone oracle');
  publicRigs.add(originalPhone);
  for (const tier of ['phone', 'desktop'] as const) {
    expect(bootFileList(owned['boot.files'], tier)).toEqual(bootFileList(original['boot.files'], tier).filter(file => !publicRigs.has(file)));
    for (const mode of ['img', 'ktx2'] as const) {
      const before = bootSourceFiles(original['boot.sources'], tier, mode), after = bootSourceFiles(owned['boot.sources'], tier, mode);
      expect(after).toEqual({ ...before, props: before.props.filter(file => !publicRigs.has(file)) });
      expect(Object.values(after).flat().some(file => file.startsWith('/shardfiles/'))).toBe(false);
      expect(bootLateReads(owned['boot.lateReads'], tier, mode)).toEqual(LATE_READS);
    }
  }
  const baseline = skyModelSource('bridge.glb', 'mill.glb', 'fan.glb');
  const changed = skyModelSource('bridge.glb', 'mill.glb', 'fan.glb', skyRigLibrary(admitted.urls));
  let expected = new TextDecoder().decode(baseline.bytes);
  for (const creature of SKY_CREATURES) expected = expected.replace(JSON.stringify(SKY_CREATURE_RIGS[creature]), JSON.stringify(admitted.urls[creature]));
  expect(new TextDecoder().decode(changed.bytes)).toBe(expected);
  expect(skyProductBoot()).toEqual(original);
  expect(skyModelSource('bridge.glb', 'mill.glb', 'fan.glb')).toEqual(baseline);
});

test('incomplete, duplicate, mismatched or aliased admitted representations refuse', () => {
  for (const file of files) expect(() => skyRigAssetSources(files.filter(row => row !== file), GPU_FILES)).toThrow('exactly one admitted GLB');
  expect(() => skyRigAssetSources([...files, roc], GPU_FILES)).toThrow('exactly one admitted GLB');
  expect(() => skyRigAssetSources([{ ...roc, kind: 'bin' }, ...files.slice(1)], GPU_FILES)).toThrow('exactly one admitted GLB');
  expect(() => skyRigAssetSources([{ ...roc, hash: 'invalid' }, ...files.slice(1)], GPU_FILES)).toThrow('exactly one admitted GLB');
  expect(() => skyRigAssetSources([{ ...roc, path: '../foreign.glb' }, ...files.slice(1)], GPU_FILES)).toThrow('blob path differs');
  expect(() => skyRigAssetSources([...files.slice(0, 4), { ...phone, hash: roc.hash, path: roc.path }], GPU_FILES)).toThrow('cannot alias');
  expect(() => skyRigAssetSources(files, { phone: {}, desktop: {} })).toThrow('original phone variant');
  expect(() => skyRigAssetSources(files, { ...GPU_FILES, desktop: { [SKY_CREATURE_RIGS['sky-goat']]: '/foreign.glb' } })).toThrow('not admitted');
  expect(() => skyRigAssetSources(files, { ...GPU_FILES, phone: { ...GPU_FILES.phone, [url(roc.path)]: url(phone.path) } })).toThrow('repeated translated source');
});
