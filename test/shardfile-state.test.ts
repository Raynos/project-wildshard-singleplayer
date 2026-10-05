import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { assertStateCompatibility, parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import { contentHash, validateProject } from '@wildshard/sdk/project';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';

const empty = (): Shardfile => emptyShardfile({ slug: 'state-test', name: 'State test', author: 'Local', revision: 1, seed: 1 });
const source = (): Shardfile => {
  const shard = empty();
  shard.state.shared.push({ id: 9, name: 'door.open', type: 'bool', privacy: 'public', default: false });
  shard.state.player.push({ id: 2, name: 'quest.stage', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 4 });
  return parseShardfile(shard);
};
it('round trips explicit state ids and optional bounds without using array ordinals', () => {
  const shard = source();
  const wire = JSON.stringify(shard);
  expect(parseShardfile(JSON.parse(wire)).state).toEqual(shard.state);
});
it.each([0, -1, 0.5, 0x80000000])('refuses invalid stable state id %s', (id) => {
  const shard = source(), field = shard.state.shared[0];
  if (field === undefined) throw new Error('Missing fixture field');
  field.id = id;
  expect(() => parseShardfile(shard)).toThrow();
});
it('rejects ids reused across shared and player fields and numeric input overflow', () => {
  const duplicate = source(); duplicate.state.player.push({ id: 9, name: 'other', type: 'f64', privacy: 'host', default: 0 });
  expect(() => parseShardfile(duplicate)).toThrow();
  const overflow = empty();
  overflow.state.shared = Array.from({ length: 25 }, (_value, id) => ({ id: id + 1, name: `field${id}`, type: 'f64', privacy: 'host', default: 0 }));
  expect(() => parseShardfile(overflow)).toThrow();
});
it.each([{ min: -2147483649 }, { min: 0.5 }, { min: 1 }, { min: 2, max: 1 }, { max: 2147483648 }])('refuses invalid typed bounds %o', (bounds) => {
  const shard = source(), field = shard.state.player[0];
  if (field === undefined) throw new Error('Missing fixture field');
  Object.assign(field, bounds);
  expect(() => parseShardfile(shard)).toThrow();
});
it('allows reordered declarations and additional fields while preserving saved identities', () => {
  const previous = source(), next = source();
  next.state.shared.push({ id: 10, name: 'door.visits', type: 'i32', privacy: 'public', default: 0 });
  next.state.shared.reverse(); next.identity.revision++;
  expect(() => assertStateCompatibility(previous, parseShardfile(next))).not.toThrow();
});
it.each(['id', 'type', 'name', 'delete', 'scope'])('refuses an existing state identity change: %s', (change) => {
  const previous = source(), next = source(), field = next.state.shared[0];
  if (field === undefined) throw new Error('Missing fixture field');
  if (change === 'id') field.id = 11;
  if (change === 'type') { field.type = 'i32'; field.default = 0; }
  if (change === 'name') field.name = 'door.closed';
  if (change === 'delete') next.state.shared = [];
  if (change === 'scope') { next.state.shared = []; next.state.player.push(field); }
  expect(() => assertStateCompatibility(previous, parseShardfile(next))).toThrow();
});
it('requires the same shard identity and rejects numeric bounds on string fields', () => {
  const previous = source(), next = source(); next.identity.slug = 'other';
  expect(() => assertStateCompatibility(previous, next)).toThrow('same shard');
  next.state.player.push({ id: 5, name: 'label', type: 'string', privacy: 'owner', default: 'hello', min: 0 });
  expect(() => parseShardfile(next)).toThrow();
});
it('binds director and actor-bound server/entity scripts only to declared Wasm modules', () => {
  const shard = source(), hash = 'a'.repeat(64);
  shard.files.push({ hash, kind: 'wasm', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  shard.critical.push(hash); shard.sim.scripts.push(hash);
  shard.sim.bindings.push({ module: hash, entity: 1, actorId: null, kind: 'server' }, { module: hash, entity: 2, actorId: 'actor.one', kind: 'server' }, { module: hash, entity: 3, actorId: 'actor.two', kind: 'entity' });
  expect(parseShardfile(shard).sim.bindings).toHaveLength(3);
  const first = shard.sim.bindings[0]; if (first === undefined) throw new Error('Missing binding');
  shard.sim.bindings.push(first); expect(() => parseShardfile(shard)).toThrow(); shard.sim.bindings.pop();
  first.module = 'b'.repeat(64); expect(() => parseShardfile(shard)).toThrow(); first.module = hash;
  const file = shard.files[0]; if (file === undefined) throw new Error('Missing script file');
  file.kind = 'binary'; expect(() => parseShardfile(shard)).toThrow();
});
it('charges three growth-sized memory copies once per module, admits commons and bounds critical wire', async () => {
  const bytes = await compileScript(scriptSource()), hash = contentHash(bytes), module = `commons:${hash}`, shard = empty();
  shard.requires.commons.push(hash); shard.requires.commonsWire[hash] = bytes.length; shard.critical.push(module); shard.sim.scripts.push(module);
  shard.requires.commonsCosts[hash] = { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 };
  shard.sim.bindings.push({ module, entity: 1, actorId: 'one', kind: 'server' }, { module, entity: 2, actorId: 'two', kind: 'server' });
  shard.budgets.sim = { compressed: bytes.length, resident: bytes.length + 64 * 65536 * 3 };
  shard.serverBudget.memory = shard.budgets.sim.resident;
  const assets = new Map([[module, bytes]]);
  expect(validateProject(shard, assets).sim.bindings).toHaveLength(2);
  shard.budgets.sim.resident--; expect(() => validateProject(shard, assets)).toThrow('script memory budget'); shard.budgets.sim.resident++;
  shard.serverBudget.memory--; expect(() => validateProject(shard, assets)).toThrow('script memory budget'); shard.serverBudget.memory++;
  const padding = new Uint8Array(2_000_001), paddingHash = contentHash(padding);
  shard.requires.commons.push(paddingHash); shard.requires.commonsWire[paddingHash] = padding.length; shard.critical.push(`commons:${paddingHash}`); assets.set(`commons:${paddingHash}`, padding);
  shard.requires.commonsCosts[paddingHash] = { decoded: padding.length, gpu: 0, triangles: 0, draws: 0 };
  expect(() => validateProject(shard, assets)).toThrow('critical bundle cap');
}, 30_000);
