// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual shipped native physics and restored handles.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Scene } from 'three';
import { DeclaredBodyOpsSchema } from '../src/format/bodySlots';
import { installDeclaredBodyOps } from '../src/game/quest/bodyOps';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { Animal } from '../src/engine/entities/AnimalView';
import { Forest } from '../src/engine/world/forest/Forest';
import { SkyRig } from '../src/engine/world/skyRig';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import type { ShardContext } from '../src/game/plugin/context';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const rows = { bodies: [{ id: 'crate', kind: 'prop', at: { x: 2, y: 1, z: 3 }, yaw: .3,
  shape: { cuboid: { x: .4, y: .5, z: .6 } }, material: 'wood', owner: { kind: 'crate', id: 'crate' }, keep: true }],
  colliders: [{ id: 'crate.collider', target: { kind: 'body', body: 'crate' } }] };

test('declared transactions allocate only at commit, retain exact physics and refuse atomically', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const ops = await installDeclaredBodyOps(host, rows), baseline = host.physics.world.bodies.len();
    const staged = ops.prepare([[17, 0, 1, 0, 0], [18, 1, 4, 5, 6], [19, 0, 1, 0, 0], [21, 1, 0, 0, 0]]);
    expect(host.physics.world.bodies.len()).toBe(baseline); expect(ops.body('crate')).toBeNull();
    expect(() => ops.prepare([[17, 0, 1, 0, 0], [19, 0, 999, 0, 0]])).toThrow('collider');
    expect(host.physics.world.bodies.len()).toBe(baseline);
    staged.commit(); const body = ops.body('crate'); if (body === null) throw new Error('Missing native prop');
    expect(host.physics.world.bodies.len()).toBe(baseline + 1);
    expect(body.rb.translation()).toEqual({ x: 4, y: 5, z: 6 }); expect(body.collider.isEnabled()).toBe(false);
    expect(ops.read(23, 1, 0)).toBe(1); expect(ops.read(25, 1, 0)).toBe(0);
    expect(() => staged.commit()).toThrow('no longer live');
    expect(() => ops.prepare([[18, 1, 20, 10, 20], [21, 1, 2, 0, 0]])).toThrow('visibility');
    expect(body.rb.translation()).toEqual({ x: 4, y: 5, z: 6 });
    ops.prepare([[20, 1, 7, 8, .7], [19, 0, 1, 1, 0]]).commit();
    expect(body.rb.translation()).toEqual({ x: 7, y: 5, z: 8 }); expect(ops.read(24, 1, 0)).toBe(.7);
    expect(body.rb.rotation().y).toBeCloseTo(Math.sin(.35));
    expect(body.collider.isEnabled()).toBe(true);
    ops.pre(1 / 60); host.physics.world.step(); ops.post(1 / 60);
    expect(ops.position('crate')?.y).toBeLessThan(5);
    ops.prepare([[22, 1, 0, 0, 0]]).commit(); expect(ops.body('crate')).toBeNull();
    expect(host.physics.world.bodies.len()).toBe(baseline);
    const pending = ops.prepare([[17, 0, 1, 0, 0]]); host.dispose();
    expect(() => pending.commit()).toThrow('no longer live');
  } finally { host.dispose(); }
});

test('caller-owned old save handles rebind without allocating or replaying scripts', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const ops = await installDeclaredBodyOps(host, rows);
    ops.prepare([[17, 0, 1, 0, 0]]).commit();
    const handle = ops.body('crate')?.rb.handle;
    if (handle === undefined) throw new Error('Missing original handle');
    const saved = snapshotSimHost(host), restored = restoreSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }, saved);
    try {
      const rebound = await installDeclaredBodyOps(restored, rows), before = restored.physics.world.bodies.len();
      rebound.restoreHandles({ crate: handle });
      expect(restored.physics.world.bodies.len()).toBe(before); expect(rebound.body('crate')?.rb.handle).toBe(handle);
      rebound.prepare([[18, 1, 3, 4, 5]]).commit(); expect(rebound.position('crate')).toEqual({ x: 3, y: 4, z: 5 });
      expect(() => rebound.restoreHandles({ crate: handle, foreign: handle })).toThrow('Unknown');
    } finally { restored.dispose(); }
  } finally { host.dispose(); }
});

test('rows are plain data and absent targets refuse before publishing any body', async () => {
  let accessed = false;
  const getter = { get bodies() { accessed = true; return []; }, colliders: [] };
  expect(() => v.parse(DeclaredBodyOpsSchema, getter)).toThrow('plain JSON'); expect(accessed).toBe(false);
  expect(() => v.parse(DeclaredBodyOpsSchema, { ...rows, bodies: [rows.bodies[0], rows.bodies[0]] })).toThrow();
  expect(() => v.parse(DeclaredBodyOpsSchema, { ...rows, colliders: [{ id: 'bad', target: { kind: 'body', body: 'absent' } }] })).toThrow();
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const baseline = host.physics.world.bodies.len();
    await expect(installDeclaredBodyOps(host, { bodies: [], colliders: [{ id: 'missing', target: { kind: 'box', box: { x: 20, z: 20, hw: 1, hd: 1, yTop: 2, yBottom: 0 } } }] })).rejects.toThrow('baked box');
    await expect(installDeclaredBodyOps(host, { bodies: [{ id: 'guide', kind: 'actor', species: 'deer', variant: 'ghost', at: { x: 0, y: 0, z: 0 }, yaw: 0 }], colliders: [] })).rejects.toThrow('client-only');
    expect(host.physics.world.bodies.len()).toBe(baseline);
  } finally { host.dispose(); }
});

