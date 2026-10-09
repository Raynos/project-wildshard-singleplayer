import { beforeAll, describe, expect, it } from 'vitest';
import { DeclaredScriptWorld, SCRIPT_STATE_OP, type ScriptStateDeclaration } from '../../src/engine/script/state';
import { ScriptLane, installScriptLane } from '../../src/engine/script/lane';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from './fixture';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier } from '../../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

const declaration: ScriptStateDeclaration = {
  shared: [{ id: 101, name: 'door', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }],
  player: [{ id: 202, name: 'quest', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 10 }],
};
function world(): DeclaredScriptWorld {
  return new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [1], maxEntities: 8 }, [1, 2].map((id) => ({ id, name: `actor ${id}`, position: [0, 0, 0], fields: {}, frozen: false, interactive: true })), declaration, new Map([[1, 'alice'], [2, 'bob']]));
}
let bytes: Uint8Array, rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  bytes = await compileScript(scriptSource(`
    const command = load<f64>(16384+16);
    const door = load<f64>(16384+64);
    const progress = load<f64>(16384+72);
    store<f64>(24576,5); store<f64>(24584,101); store<f64>(24592,command>0?1:door);
    store<f64>(24616,6); store<f64>(24624,202); store<f64>(24632,progress+command);
  `, '', '2'));
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});
function lane(w = world(), divisor = 1): ScriptLane {
  return new ScriptLane({ world: w, query: () => [], modules: [{ name: 'door', bytes, seedLo: 0, seedHi: 0 }],
    bindings: [1, 2].map((entity) => ({ module: 'door', entity, actorId: entity === 1 ? 'alice' : 'bob', kind: 'server' })), divisor });
}
describe('local authoritative entity script lane', () => {
  it('queues declared scene events until the next fixed script tick and refuses unknown/cross-budget events', () => {
    const scripts = lane(); scripts.enqueue({ type: 1, target: 1, value: 7 });
    expect(scripts.host.checkpoint().pending).toEqual([{ type: 1, target: 1, value: 7 }]);
    expect(() => scripts.enqueue({ type: 2, target: 1, value: 1 })).toThrow();
    expect(() => scripts.enqueue({ type: 1, target: 3, value: 1 })).toThrow();
    expect(() => scripts.enqueue({ type: 1, target: 1, value: Number.NaN })).toThrow();
    scripts.step(1); expect(scripts.host.checkpoint().pending).toEqual([]);
    for (let i = 0; i < 32; i++) scripts.enqueue({ type: 1, target: 1, value: i });
    expect(() => scripts.enqueue({ type: 1, target: 1, value: 33 })).toThrow('allowance');
  });
  it('two actors agree on a shared door while private quest progress stays separate', () => {
    const scripts = lane(); expect(scripts.step(1, new Map([['alice', 1]]))).toHaveLength(2);
    expect(scripts.world.view('alice')).toEqual({ shared: { door: 1 }, player: { quest: 1 } });
    expect(scripts.world.view('bob')).toEqual({ shared: { door: 1 }, player: { quest: 0 } });
    scripts.step(2, new Map([['bob', 2]]));
    expect(scripts.world.view('alice').player).toEqual({ quest: 1 }); expect(scripts.world.view('bob').player).toEqual({ quest: 2 });
    expect(scripts.host.checkpoint().modules).toHaveLength(1);
    const view = scripts.world.view('alice'); expect(view).not.toBe(scripts.world.view('alice'));
  });
  it('rejects undeclared, wrongly typed, cross-actor and out-of-range state batches atomically', () => {
    const w = world(), before = w.checkpoint();
    for (const bad of [ { op: 6, a: 202, b: 2, c: 2, d: 0 }, { op: 6, a: 203, b: 1, c: 0, d: 0 }, { op: 6, a: 202, b: 0.5, c: 0, d: 0 }, { op: 5, a: 101, b: 2, c: 0, d: 0 } ]) {
      expect(() => w.prepare([{ op: SCRIPT_STATE_OP.shared, a: 101, b: 1, c: 0, d: 0 }, bad], 1, 8, 32)).toThrow(); expect(w.checkpoint()).toEqual(before);
    }
    expect(() => new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 8 }, [], declaration, new Map([[1, 'impostor']]))).toThrow('binding');
    expect(() => new ScriptLane({ world: w, query: () => [], modules: [{ name: 'door', bytes, seedLo: 0, seedHi: 0 }], bindings: [{ module: 'door', entity: 1, actorId: 'bob', kind: 'entity' }], divisor: 1 })).toThrow('binding');
  });
  it('snapshots pending events, failure history, quotas and all script and actor state', async () => {
    const eventBytes = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,1);store<f64>(24592,2);store<f64>(24600,load<f64>(16384));', '', '1'));
    const make = () => new ScriptLane({ world: world(), query: () => [], modules: [{ name: 'event', bytes: eventBytes, seedLo: 0, seedHi: 0 }], bindings: [{ module: 'event', entity: 1, actorId: 'alice', kind: 'entity' }], divisor: 1 });
    const original = make(); original.step(1); const saved = original.snapshot();
    expect(original.host.checkpoint().pending).toHaveLength(1);
    const fresh = make(); fresh.restore(saved); expect(fresh.snapshot()).toBe(saved);
    expect(fresh.step(2)).toEqual(original.step(2)); expect(fresh.snapshot()).toBe(original.snapshot());
    expect(() => fresh.restore(JSON.stringify({ version: 9 }))).toThrow();
    expect(() => lane(world(), 2).restore(saved)).toThrow('Incompatible');
    const frozen = lane(); frozen.step(1, new Map([['alice', 99]]));
    const copy = lane(); copy.restore(frozen.snapshot()); expect(copy.world.entity(1)?.frozen).toBe(true); expect(copy.host.checkpoint().modules[0]?.failures).toBe(1);
  });
  it('runs the server lane inside the real singleplayer sim and restores/replays its adapter', () => {
    const sim = createSimHost(SIM_LEVEL, { rapier }), scripts = lane(world(), 2);
    const commands = () => new Map([['alice', 1]]);
    installScriptLane(sim, 'declared-scripts', scripts, commands);
    let restored: ReturnType<typeof createSimHost> | undefined;
    try {
      sim.step(); expect(scripts.world.view('alice').player['quest']).toBe(0); sim.step(); expect(scripts.world.view('alice').player['quest']).toBe(1);
      const saved = snapshotSimHost(sim), fresh = lane(world(), 2), encoded = JSON.stringify(saved);
      restored = restoreSimHost(SIM_LEVEL, { rapier }, JSON.parse(encoded) as typeof saved, (host) => { installScriptLane(host, 'declared-scripts', fresh, commands); });
      for (let i = 0; i < 8; i++) { sim.step(); restored.step(); }
      expect(fresh.snapshot()).toBe(scripts.snapshot()); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim));
    } finally { sim.dispose(); restored?.dispose(); }
    expect(sim.adapters.size).toBe(0);
  });
  it('hides host-only fields and preserves stable explicit ids when declaration order changes', () => {
    const w = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 2 }, world().state(), {
      shared: [{ ...declaration.shared[0], id: 55, name: 'secret', type: 'f64', privacy: 'host', default: 8, min: 0, max: 10 }, declaration.shared[0]].filter((f): f is ScriptStateDeclaration['shared'][number] => f !== undefined), player: declaration.player,
    }, new Map([[1, 'alice'], [2, 'bob']]));
    expect(w.input(1)).toEqual([2, 1, 8, 0, 0]); expect(w.view('alice').shared).toEqual({ door: 0 });
  });
});
