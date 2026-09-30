// E314 stage 3 (src/game/loot/perks.ts): what the charms and trophies do, and the chime's count.
import { describe, expect, it } from 'vitest';
import { CHARM_DODGE, CLAW_HEAVY, charmsFor, chimeCount, dodgeCooldownScale, dodgeGuard, heavyMult, nightGlow } from '../src/game/loot/perks';
import type { OwnedId } from '../src/game/loot/Owned';

const owns = (...ids: OwnedId[]): { has: (id: OwnedId) => boolean } => ({ has: (id) => ids.includes(id) });

describe('keepsake perks', () => {
  it('are off with nothing owned', () => {
    const none = owns();
    expect(dodgeCooldownScale(none)).toBe(1);
    expect(heavyMult(none)).toBe(1);
    expect(dodgeGuard(none)).toBe(false);
    expect(nightGlow(none, 1)).toBe(0);
  });

  it('charm II speeds the dodge, the claw the heavy, the tusk guards the dodge', () => {
    expect(dodgeCooldownScale(owns('charm-2'))).toBe(CHARM_DODGE);
    expect(0.8 * CHARM_DODGE).toBeCloseTo(0.56);
    expect(heavyMult(owns('bear-claw'))).toBe(CLAW_HEAVY);
    expect(dodgeGuard(owns('boar-tusk'))).toBe(true);
  });

  it('charm III glows only at night', () => {
    const c = owns('charm-3');
    expect(nightGlow(c, 0)).toBe(0);
    expect(nightGlow(c, 0.3)).toBe(0);
    expect(nightGlow(c, 0.5)).toBeGreaterThan(0);
    expect(nightGlow(c, 1)).toBe(1);
  });

  it('the chime shows whole charms and the charms follow the count', () => {
    expect([0, 4, 5, 9, 10, 14, 15].map((n) => chimeCount(n))).toEqual([0, 0, 5, 5, 10, 10, 15]);
    expect(charmsFor(4)).toEqual([]);
    expect(charmsFor(5)).toEqual(['charm-1']);
    expect(charmsFor(12)).toEqual(['charm-1', 'charm-2']);
    expect(charmsFor(15)).toEqual(['charm-1', 'charm-2', 'charm-3']);
  });
});
