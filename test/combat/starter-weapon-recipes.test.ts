import { describe, expect, it } from 'vitest';
import { fnv1a32 } from '../../src/engine/core/rng';
import * as legacyMoves from '../../src/kit/weapons/melee/moves';
import * as starterMoves from '../../src/sdk/runtime/weapons/starterMoves';
import { SWORD_WOOD as originalWood, SWORD_IRON as originalIron } from '../../src/kit/weapons/melee/profiles';
import { SWORD_WOOD, SWORD_IRON } from '../../src/sdk/runtime/weapons/starterMeleeProfile';
import { BOW as originalBow } from '../../src/kit/weapons/bow/profiles';
import { BOW } from '../../src/sdk/runtime/weapons/starterBowProfile';
import * as originalEquipment from '../../src/kit/weapons/equipment';
import * as equipment from '../../src/sdk/runtime/weapons/starterEquipment';
import { SWAP_GLYPHS as originalGlyphs } from '../../src/kit/weapons/ui';
import { SWAP_GLYPHS } from '../../src/sdk/runtime/weapons/starterGlyphs';
import { Sword as LegacySword, swordEvents as legacyEvents } from '../../src/kit/weapons/melee/SweptMelee';
import { Bow as LegacyBow } from '../../src/kit/weapons/bow/family';
import { Sword, swordEvents } from '../../src/sdk/runtime/weapons/Sword';
import { Sword as GameSword, swordEvents as gameEvents } from '../../src/game/weapons/Sword';
import { Bow } from '../../src/sdk/runtime/weapons/starterBow';
import { Bow as GameBow } from '../../src/game/weapons/Bow';
import { legacySource } from '../fake/legacySource';
import { weaponTraceJson } from '../fake/weaponTrace';

function recipes(moves: typeof legacyMoves, wood: typeof originalWood, iron: typeof originalIron,
  bow: typeof originalBow, rows: typeof originalEquipment, glyphs: typeof originalGlyphs): string {
  return JSON.stringify({ rows, glyphs, wood, iron, bow,
    moves: { REST: moves.REST, CHARGE: moves.CHARGE, SPRINT: moves.SPRINT, COMBO: moves.COMBO, HEAVY: moves.HEAVY } });
}
describe('trusted starter recipes leave the kit without a second content identity', () => {
  it('matches the pre-delegation recipe bytes including every move, profile, glyph and equipment field', () => {
    const original = recipes(legacyMoves, originalWood, originalIron, originalBow, originalEquipment, originalGlyphs);
    expect(recipes(starterMoves, SWORD_WOOD, SWORD_IRON, BOW, equipment, SWAP_GLYPHS)).toBe(original);
    // Captured while the kit still defined its independent recipes. Only snapshot encoding is quantized for cross-platform math.
    const originalValues: unknown = JSON.parse(original);
    expect(fnv1a32(weaponTraceJson(originalValues))).toMatchSnapshot();
    expect(BOW.wind).toBe(originalBow.wind);
  });
  it('exposes exactly one starter constructor and reaction registry through the trusted SDK', () => {
    expect(Sword).toBe(GameSword); expect(Bow).toBe(GameBow); expect(swordEvents).toBe(gameEvents);
    expect(LegacySword).toBe(Sword); expect(LegacyBow).toBe(Bow); expect(legacyEvents).toBe(swordEvents);
    expect(legacyMoves.COMBO).toBe(starterMoves.COMBO); expect(originalWood).toBe(SWORD_WOOD); expect(originalIron).toBe(SWORD_IRON);
    expect(SWORD_WOOD.moves?.combo).toBe(starterMoves.COMBO);
    expect(SWORD_WOOD.moves?.combo[0]).toBe(starterMoves.SLASH);
    expect(SWORD_IRON.moves).toBe(SWORD_WOOD.moves);
  });
  it('keeps all new defining recipe modules free of kit and runtime commons imports', () => {
    for (const name of ['starterGlyphs', 'starterEquipment', 'starterMoves', 'starterMeleeProfile', 'starterBowProfile', 'Sword', 'Bow']) {
      const text = legacySource(`src/game/weapons/${name}.ts`).text;
      expect(text).not.toContain('@wildshard/kit'); expect(text).not.toContain('@wildshard/commons');
    }
    for (const name of ['starterGlyphs', 'starterEquipment', 'starterMoves', 'starterMeleeProfile', 'starterBowProfile', 'Sword', 'starterBow']) {
      const text = legacySource(`src/sdk/runtime/weapons/${name}.ts`).text;
      expect(text).not.toContain('@wildshard/kit'); expect(text).not.toContain('@wildshard/commons');
    }
  });
});
