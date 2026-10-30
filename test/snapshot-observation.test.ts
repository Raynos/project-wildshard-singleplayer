// oxlint-disable-next-line import/no-nodejs-modules -- The behavior fixture uses shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { checkSimSnapshotWire, snapshotSimHostBytes, serializeSimSnapshot, type SimSnapshotBytes } from '../src/engine/sim/snapshot';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { Rng } from '../src/engine/core/rng';
import { MAX_TICK_SNAPSHOT_CHARS } from '../src/sdk/tickProtocol';

let initial: SimSnapshotBytes;
beforeAll(async () => {
  const host = createSimHost(SIM_LEVEL, { rapier: await loadRapier(readFileSync('public/assets/physics/rapier.wasm')) });
  try { initial = snapshotSimHostBytes(host); } finally { host.dispose(); }
});

test('the wire fence has the same exact result at either side of the actual encoded length', () => {
  const rng = new Rng(417);
  for (const length of [1, 63, 64, 65537]) for (const repeated of [false, true]) {
    const physics = Uint8Array.from({ length }, () => repeated ? 73 : rng.int(0, 255));
    const saved = { ...initial, physics, adapters: [{ id: 'metadata', state: 'é😀' }] };
    const wire = serializeSimSnapshot(saved);
    expect(() => checkSimSnapshotWire(saved, wire.length - 1)).toThrow('character bound');
    expect(() => checkSimSnapshotWire(saved, wire.length)).not.toThrow();
    expect(() => checkSimSnapshotWire(saved, MAX_TICK_SNAPSHOT_CHARS)).not.toThrow();
  }
});

test('a conservative bound never refuses a large but compressible valid continuation', () => {
  const saved = { ...initial, physics: new Uint8Array(24_000_000) };
  // Raw base64 alone reaches the cap; metadata pushes the cheap bound above it.
  // The original compressor must decide whether the full checkpoint really fits.
  expect(serializeSimSnapshot(saved).length).toBeLessThan(MAX_TICK_SNAPSHOT_CHARS);
  expect(() => checkSimSnapshotWire(saved, MAX_TICK_SNAPSHOT_CHARS)).not.toThrow();
});

test.each(['pose', 'identity', 'accessor', 'cycle', 'legacy-byte', 'empty', 'too-large'] as const)('the observation keeps the writer refusal for %s', kind => {
  const saved = structuredClone(initial);
  if (kind === 'pose') saved.player.position[0] = Number.NaN;
  if (kind === 'identity') saved.flags.push('duplicate', 'duplicate');
  if (kind === 'accessor') Object.defineProperty(saved, 'unexpected', { enumerable: true, get: () => 1 });
  if (kind === 'cycle') Reflect.set(saved, 'unexpected', saved);
  if (kind === 'legacy-byte') Reflect.set(saved, 'physics', [256]);
  if (kind === 'empty') saved.physics = new Uint8Array();
  if (kind === 'too-large') saved.physics = new Uint8Array(32_000_001);
  expect(() => serializeSimSnapshot(saved)).toThrow();
  expect(() => checkSimSnapshotWire(saved, MAX_TICK_SNAPSHOT_CHARS)).toThrow();
});

test('native offset views keep their bytes and ownership through the fast fence', () => {
  const backing = new Uint8Array(initial.physics.length + 19).fill(173), physics = backing.subarray(7, 7 + initial.physics.length);
  physics.set(initial.physics); const before = backing.slice();
  checkSimSnapshotWire({ ...initial, physics }, MAX_TICK_SNAPSHOT_CHARS);
  expect(backing.every((byte, index) => byte === before[index])).toBe(true);
});
