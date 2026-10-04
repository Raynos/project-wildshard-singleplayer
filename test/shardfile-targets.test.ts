import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { syncTargetColliders } from '../src/game/shardfile/targets';

function source() {
  const shard = emptyShardfile({ slug: 'target-test', name: 'Door', author: 'Local', revision: 1, seed: 1 });
  const hash = 'a'.repeat(64), module = 'b'.repeat(64);
  shard.files.push({ hash, kind: 'glb', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }, { hash: module, kind: 'wasm', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  shard.library.push(hash); shard.critical.push(module); shard.sim.scripts.push(module); shard.sim.bindings.push({ module, entity: 1, actorId: 'actor.player', kind: 'server' });
  shard.state.shared.push({ id: 101, name: 'door.open', type: 'bool', privacy: 'public', default: false });
  shard.hooks.scenes.push({ id: 'door.toggle', type: 201, value: 1 });
  shard.props = { version: 1, family: 'toon', panels: [{ id: 'door', file: hash, visible: true }], models: [], tiles: [], far: null, textures: [], colliders: [{ id: 'door', panel: 'door', initialActive: true, shapes: [{ kind: 'box', x: 0, y: 1, z: 0, hx: 0.5, hy: 1, hz: 0.1 }] }] };
  shard.targets = { panels: [{ panel: 'door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['door'], activeWhenMatched: false }], interactions: [{ id: 'door.use', at: [0, 1, 0], radius: 2.5, label: 'DOOR', scene: 'door.toggle' }] };
  return parseShardfile(shard);
}
it('binds a door to stable public field101 and leaves activation with the authoritative host', () => {
  const shard = source(); let active = false, published = 0;
  const colliders = new Map([['door', { setActive: (value: boolean) => { active = value; } }]]);
  syncTargetColliders(shard.targets, colliders, () => published); expect(active).toBe(true);
  published = 1; syncTargetColliders(shard.targets, colliders, () => published); expect(active).toBe(false);
  published = 0; syncTargetColliders(shard.targets, colliders, () => published); expect(active).toBe(true);
});
it.each(['panel', 'collider', 'field', 'scene', 'duplicate'])('refuses a dangling or conflicting target: %s', (failure) => {
  const shard = source(), target = shard.targets.panels[0], interaction = shard.targets.interactions[0];
  if (target === undefined || interaction === undefined) throw new Error('Missing target fixture');
  if (failure === 'panel') target.panel = 'missing';
  if (failure === 'collider') target.colliders.push('missing');
  if (failure === 'field') target.fieldId = 102;
  if (failure === 'scene') interaction.scene = 'missing';
  if (failure === 'duplicate') shard.targets.panels.push(target);
  expect(() => parseShardfile(shard)).toThrow();
});
