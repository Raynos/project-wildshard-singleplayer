import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Spear } from '#shards/nalati-grasslands/weapons/Spear';
import { activePhysics, setActivePhysics } from '#engine/physics/active';
import { setAimTargets } from '#engine/player/AimTargets';
import { fakeWorld } from '../fake/world';

const previousPhysics = activePhysics();
beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); setAimTargets([]); setActivePhysics(null); });
afterEach(() => { setAimTargets([]); setActivePhysics(previousPhysics); Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });
function fixture() {
  const f = fakeWorld(), spear = new Spear({ game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest }, { raycast: () => null });
  const fires: number[] = [], braces: boolean[] = [];
  spear.onFire = () => { fires.push(f.game.clock.elapsedTime); }; spear.onBrace = (on) => { braces.push(on); };
  f.game.onFixed('step', (dt) => { spear.update(dt, f.game.clock.elapsedTime); }, 'spear clock', true);
  const advance = (n: number): void => { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('spear clock faulted'); };
  return { ...f, spear, fires, braces, advance };
}
describe('real spear input clocks', () => {
  it('thrust lasts .35s and queues only after its .12s windup', () => {
    const f = fixture(); f.spear.tryFire(); f.spear.tryFire(); f.advance(8); f.spear.tryFire(); f.spear.tryFire();
    f.advance(12); expect(f.fires).toHaveLength(1); expect(f.spear.thrusting).toBe(true);
    f.advance(2); expect(f.fires).toHaveLength(2); expect(f.fires[1]).toBeCloseTo(0.35);
    f.advance(22); expect(f.spear.thrusting).toBe(false); expect(f.fires).toHaveLength(2);
  });
  it('brace sets after .25s, locks walking, expires after4s and observes1s cooldown', () => {
    const f = fixture(); f.spear.altHeld = true; f.advance(14); expect(f.spear.bracing).toBe(false);
    f.advance(2); expect(f.spear.bracing).toBe(true); expect(f.player.moveScale).toBe(0); expect(f.braces).toEqual([true]);
    f.spear.tryFire(); expect(f.fires).toEqual([]);
    f.advance(239); expect(f.spear.bracing).toBe(true); f.advance(2); expect(f.spear.bracing).toBe(false); expect(f.braces).toEqual([true, false]);
    f.advance(58); expect(f.spear.bracing).toBe(false); f.advance(17); expect(f.spear.bracing).toBe(true);
  });
  it('stowing drops a running thrust and releases the movement lock', () => {
    const f = fixture(); f.spear.tryFire(); f.advance(3); f.spear.setActive(false); f.advance(1);
    expect(f.spear.thrusting).toBe(false); expect(f.player.moveScale).toBe(1); expect(f.player.swinging).toBe(false);
  });
});
