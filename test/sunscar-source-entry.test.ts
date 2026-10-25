// oxlint-disable-next-line import/no-nodejs-modules -- Verify the exact retired catalogue row in the shared source registry.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real SDK project reader at its defining author folder.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import entry, { generate } from '../src/shards/sunscar-dunes/shard.config';
import { output } from '../src/shards/sunscar-dunes/generators/sourceOutput';
import { worldBakes } from '../src/shards/sunscar-dunes/generators/worldBakes';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { generated } from './fixtures/sunscar-source-program';
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };
import originalProductAssets from './fixtures/sunscar-duplicate-product.json' with { type: 'json' };
import rigFiles from './fixtures/sunscar-rig-files.json' with { type: 'json' };
import { BOOT_FILES, BOOT_SOURCES } from '../src/shards/sunscar-dunes/generators/rows/boot';
import { DUNE_RIG_URLS } from '../src/shards/sunscar-dunes/generators/rows/files';

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
  expect(result.output?.platform).toBe(output.platform);
  expect(signature(result.shard)).toEqual(before.raw.shard);
  expect(signature({ ...output, assets: physical(output.assets), platform: { ...output.platform, files: physical(output.platform.files) } }))
    .toEqual(before.raw.output);
});

test('direct world rows preserve the original ordered aggregate without its JSON handoff', () => {
  expect(signature(worldBakes())).toEqual(before.raw.world);
  const registry = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), shard: v.nullable(v.string()), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  expect(registry.jobs.some(row => ['signal-world-bakes', 'signal-product', 'signal-fire-book', 'signal-rigs'].includes(row.id))).toBe(false);
  expect(registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs)).some(path => path.startsWith('src/shards/sunscar-dunes/.wildshard/product/'))).toBe(false);
  expect(registry.jobs.filter(row => row.shard === 'sunscar-dunes')).toHaveLength(18);
  expect(registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs)).some(path => path.endsWith('/worldBakes.generated.json'))).toBe(false);
});


test('the SDK admits all original physical bytes, platform metadata and mirrors through the source entry', async () => {
  const result = await readProjectAssets(resolve('src/shards/sunscar-dunes'));
  const oldModel = output.namedFiles.find(file => file.name === 'world/sources/models.json');
  const model = result.output.namedFiles?.find(file => file.name === 'world/sources/models.json');
  if (oldModel === undefined || model === undefined) throw new Error('Missing model descriptor');
  const rigs = result.output.namedFiles?.filter(file => file.name?.startsWith('geometry/rigs/')) ?? [];
  expect(rigs).toHaveLength(4);
  for (const rig of rigs) {
    const expected = Object.entries(rigFiles).find(([name]) => rig.name === `geometry/rigs/${name}`)?.[1];
    expect({ bytes: rig.compressed, hash: rig.hash }).toEqual(expected);
  }
  const hashes = new Set(rigs.map(file => file.hash));
  const compressed = rigs.reduce((sum, file) => sum + file.compressed, model.compressed - oldModel.compressed);
  const resident = rigs.reduce((sum, file) => sum + file.decoded + file.gpu, model.decoded + model.gpu - oldModel.decoded - oldModel.gpu);
  const { name: _name, path: _path, jsonSchema: _schema, ...oldFile } = oldModel;
  const budget = result.shard.budgets.library;
  expect(signature({ ...result.shard,
    files: result.shard.files.filter(file => !hashes.has(file.hash)).map(file => file.hash === model.hash ? oldFile : file),
    library: result.shard.library.filter(hash => !hashes.has(hash)).map(hash => hash === model.hash ? oldModel.hash : hash),
    budgets: { ...result.shard.budgets, library: { ...budget, compressed: budget.compressed - compressed, resident: budget.resident - resident,
      ...(budget.downloadAllowance === undefined ? {} : { downloadAllowance: budget.downloadAllowance - compressed }) } },
  })).toEqual(before.shard);
  const assets = physical(result.assets);
  expect(assets).toHaveLength(before.assets.length + 4);
  const projectedAssets = new Map(result.assets);
  for (const hash of hashes) projectedAssets.delete(hash);
  projectedAssets.delete(model.hash);
  const oldBytes = output.assets.get(oldModel.hash); if (oldBytes === undefined) throw new Error('Missing original model bytes');
  projectedAssets.set(oldModel.hash, oldBytes);
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
    namedFiles: result.output.namedFiles?.filter(file => !hashes.has(file.hash)).map(file => file.hash === model.hash ? oldModel : file),
  };
  const { discovery: _discovery, ...previousOutput } = admitted;
  expect(signature(previousOutput)).toEqual(before.output);
  expect(signature(result.mirrors)).toEqual(before.mirrors);
});

test('computed discovery removes only the four retired public rig URLs in both tiers', () => {
  const rigs = new Set(Object.values(DUNE_RIG_URLS));
  const expected = { tiers: { phone: { ...BOOT_SOURCES.tiers.phone, props: BOOT_SOURCES.tiers.phone.props.filter(url => !rigs.has(url)) },
    desktop: { ...BOOT_SOURCES.tiers.desktop, props: BOOT_SOURCES.tiers.desktop.props.filter(url => !rigs.has(url)) } } };
  expect(generated.discovery).toEqual({ 'boot.sources': expected, 'boot.files': { ...BOOT_FILES, sources: expected } });
});
