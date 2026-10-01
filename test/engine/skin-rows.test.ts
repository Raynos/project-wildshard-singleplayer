import { describe, expect, it } from 'vitest';
import { SkinLocker, type SkinDef } from '#engine/player/Skins';
import { saveFixture } from '../fake/saveFixture';

const rows: readonly SkinDef[] = [
  { id: 'test.ash', weapon: 'crossbow', name: 'Ash', blurb: 'Ash', mats: {} },
  { id: 'test.iron', weapon: 'rifle', name: 'Iron', blurb: 'Iron', mats: {} },
];

describe('cosmetic ownership is supplied by registered rows', () => {
  it('restores the saved row without retaining unknown or mismatched weapon ids', () => {
    saveFixture('test-skins', 'skins', { owned: ['test.ash', 'test.iron', 'missing'], worn: { crossbow: 'test.ash', rifle: 'test.ash' } });
    const locker = new SkinLocker('test-skins', rows);
    expect(locker.wearing('crossbow')).toEqual(rows[0]); expect(locker.wearing('rifle')).toBeNull();
    expect(locker.has('missing')).toBe(false);
    locker.wear('crossbow', 'test.iron'); expect(locker.wearing('crossbow')?.id).toBe('test.ash');
    locker.wear('rifle', 'test.iron');
    expect(new SkinLocker('test-skins', rows).wearing('rifle')?.id).toBe('test.iron');
    expect(new SkinLocker('another-shard', rows).has('test.ash')).toBe(false);
  });
  it('cannot grant a row that the shard never registered', () => {
    const locker = new SkinLocker('empty-shard');
    locker.own('test.ash'); locker.wear('crossbow', 'test.ash');
    expect(locker.has('test.ash')).toBe(false); expect(locker.wearing('crossbow')).toBeNull();
  });
});
