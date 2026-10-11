import { expect, it } from 'vitest';
import { generateScriptModule } from '../src/sdk/directorAbi';
import { compileBehaviourModule } from '../src/sdk/buildBehaviour';
import { ScriptLane } from '@wildshard/engine/script/lane';
import { DeclaredScriptWorld } from '@wildshard/engine/script/state';
import { numericScriptExample } from '../scripts/docs/authoring/director-script';

const state = { version: 1, sharedOwner: 'host', playerKey: 'actorId',
  shared: [{ id: 9, name: 'beacon-lit', type: 'bool', privacy: 'public', default: false }],
  player: [{ id: 3, name: 'coins', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 10 }] };
function world(actor = true): DeclaredScriptWorld {
  return new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [7], maxEntities: 1 },
  [{ id: 1, name: 'beacon', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }],
  { shared: [{ id: 9, name: 'beacon-lit', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }],
    player: [{ id: 3, name: 'coins', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 10 }] },
  actor ? new Map([[1, 'fixture.player']]) : new Map());
}

it('runs generated capacities, ordered getters, five-f64 effects and event offsets in the actual host', async () => {
  const generated = numericScriptExample();
  expect(generated.layout).toEqual({ version: 0, inputBytes: 1800, outputRecords: 8, outputBytes: 320, eventCountOffset: 256, eventOffset: 264, eventStride: 48, effectStride: 40, minimumPages: 1 });
  const compiled = await compileBehaviourModule(generated.source), owned = world();
  const lane = new ScriptLane({ query: () => [], world: owned, modules: [{ name: compiled.module, bytes: compiled.bytes, seedLo: 1, seedHi: 0 }], bindings: [{ module: compiled.module, entity: 1, actorId: 'fixture.player', kind: 'entity' }], divisor: 1 });
  lane.enqueue({ type: 7, target: 1, value: 42 });
  const call = lane.step(0)[0];
  expect(call?.ok).toBe(true); expect(call?.effects).toHaveLength(3);
  expect(call?.events).toEqual([{ type: 7, target: 1, value: 42 }]);
  expect(owned.view('fixture.player')).toEqual({ shared: { 'beacon-lit': 1 }, player: { coins: 5 } });
  const checkpoint = lane.snapshot();
  const next = lane.step(1); const restored = new ScriptLane({ query: () => [], world: world(), modules: [{ name: compiled.module, bytes: compiled.bytes, seedLo: 1, seedHi: 0 }], bindings: [{ module: compiled.module, entity: 1, actorId: 'fixture.player', kind: 'entity' }], divisor: 1 });
  restored.restore(checkpoint); expect(restored.step(1)).toEqual(next); expect(restored.snapshot()).toBe(lane.snapshot());
});

it('refuses player writes without native actor binding and rolls back the preceding shared effect', async () => {
  const generated = generateScriptModule(state, 'shared.beaconLit = true; player.coins = 5;');
  const compiled = await compileBehaviourModule(generated.source), owned = world(false);
  const lane = new ScriptLane({ query: () => [], world: owned, modules: [{ name: compiled.module, bytes: compiled.bytes, seedLo: 1, seedHi: 0 }], bindings: [{ module: compiled.module, entity: 1, actorId: null, kind: 'server' }], divisor: 1 });
  expect(lane.step(0)[0]?.ok).toBe(false); expect(owned.checkpoint().shared).toEqual([0]);
});

it('refuses invalid capacities, strings and ambiguous state aliases before compilation', () => {
  expect(() => generateScriptModule(state, '', { events: 33 })).toThrow('capacity');
  expect(() => generateScriptModule(state, '', { effects: 0 })).toThrow('capacity');
  expect(() => generateScriptModule({ ...state, shared: [{ id: 1, name: 'text', type: 'string', privacy: 'public', default: '' }] }, '')).toThrow('Strings');
  expect(() => generateScriptModule({ ...state, shared: [{ ...state.shared[0], id: 1, name: 'a.b' }, { ...state.shared[0], id: 2, name: 'a-b' }] }, '')).toThrow('aliases');
});
