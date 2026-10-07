import { Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { Melee, meleeActor } from '../../src/engine/combat/Melee';
import { isMeleeProfile } from '../../src/engine/combat/meleeProfile';
import { CombatPipeline, type Actor, type DamageRequest } from '../../src/engine/combat/pipeline';
import { Thrown } from '../../src/engine/combat/Thrown';
import type { ThrownProfile } from '../../src/engine/combat/thrownProfile';
import type { TargetAnimal } from '../../src/engine/combat/types';
import { Events } from '../../src/engine/events/events';
import { Melee as LegacyMelee, meleeActor as legacyMeleeActor, isMeleeProfile as legacyIsMeleeProfile } from '../../src/kit/weapons/melee/Melee';
import { SWORD_WOOD } from '../../src/kit/weapons/melee/profiles';
import { Thrown as LegacyThrown } from '../../src/kit/weapons/thrown/Thrown';
import { Melee as TrustedMelee, meleeActor as trustedMeleeActor } from '../../src/sdk/runtime/weapons/Melee';
import { Thrown as TrustedThrown } from '../../src/sdk/runtime/weapons/Thrown';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';

afterEach(() => { vi.restoreAllMocks(); });

const profile: ThrownProfile = {
  id: 'weapon.fixture', speed: 18, gravity: 9.8, damage: 12, headMultiplier: 2,
  radius: 0.1, headOffset: 0.2, windup: 0.1, release: 0.2, recovery: 0.3,
  carried: 3, pool: 4, pickupRadius: 2, pickupHeight: 1, survive: 3,
  arcPoints: 12, arcAfter: 0.1, stagger: 0.4,
};
class PlatformRecorder extends Thrown {
  readonly hooks: { power: number; remaining: number }[] = [];
  protected override onRelease(power: number): void { this.hooks.push({ power, remaining: this.ammo }); }
}
function thrownTrace(helper: Pick<PlatformRecorder, 'ammo' | 'flightStep' | 'release' | 'hooks'>) {
  const position = new Vector3(1, 2, 3), velocity = new Vector3(4, 5, -6);
  const flight = [0, 1 / 60, 0.25, 0.5].map((dt) => {
    helper.flightStep(position, velocity, dt);
    return { position: position.toArray(), velocity: velocity.toArray() };
  });
  const release = Array.from({ length: 5 }, () => ({ result: helper.release(), remaining: helper.ammo }));
  return { flight, release, hooks: helper.hooks };
}
function target(): TargetAnimal {
  return { kind: 'fixture', position: new Vector3(), alive: true, damageFor: () => 12, applyDamage: () => true };
}
class ContactFixture extends Melee {
  readonly model = { visible: true, parent: null, removeFromParent: (): void => undefined };
  readonly state = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; adsHeld = false; aimInfo = null;
  tryFire(): void { /* Fixture selects explicit contact below. */ }
  update(): void { /* No presentation work. */ }
  hit(practice: TargetAnimal): unknown { return this.contact(practice, 12, new Vector3(), new Vector3(0, 0, -1), new Vector3(), 'slash'); }
}
function contactTrace(prototype: object, adapter: typeof meleeActor) {
  const practice = target(), actor = adapter(practice), requests: unknown[] = [];
  vi.spyOn(app.combat, 'hit').mockImplementation((req) => {
    requests.push({ source: req.source, tags: req.sourceTags, target: req.target.id, amount: req.amount,
      point: req.point.toArray(), dir: req.dir.toArray(), from: req.from?.toArray(), weapon: req.weaponId, move: req.moveId });
    return { req, dealt: req.amount, killed: false };
  });
  const weapon = legacyActor(prototype, { row: SWORD_WOOD, profile: SWORD_WOOD, combat: app.combat, attributes: { damage: 23 } });
  for (const checked of [false, true]) {
    invokeLegacy(weapon, 'contact', practice, 46, new Vector3(1, 2, 3), new Vector3(0, 0, -1), new Vector3(4, 5, 6), 'heavy', checked);
  }
  const damage = invokeLegacy(weapon, 'moveDamage', { damage: 2 });
  vi.restoreAllMocks();
  expect(actor).toBe(adapter(practice));
  return { requests, damage };
}

describe('trusted SDK contact families graduate without a second implementation', () => {
  it('publishes the exact platform constructors and target adapter', () => {
    expect(TrustedMelee).toBe(Melee); expect(TrustedThrown).toBe(Thrown); expect(trustedMeleeActor).toBe(meleeActor);
    expect(LegacyThrown).toBe(Thrown); expect(legacyMeleeActor).toBe(meleeActor); expect(legacyIsMeleeProfile).toBe(isMeleeProfile);
    expect(LegacyMelee.prototype).toBeInstanceOf(Melee);
  });
  it('constructs without global combat and sends contact through the injected pipeline', () => {
    const scope = new Scope('contact-fixture'), combat = new CombatPipeline(new Events(), scope), localHit = vi.spyOn(combat, 'hit').mockReturnValue(null);
    const globalHit = vi.spyOn(app.combat, 'hit'), weapon = new ContactFixture(SWORD_WOOD, combat);
    expect(weapon.attributes['damage']).toBe(SWORD_WOOD.damage); expect(weapon.attributes['heavyDamageMul']).toBe(1);
    expect(weapon.hit(target())).toBeNull(); expect(localHit).toHaveBeenCalledOnce(); expect(globalHit).not.toHaveBeenCalled();
    scope.dispose();
  });
  it('matches legacy gravity integration, decrement-before-hook ordering and exhausted releases', () => {
    // Captured from the independent pre-delegation kit implementation in 423512790, never regenerated after delegation.
    expect(thrownTrace(new PlatformRecorder(profile))).toMatchSnapshot();
  });
  it('matches practice-target damage forwarding and cover admission tags', () => {
    expect(contactTrace(Melee.prototype, meleeActor)).toMatchSnapshot();
    expect(isMeleeProfile(SWORD_WOOD)).toBe(true);
  });
  it('uses native actors directly and preserves live practice liveness and reaction arguments', () => {
    const practice = target(), reaction = vi.fn(() => true); practice.applyDamage = reaction;
    const actor = meleeActor(practice), native: TargetAnimal & { combatActor: () => Actor } = { ...target(), combatActor: () => actor };
    expect(meleeActor(native)).toBe(actor);
    practice.alive = false; expect(actor.alive).toBe(false);
    const req: DamageRequest = { source: 'env', sourceTags: ['dmg.melee'], target: actor, amount: 7, point: new Vector3(1, 2, 3), dir: new Vector3(0, 0, -1) };
    expect(actor.applyDamage(req)).toBe(true); expect(reaction).toHaveBeenCalledExactlyOnceWith(7, req.point, req.dir);
  });
});
