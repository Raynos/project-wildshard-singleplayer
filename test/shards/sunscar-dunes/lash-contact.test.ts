// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real native host for the contact-capacity fixture.
import { readFileSync } from 'node:fs';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { createSimHost } from '../../../src/engine/sim';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { WHIP_ITEM, WHIP_PROFILE } from '../../../src/shards/sunscar-dunes/data/items';
import { nativeMeleeVolumeHit } from '../../../src/game/plugin/simulation';
import { weaponContactDistance } from '../../../src/engine/combat/contactWeapon';
import { lashLane as frozenLane } from '../../../src/game/systems/items/lash';
import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { lashRuntime, lashSpec } from '../../../src/shards/sunscar-dunes/runtime/items/lash';

/** The grounded Matriarch at 3.6x (bodyY 0.3, half-length 1.1, radius 0.8, head 0.4), facing +z (the player at the origin). */
function matriarch(at: Vector3) {
  const s = 3.6, cy = at.y + 0.3 * s;
  return { head: new Vector3(at.x, cy, at.z + 1.1 * s), headRadius: 0.4 * s, a: new Vector3(at.x, cy, at.z - 1.1 * s), b: new Vector3(at.x, cy, at.z + 1.1 * s), bodyRadius: 0.8 * s };
}
describe('the lash contact rule shared by the browser and headless whips', () => {
  const eye = new Vector3(0, 1.68, 0), feet = new Vector3(0, 0.2, -9);
  it('lands on her skin, not her centre: grounded 9 m off, the 7 m lash reaches her head ball', () => {
    const body = matriarch(feet), centre = new Vector3(0, feet.y + 1.08, -9), dir = centre.clone().sub(eye).normalize();
    // she faces the player: her head ball's near surface is 9 - 3.96 - 1.44 m along the ground
    const along = nativeMeleeVolumeHit(eye, dir, 7, body);
    expect(along).not.toBeNull(); expect(along ?? Infinity).toBeLessThan(4.5);
    expect(centre.distanceTo(eye)).toBeGreaterThan(7); // the old centre test refused this crack
  });
  it('misses a body wholly past the reach, and answers 0 from inside a volume', () => {
    const far = matriarch(new Vector3(0, 0.2, -30)), dir = new Vector3(0, 0, -1);
    expect(nativeMeleeVolumeHit(eye, dir, 7, far)).toBeNull();
    const over = matriarch(new Vector3(0, 0, 0));
    expect(nativeMeleeVolumeHit(new Vector3(0, 1.08, 0), dir, 7, over)).toBe(0);
  });
  it('keeps the browser lane exactly: chest over the feet, reach and width widened by the body allowance', () => {
    const dir = new Vector3(0, 0, -1);
    const inLane = (target: Vector3): number | null => weaponContactDistance(eye, dir, target, 'lane', 7, 0.9, WHIP_PROFILE.contact.chestHeight, WHIP_PROFILE.contact.bodyAllowance);
    expect(WHIP_PROFILE.contact).toEqual({ chestHeight: 0.9, bodyAllowance: 0.7 });
    expect(inLane(new Vector3(0, 0.78, -7.6))).toBeCloseTo(7.6);
    expect(inLane(new Vector3(0, 0.78, -7.8))).toBeNull();
    expect(inLane(new Vector3(1.55, 0.78, -3))).toBeCloseTo(3);
    expect(inLane(new Vector3(1.65, 0.78, -3))).toBeNull();
    expect(inLane(new Vector3(0, 0.78, 1))).toBeNull();

  });
});

it('matches the retained native lane on 10000 deterministic contacts and consumes authored contact changes', () => {
  const from = new Vector3(), dir = new Vector3(), feet = new Vector3();
  for (let i = 0; i < 10000; i++) {
    from.set(Math.sin(i * 1.31) * 4, Math.cos(i * 0.57) * 2, Math.sin(i * 0.93) * 4);
    dir.set(Math.cos(i * 0.47), Math.sin(i * 0.61), Math.cos(i * 0.79)).normalize();
    feet.set(Math.sin(i * 0.37) * 10, Math.cos(i * 0.23), Math.sin(i * 0.17) * 10);
    const reach = 1 + i % 11, width = 0.1 + (i % 9) * 0.2;
    expect(weaponContactDistance(from, dir, feet, 'lane', reach, width, WHIP_PROFILE.contact.chestHeight, WHIP_PROFILE.contact.bodyAllowance)).toBe(frozenLane(from, dir, reach, width, feet));
  }
  const eye = new Vector3(0, 1.68, 0), ray = new Vector3(0, 0, -1), target = new Vector3(0, 0.78, -7.6);
  expect(weaponContactDistance(eye, ray, target, 'lane', 7, 0.9, WHIP_PROFILE.contact.chestHeight, WHIP_PROFILE.contact.bodyAllowance)).toBe(7.6);
  expect(weaponContactDistance(eye, ray, target, 'lane', 7, 0.9, 0.9, 0.2)).toBeNull();
});

it('accepts the bounded native roster and refuses an excessive contact scan before damage', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const actor = host.entities.values().next().value;
    if (actor === undefined) throw new Error('Missing real native contact actor');
    const port = host.combat.targetPort(actor.combatActor(), actor);
    for (const count of [1024, 1025]) {
      const lash = lashRuntime(lashSpec(WHIP_ITEM, WHIP_PROFILE), {
        source: host.player.health, hit: request => host.combat.hit(request), body: () => null, world: () => [],
        targets: () => Array.from({ length: count }, () => port),
        aim: (from, dir) => { from.set(100, 100, 100); dir.set(0, 0, -1); return true; },
      });
      expect(lash.swing(0)).toBe(true);
      if (count === 1024) expect(() => lash.advance(WHIP_PROFILE.timing.unroll)).not.toThrow();
      else expect(() => lash.advance(WHIP_PROFILE.timing.unroll)).toThrow('admitted contact scan');
    }
    // A missed posed-volume query uses the actual controller's chest lane and
    // clamps its real damage point to the declared reach, not an unused helper.
    const eye = new Vector3(0, 1.68, 0), direction = new Vector3(0, 0, -1);
    const tiny = { head: new Vector3(0, 99, 0), headRadius: .01, a: new Vector3(0, 99, 0), b: new Vector3(0, 99, .1), bodyRadius: .01 };
    actor.position.set(0, .78, -7.6);
    const hit = vi.spyOn(host.combat, 'hit');
    try {
      const lash = lashRuntime(lashSpec(WHIP_ITEM, WHIP_PROFILE), {
        source: host.player.health, hit: request => host.combat.hit(request), targets: () => [port], world: () => [],
        aim: (from, dir) => { from.copy(eye); dir.copy(direction); return true; },
        body: (from, dir, reach) => {
          const distance = nativeMeleeVolumeHit(from, dir, reach, tiny);
          return distance === null ? null : { port, point: from.clone().addScaledVector(dir, distance) };
        },
      });
      expect(lash.swing(0)).toBe(true); lash.advance(WHIP_PROFILE.timing.unroll);
      expect(hit).toHaveBeenCalledTimes(1);
      expect(hit.mock.calls[0]?.[0].point.toArray()).toEqual([0, 1.68, -7]);
    } finally { hit.mockRestore(); }
  } finally { host.dispose(); }
});
