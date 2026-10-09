// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { fnv1a32 } from '../../src/engine/core/rng';
import { tagCollider } from '../../src/engine/physics/surface';
import { SIM_LEVEL, fightCommand } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function install(host: SimHost): void {
  const brain = { ticks: 0 };
  const memory = host.slots.scriptMemory;
  host.state.timers['fixture.wait'] = 0.2;
  host.slots.scriptGlobals['round'] = 1;
  host.slots.questState['journal'] = { visited: ['arena'] };
  host.slots.ledgerDedupe.push('reward:start');
  host.onStep('fixture.brain', (_dt, active) => {
    brain.ticks++; memory['ticks'] = brain.ticks;
    if (brain.ticks % 61 === 0) active.startStrike('boar:1', active.player.id);
    if (brain.ticks % 47 === 0) active.rng.stream('ai').next();
  }, { snapshot: () => ({ ticks: brain.ticks }), restore: (state) => {
    if (state === null || typeof state !== 'object' || Array.isArray(state) || typeof state['ticks'] !== 'number') throw new RangeError('Invalid brain state');
    brain.ticks = state['ticks'];
  } });
}
function observe(host: SimHost): string[] {
  const hits: string[] = [];
  host.events.on('damage.dealt', ({ req, dealt, killed }) => {
    expect(req.target).toBe(req.target.id === host.player.id ? host.player.health : host.entities.get(req.target.id)?.combatActor());
    hits.push(`${req.target.id}:${String(dealt)}:${String(killed)}`);
  }, host.scope);
  host.events.on('player.respawned', ({ at }) => { expect(at).toBe(host.player.position); }, host.scope);
  return hits;
}
const hash = (host: SimHost): number => fnv1a32(JSON.stringify(snapshotSimHost(host)));

it.each([2, 7, 20, 93, 187])('snapshots the recorded real fight at tick %i and restores its exact suffix in Node', (checkpoint) => {
  const original = createSimHost(SIM_LEVEL, { rapier }); install(original);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < checkpoint; tick++) original.step(fightCommand(tick));
    original.advance(1 / 120); // nonzero fixed-step accumulator also belongs to the continuation
    const target = original.entities.get('boar:1');
    if (target === undefined) throw new Error('Missing fixture creature');
    original.combat.hit({ source: original.player.health, sourceTags: ['dmg.melee', 'cover.checked', 'fixture.pending'], target: target.combatActor(),
      amount: 1, point: target.position, from: original.player.position, dir: new Vector3(0, 0, 1) }); // leave a real combat event pending
    original.events.emit('player.respawned', { at: original.player.position, checkpoint: false });
    const saved = snapshotSimHost(original), serialized = serializeSimSnapshot(saved);
    const roundTrip = decodeSimSnapshot(serialized); // validated transport includes packed Rapier bytes
    restored = restoreSimHost(SIM_LEVEL, { rapier }, roundTrip, install);
    expect(hash(restored)).toBe(hash(original));
    const originalHits = observe(original), restoredHits = observe(restored);
    for (let tick = checkpoint; tick < 600; tick++) {
      original.advance(1 / 60, fightCommand(tick)); restored.advance(1 / 60, fightCommand(tick));
    }
    expect(restoredHits).toEqual(originalHits); expect(restoredHits.length).toBeGreaterThan(0);
    expect(hash(restored)).toBe(hash(original));
    expect(restored.entities.get('boar:1')?.alive).toBe(false);
    expect(restored.flags.has('quest:arena')).toBe(true);
    expect(restored.slots.scriptMemory['ticks']).toBe(original.state.tick);
  } finally { restored?.dispose(); original.dispose(); }
});

it('rejects other snapshot/engine/content versions and missing future-state adapters', () => {
  const original = createSimHost(SIM_LEVEL, { rapier }); install(original);
  try {
    const saved = snapshotSimHost(original);
    for (const bad of [{ ...saved, version: 2 }, { ...saved, apiVersion: 2 }, { ...saved, levelFingerprint: 0 }]) {
      expect(() => restoreSimHost(SIM_LEVEL, { rapier }, bad, install)).toThrow('Incompatible');
    }
    expect(() => restoreSimHost(SIM_LEVEL, { rapier }, saved)).toThrow('registrations');
    expect(original.scope.disposed).toBe(false); expect(snapshotSimHost(original)).toEqual(saved);
    saved.slots.ledgerDedupe.push('mutation'); expect(original.slots.ledgerDedupe).toEqual(['reward:start']);
  } finally { original.dispose(); }
});

it('replays moving character contacts and a dynamic Rapier body after restoration', () => {
  const original = createSimHost(SIM_LEVEL, { rapier });
  let restored: SimHost | undefined;
  try {
    const body = original.physics.world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(5, 3, 0));
    const collider = original.physics.world.createCollider(rapier.ColliderDesc.ball(0.3), body); tagCollider(collider, 'metal');
    const command = (tick: number) => ({ moveX: tick < 180 ? 0.2 : -0.2, moveZ: -0.1, yaw: 0 });
    for (let tick = 0; tick < 80; tick++) original.step(command(tick));
    restored = restoreSimHost(SIM_LEVEL, { rapier }, snapshotSimHost(original));
    for (let tick = 80; tick < 360; tick++) { original.step(command(tick)); restored.step(command(tick)); }
    expect(restored.player.position.toArray()).toEqual(original.player.position.toArray());
    expect(restored.physics.world.getRigidBody(body.handle).translation()).toEqual(body.translation());
    expect(hash(restored)).toBe(hash(original));
  } finally { restored?.dispose(); original.dispose(); }
});

