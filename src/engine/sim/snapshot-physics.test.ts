import { expect, test } from 'vitest';
import { Rng } from '../core/rng';
import { MAX_REFERENCE_BYTES, encodePhysicsReferences, decodePhysicsReferences, validatePhysicsReferences } from './snapshotPhysics';

test('sparse copy indexing reconstructs every byte across offsets, tails and native-sized repeated blocks', () => {
  const block = Uint8Array.from({ length: 8191 }, (_, i) => (Math.imul(i, 73) ^ (i >>> 3)) & 255);
  for (const offset of [0, 1, 15]) for (const length of [1, 15, 63, 64, 65, 129, 65537, 2_097_169]) {
    const backing = new Uint8Array(length + offset + 7).fill(173), raw = backing.subarray(offset, offset + length);
    for (let i = 0; i < length; i++) raw[i] = block[(i + offset) % block.length] ?? 0;
    for (let i = 4093; i < length; i += 32771) raw[i] = (raw[i] ?? 0) ^ 37;
    const before = backing.slice(), packed = encodePhysicsReferences(raw);
    expect(packed.length).toBeLessThanOrEqual(MAX_REFERENCE_BYTES);
    validatePhysicsReferences(packed, length);
    const decoded = decodePhysicsReferences(packed, length);
    expect(decoded.length).toBe(length);
    expect(decoded.every((value, i) => value === raw[i])).toBe(true);
    expect(backing).toEqual(before);
    expect(decoded.buffer).not.toBe(raw.buffer);
  }
});

test('basis copies and incompressible literal tails keep complete original bytes', () => {
  const rng = new Rng(731), basis = Uint8Array.from({ length: 8191 }, () => rng.int(0, 255));
  for (const supplied of [undefined, basis]) {
    const raw = new Uint8Array(basis.length + 17); raw.set(basis.subarray(9), 0); raw.fill(31, basis.length - 9);
    const packed = encodePhysicsReferences(raw, supplied);
    validatePhysicsReferences(packed, raw.length, supplied?.length);
    expect(decodePhysicsReferences(packed, raw.length, supplied)).toEqual(raw);
  }
});

test.each([1, 64])('previous literal/copy tokens retain overlapping distance %i', distance => {
  const encoded = Uint8Array.from([0, 63, 0, ...Array.from({ length: 64 }, (_, i) => i), 1, distance, 0, 0, 0, 64, 0, 0, 0]);
  const expected = Uint8Array.from({ length: 128 }, (_, i) => i < 64 ? i : distance === 1 ? 63 : i - 64);
  validatePhysicsReferences(encoded, 128);
  expect(decodePhysicsReferences(encoded, 128)).toEqual(expected);
});

test('previous external references and malformed bounds retain their defining behavior', () => {
  const basis = Uint8Array.from({ length: 256 }, (_, i) => i), encoded = Uint8Array.from([2, 7, 0, 0, 0, 128, 0, 0, 0]);
  expect(decodePhysicsReferences(encoded, 128, basis)).toEqual(basis.subarray(7, 135));
  expect(() => decodePhysicsReferences(encoded, 128)).toThrow('basis reference');
  expect(() => decodePhysicsReferences(encoded, 128, new Uint8Array(64))).toThrow('basis reference');
  expect(() => decodePhysicsReferences(Uint8Array.of(1, 0, 0, 0, 0, 64, 0, 0, 0), 64)).toThrow('reference');
  expect(() => decodePhysicsReferences(Uint8Array.of(0, 63, 0, 1), 64)).toThrow('literal length');
  expect(() => encodePhysicsReferences(new Uint8Array())).toThrow('byte bounds');
  expect(() => encodePhysicsReferences(Uint8Array.of(1), new Uint8Array())).toThrow('basis exceeds');
});
