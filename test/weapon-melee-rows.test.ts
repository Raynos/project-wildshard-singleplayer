import { expect, it } from 'vitest';
import { parseWeaponProfile } from '../src/format/weaponProfiles';
import { applyMeleeCombatProfile, type MeleeProfile } from '../src/engine/combat/meleeProfile';
import { SweptMeleeCore, sweptMoveDamage, sweptLunge } from '../src/engine/combat/sweptMeleeCore';
import type { Move } from '../src/engine/combat/view/melee';
import { STARTER_MELEE_PROFILE, IRON_MELEE_PROFILE } from '../src/game/weapons/starterCombat';
import { SWORD_WOOD, SWORD_IRON } from '../src/game/weapons/starterMeleeProfile';
import { COMBO, HEAVY } from '../src/game/weapons/starterMoves';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../src/shards/driftwood-isle/data/meleeProfile';
import { JIAN_MELEE_PROFILE } from '../src/shards/nine-dragon-stack/data/meleeProfile';
import { JIAN_ROW } from '../src/shards/nine-dragon-stack/vm/jianRow';

function clock(profile: MeleeProfile) {
  const moves = profile.moves; if (moves === undefined) throw new Error('Missing native recipe');
  let queued = false;
  const starts: [string, number, boolean][] = [];
  const core = new SweptMeleeCore<Move>(moves, profile, { queue: () => { queued = true; }, consume: () => { const was = queued; queued = false; return was; } },
    { start: (move, lunge) => { starts.push([move.name, sweptMoveDamage(profile.damage, move, move === moves.heavy, 1.3), lunge]); }, charge: () => undefined });
  return { core, starts };
}
it('preserves every native starter/Jian field, pose reference, cue and shared move identity', () => {
  expect(parseWeaponProfile(STARTER_MELEE_PROFILE)).toEqual(DRIFTWOOD_MELEE_PROFILE);
  expect(parseWeaponProfile(IRON_MELEE_PROFILE)).toEqual(DRIFTWOOD_IRON_PROFILE);
  expect(parseWeaponProfile(JIAN_MELEE_PROFILE)).toEqual(STARTER_MELEE_PROFILE);
  expect(applyMeleeCombatProfile(SWORD_WOOD, DRIFTWOOD_MELEE_PROFILE)).toEqual(SWORD_WOOD);
  expect(applyMeleeCombatProfile(SWORD_IRON, DRIFTWOOD_IRON_PROFILE)).toEqual(SWORD_IRON);
  expect(applyMeleeCombatProfile(JIAN_ROW, JIAN_MELEE_PROFILE)).toEqual(JIAN_ROW);
  expect(SWORD_WOOD.moves?.combo).toBe(COMBO); expect(SWORD_WOOD.moves?.heavy).toBe(HEAVY);
  const composed = applyMeleeCombatProfile(JIAN_ROW, JIAN_MELEE_PROFILE);
  expect(composed.moves?.combo[0]?.keys).toBe(COMBO[0]?.keys);
  expect(composed.moves?.heavy.trail).toBe(HEAVY.trail); expect(composed.viewmodel).toBe(JIAN_ROW.viewmodel);
});
it('retains native combo/held-heavy clocks, damage, lunge and mid-swing restore over 10k mixed steps', () => {
  for (const [native, data] of [[SWORD_WOOD, DRIFTWOOD_MELEE_PROFILE], [SWORD_IRON, DRIFTWOOD_IRON_PROFILE], [JIAN_ROW, JIAN_MELEE_PROFILE]] as const) {
    const composed = applyMeleeCombatProfile(native, data), a = clock(native), b = clock(composed);
    for (let tick = 1; tick <= 10000; tick++) {
      if (tick % 17 === 0) { a.core.tryFire(); b.core.tryFire(); }
      const held = tick % 233 < 42;
      const left = a.core.step(1 / 60, tick / 60, native.swingScale, held), right = b.core.step(1 / 60, tick / 60, composed.swingScale, held);
      expect([right.active, right.move?.name]).toEqual([left.active, left.move?.name]);
      expect(b.core.snapshot()).toEqual(a.core.snapshot());
      if (tick === 5021) { const c = clock(composed); c.core.restore(b.core.snapshot()); b.core.restore(c.core.snapshot()); }
    }
    expect(b.starts).toEqual(a.starts);
    expect(sweptLunge(composed.lunge, true, 3, 2, 0.5)).toEqual(sweptLunge(native.lunge, true, 3, 2, 0.5));
  }
});
it('admitted changed numbers drive the actual clock, contact and lunge without changing poses', () => {
  const authored = structuredClone(JIAN_MELEE_PROFILE); authored.damage = 33; authored.heavyCharge = 0.2;
  authored.moves.combo[0].windup = 0.2; authored.lunge.range = 1; authored.moves.heavy.damage = 3;
  const parsed = parseWeaponProfile(authored); if (parsed.family !== 'melee') throw new Error('Melee row required');
  const profile = applyMeleeCombatProfile(JIAN_ROW, parsed), native = clock(JIAN_ROW), changed = clock(profile);
  native.core.tryFire(); changed.core.tryFire();
  expect(native.core.step(0.1, 0.1, 1, false).active).toBe(true);
  expect(changed.core.step(0.1, 0.1, 1, false).active).toBe(false);
  expect(changed.starts[0]?.[1]).toBe(33);
  expect(sweptLunge(profile.lunge, false, 3, 0, 0.5)).toBeNull();
  expect(sweptLunge(JIAN_ROW.lunge, false, 3, 0, 0.5)).not.toBeNull();
  expect(profile.moves?.combo[0]?.keys).toBe(JIAN_ROW.moves?.combo[0]?.keys);
  expect(sweptMoveDamage(profile.damage, profile.moves?.heavy ?? HEAVY, true, 1)).toBe(99);
});
it('refuses missing/mismatched recipes and invalid contact phases before any native owner is allocated', () => {
  expect(() => applyMeleeCombatProfile(SWORD_WOOD, { ...STARTER_MELEE_PROFILE, moves: { ...STARTER_MELEE_PROFILE.moves, combo: [] } })).toThrow('recipe must match');
  const { moves: _moves, ...without } = SWORD_WOOD;
  expect(() => applyMeleeCombatProfile(without, STARTER_MELEE_PROFILE)).toThrow('recipe must match');
  const invalid = structuredClone(STARTER_MELEE_PROFILE); invalid.moves.combo[0].stagger = -1;
  expect(() => parseWeaponProfile(invalid)).toThrow(); invalid.moves.combo[0].stagger = 0;
  invalid.moves.combo[0].windup = 0.3; expect(() => parseWeaponProfile(invalid)).toThrow();
});
