// oxlint-disable-next-line import/no-nodejs-modules -- Verify the immutable source and emitted navigation bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Audit the real isolated authoring tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { readNavigation, parseNavigation } from '@wildshard/format/navigation';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

for (const [id, shard] of [['signal-navigation', 'sunscar-dunes'], ['sky-navigation', 'far-reach']] as const) it(`${id}: builds declared navigation before manifest consumers from a complete author closure`, () => {
  const jobs = discoverGeneration(process.cwd()).jobs, index = jobs.findIndex(job => job.id === id), job = jobs[index];
  if (job === undefined) throw new Error('Missing navigation author job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(process.cwd(), shard, entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const input = job.command[4]; if (typeof input !== 'string') throw new Error('Missing navigation source');
  const expected = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/navigation-json.mjs', input,
    'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, expected, shard);
  expect(job.seedOutputs).toEqual([]);
  expect(index).toBeLessThan(jobs.findIndex(row => row.id === (shard === 'sunscar-dunes' ? 'signal-rigs' : 'sky-rigs')));
  const original = new Uint8Array(readFileSync(input)), hash = hashImmutableBytes(original);
  const output = new Uint8Array(readFileSync(`src/shards/${shard}/assets/${hash}`));
  expect(output).toEqual(original);
  expect(output).toEqual(new Uint8Array(readFileSync(`public/assets/baked/${shard}/navmesh.bin`)));
  const metadata: unknown = JSON.parse(readFileSync(`src/shards/${shard}/data/navigation.generated.json`, 'utf8'));
  if (metadata === null || typeof metadata !== 'object' || !('navigation' in metadata)) throw new Error('Missing navigation row');
  expect(readNavigation(parseNavigation(metadata.navigation), output).length).toBeGreaterThan(0);
  expect(Reflect.get(metadata, 'url')).toBe(`/assets/baked/${shard}/navmesh.bin`);
  expect(job.buildOutputs?.[`src/shards/${shard}/assets/${hash}`]).toBe(hash);
});
