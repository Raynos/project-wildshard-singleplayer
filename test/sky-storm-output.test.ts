// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the complete committed storm output, not a regenerated pin.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare all bytes without expanding binary assertions.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the actual retained generator catalogue.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { stormRest } from '../src/shards/far-reach/generators/restScene';

test('the retained storm declaration and committed geometry match the current merged-bolt producer', () => {
  const output = 'public/assets/far-reach/baked/rest-storm.glb', original = readFileSync(output);
  const { glb, scene } = stormRest(), hash = hashImmutableBytes(glb);
  expect(glb.byteLength).toBe(43_108);
  expect(hash).toBe('fc828ac38a91fd74abbe6fc63f823096e42744d9ed0d0fc057d74c73c3a5ec32');
  expect(Buffer.compare(glb, original)).toBe(0);
  expect(scene.nodes.filter(row => row.kind === 'mesh')).toHaveLength(2);
  const job = discoverGeneration(resolve('.')).jobs.find(row => row.id === 'sky-rest-storm');
  if (job === undefined) throw new Error('Missing retained storm producer');
  expect(job.outputs).toEqual([output]);
  expect(job.buildOutputs).toEqual({ [output]: hash });
});
