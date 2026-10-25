// oxlint-disable-next-line import/no-nodejs-modules -- Bake the original author model; no published world file seeds this proof.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bakeSignalWorldSources } from '../src/shards/sunscar-dunes/generators/worldSources';
import { signalWorldMetadata } from '../src/shards/sunscar-dunes/generators/worldMetadata';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };
import original from './fixtures/sunscar-world-files.json' with { type: 'json' };

const { files } = await bakeSignalWorldSources(new Uint8Array(readFileSync('src/shards/sunscar-dunes/assets/models/dry-well.glb')));
const encoder = new TextEncoder();
const metadata = signalWorldMetadata(files);
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

test('all original world metadata words, extras, order and aggregate survive owned decoding', () => {
  const bytes = encoder.encode(encodeCanonicalJson(metadata));
  expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(before.raw.world);
  for (const [name, rows] of Object.entries(metadata)) {
    const expected = Object.entries(original).find(([file]) => file === `${name}.json`)?.[1];
    if (expected === undefined) throw new Error('Missing original metadata oracle');
    const encoded = encoder.encode(`${JSON.stringify(rows, null, 2)}\n`);
    expect({ bytes: encoded.length, hash: hashImmutableBytes(encoded) }).toEqual(expected);
  }
});

test('decoded row mutation cannot change another result or the cached bytes', () => {
  const first = signalWorldMetadata(files), kind = first.rocks.kinds[0];
  if (kind === undefined) throw new Error('Missing original rock kind');
  kind.color = 0; first.caravan.anchors.logbook[0] += 1;
  expect(signalWorldMetadata(files)).toEqual(metadata);
  expect(first.caravan.anchors.logbook).not.toEqual(metadata.caravan.anchors.logbook);
  for (const [name, bytes] of files) {
    const expected = Object.entries(original).find(([file]) => file === name)?.[1];
    expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(expected);
  }
});

const malformed: readonly [string, (row: Record<string, unknown>) => unknown][] = [
  ['rocks', row => ({ ...row, unexpected: 1 })],
  ['dressing', row => ({ ...row, kinds: [{ ...metadata.dressing.kinds[0], flat: 1 }] })],
  ['rocks', row => ({ ...row, kinds: [{ ...metadata.rocks.kinds[0], unknown: true }] })],
  ['well', row => ({ ...row, colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 'bad', hy: 1, hz: 1 }] })],
  ['well', row => ({ ...row, colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1 }] })],
  ['tower', row => ({ ...row, anchors: { deckY: 'bad', lampY: 1 } })],
  ['caravan', row => ({ ...row, anchors: { y: 0, logbook: [0, 0], lamp: [1, 2, 3] } })],
  ['well', row => ({ ...row, anchors: {} })],
  ['lash', row => ({ ...row, tip: [0, 0, null] })],
  ['lash', row => ({ ...row, along: 'bad' })],
  ['braziers', row => ({ ...row, braziers: [{ y: 0, colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1, surface: 'unknown' }] }] })],
  ['well', row => ({ ...row, glb: '0'.repeat(64) })],
];
test.each(malformed)('cached %s metadata refuses malformed fields or a different GLB', (name, change) => {
  const next = new Map(files), bytes = files.get(`${name}.json`);
  if (bytes === undefined) throw new Error('Missing original metadata');
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!record(value)) throw new Error('Invalid original metadata');
  next.set(`${name}.json`, encoder.encode(JSON.stringify(change(value))));
  expect(() => signalWorldMetadata(next)).toThrow();
});

test('missing, empty, oversized and malformed UTF-8 documents refuse', () => {
  for (const bytes of [undefined, new Uint8Array(), new Uint8Array(1_000_001), new Uint8Array([255])]) {
    const next = new Map(files);
    if (bytes === undefined) next.delete('well.json'); else next.set('well.json', bytes);
    expect(() => signalWorldMetadata(next)).toThrow();
  }
  const next = new Map(files); next.set('well.glb', new Uint8Array());
  expect(() => signalWorldMetadata(next)).toThrow();
});
