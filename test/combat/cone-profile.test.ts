import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Actor, DamageRequest } from '../../src/engine/combat/pipeline';
import { ConeStrikes, coneStrikeSpec } from '../../src/shards/far-reach/runtime/weapons/coneStrikes';
import { FAN_PROFILE, FAN_STRIKES, SKY_ITEMS } from '../../src/shards/far-reach/data/items';

const row = SKY_ITEMS.rows[0];
const from = new Vector3(), dir = new Vector3(0, 0, -1);
function fixture() {
  const hits: DamageRequest[] = [], impulses: Vector3[] = [], order: string[] = [];
  const actor: Actor = { id: 'bird', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 },
    alive: true, applyDamage: () => false };
  const fan = new ConeStrikes(coneStrikeSpec(row, row.profile), {
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
    fan.startSwing(false); fan.startGust(); fan.tick(0.1);
    const saved = fan.snapshot();
    const profile = { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: 7, lift: 2, damage: 11, cooldown: 0.7 } };
    fan.configure({ ...row, light: { ...row.light, damage: 21, cooldown: 0.2 } }, profile);
    expect(fan.snapshot()).toEqual(saved);
    expect(fan.slash(from, dir, false)).toBe(1);
    expect(hits[0]?.amount).toBe(21);
    expect(fan.blow(from, dir)).toBe(1);
    expect(hits[1]?.amount).toBe(11);
    expect(impulses).toEqual([new Vector3(0, 2, -7)]);
    expect(order).toEqual(['hit', 'impulse', 'hit']);
    fan.tick(2); expect(fan.startSwing(false)).toBe(true); expect(fan.startGust()).toBe(true);
    expect(fan.snapshot()).toEqual({ cooldown: 0.2, gustCooldown: 0.7 });
  });
  it('refuses incompatible shapes, missing profiles and changed identity before mutating continuation', () => {
    const { fan } = fixture(); fan.startSwing(true); fan.startGust(); const saved = fan.snapshot();
    expect(() => fan.configure(row, undefined)).toThrow();
    expect(() => fan.configure({ ...row, id: 'weapon.other' }, FAN_PROFILE)).toThrow('identity');
    expect(() => fan.configure({ ...row, heavy: { ...row.heavy, width: 1 } }, FAN_PROFILE)).toThrow('shared contact shape');
    expect(() => fan.configure(row, { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: -1 } })).toThrow();
    expect(fan.snapshot()).toEqual(saved);
    const restored = fixture(); restored.fan.restore(saved); restored.fan.tick(0.1); fan.tick(0.1);
    expect(restored.fan.snapshot()).toEqual(fan.snapshot());
  });
});
