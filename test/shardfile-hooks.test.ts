import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, type Shardfile } from '@wildshard/game/shardfile/schema';

function source(): Shardfile {
  const shard = emptyShardfile({ slug: 'hook-test', name: 'Hook test', author: 'Local', revision: 1, seed: 1 });
  const module = 'a'.repeat(64);
  shard.files.push({ hash: module, kind: 'wasm', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  shard.critical.push(module); shard.sim.scripts.push(module);
  shard.sim.bindings.push({ module, entity: 1, actorId: 'actor.player', kind: 'server' });
  shard.state.shared.push({ id: 101, name: 'template.door.open', type: 'bool', privacy: 'public', default: false });
  shard.hooks.conditions.push({ id: 'template.door.isOpen', scope: 'shared', fieldId: 101, equals: 1 });
  shard.hooks.scenes.push({ id: 'template.door.toggle', type: 201, value: 1 });
  return parseShardfile(shard);
}
it('round trips a bounded player spawn and named field/event hooks', () => {
  const shard = source(); shard.spawn = { x: -250, y: 250, z: 250, yaw: 1.25 };
  const wire = JSON.stringify(shard);
  expect(parseShardfile(JSON.parse(wire)).spawn).toEqual(shard.spawn);
});
it.each(['missing', 'private', 'type', 'value', 'duplicate', 'unbound'])('refuses an invalid hook: %s', (failure) => {
  const shard = source(), condition = shard.hooks.conditions[0], field = shard.state.shared[0];
  if (condition === undefined || field === undefined) throw new Error('Missing hook fixture');
  if (failure === 'missing') condition.fieldId = 102;
  if (failure === 'private') field.privacy = 'host';
  if (failure === 'type') { field.type = 'string'; field.default = 'closed'; }
  if (failure === 'value') condition.equals = 0.5;
  if (failure === 'duplicate') shard.hooks.conditions.push(condition);
  if (failure === 'unbound') shard.sim.bindings = [];
  expect(() => parseShardfile(shard)).toThrow();
});
it.each(['x', 'y', 'z'] as const)('refuses a spawn outside the cell along %s', (axis) => {
  const shard = source(); shard.spawn[axis] = 250.01;
  expect(() => parseShardfile(shard)).toThrow();
});
it('refuses an input scene without a declared hook and keeps old empty sources compatible', () => {
  const shard = source();
  shard.plumbing = { namespace: 'template', input: [{ id: 'template.controls', priority: 1, actions: [{ id: 'template.toggle', keys: ['KeyE'], scene: 'template.missing' }] }], knobs: [], debug: [] };
  expect(() => parseShardfile(shard)).toThrow();
  const wire: Partial<Shardfile> = structuredClone(emptyShardfile({ slug: 'empty', name: 'Empty', author: 'Local', revision: 1, seed: 1 }));
  delete wire.spawn; delete wire.hooks; delete wire.plumbing;
  expect(parseShardfile(wire).spawn).toEqual({ x: 0, y: 2, z: 0, yaw: 0 });
});
