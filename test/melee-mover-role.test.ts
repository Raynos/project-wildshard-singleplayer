import { beforeAll, expect, it } from 'vitest';
import { compileScript } from '../src/sdk/compileScript';
import { scriptSource } from './script/fixture';
import { MoverScriptDriver } from '../src/game/plugin/mover';
import { createMeleeScriptDriver } from '../src/game/plugin/simulation';
import { SKY_ITEMS } from '../src/shards/far-reach/data/items';

let bytes: Uint8Array, moduleId: string;
beforeAll(async () => {
  bytes = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,301);store<f64>(24592,load<f64>(16408));store<f64>(24600,3);', '', '1'));
  moduleId = [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))].map(value => value.toString(16).padStart(2, '0')).join('');
});
const content = (scripts: readonly string[]) => ({ identity: { seed: 17 },
  sim: { scripts, bindings: [], scriptTickDivisor: 1 }, state: { shared: [], player: [] } });
const ports = (maxEntities = 1) => ({ rules: { fields: {}, archetypes: [], events: [], maxEntities }, entities: [], actors: new Map<number, string>(), query: () => [] });
function items(entity = 7) {
  return createMeleeScriptDriver({ ...SKY_ITEMS, rows: [{ ...SKY_ITEMS.rows[0], hook: { module: moduleId, entity, event: 301 } }] },
    'actor.player', new Map([[moduleId, bytes]]), 17);
}

it('preserves continuation bytes when no extra roles are supplied', () => {
  const a = new MoverScriptDriver([], () => []).compose(content([]), new Map(), ports());
  const b = new MoverScriptDriver([], () => []).compose(content([]), new Map(), ports(), undefined, undefined, { roles: [] });
  expect(a.snapshot()).toBe(b.snapshot()); a.step(1); b.step(1); expect(a.snapshot()).toBe(b.snapshot());
});

it('joins item owner grants and optional schedules into the existing mover clock', async () => {
  const item = await items(), driver = new MoverScriptDriver([], () => []);
  const lane = driver.compose(content([moduleId]), item.modules, ports(), undefined, undefined, { roles: [item.role()],
    schedules: [{ id: 'item-request', role: 'items', bindings: [{ module: moduleId, entity: 7, divisor: 1 }],
      input: (_binding, tick) => [tick, 1 / 60, 3, 7, 0, 0], committed: () => undefined }] });
  const hook = item.hooks(lane.host).get(SKY_ITEMS.rows[0].id); if (hook === undefined) throw new Error('Missing item hook');
  for (let tick = 1; tick <= 3; tick++) {
    expect(lane.step(tick).every(call => call.ok)).toBe(true);
    expect(hook({ tick, dt: 1 / 60, action: 3, fuel: 0, cooldown: 0 })).toBe(3);
    expect(lane.host.currentTick).toBe(tick); expect(lane.host.checkpoint().used.events).toBe(2);
  }
  expect(lane.host.checkpoint().modules).toHaveLength(1);
  expect(() => lane.step(3)).toThrow('Invalid composed script tick');
});

it('keeps aggregate entity limits and rejects overlapping extra roles', async () => {
  const item = await items(), driver = new MoverScriptDriver([], () => []);
  expect(() => driver.compose(content([moduleId]), item.modules, ports(), undefined, undefined,
    { roles: [item.role(), item.role('duplicate')] })).toThrow('Invalid script role identities');
  const other = await items();
  expect(() => driver.compose(content([moduleId]), item.modules, ports(2), undefined, undefined,
    { roles: [item.role(), other.role('duplicate')] })).toThrow('Overlapping script roles');
  const disjoint = await items(8);
  expect(() => driver.compose(content([moduleId]), item.modules, ports(), undefined, undefined,
    { roles: [item.role(), disjoint.role('other')] })).toThrow('Aggregate script entity allowance');
});
