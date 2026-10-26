import { nalatiDecorative } from './fixtures/nalati-decorative';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply the complete original native terrain bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decorativeRows } from '../src/shards/nalati-grasslands/generators/decorativeInput';
import { dressingSceneBlobs } from '../src/shards/nalati-grasslands/generators/dressingScene';
import { withPortableMath } from '../src/commons/bake/portableMath';
import original from './fixtures/nalati-dressing-scenes.json' with { type: 'json' };

for (const fresh of [false, true]) test(`${fresh ? 'fresh native' : 'prepared native'} profiles preserve all complete dressing scenes and addresses`, () => {
  const profiles = fresh ? withPortableMath(() => decorativeRows(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'))) : nalatiDecorative;
  const blobs = dressingSceneBlobs(profiles);
  const actual = blobs.map(blob => {
    const name = blob.file.name;
    if (name === undefined) throw new Error('Missing original dressing file name');
    return { name, bytes: blob.bytes.length, hash: blob.file.hash };
  });
  expect(actual.sort((a, b) => a.name.localeCompare(b.name))).toEqual([...original].sort((a, b) => a.name.localeCompare(b.name)));
});

test('supplied incomplete decorative profiles refuse without falling back to the retained copy', () => {
  expect(() => dressingSceneBlobs({})).toThrow();
  expect(() => dressingSceneBlobs({ phone: {}, desktop: {} })).toThrow();
  expect(() => dressingSceneBlobs(null)).toThrow();
  expect(() => dressingSceneBlobs(undefined)).toThrow();
});
