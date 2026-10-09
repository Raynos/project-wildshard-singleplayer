import { beforeAll, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed physics binary in clean exports.
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import type { SystemSpec } from '../src/engine/app/systems';
import { Rng } from '../src/engine/core/rng';
import { prepareDeclaredCrowds, installDeclaredCrowdFrames, type DeclaredCrowdPorts } from '../src/game/shardfile/crowdRuntime';
import { parseFlock } from '../src/game/shardfile/crowds';
import { ShippingFlock } from './fixtures/flock-oracle/flock';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
const rows = [parseFlock({ id: 'crowd.a', kind: 'flock', x: 0, z: 0, count: 8, seed: 357, range: 32,
  runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' }),
  parseFlock({ id: 'crowd.b', kind: 'flock', x: 35, z: 0, count: 4, seed: 458, range: 32,
    runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' })];
const terrain = { heightAt: (x: number, z: number) => Math.sin(x * 0.01) + Math.cos(z * 0.02), normalY: () => 1,
  inBounds: () => true, wetAt: () => false, playerCrouched: () => false, grassHeightAt: () => 1 };
function recipes(player: Vector3, trace: string[]): DeclaredCrowdPorts {
  return { flock: row => ({ ports: { ...terrain,
    trample: (...values) => { trace.push(`${row.id}.trample.${values.join(',')}`); },
    centre: (...values) => { trace.push(`${row.id}.centre.${values.join(',')}`); } },
    observe: () => ({ player, playerSpeed: 0, wolves: [], dog: null }),
    sound: (cue, x, z) => { trace.push(`${row.id}.${cue}.${x}.${z}`); },
    present: (_policy, time, moved) => { trace.push(`${row.id}.pose.${time}.${moved}`); },
  }) };
}
function first<T>(values: readonly T[]): T { const value = values[0]; if (value === undefined) throw new Error('Missing fixture row'); return value; }
function install(host: SimHost, trace: string[], restoring = false): ReturnType<typeof prepareDeclaredCrowds> {
  const prepared = prepareDeclaredCrowds(rows, recipes(host.player.position, trace)); prepared.install(host, restoring); return prepared;
}
describe('declared crowd owner', () => {
  it('preflights all rows and recipes without setup, then installs in authored order', () => {
    const host = createSimHost(SIM_LEVEL, { rapier }), trace: string[] = [], draws = vi.spyOn(Rng.prototype, 'next');
    try {
      const before = snapshotSimHost(host), prepared = prepareDeclaredCrowds(rows, recipes(host.player.position, trace));
      expect(draws).not.toHaveBeenCalled(); expect(trace).toEqual([]); expect(snapshotSimHost(host)).toEqual(before);
      expect(() => prepareDeclaredCrowds([first(rows), first(rows)], recipes(host.player.position, trace))).toThrow('declarations');
      expect(() => prepareDeclaredCrowds(rows, { flock: row => {
        const recipe = recipes(host.player.position, trace).flock(row);
        if (row.id === 'crowd.b') Reflect.set(recipe, 'observe', undefined);
        return recipe;
      } })).toThrow('recipe');
      expect(draws).not.toHaveBeenCalled();
      prepared.install(host); expect(draws).toHaveBeenCalled(); trace.length = 0; host.step();
      expect(trace.filter(value => value.includes('.pose.')).map(value => value.split('.pose.')[0])).toEqual(rows.map(row => row.id));
      expect(() => prepared.install(host)).toThrow('already'); host.dispose(); expect(host.hasStep('crowd.crowd.a')).toBe(false);
    } finally { draws.mockRestore(); host.dispose(); }
  });
  it('rechecks collisions and rolls back a failed later setup without registering any callback', () => {
    const host = createSimHost(SIM_LEVEL, { rapier }), trace: string[] = [];
    try {
      const prepared = prepareDeclaredCrowds(rows, recipes(host.player.position, trace)), draws = vi.spyOn(Rng.prototype, 'next');
      const undo = host.onStep('crowd.crowd.b', () => undefined);
      expect(() => prepared.install(host)).toThrow('Installed'); expect(draws).not.toHaveBeenCalled(); draws.mockRestore(); undo();
      let fail = true;
      const broken = prepareDeclaredCrowds(rows, { flock: row => {
        const recipe = recipes(host.player.position, trace).flock(row);
        return { ...recipe, ports: { ...recipe.ports, heightAt: (x, z) => {
          if (fail && row.id === 'crowd.b') throw new Error('Native terrain unavailable'); return terrain.heightAt(x, z);
        } } };
      } });
      const states = [...broken.policies.values()].map(policy => policy.snapshot());
      expect(() => broken.install(host)).toThrow('Native terrain unavailable');
      expect([...broken.policies.values()].map(policy => policy.snapshot())).toEqual(states); expect(host.hasStep('crowd.crowd.a')).toBe(false);
      fail = false; broken.install(host);
      const fresh = prepareDeclaredCrowds(rows, recipes(host.player.position, [])); fresh.initialize();
      expect([...broken.policies.values()].map(policy => policy.snapshot())).toEqual([...fresh.policies.values()].map(policy => policy.snapshot()));
    } finally { host.dispose(); }
  });
  it('restores the complete mixed host with no setup or observation and an exact 10k suffix', () => {
    const host = createSimHost(SIM_LEVEL, { rapier }), a: string[] = [], b: string[] = []; let restored: SimHost | undefined;
    try {
      const original = install(host, a); for (let tick = 0; tick < 301; tick++) host.step();
      const draw = vi.spyOn(Rng.prototype, 'next');
      restored = restoreSimHost(SIM_LEVEL, { rapier }, snapshotSimHost(host), fresh => { install(fresh, b, true); });
      expect(draw).not.toHaveBeenCalled(); draw.mockRestore(); expect(b).toEqual([]); a.length = 0;
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expect(b).toEqual(a); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
      expect(original.policies.size).toBe(2);
    } finally { host.dispose(); restored?.dispose(); }
  });
  it.each([30, 60])('keeps the shipping render-frame clock and ordered native recipe at %i Hz', hz => {
    const player = new Vector3(25, 0, 0), trace: string[] = [], prepared = prepareDeclaredCrowds([first(rows)], recipes(player, trace));
    prepared.initialize();
    const oracle = new ShippingFlock({ ...terrain, normalAt: () => [0, 1, 0], playerCrouched: false,
      trample: () => undefined, centre: () => undefined }, first(rows)); oracle.initialize();
    let system: SystemSpec | undefined;
    installDeclaredCrowdFrames({ system: value => { system = value; } }, { systemId: 'native.crowds', after: ['grass'], before: ['animals'],
      current: () => prepared, frame: (dt, time, advance) => {
        trace.push('grass'); advance(first(rows).id, dt, time); trace.push('marmots');
      } });
    if (system === undefined) throw new Error('Missing installed system');
    expect(system.phase).toBe('update'); expect(system.after).toEqual(['grass']); expect(system.before).toEqual(['animals']);
    const policy = prepared.policies.get(first(rows).id); if (policy === undefined) throw new Error('Missing policy');
    for (let frame = 0; frame < 10000; frame++) {
      player.set(policy.cx + (frame % 3000 < 800 ? 35 : frame % 3000 < 1600 ? 90 : 300), 0, policy.cz);
      trace.length = 0; system.run(1 / hz, frame / hz); oracle.update(1 / hz, frame / hz, player, 0, []);
      expect(policy.state()).toEqual(oracle.state()); expect(trace[0]).toBe('grass'); expect(trace.at(-1)).toBe('marmots');
    }
  });
  it('rejects duplicate, omitted or re-clocked native advances', () => {
    const prepared = prepareDeclaredCrowds([first(rows)], recipes(new Vector3(), [])); prepared.initialize();
    for (const mode of ['duplicate', 'omitted', 'clock'] as const) {
      let system: SystemSpec | undefined;
      installDeclaredCrowdFrames({ system: value => { system = value; } }, { systemId: mode, after: [], before: [], current: () => prepared,
        frame: (dt, t, advance) => {
          if (mode === 'omitted') return;
          advance(first(rows).id, mode === 'clock' ? dt / 2 : dt, t);
          if (mode === 'duplicate') advance(first(rows).id, dt, t);
        } });
      if (system === undefined) throw new Error('Missing system'); const installed = system; expect(() => installed.run(1 / 30, 0)).toThrow('crowd');
    }
  });
});
