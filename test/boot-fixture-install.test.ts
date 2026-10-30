import {expect,test} from 'vitest';
import {installCatalogueFixture} from './fixtures/bootSetup';
import {installShards,shards,legacyContentIdentity} from '../src/game/shard/list';
import {selectedLevel} from '../src/engine/level/selection';

test('a cached catalogue module restores its real rows without selecting a world',async()=>{
  const level=selectedLevel();
  await installCatalogueFixture();
  const before=shards(),identities=before.map(row=>[row.slug,legacyContentIdentity(row.slug)]);
  expect(before.length).toBeGreaterThan(0);expect(selectedLevel()).toBe(level);
  try{
    installShards([]);expect(shards()).toHaveLength(0);
    await installCatalogueFixture();
    expect(shards().map(row=>row.slug)).toEqual(before.map(row=>row.slug));
    expect(shards().map(row=>[row.slug,legacyContentIdentity(row.slug)])).toEqual(identities);
    expect(selectedLevel()).toBe(level);
  }finally{await installCatalogueFixture();}
});
