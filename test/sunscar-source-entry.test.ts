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
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };

const signature = (value: unknown): { bytes: number; hash: string } => {
  const bytes = new TextEncoder().encode(encodeCanonicalJson(value));
  return { bytes: bytes.length, hash: hashImmutableBytes(bytes) };
};
const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values]
  .map(([key, value]) => [key, value.length, hashImmutableBytes(value)])
  .sort(([a], [b]) => String(a).localeCompare(String(b)));

test('the source entry owns both outputs with the complete original declaration and output bytes', () => {
  expect(entry).toBe(generate);
  const result = generate();
  expect(result.output).toBe(output);
  expect(signature(result.shard)).toEqual(before.raw.shard);
  expect(signature({ ...output, assets: physical(output.assets), platform: { ...output.platform, files: physical(output.platform.files) } }))
    .toEqual(before.raw.output);
});

test('direct world rows preserve the original ordered aggregate without its JSON handoff', () => {
  expect(signature(worldBakes())).toEqual(before.raw.world);
  const registry = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), shard: v.nullable(v.string()), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  expect(registry.jobs.some(row => row.id === 'signal-world-bakes')).toBe(false);
  expect(registry.jobs.filter(row => row.shard === 'sunscar-dunes')).toHaveLength(21);
  expect(registry.jobs.flatMap(row => row.inputRoots.concat(row.outputs)).some(path => path.endsWith('/worldBakes.generated.json'))).toBe(false);
});


test('the SDK admits all original physical bytes, platform metadata and mirrors through the source entry', async () => {
  const result = await readProjectAssets(resolve('src/shards/sunscar-dunes'));
  expect(signature(result.shard)).toEqual(before.shard);
  expect(physical(result.assets)).toEqual(before.assets);
  const admitted = { ...result.output,
    ...(result.output.custom === undefined ? {} : { custom: { ...result.output.custom, files: physical(result.output.custom.files) } }),
    ...(result.output.platform === undefined ? {} : { platform: { ...result.output.platform, files: physical(result.output.platform.files) } }),
  };
  expect(signature(admitted)).toEqual(before.output);
  expect(signature(result.mirrors)).toEqual(before.mirrors);
});
