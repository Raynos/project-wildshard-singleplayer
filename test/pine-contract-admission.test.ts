import { afterAll, expect, test } from 'vitest';
import { prepareOutput } from '../src/shards/pine-hollow/generators/output';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import pine from '../src/shards/pine-hollow/shard.config';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { ContractCatalogue } from '../src/format/contracts';
// oxlint-disable-next-line import/no-nodejs-modules -- The product's generation cache lives in a scratch folder.
import { mkdtempSync, rmSync } from 'node:fs';
import { hashImmutableBytes } from '../src/sdk/immutable';

const cache = mkdtempSync('tmp/pine-contracts-');
afterAll(() => rmSync(cache, { recursive: true, force: true }));
const CONTEXT = createProjectGeneration('src/shards/pine-hollow', hashImmutableBytes(new TextEncoder().encode('pine-contract-admission-v1')), new Map(), cache);

test('the actual contract file validates before page or native board construction', async () => {
  // GR8 (B5): the product compiles the guest, so the file is named by prepareOutput, not the static rows.
  const output = await prepareOutput(CONTEXT);
  const file = output.namedFiles.find(row => row.name === 'quests/contracts.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined || file.jsonSchema === undefined) throw new Error('The board needs its admitted named schema');
  const jsonSchema = file.jsonSchema;
  const read = (body: Uint8Array) => createShardProduct({ slug: 'pine-hollow', revision: 1, shardfile: pine, sections: new Map(),
    files: new Map([['quests/contracts.json', { hash: file.hash, url: file.path, jsonSchema }]]),
    read: () => Promise.resolve(body) }).json<ContractCatalogue>('quests/contracts.json');
  const catalogue = await read(bytes);
  expect(catalogue.rows).toHaveLength(11);
  expect(catalogue.program?.bytes).toBe('');
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  await expect(read(encode({ ...catalogue, slots: 0 }))).rejects.toThrow('refuses its schema');
  await expect(read(encode({ ...catalogue, tags: [{ tag: 'unbound', any: [{}] }] }))).rejects.toThrow('refuses its schema');
  await expect(read(encode({ ...catalogue, runtimeHook: 'foreign' }))).rejects.toThrow('refuses its schema');
});
