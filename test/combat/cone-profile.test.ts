import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Actor, DamageRequest } from '../../src/engine/combat/pipeline';
import { configureCone, coneRestore, coneSnapshot, coneStrikes, coneStrikeSpec } from '../../src/shards/far-reach/runtime/weapons/coneStrikes';
import { FAN_PROFILE, FAN_STRIKES, SKY_ITEMS } from '../../src/shards/far-reach/data/items';

const row = SKY_ITEMS.rows[0];
const from = new Vector3(), dir = new Vector3(0, 0, -1);
function fixture() {
  const hits: DamageRequest[] = [], impulses: Vector3[] = [], order: string[] = [];
  const actor: Actor = { id: 'bird', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 },
    alive: true, applyDamage: () => false };
  const fan = coneStrikes(coneStrikeSpec(row, row.profile), {
    targets: () => [{ actor, position: new Vector3(0, 0, -3), impulse: velocity => { order.push('impulse'); impulses.push(velocity.clone()); } }],
    hit: req => { order.push('hit'); hits.push(req); return { req, dealt: req.amount, killed: false }; },
  });
  return { fan, hits, impulses, order };
}

describe('admitted fan profile reaches the actual native owner', () => {
  it('reconstructs every shipping contact number exactly from the item', () => {
    expect(coneStrikeSpec(row, row.profile)).toEqual(FAN_STRIKES);
  });
  it('consumes changed damage, clocks and impulses without restarting retained clocks', () => {
    const { fan, hits, impulses, order } = fixture();
    fan.claim(0); fan.claim(2); fan.cool(0.1);
    const saved = coneSnapshot(fan);
    const profile = { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: 7, lift: 2, damage: 11, cooldown: 0.7 } };
    configureCone(fan, { ...row, light: { ...row.light, damage: 21, cooldown: 0.2 } }, profile);
    expect(coneSnapshot(fan)).toEqual(saved);
    expect(fan.land(0, 0, from, dir)).toBe(1);
    expect(hits[0]?.amount).toBe(21);
    fan.land(2, 0, from, dir); expect(fan.touched).toBe(1);
    expect(hits[1]?.amount).toBe(11);
    expect(impulses).toEqual([new Vector3(0, 2, -7)]);
    expect(order).toEqual(['hit', 'impulse', 'hit']);
    fan.cool(2); expect(fan.claim(0)).toBe(true); expect(fan.claim(2)).toBe(true);
    expect(coneSnapshot(fan)).toEqual({ cooldown: 0.2, gustCooldown: 0.7 });
  });
  it('refuses incompatible shapes, missing profiles and changed identity before mutating continuation', () => {
    const { fan } = fixture(); fan.claim(1); fan.claim(2); const saved = coneSnapshot(fan);
    expect(() => configureCone(fan, row, undefined)).toThrow();
    expect(() => configureCone(fan, { ...row, id: 'weapon.other' }, FAN_PROFILE)).toThrow('identity');
    expect(() => configureCone(fan, { ...row, heavy: { ...row.heavy, width: 1 } }, FAN_PROFILE)).toThrow('shared contact shape');
    expect(() => configureCone(fan, row, { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: -1 } })).toThrow();
    expect(coneSnapshot(fan)).toEqual(saved);
    const restored = fixture(); coneRestore(restored.fan, saved); restored.fan.cool(0.1); fan.cool(0.1);
    expect(coneSnapshot(restored.fan)).toEqual(coneSnapshot(fan));
  });
});
