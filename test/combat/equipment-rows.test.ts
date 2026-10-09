import { describe, expect, it } from 'vitest';
import { SWAP_GLYPHS } from '../../src/game/weapons/starterGlyphs';
import { Weapon } from '../../src/engine/combat/Weapon';
import { WOODEN_SWORD, IRON_SWORD } from '../../src/game/weapons/starterEquipment';
import { JIAN_ROW as JIAN } from '../../src/shards/nine-dragon-stack/vm/jianRow';
import { SABRE, SPEAR, BOW, AR15 } from '../../src/shards/nalati-grasslands/weapons/equipment';
import { CROSSBOW, LONGBOW, LEVER } from '../../src/shards/pine-hollow/weapons/equipment';
import { Sword } from '../../src/game/weapons/Sword';
import { Bow } from '../../src/game/weapons/Bow';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';
import { Sabre } from '../../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { Spear } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';

const rows = [WOODEN_SWORD, IRON_SWORD, JIAN, SABRE, SPEAR, BOW, AR15, CROSSBOW, LONGBOW, LEVER];
describe('C2 concrete weapon and UI row contracts', () => {
  it('registered base rows have unique namespaced ids and complete gameplay UI declarations', () => {
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.id.startsWith('weapon.')).toBe(true); expect(row.ui.name).not.toBe('');
      expect(row.ui.icon).not.toBe(''); expect(row.ui.swapIcon).not.toBe('');
      for (const key of ['lockOn', 'melee', 'tracers'] as const) expect(row.ui[key]).toBeTypeOf('boolean');
      expect(['melee', 'throwing', 'bow', 'ranged']).toContain(row.ui.touch);
      expect(row.meta.category).toBe('weapon'); expect(row.meta.name).not.toBe('');
      if (row.ui.ammo !== undefined) { expect(row.ui.ammo.label).not.toBe(''); expect(row.ui.ammo.segments).toBeGreaterThan(0); }
    }
    expect(rows.map((row) => [row.id, row.ui.touch, row.ui.lockOn, row.ui.melee, row.ui.tracers, row.ui.ammo?.segments ?? 0])).toEqual([
      ['weapon.sword', 'melee', true, true, false, 0], ['weapon.sword-iron', 'melee', true, true, false, 0],
      ['weapon.jian', 'melee', true, true, false, 0], ['weapon.sabre', 'melee', true, true, false, 0],
      ['weapon.spear', 'throwing', true, true, false, 3], ['weapon.bow', 'bow', false, false, false, 4],
      ['weapon.rifle', 'ranged', false, false, true, 6], ['weapon.crossbow', 'ranged', false, false, true, 4],
      ['weapon.longbow', 'bow', false, false, false, 4], ['weapon.lever', 'ranged', false, false, true, 7],
    ]);
  });
  it('keeps exact existing Pine glyph markup as row data without a runtime kit dependency', () => {
    expect([CROSSBOW.ui.swapIcon, LONGBOW.ui.swapIcon, LEVER.ui.swapIcon]).toEqual([SWAP_GLYPHS.crossbow, SWAP_GLYPHS.bow, SWAP_GLYPHS.rifle]);
  });
  it.each([Sword, Bow, Crossbow, Rifle, Sabre, Spear, LeverRifle])('%s inherits the concrete Weapon class', (weapon) => {
    expect(Object.prototype.isPrototypeOf.call(Weapon.prototype, weapon.prototype)).toBe(true);
    for (const method of ['install', 'dispose', 'setActive', 'tryFire', 'update']) expect(Reflect.get(weapon.prototype, method)).toBeTypeOf('function');
  });
});
