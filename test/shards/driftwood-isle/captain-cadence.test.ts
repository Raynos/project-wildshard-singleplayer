import { describe, expect, it } from 'vitest';
import { creature } from '../../fake/creature';

describe('Captain authored strike window', () => {
  it('keeps the phase III dodge window until the next decision, then contacts once on the body step', () => {
    const f = creature('captain', 'captain');
    f.advance(7);
    f.animal.hp = f.animal.maxHp * 0.2;
    Object.assign(f.animal.mem, { st: 3, hit: 0, combo: 0, rise: 1, cd: 0 });
    f.animal.startAttack(0.85);
    // The cut threshold crosses between decision steps. Hitting immediately here used to bypass the dodge window.
    f.advance(35);
    expect(f.hits).toEqual([]);
    f.advance(1);
    expect(f.hits).toEqual([{ frame: 43, damage: 24 }]);
    f.advance(10);
    expect(f.hits).toHaveLength(1);
  });
});
