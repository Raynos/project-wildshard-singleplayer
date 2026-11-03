import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SceneScatterPageSchema, parseSceneScatterPage, readSceneScatterPose } from '../src/format/sceneDressing';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { nalatiDressingPlacementBlobs, DRESSING_SCHEMAS } from '../src/shards/nalati-grasslands/generators/dressingSchemas';
import { nalatiDressingPages, nalatiPagedDressingRows, nalatiDressingPageReference } from '../src/shards/nalati-grasslands/generators/dressingPages';

const pose = { x: 1, z: -0, y: 2, yaw: 3, sx: 4, sy: 5, sz: 6, far: 7, r: .1, g: .2, b: .3, solid: true };
const data: Readonly<Record<string, readonly unknown[]>> = {
  boulder: [pose], slab: [pose], juniper: [pose], rose: [pose], willow: [pose], lupin: [pose], reed: [pose],
  logs: [{ ax: 1, az: 2, bx: 3, bz: 4, r: 5, drift: false }], stumps: [{ x: 1, z: 2, s: 3 }],
  ovoos: [{ x: 4, z: 5, s: 6 }], poles: [{ x: 7, z: 8, s: 9 }], fences: [[[1, 2], [3, 4]]],
  gates: [{ x: 1, z: 2, yaw: 3 }], drifts: [{ x: 1, z: 2, y: 3, r: 4 }],
  colliders: [{ x: 1, z: 2, hw: 3, hd: 4, rot: 5, yBottom: 6, yTop: 7, ghost: true }], clutter: [{ x: 1, z: 2, yaw: 3, kind: 4 }],
  stone: [{ ...pose, solid: 1 }], daisy: [{ ...pose, solid: 1 }],
};
const encode = (value: unknown) => new TextEncoder().encode(encodeCanonicalJson(value));
const source = () => new Map(Object.entries(data).map(([key, value]) => [`dressing-${key}.json`, encode(value)]));
const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes));

test('all sixteen full native lists reconstruct byte-exact; both numeric files stay identical', () => {
  const input = source(), before = new Map([...input].map(([name, bytes]) => [name, bytes.slice()]));
  const originals = nalatiDressingPlacementBlobs(input), binaries = originals.filter(row => row.file.kind === 'bin');
  const blobs = nalatiDressingPages(input, binaries), pages = blobs.filter(row => row.file.kind === 'json');
  expect(pages).toHaveLength(5); expect(blobs).toHaveLength(7);
  for (const original of originals) {
    const name = original.file.name;
    if (name === undefined) throw new Error('Missing original named file');
    const reference = nalatiDressingPageReference(name);
    if (reference === undefined) { expect(blobs.find(row => row.file.name === name)).toEqual(original); continue; }
    const page = pages.find(row => row.file.name === reference.file);
    if (page === undefined) throw new Error('Missing page');
    const parsed = parseSceneScatterPage(decode(page.bytes)), member = parsed.members.find(row => row.id === reference.member);
    expect(member).toBeDefined(); expect(encode(member?.rows)).toEqual(original.bytes);
    if(member?.kind==='poses')for(const row of member.rows){expect(row).toEqual(readSceneScatterPose(row));expect(Object.keys(row)).toEqual(Object.keys(readSceneScatterPose(row)));}
    expect(parsed.members.length).toBeLessThanOrEqual(4);
    expect(page.file.jsonSchema).toEqual(namedJsonSchema(SceneScatterPageSchema, { provenance: true }));
  }
  expect(()=>nalatiDressingPages(input,[])).toThrow('numeric');
  expect(input).toEqual(before);
  expect(nalatiDressingPages(input, binaries).map(row => row.file)).toEqual(blobs.map(row => row.file));
});

test('every original row grammar remains authoritative before native page packing', () => {
  const binaries=nalatiDressingPlacementBlobs(source()).filter(row=>row.file.kind==='bin');
  for (const [key, schema] of Object.entries(DRESSING_SCHEMAS)) {
    const original = data[key]; if (original === undefined) throw new Error('Missing original test list');
    const first=original[0]; if(first===null||typeof first!=='object')throw new Error('Missing original test row');
    const bad = [{ ...first, ignored: 1 }], input = source();
    expect(() => schema.parse(bad), key).toThrow();
    input.set(`dressing-${key}.json`, encode(bad));
    expect(() => nalatiDressingPages(input, binaries), key).toThrow();
  }
  const missing = source(); missing.delete('dressing-colliders.json');
  expect(() => nalatiDressingPages(missing, binaries)).toThrow('Missing original');
});

test('bounded whole pages refuse duplicates, wrong members and malformed unused lists', () => {
  const good = { id: 'stone-list', kind: 'poses', rows: [pose] };
  for (const input of [
    { version: 1, members: [] }, { version: 1, members: Array.from({ length: 5 }, (_, i) => ({ ...good, id: `list-${i}` })) },
    { version: 1, members: [good, good] }, { version: 1, members: [good], extra: true },
    { version: 1, members: [{ ...good, rows: [{ ...pose, sx: Infinity }] }] },
    { version: 1, members: [good, { id: 'later', kind: 'gates', rows: [{ x: 1, z: 2, yaw: 'wrong' }] }] },
    { version: 1, members: [{ ...good, rows: [{ ...pose, solid: 1 }] }] },
  ]) expect(() => v.parse(SceneScatterPageSchema, input)).toThrow();
});

test('scene binding changes only exact JSON references, keeping layer order, binary tables and raw defaults', () => {
  const input = { name: 'book', layers: [
    { id: 'first', file: 'world/dressing-boulder.json', binary: false, select: { modulo: 3, remainder: 2, equal: true } },
    { id: 'numeric', file: 'world/dressing-stone.bin', binary: true },
    { id: 'last', file: 'world/dressing-reed.json', binary: false },
  ], geometry: { original: true } }, before = structuredClone(input);
  expect(nalatiPagedDressingRows(input)).toEqual({ ...input, layers: [
    { ...input.layers[0], file: 'world/dressing-pages/0.json', member: 'boulder' }, input.layers[1],
    { ...input.layers[2], file: 'world/dressing-pages/1.json', member: 'reed' },
  ] });
  expect(input).toEqual(before);
  expect(() => nalatiPagedDressingRows({ ...input, layers: [{ file: 'world/dressing-boulder.json', binary: true }] })).toThrow('Numeric');
});
