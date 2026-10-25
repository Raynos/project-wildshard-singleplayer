// oxlint-disable-next-line import/no-nodejs-modules -- Verify the exact retired catalogue row in the shared source registry.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real SDK project reader at its defining author folder.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import entry, { generate } from '../src/shards/sunscar-dunes/shard.config';


import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { generated, world, originalOutput as output } from './fixtures/sunscar-source-program';
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };
import originalProductAssets from './fixtures/sunscar-duplicate-product.json' with { type: 'json' };
import rigFiles from './fixtures/sunscar-rig-files.json' with { type: 'json' };
import { BOOT_FILES, BOOT_SOURCES } from '../src/shards/sunscar-dunes/generators/rows/boot';
import { SAND_FILES } from '../src/shards/sunscar-dunes/generators/rows/sand';
import { DUNE_RIG_URLS, BAKED_URLS } from '../src/shards/sunscar-dunes/generators/rows/files';

const signature = (value: unknown): { bytes: number; hash: string } => {
  const bytes = new TextEncoder().encode(encodeCanonicalJson(value));
  return { bytes: bytes.length, hash: hashImmutableBytes(bytes) };
};
const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values]
  .map(([key, value]) => [key, value.length, hashImmutableBytes(value)])
  .sort(([a], [b]) => String(a).localeCompare(String(b)));

test('the source entry owns both outputs with the complete original declaration and output bytes', () => {
  expect(entry).toBe(generate);
  const result = generated;
  expect(result.output?.platform).toEqual(output.platform);
  expect(signature(result.shard)).toEqual(before.raw.shard);
  expect(signature({ ...output, assets: physical(output.assets), platform: { ...output.platform, files: physical(output.platform.files) } }))
    .toEqual(before.raw.output);
});

test('direct world rows preserve the original ordered aggregate without its JSON handoff', () => {
  expect(signature(world)).toEqual(before.raw.world);
  const registry = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), shard: v.nullable(v.string()), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  expect(registry.jobs.some(row => ['signal-world-bakes', 'signal-product', 'signal-fire-book', 'signal-rigs', 'signal-manifest-ground', 'signal-world', 'signal-sand', 'signal-data-map', 'signal-declaration'].includes(row.id))).toBe(false);
  expect(registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs)).some(path => path.startsWith('src/shards/sunscar-dunes/.wildshard/product/'))).toBe(false);
  expect(registry.jobs.filter(row => row.shard === 'sunscar-dunes')).toHaveLength(13);
  const paths = registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs));
  expect(paths.some(path => path.startsWith('src/shards/sunscar-dunes/') && /\/(?:manifestGround|nativeGround)\.generated\.json$/u.test(path))).toBe(false);
  expect(registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs)).some(path => path.endsWith('/worldBakes.generated.json'))).toBe(false);
});


