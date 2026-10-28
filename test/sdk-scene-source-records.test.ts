import * as v from 'valibot';
import { expect, test } from 'vitest';
import { worldSceneSourceRecords } from '../src/sdk/worldScenes';
import { glbWholePartitionIds } from '../src/sdk/bake/glb';

const rows = v.strictObject({ count: v.number(), label: v.optional(v.string(), 'original') });
const oldBook = v.strictObject({ rows, records: v.array(v.pipe(v.number(), v.finite())),
  wholeTiles: v.record(v.string(), v.strictObject({ files: v.array(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))), resident: v.boolean() })) });

test('source record books retain native admission, defaults, field order and detached ownership', () => {
  const input = { wholeTiles: { tile: { resident: false, files: ['a'.repeat(64)] } }, records: [0, -0, 4.5], rows: { count: 3 } };
  const before = v.parse(oldBook, input), after = worldSceneSourceRecords(rows, input);
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  expect(after.records[1]).toBe(-0);
  const types: [typeof before extends typeof after ? true : false, typeof after extends typeof before ? true : false] = [true, true];
  expect(types).toEqual([true, true]);
  after.records.push(5); after.wholeTiles['tile']?.files.push('b'.repeat(64));
  expect(worldSceneSourceRecords(rows, input)).toEqual(before);
  for (const invalid of [null, {}, { ...input, extra: 1 }, { ...input, records: [Infinity] }, { ...input, rows: { count: 'three' } },
    { ...input, wholeTiles: { tile: { files: ['A'.repeat(64)], resident: false } } },
    { ...input, wholeTiles: { tile: { files: [], resident: false, extra: true } } }]) {
    expect(() => v.parse(oldBook, invalid)).toThrow();
    expect(() => worldSceneSourceRecords(rows, invalid)).toThrow();
  }
});

function glb(input: unknown): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(input)), bytes = new Uint8Array(20 + json.length), header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.length, true);
  header.setUint32(12, json.length, true); header.setUint32(16, 0x4e4f534a, true); bytes.set(json, 20); return bytes;
}
const originalNodes = v.object({ nodes: v.optional(v.array(v.object({ extras: v.optional(v.object({ wholePartition: v.optional(v.object({ id: v.string() })) })) })), []) });

test('whole-partition identities retain original optional-node grammar and every bounded header refusal', () => {
  const input = { unrelated: true, nodes: [{}, { extras: { wholePartition: { id: 'tile-b', more: 1 } } }, { extras: {} }, { extras: { wholePartition: { id: 'tile-a' } } }] };
  const before = v.parse(originalNodes, input).nodes.flatMap(node => node.extras?.wholePartition === undefined ? [] : [node.extras.wholePartition.id]);
  expect(glbWholePartitionIds(glb(input))).toEqual(before);
  expect(glbWholePartitionIds(glb({}))).toEqual([]);
  const padded = new Uint8Array(glb(input).length + 16); padded.set(glb(input), 8);
  expect(glbWholePartitionIds(padded.subarray(8, -8))).toEqual(before);
  for (const value of [null, { nodes: null }, { nodes: [null] }, { nodes: [{ extras: null }] }, { nodes: [{ extras: { wholePartition: {} } }] }]) {
    expect(() => v.parse(originalNodes, value)).toThrow();
    expect(() => glbWholePartitionIds(glb(value))).toThrow();
  }
  expect(() => glbWholePartitionIds(new Uint8Array(16))).toThrow('truncated');
  for (const [at, value] of [[0, 0], [4, 1], [8, 1000], [12, 1000], [16, 0]] as const) {
    const bytes = glb(input); new DataView(bytes.buffer).setUint32(at, value, true);
    expect(() => glbWholePartitionIds(bytes)).toThrow('header');
  }
  const malformed = glb({}); malformed[20] = 255;
  expect(() => glbWholePartitionIds(malformed)).toThrow();
});