it('packs every byte value canonically, with smaller physics transport and an independent parsed-data decode', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const saved = snapshotSimHost(host);
    saved.player.yaw = -0; saved.slots.scriptGlobals['signedZero'] = -0;
    const packed = serializeSimSnapshot(saved);
    expect(packed.length).toBeLessThan(JSON.stringify(saved).length);
    expect(decodeSimSnapshot(packed)).toEqual(saved);
    expect(Object.is(decodeSimSnapshot(packed).player.yaw, -0)).toBe(true);
    expect(Object.is(decodeSimSnapshot(packed).slots.scriptGlobals['signedZero'], -0)).toBe(true);
    const parsed: unknown = JSON.parse(packed);
    expect(decodeSimSnapshot(parsed)).toEqual(saved);
    for (const length of [256, 257, 258]) {
      const bytes = { ...saved, physics: Array.from({ length }, (_value, index) => index % 256) };
      expect(decodeSimSnapshot(serializeSimSnapshot(bytes))).toEqual(bytes);
    }
  } finally { host.dispose(); }
});

it('refuses unknown fields, incompatible versions, malformed continuations and corrupt packed bytes', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }); install(host);
  try {
    const saved = snapshotSimHost(host);
    const text = serializeSimSnapshot(saved);
    const data: unknown = JSON.parse(text);
    if (data === null || typeof data !== 'object' || !('snapshot' in data) || data.snapshot === null || typeof data.snapshot !== 'object') throw new Error('Missing wire snapshot');
    const wire = data;
    const snapshot = data.snapshot;
    const invalid: unknown[] = [
      { ...wire, extra: 1 }, { ...wire, version: 2 }, { ...wire, format: 'other' },
      { ...wire, snapshot: { ...snapshot, extra: 1 } },
      { ...wire, snapshot: { ...snapshot, version: 2 } },
      { ...wire, snapshot: { ...snapshot, apiVersion: 2 } },
      { ...wire, snapshot: { ...snapshot, player: { ...saved.player, extra: 1 } } },
      { ...wire, snapshot: { ...snapshot, state: { ...saved.state, extra: 1 } } },
      { ...wire, snapshot: { ...snapshot, player: { ...saved.player, motor: { ...saved.player.motor, extra: 1 } } } },
      { ...wire, snapshot: { ...snapshot, player: { ...saved.player, position: [0, 1] } } },
      { ...wire, snapshot: { ...snapshot, adapters: [saved.adapters[0], saved.adapters[0]] } },
      { ...wire, snapshot: { ...snapshot, physics: { encoding: 'base64', data: '/w==', checksum: 0 } } },
      { ...wire, snapshot: { ...snapshot, physics: { encoding: 'base64', data: '/x==', checksum: 0 } } },
      { ...wire, snapshot: { ...snapshot, physics: { encoding: 'base64', data: '/===', checksum: 0 } } },
      { ...wire, snapshot: { ...snapshot, physics: { encoding: 'base64', data: '', checksum: 0 } } },
    ];
    for (const bad of invalid) expect(() => decodeSimSnapshot(bad)).toThrow();
    for (const bad of [{ ...saved, state: { ...saved.state, tick: -1 } },
      { ...saved, player: { ...saved.player, yaw: Number.NaN } }, { ...saved, physics: [256] }]) {
      expect(() => serializeSimSnapshot(bad)).toThrow();
    }
    const badHealth = structuredClone(saved);
    if (badHealth.player.health.kind !== 'record') throw new Error('Missing encoded health record');
    badHealth.player.health.entries.push(['unknown', { kind: 'value', value: true }]);
    expect(() => serializeSimSnapshot(badHealth)).toThrow();
    expect(() => decodeSimSnapshot(JSON.stringify(saved))).toThrow(); // old unchecked decimal-array transport is not this format
    expect(() => decodeSimSnapshot('{')).toThrow();
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    expect(() => decodeSimSnapshot(cycle)).toThrow('acyclic');
    expect(snapshotSimHost(host)).toEqual(saved);
  } finally { host.dispose(); }
});

it('decodes the checksummed physics bytes as given and refuses one corrupted byte by its checksum', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }); install(host);
  try {
    const saved = snapshotSimHost(host), text = serializeSimSnapshot(saved);
    const decoded = decodeSimSnapshot(text);
    expect(decoded).toEqual(saved);
    expect(serializeSimSnapshot(decoded)).toBe(text); // byte-identical round trip
    // the same snapshot with one physics byte flipped, carrying the original bytes' checksum
    const flipped = [...saved.physics], at = Math.floor(flipped.length / 2);
    flipped[at] = (flipped[at] ?? 0) ^ 1;
    const wire = (value: string): { snapshot: { physics: { checksum: number } } } => {
      const data: unknown = JSON.parse(value);
      if (data === null || typeof data !== 'object' || !('snapshot' in data) || data.snapshot === null || typeof data.snapshot !== 'object'
        || !('physics' in data.snapshot) || data.snapshot.physics === null || typeof data.snapshot.physics !== 'object'
        || !('checksum' in data.snapshot.physics) || typeof data.snapshot.physics.checksum !== 'number') throw new Error('Missing wire physics');
      return { ...data, snapshot: { ...data.snapshot, physics: { ...data.snapshot.physics, checksum: data.snapshot.physics.checksum } } };
    };
    const good = wire(text), corrupt = wire(serializeSimSnapshot({ ...saved, physics: flipped }));
    expect(corrupt.snapshot.physics.checksum).not.toBe(good.snapshot.physics.checksum);
    corrupt.snapshot.physics.checksum = good.snapshot.physics.checksum;
    expect(() => decodeSimSnapshot(corrupt)).toThrow(/checksum/u);
  } finally { host.dispose(); }
});
