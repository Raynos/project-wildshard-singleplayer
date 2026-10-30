// oxlint-disable-next-line import/no-nodejs-modules -- Read actual native inputs and verify source-handoff retirement.
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bridgeRestFiles } from '../src/shards/far-reach/generators/bridgeRest';
import { MODEL_URLS } from '../src/shards/far-reach/generators/fileInventory';

const hierarchy = 'src/shards/far-reach/data/bridgeRest.generated.json';

test('both bridge writers and every declared handoff reader are retired', () => {
  expect(existsSync(hierarchy)).toBe(false);
});

test('owned bridge compilation reads its declared native model and publishes both files', async () => {
  const reads: string[] = [];
  const files = await bridgeRestFiles(url => { reads.push(url); return new Uint8Array(readFileSync(`public${url}`)); });
  expect(reads).toEqual([MODEL_URLS['bridge-deck']]);
  expect([...files.keys()]).toEqual(['bridge-rest.glb', 'bridge-rest.json']);
  const glb = files.get('bridge-rest.glb'), rows = files.get('bridge-rest.json');
  if (glb === undefined || rows === undefined) throw new Error('Missing owned bridge files');

});
