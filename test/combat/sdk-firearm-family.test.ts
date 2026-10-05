import { expect, it } from 'vitest';
import { Firearm as PlatformFirearm } from '@wildshard/engine/combat/Firearm';
import { Firearm as TrustedFirearm } from '@wildshard/sdk/runtime/weapons/Firearm';
import { Firearm as LegacyFirearm } from '../../src/kit/weapons/firearm/Firearm';
import { legacyActor } from '../fake/legacyActor';

it('uses the platform firearm constructor on the trusted SDK surface', () => {
  expect(TrustedFirearm).toBe(PlatformFirearm);
});

it('retains the original trigger dispatch and empty-action clock across all readiness states', () => {
  for (const reloading of [false, true]) for (const ready of [false, true])
    for (const ammo of [undefined, 0, 1, 7]) for (const reserve of [0, 21]) {
      const run = (prototype: PlatformFirearm | LegacyFirearm) => {
        const calls: string[] = [];
        const weapon = legacyActor(prototype, {
          state: { reloading, ammo, reserve }, sinceEmpty: 99,
          actionReady: () => ready,
          fire: () => { calls.push('fire'); }, onShot: () => { calls.push('shot'); },
          onDry: () => { calls.push('dry'); }, reload: () => { calls.push('reload'); },
          onTriggerWhileReloading: () => { calls.push('reload-trigger'); },
        });
        weapon.tryFire();
        const sinceEmpty: unknown = Reflect.get(weapon, 'sinceEmpty');
        if (typeof sinceEmpty !== 'number') throw new Error('Missing firearm action clock');
        return { calls, sinceEmpty, state: weapon.state };
      };
      expect(run(TrustedFirearm.prototype)).toEqual(run(LegacyFirearm.prototype));
    }
});
