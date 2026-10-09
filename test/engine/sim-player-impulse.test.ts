// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM and read the client Player's source in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { FIXED_STEP } from '../../src/engine/core/fixedStep';
import { addImpulse, decayImpulse, IMPULSE_DECAY_RATE, IMPULSE_REST_SQ } from '../../src/engine/player/impulse';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const boot = (): SimHost => createSimHost(SIM_LEVEL, { rapier });

it('is the client Player\'s law, bit for bit: e^(-3.5 dt) per step, zero under 0.05 m²/s², finite only', () => {
  expect([IMPULSE_DECAY_RATE, IMPULSE_REST_SQ]).toEqual([3.5, 0.05]);
  const shared = new Vector3(), inline = new Vector3();
  addImpulse(shared, new Vector3(7 * Math.sin(0.4), 2.5, 7 * Math.cos(0.4))); inline.set(7 * Math.sin(0.4), 2.5, 7 * Math.cos(0.4));
  let steps = 0;
  while (inline.lengthSq() > 0) {
    // the formula Player.ts carried inline before it called decayImpulse
    inline.multiplyScalar(Math.exp(-3.5 * FIXED_STEP)); if (inline.lengthSq() < 0.05) inline.set(0, 0, 0);
    decayImpulse(shared, FIXED_STEP); steps++;
    expect(shared.toArray()).toEqual(inline.toArray());
  }
  expect(steps).toBeGreaterThan(30); expect(shared.toArray()).toEqual([0, 0, 0]);
  expect(() => { addImpulse(shared, new Vector3(Number.NaN, 0, 0)); }).toThrow('Player impulse must be finite');
  // the client Player routes both halves through the shared law, so browser and headless cannot drift
  const player = readFileSync('src/engine/player/Player.ts', 'utf8');
  expect(player).toContain('addImpulse(this.impulseVelocity, worldVelocityMps)');
  expect(player).toContain('decayImpulse(impulse, dt)');
  expect(player).not.toContain('Math.exp(-3.5');
});

it('carries a shove on the owned headless player through the motor and fades it to rest', () => {
  const host = boot();
  try {
    const start = host.player.position.clone(), expected = new Vector3(6, 0, 0);
    let travelled = 0;
    host.impulsePlayer(new Vector3(6, 0, 0));
    expect(host.playerImpulse.toArray()).toEqual([6, 0, 0]);
    for (let tick = 0; tick < 120 && host.playerImpulse.lengthSq() > 0; tick++) {
      travelled += expected.x * FIXED_STEP; decayImpulse(expected, FIXED_STEP);
      host.step();
      expect(host.playerImpulse.toArray()).toEqual(expected.toArray());
    }
    expect(host.playerImpulse.toArray()).toEqual([0, 0, 0]);
    expect(host.player.position.x - start.x).toBeCloseTo(travelled, 3);
    expect(travelled).toBeGreaterThan(1.5);
    // with no command and no impulse the host leaves the player exactly where it is
    const rest = host.player.position.clone(); host.step(); expect(host.player.position.toArray()).toEqual(rest.toArray());
  } finally { host.dispose(); }
});

it('keeps a live impulse in the strict snapshot and omits a resting one (unchanged bytes for unshoved hosts)', () => {
  const plain = boot(), shoved = boot();
  let restored: SimHost | undefined;
  try {
    expect(snapshotSimHost(plain).player.impulse).toBeUndefined();
    shoved.impulsePlayer(new Vector3(0, 0, -5)); shoved.step({ moveX: 0, moveZ: 1, yaw: 0 });
    const saved = serializeSimSnapshot(snapshotSimHost(shoved));
    expect(decodeSimSnapshot(saved).player.impulse).toEqual(shoved.playerImpulse.toArray());
    restored = restoreSimHost(SIM_LEVEL, { rapier }, decodeSimSnapshot(saved));
    expect(restored.playerImpulse.toArray()).toEqual(shoved.playerImpulse.toArray());
    for (let tick = 0; tick < 40; tick++) { shoved.step({ moveX: 0.3, moveZ: 1, yaw: 0 }); restored.step({ moveX: 0.3, moveZ: 1, yaw: 0 }); }
    expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(shoved)));
    // an explicit zero is not canonical, and a malformed vector refuses
    const zero = snapshotSimHost(plain); zero.player.impulse = [0, 0, 0];
    expect(() => restoreSimHost(SIM_LEVEL, { rapier }, zero)).toThrow('Snapshot instance registrations do not match');
    expect(() => decodeSimSnapshot(saved.replace(/"impulse":\[[^\]]*\]/u, '"impulse":[1,2]'))).toThrow();
  } finally { restored?.dispose(); shoved.dispose(); plain.dispose(); }
});
