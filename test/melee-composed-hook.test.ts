import { beforeAll, expect, it } from 'vitest';
import { compileScript } from '../src/sdk/compileScript';
import { scriptSource } from './script/fixture';
import { ScriptDriver } from '../src/engine/script/lane';
import { ScriptComposition } from '../src/engine/script/composition';
import { DeclaredScriptWorld } from '../src/engine/script/state';
import { ScriptWorld } from '../src/engine/script/effects';
import { scriptItemHook } from '../src/engine/combat/items';
import { createMeleeScriptDriver } from '../src/game/plugin/simulation';
import { SKY_ITEMS } from '../src/shards/far-reach/data/items';

const moduleId = '0'.repeat(64), event = 301;
let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(scriptSource(
  'store<f64>(24576,3);store<f64>(24584,301);store<f64>(24592,load<f64>(16384+24));store<f64>(24600,load<f64>(16384+16));', '', '1')); });
const rules = { fields: {}, archetypes: [], events: [event], maxEntities: 2 };
function role(id: string, handle: number, actorId: string) {
  const world = new DeclaredScriptWorld(rules, [{ id: handle, name: id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }],
    { shared: [], player: [] }, actorId === '' ? new Map() : new Map([[handle, actorId]]));
  return new ScriptDriver({ world, modules: [], bindings: [], divisor: 1, query: () => [] }).role(id);
}
function composition() {
  return new ScriptComposition({ modules: [{ name: moduleId, bytes, seedLo: 1, seedHi: 0 }],
    roles: [role('items', 7, 'player'), role('other', 8, 'other-player'), role('mover', 9, '')], schedules: [], maxEntities: 3 });
}

it('grants only the invoking role’s host-bound owner and shares the original global tick allowances', () => {
  const lane = composition(); lane.step(1);
  const hook = scriptItemHook(lane.host, moduleId, 7, event, 'player');
  expect(hook({ tick: 1, dt: 1 / 60, action: 3, fuel: 0, cooldown: 0 })).toBe(3);
  expect(lane.host.currentTick).toBe(1); expect(lane.host.checkpoint().used.events).toBe(1);
  expect(() => scriptItemHook(lane.host, moduleId, 8, event, 'player')).toThrow('host-bound owner');
  expect(() => scriptItemHook(lane.host, moduleId, 9, event, 'player')).toThrow('host-bound owner');
  expect(() => scriptItemHook(lane.host, moduleId, 999, event, 'player')).toThrow('host-bound owner');
  expect(() => scriptItemHook(lane.host, moduleId, 999, event, '')).toThrow('host-bound owner');
  expect(new ScriptWorld(rules, []).actor(7)).toBeUndefined();
  const restored = composition(); restored.restore(lane.snapshot());
  const resumed = scriptItemHook(restored.host, moduleId, 7, event, 'player');
  restored.step(2); expect(resumed({ tick: 2, dt: 1 / 60, action: 4, fuel: 0, cooldown: 0 })).toBe(4);
  // The undelivered first request remains charged alongside the resumed request.
  expect(restored.host.currentTick).toBe(2); expect(restored.host.checkpoint().used.events).toBe(2);
  expect(restored.host.checkpoint().pending).toHaveLength(2);
});

it('refuses cross-role emitted requests before publishing an event, preserving global failure accounting', async () => {
  const forged = await compileScript(scriptSource(
    'store<f64>(24576,3);store<f64>(24584,301);store<f64>(24592,8);store<f64>(24600,3);', '', '1'));
  const lane = new ScriptComposition({ modules: [{ name: moduleId, bytes: forged, seedLo: 1, seedHi: 0 }],
    roles: [role('items', 7, 'player'), role('other', 8, 'other-player')], schedules: [], maxEntities: 2 });
  lane.step(1); const hook = scriptItemHook(lane.host, moduleId, 7, event, 'player');
  expect(hook({ tick: 1, dt: 1 / 60, action: 3, fuel: 0, cooldown: 0 })).toBeNull();
  expect(lane.host.checkpoint().used.events).toBe(0); expect(lane.host.failureCount).toBe(1);
});

it('verifies and detaches item modules, joins one host and consumes action responses without accumulating pending input', async () => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  const hash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const items = { ...SKY_ITEMS, rows: [{ ...SKY_ITEMS.rows[0], hook: { module: hash, entity: 7, event } }] };
  const assets = new Map([[hash, Uint8Array.from(bytes)]]), driver = await createMeleeScriptDriver(items, 'player', assets, 17);
  const owned = driver.modules.get(hash); if (owned === undefined) throw new Error('Missing verified module');
  expect(owned).not.toBe(assets.get(hash)); expect(owned).toEqual(bytes);
  const lane = new ScriptComposition({ modules: [{ name: hash, bytes: owned, seedLo: 17, seedHi: 0 }],
    roles: [driver.role()], schedules: [], maxEntities: 1 });
  const hook = driver.hooks(lane.host).get(SKY_ITEMS.rows[0].id); if (hook === undefined) throw new Error('Missing bound hook');
  for (let tick = 1; tick <= 80; tick++) {
    lane.step(tick); expect(hook({ tick, dt: 1 / 60, action: 3, fuel: 0, cooldown: 0 })).toBe(3);
    expect(lane.host.checkpoint().used.events).toBe(1); expect(lane.host.checkpoint().pending).toHaveLength(1);
  }
  expect(lane.host.checkpoint().modules).toHaveLength(1); expect(lane.host.failureCount).toBe(0);
  await expect(createMeleeScriptDriver(items, 'player', new Map(), 17)).rejects.toThrow('Missing admitted');
  await expect(createMeleeScriptDriver(items, 'player', new Map([[hash, new Uint8Array(1)]]), 17)).rejects.toThrow('hash mismatch');
  await expect(createMeleeScriptDriver(items, '', assets, 17)).rejects.toThrow('owner');
});
