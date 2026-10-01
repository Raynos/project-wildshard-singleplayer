import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { legacyHurtFixture } from '../fake/legacyHurt';

// Every §3.3 path exercises the production pipeline, including the S3.4 Titan guard/cap fix.
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
  it.each([['ride', 10], ['lightning', 60]] as const)('%s damage %s bypasses creature cap/guard today', (path, damage) => {
      const f = legacyHurtFixture({ cap: 1, tusk: true, guarded: true });
      f.api[path](damage, 'WHY');
      expect(f.api.health).toBe(100 - damage); expect(f.audio.land).toHaveBeenCalledWith(true);
      expect(f.api.lastHurt).toBe(1000); expect(f.audio.hurt).not.toHaveBeenCalled();
      if (path === 'ride') expect(f.api.killer).toEqual({ kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' });
      else expect(f.api.killer).toEqual({ kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' });
    });
  it.each([40, 30, 4, 18, 15, 10])('Titan damage %s preserves its amount and obeys dodge guard and cap (B3)', (damage) => {
    const open = legacyHurtFixture({ cap: Infinity });
    open.api.titan(damage, 'WHY');
    expect(open.api.health).toBe(100 - damage); expect(open.api.lastHurt).toBe(1000);
    expect(open.api.killer).toEqual({ kind: 'storm-titan', label: 'the Storm Titan' });
    expect(open.audio.land).toHaveBeenCalledWith(true); expect(open.audio.hurt).not.toHaveBeenCalled();
    const guarded = legacyHurtFixture({ cap: 1, tusk: true, guarded: true });
    guarded.api.titan(damage, 'WHY');
    expect(guarded.api.health).toBe(100); expect(guarded.api.lastHurt).toBe(0); expect(guarded.api.killer).toBeNull();
    expect(guarded.audio.land).not.toHaveBeenCalled(); expect(guarded.hud.damageFlash).not.toHaveBeenCalled();
    guarded.player.dodging = false; guarded.api.titan(damage, 'WHY');
    expect(guarded.api.health).toBe(99); expect(guarded.api.lastHurt).toBe(1000);
    expect(guarded.api.killer).toEqual({ kind: 'storm-titan', label: 'the Storm Titan' });
    expect(guarded.audio.land).toHaveBeenCalledWith(true);
  });
  it('a soft landing has no damage; a hard landing deals 8 without resetting regeneration', () => {
    const f = legacyHurtFixture({ cap: 1, tusk: true, guarded: true });
    f.api.fall(false); expect(f.api.health).toBe(100);
    f.api.fall(true); expect(f.api.health).toBe(92); expect(f.api.lastHurt).toBe(0);
    expect(f.audio.land.mock.calls).toEqual([[false], [true]]);
  });
});