test('the SDK admits all original physical bytes, platform metadata and mirrors through the source entry', async () => {
  const result = await readProjectAssets(resolve('src/shards/sunscar-dunes'), undefined, { folder: 'sunscar-dunes', imageRoots: [{ prefix: '/assets/', directory: resolve('public/assets') }] });
  const changedNames = ['world/sources/models.json', 'world/sources/bakes.json'];
  const descriptors = changedNames.map(name => {
    const old = output.namedFiles.find(file => file.name === name), current = result.output.namedFiles?.find(file => file.name === name);
    if (old === undefined || current === undefined) throw new Error('Missing scene descriptor');
    return { old, current };
  });
  const owned = result.output.namedFiles?.filter(file => file.name?.startsWith('geometry/rigs/') === true
    || file.name?.startsWith('geometry/world/') === true || file.name === 'textures/plait.bin' || file.name === 'ui/map') ?? [];
  expect(owned).toHaveLength(13);
  const map = owned.find(file => file.name === 'ui/map');
  expect(map?.hash).toBe('bac9393474d96298d9bd4a407197d0bc86be913b872c8430e8f2e0aabd5cb399');
  expect(map?.compressed).toBe(172348);
  expect(result.shard.map?.image).toBe(map?.hash);
  for (const rig of owned.filter(file => file.name?.startsWith('geometry/rigs/'))) {
    const expected = Object.entries(rigFiles).find(([name]) => rig.name === `geometry/rigs/${name}`)?.[1];
    expect({ bytes: rig.compressed, hash: rig.hash }).toEqual(expected);
  }
  const hashes = new Set(owned.map(file => file.hash));
  const compressed = owned.reduce((sum, file) => sum + file.compressed, descriptors.reduce((sum, row) => sum + row.current.compressed - row.old.compressed, 0));
  const resident = owned.reduce((sum, file) => sum + file.decoded + file.gpu,
    descriptors.reduce((sum, row) => sum + row.current.decoded + row.current.gpu - row.old.decoded - row.old.gpu, 0));
  const budget = result.shard.budgets.library;
  const { map: _map, ...previousShard } = result.shard;
  expect(signature({ ...previousShard,
    files: result.shard.files.filter(file => !hashes.has(file.hash)).map(file => {
      const row = descriptors.find(value => value.current.hash === file.hash);
      if (row === undefined) return file;
      const { name: _name, path: _path, jsonSchema: _schema, ...oldFile } = row.old; return oldFile;
    }),
    library: result.shard.library.filter(hash => !hashes.has(hash)).map(hash => descriptors.find(row => row.current.hash === hash)?.old.hash ?? hash),
    budgets: { ...result.shard.budgets, library: { ...budget, compressed: budget.compressed - compressed, resident: budget.resident - resident,
      ...(budget.downloadAllowance === undefined ? {} : { downloadAllowance: budget.downloadAllowance - compressed }) } },
  })).toEqual(before.shard);
  const assets = physical(result.assets);
  expect(assets).toHaveLength(before.assets.length + 13);
  const projectedAssets = new Map(result.assets);
  for (const hash of hashes) projectedAssets.delete(hash);
  for (const row of descriptors) {
    projectedAssets.delete(row.current.hash);
    const oldBytes = output.assets.get(row.old.hash); if (oldBytes === undefined) throw new Error('Missing original scene bytes');
    projectedAssets.set(row.old.hash, oldBytes);
  }
  expect(physical(projectedAssets)).toEqual(before.assets);
  expect(originalProductAssets).toHaveLength(86);
  for (const hash of originalProductAssets) {
    const original = before.assets.find(row => row[0] === hash);
    if (original === undefined) throw new Error('Original duplicate asset missing from admitted oracle');
    expect(assets.find(row => row[0] === hash)).toEqual(original);
  }
  const admitted = { ...result.output,
    ...(result.output.custom === undefined ? {} : { custom: { ...result.output.custom, files: physical(result.output.custom.files) } }),
    ...(result.output.platform === undefined ? {} : { platform: { ...result.output.platform, files: physical(result.output.platform.files) } }),
    namedFiles: result.output.namedFiles?.filter(file => !hashes.has(file.hash)).map(file => descriptors.find(row => row.current.hash === file.hash)?.old ?? file),
  };
  const { discovery: _discovery, ...previousOutput } = admitted;
  expect(signature(previousOutput)).toEqual(before.output);
  expect(signature(result.mirrors)).toEqual(before.mirrors);
});

test('computed discovery removes only the retired public rig/world/skirt URLs in both tiers', () => {
  const rigs = new Set([...Object.values(DUNE_RIG_URLS), ...Object.values(BAKED_URLS)]);
  const expected = { tiers: { phone: { ...BOOT_SOURCES.tiers.phone, terrain: BOOT_SOURCES.tiers.phone.terrain.filter(url => url !== SAND_FILES.skirt), props: BOOT_SOURCES.tiers.phone.props.filter(url => !rigs.has(url)) },
    desktop: { ...BOOT_SOURCES.tiers.desktop, terrain: BOOT_SOURCES.tiers.desktop.terrain.filter(url => url !== SAND_FILES.skirt), props: BOOT_SOURCES.tiers.desktop.props.filter(url => !rigs.has(url)) } } };
  expect(generated.discovery).toEqual({ 'boot.sources': expected, 'boot.files': { ...BOOT_FILES, sources: expected } });
});
