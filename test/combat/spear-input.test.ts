import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Spear } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { activePhysics, setActivePhysics } from '../../src/engine/physics/active';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { fakeWorld } from '../fake/world';

const previousPhysics = activePhysics();
beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); setAimTargets([]); setActivePhysics(null); });
afterEach(() => { setAimTargets([]); setActivePhysics(previousPhysics); Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });
function fixture() {
  const f = fakeWorld(), spear = new Spear({ game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest }, { raycast: () => null });
  const fires: number[] = [];
  spear.onFire = () => { fires.push(f.game.clock.elapsedTime); };
  f.game.onFixed('step', (dt) => { spear.update(dt, f.game.clock.elapsedTime); }, 'spear clock', true);
  const advance = (n: number): void => { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('spear clock faulted'); };
  return { ...f, spear, fires, advance };
}
describe('real spear input clocks', () => {
  it('thrust lasts .35s and queues only after its .12s windup', () => {
    const f = fixture(); f.spear.tryFire(); f.spear.tryFire(); f.advance(8); f.spear.tryFire(); f.spear.tryFire();
    f.advance(12); expect(f.fires).toHaveLength(1); expect(f.spear.thrusting).toBe(true);
    f.advance(2); expect(f.fires).toHaveLength(2); expect(f.fires[1]).toBeCloseTo(0.35);
    f.advance(22); expect(f.spear.thrusting).toBe(false); expect(f.fires).toHaveLength(2);
  });
  it('stowing drops a running thrust and releases the movement lock', () => {
    const f = fixture(); f.spear.tryFire(); f.advance(3); f.spear.setActive(false); f.advance(1);
    expect(f.spear.thrusting).toBe(false); expect(f.player.moveScale).toBe(1); expect(f.player.swinging).toBe(false);
  });
});

function installed() {
  const f = fixture(), scope = new Scope('J14-spear-input');
  for (const context of INPUT_CONTEXTS) app.input.register(context, scope);
  app.input.push('onFoot', scope); app.input.push('weapon.spear', scope);
  f.player.moveScale = 1;
  f.spear.install({ scope });
  const aimDown = (): void => { app.input.setHeld('aim', true); };
  const aimUp = (): void => { app.input.setHeld('aim', false); };
  return { ...f, scope, aimDown, aimUp };
}
it('RMB hold never plants the spear or stops walking; quick tap retains the javelin clock', () => {
  const f = installed();
  try {
    f.aimDown(); f.advance(90);
    expect(f.player.moveScale).toBe(1); expect(f.spear.state.ads).toBe(false);
    f.aimUp(); f.advance(60); expect(f.spear.javelins).toBe(3); expect(f.fires).toEqual([]);
    f.aimDown(); f.advance(1); f.aimUp();
    f.advance(27); expect(f.spear.javelins).toBe(3);
    f.advance(3); expect(f.spear.javelins).toBe(2); expect(f.fires).toHaveLength(1);
  } finally { f.scope.dispose(); app.input.clear(); }
});
