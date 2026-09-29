// E297 (DRIFTWOOD-TOP10 row 1): one set of fight rules for every enemy on Driftwood — at most 2 attack at once (attack
// tokens), engaged boars circle back and charge again instead of fleeing (reengage), and only Driftwood has the rules.
import { describe, expect, it } from 'vitest';
import { AttackTokens, reengage, backoffPoint, aroundPoint, BREAK_OFF_HP, RING, BACKOFF_PAST, type ReengageIn } from '../src/entities/fightRules';
import { CHUNKS } from '../src/chunks/registry';
import { DRIFTWOOD_ISLE } from '../src/chunks/driftwood-isle';

describe('AttackTokens (E297: at most 2 attackers)', () => {
  it('hands out at most `max` tokens; a third attacker waits', () => {
    const t = new AttackTokens<string>(2);
    expect(t.take('boar')).toBe(true);
    expect(t.take('crab')).toBe(true);
    expect(t.count).toBe(2);
    expect(t.free('monkey')).toBe(false);
    expect(t.take('monkey')).toBe(false);
    expect(t.count).toBe(2);
    // a holder asking again keeps its own token and takes no second one
    expect(t.take('boar')).toBe(true);
    expect(t.free('boar')).toBe(true);
    expect(t.count).toBe(2);
  });

  it('a released token goes to the next attacker', () => {
    const t = new AttackTokens<string>(2);
    t.take('a'); t.take('b');
    t.release('a');
    expect(t.holds('a')).toBe(false);
    expect(t.free('c')).toBe(true);
    expect(t.take('c')).toBe(true);
    expect(t.take('a')).toBe(false);
    t.release('nobody'); // a no-op
    expect(t.count).toBe(2);
  });

  it('sweep takes back the tokens of attacks that are over', () => {
    const t = new AttackTokens<string>(2);
    t.take('a'); t.take('b');
    const attacking = new Set(['b']);
    t.sweep((who) => attacking.has(who));
    expect(t.count).toBe(1);
    expect(t.holds('a')).toBe(false);
    expect(t.holds('b')).toBe(true);
  });

  it('five enemies trading attacks never have more than 2 going at once', () => {
    const t = new AttackTokens<number>(2);
    const left = [0, 0, 0, 0, 0]; // s of attack left per enemy (0 = not attacking)
    const cd = [0, 0.3, 0.6, 0.9, 1.2];
    let most = 0, attacks = 0;
    for (let tick = 0; tick < 300; tick++) { // 30 s at the manager's 10 Hz
      t.sweep((i) => (left[i] ?? 0) > 0);
      for (let i = 0; i < 5; i++) {
        cd[i] = Math.max(0, (cd[i] ?? 0) - 0.1);
        if ((left[i] ?? 0) > 0) { left[i] = Math.max(0, (left[i] ?? 0) - 0.1); continue; }
        if ((cd[i] ?? 0) <= 0 && t.take(i)) { left[i] = 0.8; cd[i] = 1.4; attacks++; }
      }
      let now = 0;
      for (const l of left) if (l > 0) now++;
      most = Math.max(most, now);
      expect(t.count).toBeLessThanOrEqual(2);
    }
    expect(most).toBe(2);
    expect(attacks).toBeGreaterThan(40); // every one of them still gets its turns
  });

  it('a zero-token pool (no rules) never grants — the manager does not ask it then', () => {
    const t = new AttackTokens<string>(0);
    expect(t.take('a')).toBe(false);
  });
});

const base: ReengageIn = { hpFrac: 1, relentless: false, roll: 0.9, ready: true, token: true, dist: 6, chargeDist: 10, hit: false };

describe('reengage (E297: boars circle back instead of fleeing)', () => {
  it('a healthy boar never breaks off — not on a hit, not on any roll', () => {
    for (const roll of [0, 0.1, 0.5, 0.99]) {
      expect(reengage({ ...base, hit: true, roll })).not.toBe('flee');
      expect(reengage({ ...base, hit: true, roll, hpFrac: 0.4 })).not.toBe('flee');
    }
  });

  it('charges again when its cooldown is over, a token is free and you are in range', () => {
    expect(reengage(base)).toBe('charge');
  });

  it('circles on the ring while it waits: cooldown, no token, or out of range', () => {
    expect(reengage({ ...base, ready: false })).toBe('circle');
    expect(reengage({ ...base, token: false })).toBe('circle');
    expect(reengage({ ...base, dist: 12 })).toBe('circle');
  });

  it('only a nearly dead one may break off, only on a hit, and only on the roll', () => {
    const low = { ...base, hpFrac: BREAK_OFF_HP - 0.05, hit: true };
    expect(reengage({ ...low, roll: 0.2 })).toBe('flee');
    expect(reengage({ ...low, roll: 0.8 })).toBe('charge');
    expect(reengage({ ...low, hit: false, roll: 0.2 })).toBe('charge');  // circling, not hit: it keeps fighting
    expect(reengage({ ...low, relentless: true, roll: 0 })).toBe('charge'); // Old Ironhide never runs
  });
});

describe('the back-off and the ring (E297)', () => {
  it('backs off to just past the ring, arcing to one side, and the other side next time', () => {
    const o = { x: 0, z: 0 };
    const ring = RING['boar'] ?? 6.5;
    backoffPoint(0, 0, 0, 1.2, ring, 1, o);   // a boar 1.2 m north of you after the charge
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(ring + BACKOFF_PAST, 5);
    expect(o.z).toBeGreaterThan(0);          // away from you, on its own side
    const left = o.x;
    backoffPoint(0, 0, 0, 1.2, ring, -1, o);
    expect(Math.sign(o.x)).toBe(-Math.sign(left)); // the other way round
  });

  it('the ring sits inside the charge distance (a boar on it can charge from there)', () => {
    expect(RING['boar']).toBeLessThan(10); // BOAR_TUNING.panicDist
    expect(RING['bear']).toBeLessThan(14); // BEAR_TUNING.panicDist
  });

  it('aroundPoint on top of the player picks a direction instead of NaN', () => {
    const o = aroundPoint(3, 4, 3, 4, 5, 0.4, { x: 0, z: 0 });
    expect(Number.isFinite(o.x) && Number.isFinite(o.z)).toBe(true);
    expect(Math.hypot(o.x - 3, o.z - 4)).toBeCloseTo(5, 5);
  });
});

describe('ChunkDef.fightRules (E297: Driftwood only)', () => {
  it('Driftwood lets 2 attack at once; no other shard has the rules', () => {
    expect(DRIFTWOOD_ISLE.fightRules?.maxAttackers).toBe(2);
    for (const c of CHUNKS) if (c.slug !== DRIFTWOOD_ISLE.slug) expect(c.fightRules, c.slug).toBeUndefined();
  });
});
