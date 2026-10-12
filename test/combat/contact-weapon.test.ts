import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ContactWeaponHost, HeldWeaponClock, weaponContactDistance, type WeaponContactMove } from '../../src/engine/combat/contactWeapon';
import type { Actor, DamageDealt, DamageRequest } from '../../src/engine/combat/pipeline';

const actor: Actor = { id: 'target', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 },
  alive: true, applyDamage: () => false };
const request: DamageRequest = { source: 'env', sourceTags: ['actor.player'], target: actor, amount: 16,
  point: new Vector3(0, 0, -2), dir: new Vector3(0, 0, -1), from: new Vector3(), weaponId: 'weapon.test', moveId: 'test.light', surface: 'flesh' };

const move: WeaponContactMove = { source: 'env', tags: ['actor.player'], damage: 16, weaponId: 'weapon.test', moveId: 'test.light',
  copyVectors: true, copyTags: true, reactions: [] };

describe('the shared contact host retains native ordering and clocks', () => {
  it('keeps independent clocks and invokes a held release before clearing charge', () => {
    const host = new ContactWeaponHost(() => null), hold = new HeldWeaponClock(), releases: number[] = [];
    expect(host.claim('primary', 0.45)).toBe(true); expect(host.claim('primary', 9)).toBe(false);
    expect(host.claim('secondary', 1.6)).toBe(true); host.countDown(0.1);
    expect([host.primary, host.secondary]).toEqual([0.35, 1.5]);
    const release = (): void => { releases.push(hold.elapsed); host.primary = 0; host.claim('primary', 0.85); };
    hold.step(0.3, true, true, release); hold.step(0.3, true, true, release); hold.step(0.1, true, false, release);
    expect(releases).toEqual([0.6]); expect(hold.elapsed).toBe(0); expect(host.primary).toBe(0.85);
    hold.step(0.2, true, true, release); hold.step(0.1, false, false, release); hold.step(0.1, true, false, release);
    expect(releases).toEqual([0.6]); expect(hold.held).toBe(false);
  });
  it('applies a gust before even a refused hit, but a yank/stagger only after an accepted surviving hit', () => {
    for (const outcome of ['refused', 'survived', 'killed'] as const) {
      const events: string[] = [];
      const host = new ContactWeaponHost((req): DamageDealt | null => {
        events.push('hit'); return outcome === 'refused' ? null : { req, dealt: 16, killed: outcome === 'killed' };
      });
      host.contact({ actor, impulse: () => { events.push('push'); }, stagger: () => { events.push('stagger'); } },
        { ...move, reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: 15, lift: 4 },
          { when: 'survived', kind: 'stagger', strength: 2 }] }, request.point, request.dir, request.from ?? new Vector3(),
        () => { events.push('accepted'); });
      expect(events).toEqual(outcome === 'refused' ? ['push', 'hit'] : outcome === 'killed' ? ['push', 'hit', 'accepted'] : ['push', 'hit', 'accepted', 'stagger']);
    }
  });
  it('samples positions after a pre-hit impulse and health predicates after the accepted callback', () => {
    const position = new Vector3(0, 0, -2), observed: number[] = [];
    const body: Actor = { ...actor, attributes: { health: 100, maxHealth: 100 } };
    const host = new ContactWeaponHost(req => { observed.push(req.point.y); return { req, dealt: 16, killed: false }; });
    host.contact({ actor: body, impulse: velocity => { position.y = velocity.y; }, stagger: () => { observed.push(body.attributes.maxHealth); } },
      { ...move, reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: 15, lift: 4 },
        { when: 'survived', kind: 'stagger', strength: 2, aboveHealth: 50 }] }, position, request.dir, new Vector3(),
      () => { body.attributes.maxHealth = 60; });
    expect(observed).toEqual([4, 60]);
  });
  it('uses the original cone and lane boundary arithmetic, including close origin and chest allowance', () => {
    const from = new Vector3(), dir = new Vector3(0, 0, -1);
    expect(weaponContactDistance(from, dir, new Vector3(0, 0, -4.4), 'cone', 4.4, 0.9)).toBe(4.4);
    expect(weaponContactDistance(from, dir, new Vector3(0, 0, 0.0001), 'cone', 4.4, 0.9)).toBe(0.0001);
    expect(weaponContactDistance(from, dir, new Vector3(0, 0, 4), 'cone', 4.4, 0.9)).toBeNull();
    const lane = { kind: 'lane', reach: 8, width: 0.2, height: 0.9, allowance: 0.7 } as const;
    expect(weaponContactDistance(new Vector3(0, 0.9, 0), dir, new Vector3(0.8, 0, -8.7), lane.kind, lane.reach, lane.width, lane.height, lane.allowance)).toBe(8.7);
    expect(weaponContactDistance(new Vector3(0, 0.9, 0), dir, new Vector3(0.91, 0, -8.7), lane.kind, lane.reach, lane.width, lane.height, lane.allowance)).toBeNull();
  });
});
