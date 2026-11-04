import { expect, test } from 'vitest';
import { Box3, BufferAttribute, BufferGeometry, Float16BufferAttribute, Matrix4, Sphere, Vector3 } from 'three';
import { restoreHomeGeometry, snapshotHomeGeometry, type HomeGeometrySnapshot } from '../src/game/shardfile/homeGeometrySnapshot';
import { decodeHomeSeed, encodeHomeSeed, HOME_SEED_CHUNK_BYTES, homeSeedKey, homeSeedPath, joinHomeSeed, openHomeSeed, readHomeSeedKeys, splitHomeSeed } from '../src/game/shardfile/homeSeed';

function sample(): { geometry: BufferGeometry; matrix: Matrix4; snapshot: HomeGeometrySnapshot } {
  const geometry = new BufferGeometry();
  // Two channels are views of one buffer at different ranges (not interleaved); the index has its own buffer.
  const shared = new ArrayBuffer(64), positions = new Float32Array(shared, 0, 9), uvs = new Float32Array(shared, 40, 6);
  positions.set([-0, 1.5, 2, 3, Number.NaN, 5, 6, 7, 8]); uvs.set([0.25, 0.5, 0.75, 1, 0, -1]);
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('aPat', new Float16BufferAttribute(new Uint16Array([0x3800, 0x3c00, 0x4000]), 1));
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array([128, 19, 255, 0, 1, 2, 3, 4, 5]), 3, true));
  geometry.setIndex(new BufferAttribute(new Uint16Array([2, 0, 1]), 1));
  geometry.name = 'seed draw'; geometry.addGroup(0, 3, 2); // draw range stays [0, Infinity]
  geometry.boundingBox = new Box3(new Vector3(-0, -3, -4), new Vector3(1.1234567891234, 2, 3));
  geometry.boundingSphere = new Sphere(new Vector3(-0, 2, 3), 7.1234567891234);
  const matrix = new Matrix4().makeTranslation(-0, 1.1234567891234, 3);
  const snapshot = snapshotHomeGeometry(new Map([['draw', { geometry, matrix }]])); if (snapshot === null) throw new Error('Missing snapshot');
  return { geometry, matrix, snapshot };
}

test('a seed round-trips exact words, half bits, shared buffers, index, groups, bounds and matrix', () => {
  const { geometry, matrix, snapshot } = sample();
  const bytes = encodeHomeSeed(new Map([['whole:[["a"],"phone"]', snapshot]]));
  const decoded = decodeHomeSeed(bytes), entry = decoded.get('whole:[["a"],"phone"]');
  if (entry === undefined) throw new Error('Missing decoded entry');
  const view = restoreHomeGeometry(entry).get('draw'); if (view === undefined) throw new Error('Missing restored view');
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const actual: unknown = view.geometry.getAttribute(name);
    if (!(attribute instanceof BufferAttribute) || !(actual instanceof BufferAttribute)) throw new Error('Expected plain channels');
    expect(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength))
      .toEqual(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    expect(actual.array.constructor).toBe(attribute.array.constructor);
    expect(actual.normalized).toBe(attribute.normalized); expect(actual.itemSize).toBe(attribute.itemSize);
    expect(actual.array.buffer).not.toBe(attribute.array.buffer);
  }
  expect(view.geometry.getAttribute('aPat')).toBeInstanceOf(Float16BufferAttribute);
  expect(view.geometry.getAttribute('aPat').getX(0)).toBe(0.5);
  expect(view.geometry.getIndex()?.array).toEqual(new Uint16Array([2, 0, 1]));
  expect(view.geometry.groups).toEqual(geometry.groups); expect(view.geometry.drawRange).toEqual({ start: 0, count: Infinity });
  expect(view.geometry.boundingBox).toEqual(geometry.boundingBox); expect(Object.is(view.geometry.boundingBox?.min.x, -0)).toBe(true);
  expect(view.geometry.boundingSphere).toEqual(geometry.boundingSphere);
  expect(view.matrix.elements).toEqual(matrix.elements); expect(view.geometry.name).toBe('seed draw');
  view.geometry.dispose(); geometry.dispose();
});

