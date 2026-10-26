import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiDecorative } from './fixtures/nalati-decorative';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply the complete original native terrain bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decorativeRows } from '../src/shards/nalati-grasslands/generators/decorativeInput';
import { dressingScene, dressingSceneBlobs } from '../src/shards/nalati-grasslands/generators/dressingScene';
import * as v from 'valibot';
import { withPortableMath } from '../src/commons/bake/portableMath';
import original from './fixtures/nalati-dressing-scenes.json' with { type: 'json' };

for (const fresh of [false, true]) test(`${fresh ? 'fresh native' : 'prepared native'} profiles preserve all complete dressing scenes and addresses`, () => {
  const profiles = fresh ? withPortableMath(() => decorativeRows(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'))) : nalatiDecorative;
  const blobs = dressingSceneBlobs(profiles,nalatiRuntime);
  const actual = blobs.map(blob => {
    const name = blob.file.name;
    if (name === undefined) throw new Error('Missing original dressing file name');
    return { name, bytes: blob.bytes.length, hash: blob.file.hash };
  });
  expect(actual.sort((a, b) => a.name.localeCompare(b.name))).toEqual([...original].sort((a, b) => a.name.localeCompare(b.name)));
});

test('supplied incomplete decorative profiles refuse without falling back to the retained copy', () => {
  expect(() => dressingSceneBlobs({},nalatiRuntime)).toThrow();
  expect(() => dressingSceneBlobs({ phone: {}, desktop: {} },nalatiRuntime)).toThrow();
  expect(() => dressingSceneBlobs(null,nalatiRuntime)).toThrow();
  expect(() => dressingSceneBlobs(undefined,nalatiRuntime)).toThrow();
});

test('missing or malformed supplied runtime metadata refuses without a retained fallback', () => {
  for (const runtime of [undefined, null, {}, { places: { rows: [] } }]) {
    expect(() => dressingSceneBlobs(nalatiDecorative, runtime)).toThrow();
  }
});

test('supplied place addresses drive both tier wires without mutating their source', () => {
  const beforeRuntime = JSON.stringify(nalatiRuntime);
  const input = v.parse(v.looseObject({ places: v.looseObject({ rows: v.array(v.looseObject({
    name: v.string(), meshes: v.array(v.looseObject({ offset: v.number() })),
  })) }) }), structuredClone(nalatiRuntime));
  const mesh = input.places.rows.find(row => row.name === 'camp')?.meshes[0];
  if (mesh === undefined) throw new Error('Missing native camp mesh');
  mesh.offset += 4;
  const before = JSON.stringify(input), blobs = dressingSceneBlobs(nalatiDecorative, input);
  for (const tier of ['phone', 'desktop'] as const) {
    const geometry = dressingScene(tier, nalatiDecorative, input).geometry['camp.0'];
    if (geometry?.kind !== 'baked-file') throw new Error('Missing supplied camp geometry');
    const bytes = blobs.find(blob => blob.file.name === geometry.address.file)?.bytes;
    if (bytes === undefined) throw new Error('Missing supplied camp address bytes');
    expect(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(geometry.address.word * 4, true)).toBe(mesh.offset);
  }
  expect(JSON.stringify(input)).toBe(before);
  expect(JSON.stringify(nalatiRuntime)).toBe(beforeRuntime);
});
