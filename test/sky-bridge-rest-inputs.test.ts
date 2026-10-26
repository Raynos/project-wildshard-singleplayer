// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the frozen geometry oracle and verify source-handoff retirement.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Discover the actual scheduler from the repository root.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bridgeRestFiles } from '../src/shards/far-reach/generators/bridgeRest';
import { MODEL_URLS } from '../src/shards/far-reach/generators/fileInventory';

const hierarchy = 'src/shards/far-reach/data/bridgeRest.generated.json';
const geometry = 'public/assets/far-reach/baked/bridge-rest.glb';

test('both bridge writers and every declared handoff reader are retired', () => {
  const { jobs } = discoverGeneration(resolve('.'));
  expect(jobs.some(job => job.id === 'sky-bridge-rest-rows' || job.id === 'sky-bridge-rest-glb')).toBe(false);
  for (const job of jobs) for (const file of [hierarchy, geometry]) {
    expect(job.outputs, job.id).not.toContain(file);
    expect(job.inputRoots, job.id).not.toContain(file);
  }
  expect(existsSync(hierarchy)).toBe(false);
});

test('owned bridge bytes preserve the complete predecessor hierarchy and frozen geometry', async () => {
  const reads: string[] = [];
  const files = await bridgeRestFiles(url => { reads.push(url); return new Uint8Array(readFileSync(`public${url}`)); });
  expect(reads).toEqual([MODEL_URLS['bridge-deck']]);
  expect([...files.keys()]).toEqual(['bridge-rest.glb', 'bridge-rest.json']);
  const glb = files.get('bridge-rest.glb'), rows = files.get('bridge-rest.json');
  if (glb === undefined || rows === undefined) throw new Error('Missing owned bridge files');
  expect(glb.byteLength).toBe(2_109_968);
  expect(hashImmutableBytes(glb)).toBe('1a31cb2c7b426d9ffb14db4e39792aeb0bde86f6f01d0b1796130a3a0c7d8bf0');
  expect(rows.byteLength).toBe(59_699);
  expect(hashImmutableBytes(rows)).toBe('ae5faee1125143aa75aa053cfbd418f9899c1b1a9907b617280a97e00c538bb4');
});
