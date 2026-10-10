// oxlint-disable-next-line import/no-nodejs-modules -- Exact native snapshots and the shipped Rapier binary are Node fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Generate an independent legacy base64 wire and malformed compressed frames.
import { Buffer } from 'node:buffer';
import { deflateSync } from 'fflate';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { encodePhysicsReferences, decodePhysicsReferences } from '../../src/engine/sim/snapshotPhysics';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('preserves exact multi-block bytes, decodes the legacy wire, and falls back for incompressible data', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const saved = snapshotSimHost(host);
    saved.physics = Array.from({ length: 131_079 }, (_, i) => i % 251); // complete and partial block boundaries
    const text = serializeSimSnapshot(saved), parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || !('snapshot' in parsed) || parsed.snapshot === null || typeof parsed.snapshot !== 'object'
      || !('physics' in parsed.snapshot) || parsed.snapshot.physics === null || typeof parsed.snapshot.physics !== 'object' || !('checksum' in parsed.snapshot.physics)) throw new Error('Missing packed physics');
    expect(text).toContain('deflate-lz-base64-v1'); expect(text.length).toBeLessThan(20_000);
    expect(decodeSimSnapshot(text)).toEqual(saved);
    const legacy = { ...parsed, snapshot: { ...parsed.snapshot, physics: { encoding: 'base64', data: Buffer.from(saved.physics).toString('base64'), checksum: parsed.snapshot.physics.checksum } } };
    expect(decodeSimSnapshot(legacy)).toEqual(saved);
    let state = 1729;
    saved.physics = Array.from({ length: 4096 }, () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state & 255; });
    const raw = serializeSimSnapshot(saved); expect(raw).toContain('"encoding":"base64"'); expect(decodeSimSnapshot(raw)).toEqual(saved);
  } finally { host.dispose(); }
});
it('requires the exact immutable basis and reconstructs changed native bytes around long external references', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const saved = snapshotSimHost(host), basis = Uint8Array.from({ length: 200_003 }, (_, i) => i % 251);
    const bytes = basis.slice(); bytes[3] = 255; bytes[145_001] = 255;
    saved.physics = Array.from(bytes);
    const text = serializeSimSnapshot(saved, basis);
    expect(text).toContain('"basis"'); expect(text.length).toBeLessThan(20_000);
    expect(decodeSimSnapshot(text, basis)).toEqual(saved);
    expect(() => decodeSimSnapshot(text)).toThrow('basis mismatch');
    expect(() => decodeSimSnapshot(text, basis.subarray(1))).toThrow('basis mismatch');
    const wrong = basis.slice(); wrong[100] = 255;
    expect(() => decodeSimSnapshot(text, wrong)).toThrow('basis mismatch');
    expect(basis[3]).toBe(3); expect(basis[145_001]).toBe(145_001 % 251);
  } finally { host.dispose(); }
});
it('bounds literal/copy work and refuses invalid reference streams before allocating or reading outside data', () => {
  for (const length of [1, 3, 63, 64, 65, 65535, 65536, 65537, 131079]) {
    const bytes = Uint8Array.from({ length }, (_, i) => i % 251), encoded = encodePhysicsReferences(bytes);
    expect(encoded).toEqual(encodePhysicsReferences(bytes)); expect(decodePhysicsReferences(encoded, length)).toEqual(bytes);
  }
  for (const invalid of [[], [7], [0], [0, 0], [0, 0, 0], [1], [1, 0, 0, 0, 0, 64, 0, 0, 0],
    [2, 0, 0, 0, 0, 64, 0, 0, 0], [0, 0, 0, 7, 1, 1, 0, 0, 0, 64, 0, 0, 0]]) expect(() => decodePhysicsReferences(Uint8Array.from(invalid), 2)).toThrow();
  const external = Uint8Array.from([2, 1, 0, 0, 0, 64, 0, 0, 0]);
  expect(() => decodePhysicsReferences(external, 64, new Uint8Array(64))).toThrow('basis reference');
  expect(() => decodePhysicsReferences(new Uint8Array(), 32_000_001)).toThrow('byte bounds');
});
it('keeps the existing reference wire across unaligned word tails, first differing bytes and overlapping copies', () => {
  // Golden packets from the byte comparator: a fifteen-byte prefix reaches the immutable basis's stride.
  const basis = Uint8Array.from({ length: 301 }, (_, i) => i % 251);
  for (const length of [129, 130, 131, 132]) {
    const raw = basis.subarray(17, 17 + length);
    expect(encodePhysicsReferences(raw, basis)).toEqual(Uint8Array.from([
      0, 14, 0, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      2, 32, 0, 0, 0, length - 15, 0, 0, 0,
    ]));
    const overlapping = new Uint8Array(length).fill(11);
    expect(encodePhysicsReferences(overlapping)).toEqual(Uint8Array.from([0, 0, 0, 11, 1, 1, 0, 0, 0, length - 1, 0, 0, 0]));
    expect(decodePhysicsReferences(encodePhysicsReferences(overlapping), length)).toEqual(overlapping);
  }
  for (const tail of [1, 2, 3, 4]) {
    const raw = basis.subarray(17, 160).slice(); raw[raw.length - tail] = 255;
    const packed = encodePhysicsReferences(raw, basis);
    expect(packed).toEqual(Uint8Array.from([
      0, 14, 0, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      2, 32, 0, 0, 0, 128 - tail, 0, 0, 0, 0, tail - 1, 0, ...raw.subarray(raw.length - tail),
    ]));
    expect(decodePhysicsReferences(packed, raw.length, basis)).toEqual(raw);
  }
});
it('rejects short/oversized blocks, bad lengths, extra fields and corrupt bytes before publishing a snapshot', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const saved = snapshotSimHost(host), parsed: unknown = JSON.parse(serializeSimSnapshot(saved));
    if (parsed === null || typeof parsed !== 'object' || !('snapshot' in parsed) || parsed.snapshot === null || typeof parsed.snapshot !== 'object') throw new Error('Missing wire snapshot');
    const snapshot = parsed.snapshot;
    const wire = (physics: unknown) => ({ ...parsed, snapshot: { ...snapshot, physics } });
    const block = { encoding: 'deflate-lz-base64-v1', length: 1, packedLength: 1, chunks: [Buffer.from(deflateSync(new Uint8Array([1]))).toString('base64')], checksum: 0 };
    for (const invalid of [{ ...block, length: 0 }, { ...block, length: 32_000_001 }, { ...block, length: 1.5 },
      { ...block, extra: 1 }, { ...block, chunks: [] }, { ...block, packedLength: 65537 }, { ...block, chunks: ['/==='] },
      { ...block, chunks: ['AAAA'] }, { ...block, chunks: ['AA=='] }, block]) expect(() => decodeSimSnapshot(wire(invalid))).toThrow();
    const bomb = { ...block, chunks: [Buffer.from(deflateSync(new Uint8Array(65_536))).toString('base64')] };
    expect(() => decodeSimSnapshot(wire(bomb))).toThrow(/block (size|length)/u);
    const short = { ...block, packedLength: 2 };
    expect(() => decodeSimSnapshot(wire(short))).toThrow('block length');
    expect(snapshotSimHost(host)).toEqual(saved);
  } finally { host.dispose(); }
});
