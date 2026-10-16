import { expect, test } from 'vitest';
import { CosmeticsLocker, SkinLocker, type CosmeticState } from '../src/game/cosmetics/locker';
import { loadPineFinishes, pineSkinRows, pineSkins } from '../src/shards/pine-hollow/runtime/loadout/skins';
import { output } from '../src/shards/pine-hollow/generators/output';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { FINISH_CARDS } from '../src/shards/pine-hollow/runtime/const';

test('Pine finish cards retain authored order, ownership and slot-exclusive wear choices', async () => {
  const file = output.namedFiles.find(row => row.name === 'loadout/finishes.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined) throw new Error('Missing named finish JSON');
  const shardfile = emptyShardfile({ slug: 'pine-hollow', name: 'Pine', author: 'Wildshard', revision: 1, seed: 1 });
  await loadPineFinishes(createShardProduct({ slug: 'pine-hollow', revision: 1, shardfile, sections: new Map(),
    files: new Map([['loadout/finishes.json', { hash: file.hash, url: file.path }]]), read: () => Promise.resolve(bytes) }));
  const PINE_FINISHES = pineSkinRows(), SKINS = pineSkins();
  const locker = new SkinLocker('pine-hollow', PINE_FINISHES);
  const ids = ['hollow-ash', 'ghost-stag', 'blackpaw', 'imperial', 'warden', 'ironhide', 'scarback-furnace'];
  expect(locker.cardRows(FINISH_CARDS).map(card => card.id)).toEqual(ids);
  expect(locker.cardRows(FINISH_CARDS).every(card => card.locked && !card.worn)).toBe(true);
  expect(locker.pick('ghost-stag')).toBeNull();
  expect(locker.pick('not-a-finish')).toBeNull();
  for (const skin of PINE_FINISHES) locker.own(skin.id);
  for (const skin of PINE_FINISHES) {
    expect(locker.pick(skin.id)).toEqual({ skin, act: 'wear' });
    locker.wear(skin.weapon, skin.id);
    expect(locker.pick(skin.id)).toEqual({ skin, act: 'off' });
    const card = locker.cardRows(FINISH_CARDS).find(row => row.id === skin.id);
    expect(card).toMatchObject({ name: skin.name, worn: true, locked: false,
      blurb: skin.weapon === 'rifle' ? 'Lever-action' : 'Crossbow' });
    locker.wear(skin.weapon, null);
  }
  locker.wear('crossbow', 'ghost-stag');
  locker.wear('rifle', 'ironhide');
  expect(locker.cardRows(FINISH_CARDS).filter(card => card.worn).map(card => card.id)).toEqual(['ghost-stag', 'ironhide']);
  expect(locker.pick('ghost-stag')?.skin).toBe(SKINS['ghost-stag']);
});

test('cosmetic card reads are silent and toggles retain auto-wear and save behavior', () => {
  const rows = [{ id: 'mount-a', slot: 'mount' }, { id: 'mount-b', slot: 'mount' }];
  let saved: CosmeticState = { owned: [], worn: {} }, writes = 0;
  const locker = new CosmeticsLocker('test', rows, { slot: row => row.slot, autoWear: true,
    save: { read: () => saved, write: state => { saved = state; writes++; return true; } } });
  const cards = rows.map(row => ({ id: row.id, name: row.id, icon: 'horse' as const, blurb: 'Owned', lockedBlurb: 'Find it' }));
  expect(locker.cardRows(cards)[0]).toMatchObject({ blurb: 'Find it', locked: true });
  locker.own('mount-a'); locker.own('mount-b');
  const version = locker.version;
  expect(locker.pick('mount-a')?.act).toBe('off');
  expect(locker.cardRows(cards)[0]).toMatchObject({ blurb: 'Owned', locked: false, worn: true });
  expect(locker.version).toBe(version); expect(writes).toBe(2);
  locker.toggle('mount-b'); expect(saved.worn).toEqual({ mount: 'mount-b' });
  locker.toggle('mount-b'); expect(saved.worn).toEqual({});
  locker.toggle('missing'); expect(writes).toBe(4);
  expect(() => locker.cardRows([{ ...cards[0], id: 'missing', name: 'Missing', icon: 'horse', blurb: '', lockedBlurb: '' }])).toThrow('Unregistered cosmetic card');
});
