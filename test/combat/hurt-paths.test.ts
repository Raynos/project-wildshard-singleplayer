import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { legacyHurtFixture } from '../fake/legacyHurt';

// Every §3.3 path is routed to the real closure it uses today, including the explicit later B3 exception.
const creaturePaths: readonly [string, number][] = [
  ['boar', 25], ['bear', 35], ['elk', 14], ['horse', 25], ['crab', 10], ['monkey', 6], ['sailor', 14], ['captain', 24],
  ['balbal', 30], ['wolf', 12], ['kurgan-balbal', 18], ['monkey-coconut', 8], ['ironhide', 30], ['blackpaw', 12],
  ['blackpaw-charge', 28], ['blackpaw-swipe', 22], ['imperial', 34], ['antler-king', 24], ['antler-stomp', 20],
  ['antler-charge', 32], ['thrall', 14], ['aqbars', 35], ['kokbori', 22], ['qyran', 30], ['qara-batyr', 38],
  ['argymaq', 25], ['golden-king', 22], ['sunburst', 25], ['sand', 4], ['beam', 15], ['ghost-rider', 10],
];

describe('today’s creature/world → player paths (09 §3.3)', () => {
  it.each(creaturePaths)('%s deals %s before the shard cap; uncapped on Pine/Nalati', (kind, damage) => {
    const f = legacyHurtFixture({ cap: Infinity });
    f.api.creature({ kind, label: kind, position: new THREE.Vector3(2, 0, 0) }, damage);
    expect(f.api.health).toBe(100 - damage); expect(f.api.killer).toEqual({ kind, label: kind });
    expect(f.api.lastHurt).toBe(1000); expect(f.audio.hurt).toHaveBeenCalledWith(damage / 20, 0.7);
    expect(f.music.combat).toHaveBeenCalledWith(0.9); expect(f.hud.damageFlash).toHaveBeenCalledOnce();
  });
  it.each([['ride', 10], ['lightning', 60], ['titan', 40], ['titan', 30], ['titan', 4], ['titan', 18], ['titan', 15], ['titan', 10]] as const)('%s damage %s bypasses creature cap/guard today', (path, damage) => {
      const f = legacyHurtFixture({ cap: 1, tusk: true, guarded: true });
      f.api[path](damage, 'WHY');
      expect(f.api.health).toBe(100 - damage); expect(f.audio.land).toHaveBeenCalledWith(true);
      expect(f.api.lastHurt).toBe(1000); expect(f.audio.hurt).not.toHaveBeenCalled();
      if (path === 'ride') expect(f.api.killer).toEqual({ cause: 'Thrown from the saddle' });
      else if (path === 'lightning') expect(f.api.killer).toEqual({ cause: 'Struck by lightning' });
      else expect(f.api.killer).toEqual({ kind: 'storm-titan', label: 'the Storm Titan' });
    });
  it('a soft landing has no damage; a hard landing deals 8 without resetting regeneration', () => {
    const f = legacyHurtFixture({ cap: 1, tusk: true, guarded: true });
    f.api.fall(false); expect(f.api.health).toBe(100);
    f.api.fall(true); expect(f.api.health).toBe(92); expect(f.api.lastHurt).toBe(0);
    expect(f.audio.land.mock.calls).toEqual([[false], [true]]);
  });
});
