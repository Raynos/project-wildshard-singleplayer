import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ItemRuntime } from '../src/engine/combat/items';
import { PlayerHealth } from '../src/engine/combat/health';
import { Events } from '../src/engine/events/events';
import { DeclaredScriptWorld } from '../src/engine/script/state';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/game/shardfile/items';
import { ITEMS } from '../src/shards/_template/data/items';
import { targetRules } from '../src/game/shardfile/targets';
import { numericScriptState } from '../src/game/shardfile/scripts';
import { clientScene, projectItemFields } from '../src/game/shardfile/clientItems';

function fixture() {
  const source = emptyShardfile({ slug: 'item-fields', name: 'Item fields', author: 'Local', revision: 1, seed: 1 });
  source.items = parseItems(ITEMS); source.sim.scripts = ['a'.repeat(64)];
  source.state.player = [{ id: 201, name: 'fuel', type: 'f64', privacy: 'owner', default: 1, min: 0, max: 1 }, { id: 202, name: 'lit', type: 'bool', privacy: 'owner', default: false }];
  source.hooks.scenes = [{ id: 'lamp.toggle', type: 102, value: 3 }, { id: 'lamp.refill', type: 102, value: 4 }];
  source.targets.itemActions = [{ scene: 'lamp.toggle', item: 'tool.template-lantern', action: 3 }, { scene: 'lamp.refill', item: 'tool.template-lantern', action: 4 }];
  source.targets.itemFields = [{ item: 'tool.template-lantern', fieldId: 201, property: 'fuel' }, { item: 'tool.template-lantern', fieldId: 202, property: 'lit' }];
  const tool = source.items.rows.find((row) => row.kind === 'tool'); if (tool === undefined) throw new Error('Missing fixture tool');
  const health = new PlayerHealth(new Events(), { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const runtime = new ItemRuntime(tool, { actor: health, combat: { hit: () => null }, targets: () => [], effect: () => undefined, hook: null });
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 10 }, [{ id: 1, name: 'player', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }], numericScriptState(source.state), new Map([[1, health.id]]));
  return { source, runtime, runtimes: new Map([[tool.id, runtime]]), lane: { world }, health };
}
it('one authoritative lantern handles named toggle/refill and publishes finite actor-owned values', () => {
  const fixtureData = fixture(), { source, runtime, runtimes, lane, health } = fixtureData;
  expect(targetRules(source.targets, source, null)).toEqual([]);
  const scene = clientScene(source, runtimes, () => { throw new Error('Unexpected script fallback'); });
  scene('lamp.toggle'); runtime.step(1, 1 / 60); runtime.step(2, 1);
  projectItemFields(source, runtimes, lane, 1);
  expect(lane.world.view(health.id).player['lit']).toBe(1); expect(lane.world.view(health.id).player['fuel']).toBe(runtime.remainingFuel); expect(runtime.remainingFuel).toBeLessThan(1);
  scene('lamp.refill'); runtime.step(3, 1 / 60); projectItemFields(source, runtimes, lane, 1);
  expect(lane.world.view(health.id).player['fuel']).toBe(1);
  expect(() => projectItemFields(source, runtimes, lane, 999)).toThrow('actor');
});
it('refuses dangling actions, duplicate field writers and incompatible projected state types', () => {
  const { source } = fixture();
  const first = source.targets.itemFields?.[0]; if (first === undefined) throw new Error('Missing binding');
  source.targets.itemFields?.push(first); expect(targetRules(source.targets, source, null)).toContain('declared item state projections');
  source.targets.itemFields = [{ ...first, fieldId: 202 }]; expect(targetRules(source.targets, source, null)).toContain('declared item state projections');
  source.targets.itemActions = [{ scene: 'missing', item: 'tool.template-lantern', action: 3 }]; expect(targetRules(source.targets, source, null)).toContain('declared item action scenes');
});
