import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWORD } from '../../src/game/weapons/starterEquipment';
import { Sword } from '../../src/game/weapons/Sword';
import { swordRig } from '../../src/shards/driftwood-isle/weapons/swordView';
import type { SwordArms } from '../../src/engine/combat/view/melee';
import { SABRE_MOVES, PASS_LEFT, PASS_RIGHT } from '../../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { activePhysics, setActivePhysics } from '../../src/engine/physics/active';
import { fakeWorld } from '../fake/world';

const previousPhysics = activePhysics();
beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); setAimTargets([]); setActivePhysics(null); });
afterEach(() => { setAimTargets([]); setActivePhysics(previousPhysics); Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });
function melee(sabre = false) {
  const f = fakeWorld(), starts: { name: string | null; t: number }[] = [];
  const arms: SwordArms = { root: new THREE.Group(), engineTrail: false, play: () => undefined, update: () => undefined,
    blade: (base, tip) => { base.set(0, 0, -0.5); tip.set(0, 0.5, -1); } };
  const sword = new Sword({ game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest }, { raycast: () => null },
    { row: SWORD, arms, rig: swordRig(f.sky, 'wood'), ...(sabre ? { damage: 24, moves: SABRE_MOVES } : {}) });
  sword.swingScale = sabre ? 0.9 : 1;
  sword.onFire = () => { starts.push({ name: sword.swingName, t: f.game.clock.elapsedTime }); };
  f.game.onFixed('step', (dt) => { sword.update(dt, f.game.clock.elapsedTime); }, 'melee input', true);
  const advance = (n: number): void => { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('melee input fixture faulted'); };
  return { ...f, sword, starts, advance };
}
describe('real melee input scheduling baseline', () => {
  it('queues only one light strike and chains .02s after each active window', () => {
    const f = melee(); f.sword.tryFire(); f.sword.tryFire(); f.sword.tryFire();
    f.advance(15); expect(f.starts.map((s) => s.name)).toEqual(['slash']);
    f.advance(1); expect(f.starts.map((s) => s.name)).toEqual(['slash', 'backhand']);
    expect(f.starts[1]?.t).toBeCloseTo(16 / 60);
    f.sword.tryFire(); f.sword.tryFire(); f.advance(15);
    expect(f.starts.map((s) => s.name)).toEqual(['slash', 'backhand', 'finisher']); expect(f.starts[2]?.t).toBeCloseTo(31 / 60);
    f.sword.tryFire(); f.advance(28); expect(f.starts).toHaveLength(3); // finisher cannot queue a fourth
    f.sword.tryFire(); expect(f.starts).toHaveLength(3); // .08s recovery
    f.advance(5); f.sword.tryFire(); expect(f.starts.at(-1)?.name).toBe('slash');
  });
  it.each([0.1, 0.61])('a fresh tap%s after the previous end preserves or resets the .6s combo gap', (gap) => {
    const f = melee(); f.sword.tryFire(); f.advance(22 + Math.ceil(gap * 60)); f.sword.tryFire();
    expect(f.starts.at(-1)?.name).toBe(gap <= 0.6 ? 'backhand' : 'slash');
  });
  it('releasing heavy early waits until .45s and light taps cannot interrupt it', () => {
    const f = melee(); f.sword.adsHeld = true; f.advance(6); expect(f.sword.chargingHeavy).toBe(true);
    f.sword.adsHeld = false; f.sword.tryFire(); f.advance(20); expect(f.starts).toEqual([]);
    f.advance(2); expect(f.starts.map((s) => s.name)).toEqual(['heavy']);
    expect(f.starts[0]?.t).toBeGreaterThanOrEqual(0.45); expect(f.starts[0]?.t).toBeLessThanOrEqual(0.45 + 1 / 60);
  });
  it('a full heavy stays charged while held and releases on the input edge', () => {
    const f = melee(); f.sword.adsHeld = true; f.advance(40); expect(f.starts).toEqual([]); expect(f.sword.charge).toBe(1);
    f.sword.adsHeld = false; f.advance(1); expect(f.starts.map((s) => s.name)).toEqual(['heavy']);
  });
  it.each([PASS_LEFT, PASS_RIGHT])('mounted %s runs at the sabre .9 timing and cannot overlap a move', (pass) => {
    const f = melee(true); expect(f.sword.strikeMove(pass, false)).toBe(true); expect(f.sword.strikeMove(pass, false)).toBe(false);
    f.advance(26); expect(f.sword.swinging).toBe(true); f.advance(2); expect(f.sword.swinging).toBe(false);
    expect(f.starts).toHaveLength(1); expect(f.starts[0]?.name).toBe(pass.name);
  });
});
