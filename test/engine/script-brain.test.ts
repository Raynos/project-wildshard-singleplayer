import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compile the committed author source and read the engine's binary fixture.
import { readFile } from 'node:fs/promises';
import { ScriptBrainLane, type ScriptBrainBinding } from '../../src/engine/ai/scriptBrain';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import { scriptPhysicsQueries } from '../../src/engine/script/queries';
import { compileScript } from '../../scripts/compile-script.mjs';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { scriptSource } from '../script/fixture';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let bytes: Uint8Array, rapier: Awaited<ReturnType<typeof loadRapier>>;
const binding: ScriptBrainBinding = { module: 'policy', entity: 7, actorId: 'boar:1', maxSpeed: 3, maxStrafe: 1,
  maxTurnRate: 6, parameters: [2], strikes: [{ event: 101, strike: 'boar.charge' }] };
beforeAll(async () => {
  bytes = await compileScript(await readFile('test/fixtures/sim-level/brain.as', 'utf8'), { maximumPages: 2 });
  const binary = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(binary).buffer);
});
function create(host: SimHost, source = bytes, attacks = true, bound = binding): ScriptBrainLane {
  return new ScriptBrainLane({ modules: [{ name: 'policy', bytes: source, seedLo: 357, seedHi: 0 }], bindings: [bound],
    actors: host.entities, divisor: 1,
    query: (kind, input, self) => scriptPhysicsQueries({ physics: host.physics,
      navigation: { closestWalkable: () => null, findPath: () => null }, handle: () => undefined })(kind, input, self),
    ports: { observe: actor => [actor.position.distanceTo(host.player.position)], mayAttack: () => attacks && host.player.health.alive,
      strike: (actor, id) => { if (id !== 'boar.charge') throw new Error('Undeclared trusted strike'); host.startStrike(actor.entityId, host.player.id); } },
  });
}
function install(host: SimHost): ScriptBrainLane {
  const lane = create(host);
  host.onStep('brain.custom', () => { lane.step(host.state.tick); }, { snapshot: () => lane.snapshot(), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid brain snapshot'); lane.restore(value);
  } });
  return lane;
}
const motion = 'store<f64>(24576,1);store<f64>(24584,2);store<f64>(24592,2);';
describe('trusted AssemblyScript creature intentions', () => {
  it('moves the real collision motor from validated guest intentions', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      host.player.position.z = 6;
      const actor = host.entities.get('boar:1'); if (actor === undefined) throw new Error('Missing fixture actor');
      actor.yaw = 0; install(host);
      for (let tick = 0; tick < 30; tick++) host.step();
      expect(host.entities.get('boar:1')?.position.z).toBeGreaterThan(2);
    } finally { host.dispose(); }
  });
  it('uses real engine queries and the strike pipeline; denied attack tokens suppress damage', () => {
    const active = createSimHost(SIM_LEVEL, { rapier }), denied = createSimHost(SIM_LEVEL, { rapier });
    try {
      const lane = install(active), blocked = create(denied, bytes, false);
      denied.onStep('brain.custom', () => { blocked.step(denied.state.tick); });
      for (let tick = 0; tick < 180; tick++) { active.step(); denied.step(); }
      expect(active.player.health.attributes.health).toBeLessThan(100);
      expect(denied.player.health.attributes.health).toBe(100);
      expect(lane.host.world.entity(7)?.frozen).toBe(false);
    } finally { active.dispose(); denied.dispose(); }
  });
  it('restores full author state plus actor/physics continuation for an exact 10,000-tick suffix', () => {
    const host = createSimHost(SIM_LEVEL, { rapier }); install(host);
    let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < 97; tick++) host.step();
      restored = restoreSimHost(SIM_LEVEL, { rapier }, snapshotSimHost(host), fresh => { install(fresh); });
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
  it.each([
    'store<f64>(24616,4);store<f64>(24624,100);',
    'store<f64>(24616,2);store<f64>(24624,1);',
    'store<f64>(24616,3);store<f64>(24624,101);store<f64>(24632,8);',
    'store<f64>(24616,1);store<f64>(24624,2);store<f64>(24632,4);',
  ])('rejects a bad effect after valid motion and rolls back the whole call', async invalid => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      const source = await compileScript(scriptSource(`counter++;${motion}${invalid}`, 'let counter:i32=0;', '2'));
      const lane = create(host, source), before = lane.host.snapshot('policy');
      expect(lane.step(0)[0]?.ok).toBe(false);
      expect(lane.host.world.entity(7)?.fields[2]).toBe(0);
      expect(lane.host.snapshot('policy')).toEqual(before);
      expect(host.entities.get('boar:1')?.desiredSpeed).toBe(0);
    } finally { host.dispose(); }
  });
  it('rejects changed bindings and malformed restored intent without mutating the installed lane', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      const lane = create(host); lane.step(0); const saved = lane.snapshot();
      expect(() => create(host, bytes, true, { ...binding, maxSpeed: 2 }).restore(saved)).toThrow('Incompatible');
      expect(() => lane.restore(saved.replace('"2":0', '"2":4'))).toThrow();
      expect(lane.snapshot()).toBe(saved);
      expect(() => create(host, bytes, true, { ...binding, actorId: 'another.actor' })).toThrow('trusted');
    } finally { host.dispose(); }
  });
  it('rejects an author-selected parameter identity and validates observations before advancing', async () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      const source = await compileScript(scriptSource('store<f64>(31000,8);query(410,31000,32000);',
        '@external("env","query") declare function query(kind:i32,input:i32,output:i32):i32;'));
      expect(create(host, source).step(0)[0]).toMatchObject({ ok: false, reason: 'Brain parameters require trusted self' });
      const lane = create(host), before = lane.snapshot();
      host.player.position.z = Number.NaN;
      expect(() => lane.step(0)).toThrow('observations'); expect(lane.snapshot()).toBe(before);
    } finally { host.dispose(); }
  });
});
