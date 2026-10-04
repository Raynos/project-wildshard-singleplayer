import { describe, expect, it } from 'vitest';
import { CosmeticsLocker, SkinLocker } from '../src/game/cosmetics/locker';
import { NALATI_SKINS, NalatiSkinLocker } from '../src/shards/nalati-grasslands/weapons/nalatiSkins';
import { saveFixture } from './fake/saveFixture';

describe('cosmetic profiles share ownership and wear storage', () => {
  it('keeps the weapon profile manual and the Nalati profile auto-wearing only bare slots', () => {
    const weapon = new SkinLocker('profile-test', [{ id: 'ash', weapon: 'crossbow', name: 'Ash', blurb: '', mats: {} }]);
    weapon.own('ash');
    expect(weapon.wearing('crossbow')).toBeNull();
    const nalati = new NalatiSkinLocker();
    expect(nalati).toBeInstanceOf(CosmeticsLocker);
    nalati.own('night-rider-mount');
    nalati.own('sky-marked-saddle');
    expect(nalati.wearing('mount')?.id).toBe('night-rider-mount');
    expect(nalati.effects.has(nalati.effectTarget, 'cosmetic.skin.night-rider-mount')).toBe(true);
    let observed = false;
    nalati.onChange = () => { observed = nalati.effects.has(nalati.effectTarget, 'cosmetic.skin.sky-marked-saddle'); };
    nalati.toggle('sky-marked-saddle');
    expect(observed).toBe(true);
    expect(nalati.effects.has(nalati.effectTarget, 'cosmetic.skin.night-rider-mount')).toBe(false);
    expect(new NalatiSkinLocker().wearing('mount')?.id).toBe('sky-marked-saddle');
    nalati.toggle('sky-marked-saddle');
    expect(nalati.wearing('mount')).toBeNull();
  });
  it('filters stale saved rows, rejects a wrong slot and keeps idempotent grants silent', () => {
    saveFixture('nalati-grasslands', 'nalati.skins', { owned: ['irbis-sabre', 'sky-wolf-bow', 'stale'], worn: { bow: 'irbis-sabre', sabre: 'irbis-sabre' } });
    const locker = new NalatiSkinLocker();
    expect(locker.wearing('sabre')).toBe(NALATI_SKINS[0]);
    expect(locker.wearing('bow')).toBeNull();
    locker.wear('bow', 'irbis-sabre');
    locker.own('irbis-sabre');
    locker.own('stale');
    expect(locker.version).toBe(0);
    expect(locker.has('stale')).toBe(false);
    expect(locker.entries().map((row) => row.id)).toEqual(['irbis-sabre', 'sky-wolf-bow']);
  });
});
