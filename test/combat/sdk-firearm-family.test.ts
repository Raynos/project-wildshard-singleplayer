import { expect, it } from 'vitest';
import { Firearm as PlatformFirearm } from '@wildshard/engine/combat/Firearm';
import { Weapon as PlatformWeapon } from '@wildshard/engine/combat/Weapon';
import { Firearm as TrustedFirearm } from '@wildshard/sdk/runtime/weapons/Firearm';
import { Weapon as TrustedWeapon } from '@wildshard/sdk/runtime/weapons/Weapon';
import oracle from '../fixtures/firearm-trigger.json' with { type: 'json' };
import { legacyActor } from '../fake/legacyActor';

it('uses the single platform constructors on the trusted SDK surface', () => {
  expect(TrustedFirearm).toBe(PlatformFirearm);
  expect(TrustedWeapon).toBe(PlatformWeapon);
});

// Captured from the unchanged kit Firearm at a4b1ddad9 before removing it, for all 32 readiness states.
it('retains the captured legacy trigger dispatch and empty-action clock', () => {
  expect(oracle).toHaveLength(32);
  for (const row of oracle) {
    const calls: string[] = [];
    const weapon = legacyActor(TrustedFirearm.prototype, {
      state: { reloading: row.reloading, ammo: row.ammo ?? undefined, reserve: row.reserve }, sinceEmpty: 99,
      actionReady: () => row.ready,
      fire: () => { calls.push('fire'); }, onShot: () => { calls.push('shot'); },
      onDry: () => { calls.push('dry'); }, reload: () => { calls.push('reload'); },
      onTriggerWhileReloading: () => { calls.push('reload-trigger'); },
    });
    weapon.tryFire();
    const sinceEmpty: unknown = Reflect.get(weapon, 'sinceEmpty');
    if (typeof sinceEmpty !== 'number') throw new Error('Missing firearm action clock');
    expect({ calls, sinceEmpty }).toEqual({ calls: row.calls, sinceEmpty: row.sinceEmpty });
    expect(weapon.state).toEqual({ reloading: row.reloading, ammo: row.ammo ?? undefined, reserve: row.reserve });
  }
});
