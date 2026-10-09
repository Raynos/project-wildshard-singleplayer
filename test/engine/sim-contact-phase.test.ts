import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { HuntBrain } from '../../src/engine/ai/hunt';
import { Rng } from '../../src/engine/core/rng';
import { BOAR } from '../../src/game/systems/species/boar';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { loadRapier } from '../../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('runs act, real native motion and contact per body, then equipment exactly once', () => {
  const first = SIM_LEVEL.entities[0]; if (first === undefined) throw new Error('Missing real boar recipe');
  const host = createSimHost({ ...SIM_LEVEL, entities: [first, { ...first, id: 'boar:2', at: { x: 3, y: 0, z: 2 } }] }, { rapier });
  const order: string[] = [], before = new Map<string, number>();
  try {
    host.onStep('equipment', () => { order.push('equipment'); }, undefined, 'afterBodies');
    host.onStep('decisions', () => { order.push('decisions'); });
    host.useBodyStep({ before: (id, body) => {
      order.push(`act:${id}`); before.set(id, body.position.z); body.setMotion(0, 2, 20);
    }, after: (id, body) => {
      expect(body.position.z).not.toBe(before.get(id)); order.push(`contact:${id}`);
    } });
    host.step();
    expect(order).toEqual(['decisions', 'act:boar:1', 'contact:boar:1', 'act:boar:2', 'contact:boar:2', 'equipment']);
    expect(host.state.tick).toBe(1);
    expect(host.hasStep('equipment')).toBe(true);
    expect(() => host.onStep('equipment', () => undefined)).toThrow('registration');
  } finally { host.dispose(); }
});

it('removes after-body work and its continuation together without changing default work', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }); let normal = 0, late = 0;
  try {
    host.onStep('default', () => { normal++; });
    const remove = host.onStep('late', () => { late++; }, { snapshot: () => late, restore: value => {
      if (typeof value !== 'number') throw new Error('Invalid continuation'); late = value;
    } }, 'afterBodies');
    host.step(); remove(); remove(); host.step();
    expect({ normal, late }).toEqual({ normal: 2, late: 1 });
    expect(host.hasStep('late')).toBe(false);
    expect(snapshotSimHost(host).adapters.some(row => row.id === 'late')).toBe(false);
  } finally { host.dispose(); }
});

it('restores the same phased installer with no extra body step or setup decision', () => {
  const install = (host: SimHost): void => {
    let count = 0;
    host.onStep('decisions', () => { count++; }, { snapshot: () => count, restore: value => {
      if (typeof value !== 'number') throw new Error('Invalid continuation'); count = value;
    } });
    host.useBodyStep({ before: (_id, actor) => { actor.setMotion(count < 20 ? 0.3 : -0.4, 1, 4); } });
    host.onStep('equipment', () => { host.state.timers['observed'] = count; }, undefined, 'afterBodies');
  };
  const host = createSimHost(SIM_LEVEL, { rapier }); install(host);
  try {
    for (let tick = 0; tick < 30; tick++) host.step();
    const saved = snapshotSimHost(host), restored = restoreSimHost(SIM_LEVEL, { rapier }, saved, install);
    try {
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let tick = 0; tick < 120; tick++) { host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { restored.dispose(); }
  } finally { host.dispose(); }
});


it('lands a real hunting charge on the tick its native motion crosses the contact radius', () => {
  const recipe = SIM_LEVEL.entities[0]; if (recipe === undefined) throw new Error('Missing real boar');
  const host = createSimHost({ ...SIM_LEVEL, entities: [{ ...recipe, at: { x: 0, y: 0, z: 1.42 } }] }, { rapier });
  try {
    const native = host.entities.get(recipe.id); if (native === undefined) throw new Error('Missing native actor');
    const actor = Object.assign(native, { hidden: false, sampleTerrain: () => undefined });
    const hits: number[] = [];
    const hunt = new HuntBrain({ rng: new Rng(7), fight: { telegraphed: true }, faunaTuning: () => undefined, species: () => BOAR }, {
      ground: { heightAt: () => 0, normalY: () => 1, trailDistance: () => 30, cabinMask: () => 0, inChunk: () => true,
        streamAt: () => null, waterLevel: () => -10, pond: () => null, sea: () => false, wetAt: () => false,
        trees: () => [], treeless: () => true, terrain: () => true, chunkHalf: 16 },
      nav: () => null, reach: () => true, wanderGoal: () => null, unaware: () => false, now: () => host.clock.now,
      sound: () => undefined, charge: (_body, damage) => { hits.push(host.state.tick);
        host.combat.hit({ source: 'env', sourceTags: ['creature.boar'], target: host.player.health, amount: damage, point: actor.position, dir: new Vector3() }); },
    }, host.player.position);
    hunt.adopt(actor, 0, 1.42); actor.state = 'charge'; actor.speed = 7.5;
    actor.setMotion(Math.PI, 7.5, 2.5);
    const hp = host.player.health.attributes.health;
    hunt.chargeContact(actor, host.player.position); expect(hits).toEqual([]);
    host.useBodyStep({ after: () => { if (actor.state === 'charge') hunt.chargeContact(actor, host.player.position); } });
    host.step();
    expect(actor.position.distanceTo(host.player.position)).toBeLessThan(1.4);
    expect(hits).toEqual([1]); expect(host.player.health.attributes.health).toBeLessThan(hp);
    host.step(); expect(hits).toEqual([1]);
  } finally { host.dispose(); }
});


it('preflights after-body ids against dynamic actors before consuming a spawn', () => {
  const recipe = SIM_LEVEL.entities[0]; if (recipe === undefined) throw new Error('Missing native recipe');
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  try {
    const remove = host.onStep('runtime.actor.deferred', () => undefined, undefined, 'afterBodies');
    const before = snapshotSimHost(host);
    expect(() => host.spawn({ ...recipe, id: 'deferred' })).toThrow('Invalid dynamic simulation actor');
    expectSameSimSnapshot(snapshotSimHost(host), before);
    remove(); expect(host.spawn({ ...recipe, id: 'deferred' }).entityId).toBe('deferred');
  } finally { host.dispose(); }
});