test('every read gives independent words; identical views share one block', () => {
  const { geometry, snapshot } = sample();
  const view = snapshot[0]; if (view === undefined) throw new Error('Expected a view');
  const twice = [view, { ...view, id: 'again' }];
  const one = encodeHomeSeed(new Map([['k', snapshot]])), two = encodeHomeSeed(new Map([['k', twice]]));
  // The second view adds header text only: its words reuse the first view's blocks.
  const data = (bytes: Uint8Array): number => bytes.length - Math.ceil((4 + new DataView(bytes.buffer).getUint32(0, true)) / 16) * 16;
  expect(data(two)).toBe(data(one));
  const seed = openHomeSeed(two), first = seed.read('k'), second = seed.read('k');
  const a = first?.[0]?.shape.attributes[0]?.words, b = second?.[0]?.shape.attributes[0]?.words;
  if (a === undefined || b === undefined) throw new Error('Missing words');
  expect(a.buffer).not.toBe(b.buffer); expect(a).toEqual(b);
  expect(seed.read('missing')).toBeNull();
  geometry.dispose();
});

/** The same seed with its JSON header rewritten by `change`, re-aligned in front of the unchanged data blocks. */
function withHeader(bytes: Uint8Array, change: (text: string) => string): Uint8Array {
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true), start = Math.ceil((4 + length) / 16) * 16;
  const header = new TextEncoder().encode(change(new TextDecoder().decode(bytes.subarray(4, 4 + length))));
  const at = Math.ceil((4 + header.length) / 16) * 16, out = new Uint8Array(at + bytes.length - start);
  new DataView(out.buffer).setUint32(0, header.length, true); out.set(header, 4); out.set(bytes.subarray(start), at);
  return out;
}

test('malformed seeds refuse', () => {
  const { geometry, snapshot } = sample(), bytes = encodeHomeSeed(new Map([['k', snapshot]]));
  expect(() => openHomeSeed(new Uint8Array(3))).toThrow();
  expect(() => openHomeSeed(bytes.slice(0, -16))).toThrow('size mismatch');
  const long = new Uint8Array(bytes); new DataView(long.buffer).setUint32(0, bytes.length, true);
  expect(() => openHomeSeed(long)).toThrow();
  const garbled = new Uint8Array(bytes); garbled[6] = 0x7b; // the header's JSON no longer parses or checks
  expect(() => openHomeSeed(garbled)).toThrow();
  // A block reference outside the data, or a wrong-typed field, refuses (the header is re-encoded around the same data).
  expect(() => openHomeSeed(withHeader(bytes, text => text.replace('"offset":0,', '"offset":4096,')))).toThrow('outside');
  expect(() => openHomeSeed(withHeader(bytes, text => text.replace('"label":""', '"label":7'))).read('k')).toThrow();
  expect(() => openHomeSeed(withHeader(bytes, text => text.replace('"version":1', '"version":2')))).toThrow();
  geometry.dispose();
});

test('owned keys lose their origin; whole keys and unknown keys stay', () => {
  const owned = 'owned:["http://127.0.0.1:4401/shardfiles/driftwood-isle/blobs/glb/aa.glb",["https://x.example/shardfiles/driftwood-isle/blobs/glb/bb.glb"],"phone",[["_sway","aSway"]],null,true]';
  expect(homeSeedKey(owned)).toBe('owned:["/shardfiles/driftwood-isle/blobs/glb/aa.glb",["/shardfiles/driftwood-isle/blobs/glb/bb.glb"],"phone",[["_sway","aSway"]],null,true]');
  expect(homeSeedKey(homeSeedKey(owned))).toBe(homeSeedKey(owned));
  const whole = 'whole:[["121e"],"phone"]';
  expect(homeSeedKey(whole)).toBe(whole);
  expect(homeSeedKey('owned:["http://127.0.0.1:4401/shardfiles/x/blobs/glb/aa.glb",[],"phone",[["_sway","aS')).toContain('127.0.0.1');
  expect(homeSeedPath('nine-dragon-stack', 'phone', 1)).toBe('/assets/home-seed/nine-dragon-stack-phone.1.bin');
  expect(HOME_SEED_CHUNK_BYTES).toBeLessThan(12_000_000); // a spawn part's per-file cap
  const big = Uint8Array.from({ length: 21 }, (_, i) => i), parts = splitHomeSeed(big, 8);
  expect(parts.map(part => part.length)).toEqual([8, 8, 5]);
  expect(joinHomeSeed(parts)).toEqual(big);
  expect(readHomeSeedKeys({ version: 1, tiers: { phone: [homeSeedKey(owned), whole].sort() } }).tiers.phone).toHaveLength(2);
  expect(() => readHomeSeedKeys({ version: 1, tiers: { phone: [owned] } })).toThrow('normalised');
  expect(() => readHomeSeedKeys({ version: 1, tiers: { phone: [whole, whole] } })).toThrow();
});
