import { expect, it } from 'vitest';
import { buildCommons, commonsRequirements, type CommonsAsset, type CommonsPack } from '../src/sdk/commons';
import { contentHash } from '../src/sdk/project';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/sdk/admission';

const asset = (id: string, bytes = new Uint8Array([1, 2, 3])): CommonsAsset => ({ id, kind: 'binary', bytes, credit: 'Fixture author', licence: 'CC0-1.0' });
const pack = (id: string, entries: readonly CommonsAsset[]): CommonsPack => ({ id, version: '1.2.3', entries });

it('pins provenance and actual costs while deduplicating owned hash-named bytes', () => {
  const input = asset('deck'), hash = contentHash(input.bytes);
  const output = buildCommons([pack('bridges', [input, asset('winch')])]);
  expect(output.catalogue).toMatchObject({ format: 'wildshard.commons', version: 0 });
  expect(output.catalogue.entries).toHaveLength(2);
  expect(output.catalogue.entries[0]).toMatchObject({ id: 'bridges/deck', pack: 'bridges', packVersion: '1.2.3', hash, wire: 3, credit: 'Fixture author', licence: 'CC0-1.0', cost: { decoded: 3, gpu: 0 } });
  expect(output.assets.size).toBe(1);
  input.bytes.fill(9);
  expect(output.assets.get(hash)).toEqual(new Uint8Array([1, 2, 3]));
});

it('emits identical catalogue and asset ordering for independent pack and entry order', () => {
  const a = asset('a'), b = asset('b', new Uint8Array([4]));
  const first = buildCommons([pack('two', [b]), pack('one', [b, a])]);
  const second = buildCommons([pack('one', [a, b]), pack('two', [b])]);
  expect(first.json).toBe(second.json);
  expect([...first.assets]).toEqual([...second.assets]);
  expect(first.catalogue.entries.map(row => row.id)).toEqual(['one/a', 'one/b', 'two/b']);
});

it('refuses ambiguous identities, unpinned versions and kind-conflicting aliases', () => {
  expect(() => buildCommons([pack('same', []), pack('same', [])])).toThrow('Duplicate commons pack');
  expect(() => buildCommons([pack('one', [asset('same'), asset('same')])])).toThrow('Duplicate commons entry');
  expect(() => buildCommons([{ ...pack('one', []), version: 'latest' }])).toThrow();
  expect(() => buildCommons([pack('../escape', [])])).toThrow();
  expect(() => buildCommons([pack('one', [asset('a'), { ...asset('b'), kind: 'glb' }])])).toThrow('conflicting kinds');
});

it('rejects malformed parsed assets and excessive entry counts before reading payloads', () => {
  expect(() => buildCommons([pack('one', [{ ...asset('bad'), kind: 'audio' }])])).toThrow();
  let reads = 0;
  const row: CommonsAsset = { ...asset('bounded'), get bytes() { reads++; return new Uint8Array(); } };
  expect(() => buildCommons([pack('one', Array.from({ length: limits.files + 1 }, () => row))])).toThrow('entries exceed');
  expect(reads).toBe(0);
});
it('derives exact deduplicated manifest requirements again from pinned bytes', () => {
  const built = buildCommons([pack('one', [asset('deck'), asset('alias')])]);
  const first = built.catalogue.entries[0]; if (first === undefined) throw new Error('Missing fixture entry');
  first.cost.decoded = 999; first.wire = 999;
  const requirements = commonsRequirements(built, ['one/deck', 'one/alias', 'one/deck']);
  expect(requirements.commons).toEqual([first.hash]); expect(requirements.commonsWire[first.hash]).toBe(3);
  expect(requirements.commonsCosts[first.hash]).toEqual({ decoded: 3, gpu: 0, triangles: 0, draws: 0 });
  expect(() => commonsRequirements(built, ['unknown'])).toThrow('Unknown commons entry');
  built.assets.get(first.hash)?.fill(8);
  expect(() => commonsRequirements(built, ['one/deck'])).toThrow('Pinned commons bytes differ');
});
