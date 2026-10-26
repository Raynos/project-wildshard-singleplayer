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
import { sceneWithNativeOutcrops } from './fixtures/nalati-scene-provenance';
import { hashImmutableBytes } from '../src/sdk/immutable';

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

test('the two observed Linux outcrop input values reconstruct both complete scene wires exactly', () => {
  const source = v.parse(v.looseObject({ places: v.looseObject({ rows: v.array(v.looseObject({
    name: v.string(), members: v.array(v.tuple([v.string(), v.unknown()])),
  })) }) }), structuredClone(nalatiRuntime));
  const row = source.places.rows.find(value => value.name === 'outcrops'), pair = row?.members[0];
  if (row === undefined || pair === undefined) throw new Error('Missing original outcrop member');
  const member = v.parse(v.looseObject({ boxes: v.array(v.number()), solid: v.array(v.unknown()), descs: v.array(v.unknown()) }), pair[1]);
  expect(member.boxes[1113]).toBe(-243.679218795643);
  member.boxes[1113] = -243.67921879564298;
  const contacts = [...member.solid, ...member.descs];
  const contact = v.parse(v.looseObject({ z: v.number() }), contacts[166]);
  expect(contact.z).toBe(-15.97741638745246);
  contact.z = -15.977416387452461;
  if (member.solid.length > 166) member.solid[166] = contact;
  else member.descs[166 - member.solid.length] = contact;
  row.members[0] = [pair[0], member];
  const compiled = dressingSceneBlobs(nalatiDecorative, source);
  for (const [tier, hash] of [['phone', '3d176427025a70af86f0a9a39a4fd61d14874e20be6c0145282e6de7ca2305be'],
    ['desktop', 'f7958d4001242d1a99cb5a18f8034cda31fae3b69aeefaa6b9ec77f1a4a9b5cd']] as const) {
    const name = `world/dressing-${tier}.json`;
    const frozen = dressingSceneBlobs(nalatiDecorative, nalatiRuntime).find(blob => blob.file.name === name);
    const actual = compiled.find(blob => blob.file.name === name);
    if (frozen === undefined || actual === undefined) throw new Error('Missing complete dressing wire');
    const projected = sceneWithNativeOutcrops(frozen, source);
    expect(hashImmutableBytes(projected.bytes)).toBe(hash);
    expect(projected.file).toEqual(actual.file);
    expect(Buffer.compare(projected.bytes, actual.bytes)).toBe(0);
    expect(hashImmutableBytes(frozen.bytes)).toBe(original.find(pin => pin.name === name)?.hash);
    expect(() => sceneWithNativeOutcrops(frozen, {})).toThrow();
  }
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
