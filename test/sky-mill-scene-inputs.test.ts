// oxlint-disable-next-line import/no-nodejs-modules -- Read original native inputs and isolate real sealed-driver fixtures.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { millSceneSource, millSceneValues } from '../src/shards/far-reach/generators/millScene';
import { skyMillSceneSource } from '../src/shards/far-reach/generators/millSceneProgram';
import { HD_URLS } from '../src/shards/far-reach/generators/fileInventory';

const inputs = [HD_URLS['mill-tower'], HD_URLS['mill-foot']];
const originalHash = '3a4d921739c9ca69a3a36885fc4020c3ee01d47aa6097df406859a626ef842a8';
const read = (name: string): Uint8Array => new Uint8Array(readFileSync(`public${name}`));

test('the mill hierarchy derives its exact original hub and complete scene from both native models', async () => {
  const reads: string[] = [];
  const bytes = await millSceneSource(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual(inputs);
  expect(bytes.byteLength).toBe(2_200);
  expect(hashImmutableBytes(bytes)).toBe(originalHash);
  const values = await millSceneValues(read);
  expect(new TextEncoder().encode(`${JSON.stringify(values)}\n`)).toEqual(bytes);
});

test('mill scene row loans cannot mutate the next caller or retained publication', async () => {
  const values = await millSceneValues(read), root = values.MILL_SCENE.recipe.scene.nodes[0];
  if (root === undefined) throw new Error('Missing original mill root');
  root.children.push('caller-only');
  values.MILL_SCENE.recipe.imports.pop();
  expect(hashImmutableBytes(await millSceneSource(read))).toBe(originalHash);
  const fresh = await millSceneValues(read);
  expect(fresh.MILL_SCENE.recipe.scene.nodes[0]?.children).not.toContain('caller-only');
  expect(fresh.MILL_SCENE.recipe.imports).toHaveLength(7);
});

test('the mill scheduler handoff is retired while original native-source refusals remain strict', async () => {
  const native = new Map(inputs.map(url => [url, read(url)]));
  for (const name of inputs) {
    const omitted = new Map(native); omitted.delete(name);
    await expect(skyMillSceneSource(omitted)).rejects.toThrow('input inventory differs');
  }
  const bytes = (await skyMillSceneSource(native)).get('mill-scene.json');
  if (bytes === undefined) throw new Error('Missing original mill wire');
  expect(bytes.byteLength).toBe(2_200);
  expect(hashImmutableBytes(bytes)).toBe(originalHash);
});
