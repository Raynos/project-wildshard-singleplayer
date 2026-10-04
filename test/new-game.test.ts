import { expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../src/engine/saves/store';
import { instanceSave } from '../src/game/instanceSaves';
import { firstPartyInstance, templateInstance } from '../src/game/grid/instances';
import { previewNewGame, resetNewGame } from '../src/game/newGame';
import { MemoryStorage } from './setup';
import saved from './fixtures/saves/v2-driftwood-isle.json';

const prefix = 'wildshard.save.v2.';
function fixture() { const local = new MemoryStorage(); return { local, store: new SaveStore({ local, session: null }) }; }
it('resets the real Driftwood save and its quests/flags/continuations while keeping feats, profile and another shard byte-for-byte', () => {
  const { local, store } = fixture(), identity = { id: firstPartyInstance('driftwood-isle'), shard: 'driftwood-isle' };
  local.setItem(`${prefix}${identity.id}`, JSON.stringify({ keys: { ...saved.keys, flags: { v: 1, data: ['quest.done'] },
    inventory: { v: 1, data: { counts: { rope: 4 }, order: ['rope'] } }, 'platform.region': { v: 1, data: { revision: 1, snapshot: '{"snapshot":{"flags":["quest.done"]}}' } },
    'platform.continuation': { v: 1, data: { flags: ['quest.done'], quests: [{ id: 'intro', started: true, currentId: null }] } } } }));
  for (const name of ['global', 'profile', 'pine-hollow']) local.setItem(`${prefix}${name}`, '{"keys":{"opaque":{"v":99,"data":"keep"}}}');
  const kept = ['global', 'profile', 'pine-hollow'].map((id) => local.getItem(`${prefix}${id}`));
  const before = local.getItem(`${prefix}${identity.id}`), preview = previewNewGame(store, identity, [{ id: 'intro', completeFlag: 'quest.done' }]);
  expect(local.getItem(`${prefix}${identity.id}`)).toBe(before);
  expect(preview.before).toMatchObject({ quests: { started: 1, completed: 1 }, inventory: { quantity: 5, coins: 37 }, flags: ['quest.done'] });
  const result = resetNewGame(store, identity); expect(result.applied).toBe(true);
  expect(result.summary.after).toMatchObject({ quests: { saved: false, completed: 0 }, inventory: { items: [], coins: 0 }, flags: [] });
  expect(store.inspectShard(identity)).toEqual({ progress: saved.keys.progress });
  expect(['global', 'profile', 'pine-hollow'].map((id) => local.getItem(`${prefix}${id}`))).toEqual(kept);
});
it('resets each template copy separately and the canonical standalone template stays separate', () => {
  const { local, store } = fixture();
  for (const id of ['template-solo', templateInstance(1), templateInstance(2)]) local.setItem(`${prefix}${id}`, '{"keys":{"flags":{"v":1,"data":["boss.dead"]}}}');
  expect(resetNewGame(store, { id: templateInstance(1), shard: '_template' }).applied).toBe(true);
  expect(previewNewGame(store, { id: templateInstance(1), shard: '_template' }).before.flags).toEqual([]);
  for (const id of ['template-solo', templateInstance(2)]) expect(previewNewGame(store, { id, shard: '_template' }).before.flags).toEqual(['boss.dead']);
});
it('Select a shard and the grid observe the same reset and old region disposal cannot resurrect it', () => {
  const { store } = fixture(), identity = { id: firstPartyInstance('driftwood-isle'), shard: 'driftwood-isle' };
  const key = { key: 'platform.region', scope: 'shard' as const, version: 1, schema: v.nullable(v.string()), initial: () => null };
  const old = instanceSave(store, key, identity); old.write('old checkpoint');
  // Use the flags/inventory namespace shared by both entry modes; the opaque region is reset even when not previewable.
  const flags = { key: 'flags', scope: 'shard' as const, version: 1, schema: v.array(v.string()), initial: (): string[] => [] };
  const standalone = instanceSave(store, flags, identity); standalone.write(['quest.done']);
  expect(resetNewGame(store, identity).applied).toBe(true); expect(old.write('old checkpoint')).toBe(false);
  const grid = instanceSave(store, flags, { id: identity.id, shard: identity.shard }); expect(grid.read()).toEqual([]);
});
it('refused storage leaves before and after equal and permits normal old save writes', () => {
  const { local, store } = fixture(), identity = { id: 'pine-hollow', shard: 'pine-hollow' };
  local.setItem(`${prefix}pine-hollow`, '{"keys":{"flags":{"v":1,"data":["quest"]}}}');
  const setter = vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  const result = resetNewGame(store, identity); expect(result.applied).toBe(false); expect(result.summary.after).toEqual(result.summary.before);
  setter.mockRestore(); expect(resetNewGame(store, identity).applied).toBe(true);
});
