// oxlint-disable-next-line import/no-nodejs-modules -- Exercise only source-defined data in a tiny owned header/bank directory.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only this fixture's temporary sibling files.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { encodeTypedDataBank, decodeTypedDataBank, readTypedDataBank } from '@wildshard/sdk/bake/typedDataBank';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

test('arrays and instance tables retain exact scalars, signed zero, little-endian bytes and detached ownership', () => {
  const points = Float64Array.of(1 / 3, -0, 4, 5, 6, 7), matrices = Float32Array.from({ length: 16 }, (_, i) => i % 5 === 0 ? 1 : 0);
  const bank = encodeTypedDataBank('tables.bin', [
    { name: 'flags', values: Uint8Array.of(0, 255, 7) }, { name: 'ids', values: Uint16Array.of(0x0102, 0xffff) },
    { name: 'points', values: points, width: 3 }, { name: 'instances', values: matrices, width: 16 },
  ]);
  const ids = bank.header.arrays[1]; if (ids === undefined) throw new Error('Missing ID column');
  expect([...bank.bytes.subarray(ids.offset, ids.offset + 4)]).toEqual([2, 1, 255, 255]);
  expect(JSON.stringify(bank.header).length).toBeLessThan(1024);
  const decoded = decodeTypedDataBank(bank.header, bank.bytes), output = decoded.columns.get('points');
  if (!(output instanceof Float64Array)) throw new Error('Missing double-precision points');
  expect([...output]).toEqual([...points]); expect(Object.is(output[1], -0)).toBe(true);
  expect(decoded.columns.get('instances')).toEqual(matrices);
  output[0] = 42; expect(points[0]).toBe(1 / 3);
  expect(decodeTypedDataBank(bank.header, bank.bytes).columns.get('points')).toEqual(points);
});

test('header, row, range, hash, padding and numeric refusals remain strict', () => {
  const bank = encodeTypedDataBank('rows.bin', [{ name: 'flag', values: Uint8Array.of(1) }, { name: 'value', values: Float64Array.of(2) }]);
  for (const input of [{ ...bank.header, file: '../rows.bin' }, { ...bank.header, byteOrder: 'big' },
    { ...bank.header, bytes: bank.header.bytes + 1 }, { ...bank.header, arrays: bank.header.arrays.map(row => ({ ...row, offset: 0 })) }])
    expect(() => decodeTypedDataBank(input, bank.bytes)).toThrow();
  const changed = new Uint8Array(bank.bytes); changed[0] = 2;
  expect(() => decodeTypedDataBank(bank.header, changed)).toThrow('size or hash mismatch');
  const padding = new Uint8Array(bank.bytes); padding[1] = 1;
  expect(() => decodeTypedDataBank({ ...bank.header, sha256: hashImmutableBytes(padding) }, padding)).toThrow('padding');
  expect(() => encodeTypedDataBank('rows.bin', [{ name: 'bad', values: Float32Array.of(Number.NaN) }])).toThrow('finite');
  expect(() => encodeTypedDataBank('rows.bin', [{ name: 'bad', values: Uint8Array.of(1, 2, 3), width: 2 }])).toThrow();
  expect(() => encodeTypedDataBank('rows.bin', [{ name: 'same', values: Uint8Array.of(1) }, { name: 'same', values: Uint8Array.of(2) }])).toThrow();
});

test('Node generators read a bounded JSON header at runtime and admit its exact sibling binary', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/typed-data-bank-'));
  try {
    const bank = encodeTypedDataBank('data.bin', [{ name: 'signed', values: Int32Array.of(-1, 0, 2_147_483_647) }]);
    writeFileSync(resolve(root, 'rows.generated.json'), `${JSON.stringify(bank.header)}\n`);
    writeFileSync(resolve(root, 'data.bin'), bank.bytes);
    expect(readTypedDataBank(resolve(root, 'rows.generated.json')).columns.get('signed')).toEqual(Int32Array.of(-1, 0, 2_147_483_647));
    writeFileSync(resolve(root, 'data.bin'), new Uint8Array(0));
    expect(() => readTypedDataBank(resolve(root, 'rows.generated.json'))).toThrow('size or hash mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
