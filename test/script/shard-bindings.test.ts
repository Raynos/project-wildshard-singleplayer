import * as v from 'valibot';
import { expect, it } from 'vitest';
import { ScriptBindingsSchema, scriptBindingRules, numericScriptState, createShardfileScriptLane } from '../../src/game/shardfile/scripts';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from './fixture';

it('validates bindings and refuses missing modules, conflicting identities and undeclared references', () => {
  const module = 'a'.repeat(64), bindings = v.parse(ScriptBindingsSchema, [{ module, entity: 1, actorId: 'alice', kind: 'server' }]);
  expect(scriptBindingRules(bindings, [module])).toEqual([]);
  expect(scriptBindingRules(bindings, [])).toEqual(['binding module declared in sim.scripts']);
  expect(scriptBindingRules([...bindings, ...bindings], [module])).toContain('unique script binding');
  expect(scriptBindingRules([...bindings, { module: 'b'.repeat(64), entity: 1, actorId: 'bob', kind: 'entity' }], [module])).toContain('consistent entity actor binding');
  expect(() => v.parse(ScriptBindingsSchema, [{ module, entity: 0, actorId: 'alice', kind: 'server' }])).toThrow();
});
it('translates typed explicit field ids and keeps strings outside the numeric binding', () => {
  expect(numericScriptState({ shared: [{ id: 101, name: 'door', type: 'bool', privacy: 'public', default: false }, { id: 102, name: 'label', type: 'string', privacy: 'public', default: 'Door' }], player: [] })).toEqual({
    shared: [{ id: 101, name: 'door', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }], player: [],
  });
  expect(() => numericScriptState({ shared: [{ id: 101, name: 'door', type: 'i32', privacy: 'public', default: 0, min: -1e10 }], player: [] })).toThrow('lower');
});
it('creates admitted shardfile script work while rejecting a forged host actor binding', async () => {
  const bytes = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,1);', '', '1'));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), (n) => n.toString(16).padStart(2, '0')).join('');
  const content = { identity: { seed: 435 }, sim: { scripts: [hash], bindings: v.parse(ScriptBindingsSchema, [{ module: hash, entity: 1, actorId: 'alice', kind: 'server' }]), scriptTickDivisor: 1 },
    state: { shared: [{ id: 101, name: 'door', type: 'bool' as const, privacy: 'public' as const, default: false }], player: [] } };
  const ports = { query: () => [], rules: { fields: {}, archetypes: [], events: [], maxEntities: 2 }, entities: [{ id: 1, name: 'Alice', position: [0, 0, 0] as const, fields: {}, frozen: false, interactive: true }], actors: new Map([[1, 'alice']]) };
  const lane = createShardfileScriptLane(content, new Map([[hash, bytes]]), ports);
  expect(lane.step(1)[0]?.ok).toBe(true); expect(lane.world.view('alice').shared['door']).toBe(1);
  expect(() => createShardfileScriptLane(content, new Map(), ports)).toThrow('Missing');
  expect(() => createShardfileScriptLane(content, new Map([[hash, bytes]]), { ...ports, actors: new Map([[1, 'bob']]) })).toThrow('binding');
});