test('page actors are real native rigs, excluded from target lists and retired exactly once', async () => {
  const owner = new Scope('declared-guide'), previous = activeLevel();
  configureLevel({ ...previous, ground: { structures: true } });
  const sky: unknown = Object.create(SkyRig.prototype), forest: unknown = Object.create(Forest.prototype);
  if (!(sky instanceof SkyRig) || !(forest instanceof Forest)) throw new Error('Missing native test services');
  const material = vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const preloads = vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  const manager = owner.run(() => new AnimalManager(new Scene(), sky, forest, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } }));
  const ctx = { scope: owner, app, game: { runtime: { play: { animals: manager } } } } as ShardContext;
  const retire = vi.spyOn(manager, 'retire');
  try {
    const ops = await installDeclaredBodyOps(ctx, { bodies: [{ id: 'guide', kind: 'actor', species: 'bear', variant: 'brown', at: { x: 1, y: 2, z: 3 }, yaw: .5 }], colliders: [] });
    expect(manager.animals).toHaveLength(0); expect(ops.actor('guide')).toBeNull();
    ops.prepare([[17, 0, 1, 0, 0], [20, 1, 4, 5, .8]]).commit();
    const actor = ops.actor('guide'); if (actor === null) throw new Error('Missing guide');
    expect(actor).toBeInstanceOf(Animal); expect(actor.variant).toBe('brown'); expect(actor.mesh.skeleton.bones.some(bone => bone.name === 'body')).toBe(true);
    expect(actor.position.toArray()).toEqual([4, 2, 5]); expect(manager.animals).not.toContain(actor);
    ops.prepare([[21, 1, 0, 0, 0]]).commit(); expect(actor.mesh.visible).toBe(false);
    ops.prepare([[21, 1, 1, 0, 0]]).commit(); expect(actor.mesh.visible).toBe(true);
    actor.setMotion(.9, 0, 3); actor.update(1 / 60, 1, true); expect(ops.position('guide')).toBe(actor.position);
    owner.dispose(); owner.dispose(); expect(retire).toHaveBeenCalledExactlyOnceWith(actor); expect(actor.mesh.parent).toBeNull();
  } finally { owner.dispose(); configureLevel(previous); material.mockRestore(); preloads.mockRestore(); retire.mockRestore(); }
});

test('compiled AS body commands reach native physics through the existing DecisionHost boundary', async () => {
  const { compileDecisionScripts } = await import('../src/sdk/buildDecisionScripts');
  const { decisionBindingMap } = await import('../src/format/decisionBindings');
  const { DecisionHost } = await import('../src/engine/script/decision');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const ops = await installDeclaredBodyOps(host, rows);
    const input = { id: 'test.native-body', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/body.as',
      binding: { shard: true }, onFail: 'hold', on: ['start'], reads: ['bodyAlive'], commands: ['body.spawn', 'body.teleport'],
      bodies: { crate: 'crate' }, params: {}, state: [], stateVersion: 1 };
    const built = await compileDecisionScripts([input], ops.registries, new Map([['behaviour/body.as',
      "import {Body,Read,Do} from './generated/testNativeBody';\nexport function onStart():void{if(!Read.bodyAlive(Body.crate))Do.bodySpawn(Body.crate);Do.bodyTeleport(Body.crate,5,6,7);}"]]), { asLineCeiling: 10 });
    const script = built.rows[0], blob = built.blobs[0]; if (script === undefined || blob === undefined) throw new Error('Missing compiled body program');
    const decision = new DecisionHost({ scripts: [{ ...script, reads: ['bodyAlive'], lists: [], ids: decisionBindingMap(script, ops.registries).ids }],
      bindings: [{ id: 1, script: script.id, self: 0, actors: [], instance: 0 }], modules: new Map([[script.module, blob.bytes]]), seed: [1, 2],
      world: { read: (op, a, b) => ops.read(op, a, b), list: () => 0, prepare: commands => ops.prepare(commands), failed: () => undefined } });
    decision.enqueue(1, [1, 0, 0, 0, 0, 0]);
    for (let tick = 1; tick <= 6; tick++) decision.step(tick);
    expect(ops.body('crate')).toBeNull(); decision.step(7);
    expect(ops.position('crate')).toEqual({ x: 5, y: 6, z: 7 }); expect(decision.metrics()[0]?.refusals).toBe(0);
  } finally { host.dispose(); }
});
