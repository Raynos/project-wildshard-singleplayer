// oxlint-disable-next-line import/no-nodejs-modules -- Exercise exact native snapshots with the shipped Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { snapshotSimHost, snapshotSimHostBytes, serializeSimSnapshot, serializeSimSnapshotSteps, finishSimSteps, decodeSimSnapshot, restoreSimHost } from '../../src/engine/sim/snapshot';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('writes byte-identical native captures and restores the same tick, state and physical world', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    host.flags.set('native-bytes'); host.slots.scriptMemory['fixture'] = { coins: 17 };
    for (let tick = 0; tick < 7; tick++) host.step();
    const plain = snapshotSimHost(host), native = snapshotSimHostBytes(host);
    expect(Array.isArray(plain.physics)).toBe(true); expect(native.physics).toBeInstanceOf(Uint8Array);
    expect(native.physics).toEqual(Uint8Array.from(plain.physics));
    for (const basis of [undefined, native.physics.slice()]) {
      const wire = serializeSimSnapshot(native, basis);
      expect(wire).toBe(serializeSimSnapshot(plain, basis));
      const decoded = decodeSimSnapshot(wire, basis); expect(decoded).toEqual(plain);
      const restored = restoreSimHost(SIM_LEVEL, { rapier }, decoded);
      try { expect(serializeSimSnapshot(snapshotSimHostBytes(restored), basis)).toBe(wire); }
      finally { restored.dispose(); }
    }
  } finally { host.dispose(); }
});
it('freezes a byte subview before the first pause, and interleaved or cancelled jobs share no capacity', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const native = snapshotSimHostBytes(host), backing = new Uint8Array(131_093);
    for (let i = 0; i < backing.length; i++) backing[i] = i % 251;
    native.physics = backing.subarray(7, 131_086);
    const expected = serializeSimSnapshot(native), first = serializeSimSnapshotSteps(native);
    expect(first.next().done).toBe(false);
    native.physics.fill(255); native.state.tick = 11;
    const changed = serializeSimSnapshot(native), second = serializeSimSnapshotSteps(native), cancelled = serializeSimSnapshotSteps(native);
    expect(second.next().done).toBe(false); expect(cancelled.next().done).toBe(false); cancelled.return('cancelled');
    expect(finishSimSteps(first)).toBe(expected); expect(finishSimSteps(second)).toBe(changed);
    expect(serializeSimSnapshot(native)).toBe(changed);
    expect(() => serializeSimSnapshot({ ...native, physics: new Uint8Array() })).toThrow();
    expect(() => serializeSimSnapshot({ ...native, physics: new Uint8Array(32_000_001) })).toThrow('32 MB');
  } finally { host.dispose(); }
});
