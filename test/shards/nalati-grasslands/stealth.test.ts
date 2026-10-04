// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { Events } from '../../../src/engine/events/events';
import { InputService } from '../../../src/engine/input/InputService';
import { Stealth } from '../../../src/shards/nalati-grasslands/stealth';
import { fakeWorld } from '../../fake/world';

// the grass under the player, passed to Stealth (no module mock, E422)
const grass = { height: 1 };
beforeEach(() => { document.body.innerHTML = '<div id="hud"></div>'; grass.height = 1; });
function setup() {
  const { player } = fakeWorld();
  player.keys = new Set(); player.touchMove = { x: 0, y: 0 }; player.touchJump = false;
  player.hover = false; player.swimming = false; player.inputService = new InputService(() => 0);
  let mounted = false, taming = false;
  const stealth = new Stealth({ player, wildlife: () => null, isMounted: () => mounted, crouchHere: () => taming, grassAt: () => grass.height });
  const events = new Events(), scope = new Scope('stealth-test');
  events.answer('player.crouch', (request) => stealth.answerCrouch(request), scope);
  const ask = (want: boolean, via: 'toggle' | 'hold' = 'toggle') => events.ask('player.crouch', { want, via });
  stealth.crouchStep(0.3);
  return { stealth, player, ask, scope, mount: () => { mounted = true; }, tame: () => { taming = true; } };
}
describe('Nalati crouch through the motor ask', () => {
  it('keeps other shards standing without a crouch answer', () => {
    expect(new Events().ask('player.crouch', { want: true, via: 'toggle' })).toEqual({ allowed: false, latched: false });
  });
  it('latches C once per press and keeps Ctrl held', () => {
    const f = setup(); expect(f.ask(true)).toEqual({ allowed: false, latched: true });
    expect(f.ask(true).latched).toBe(true); f.ask(false); expect(f.ask(true).latched).toBe(false);
    f.ask(false); expect(f.ask(true, 'hold')).toEqual({ allowed: true, latched: false });
    expect(f.ask(false, 'hold').latched).toBe(false); f.scope.dispose();
  });
  it('rejects grassless toggles but permits the taming approach', () => {
    const f = setup(); grass.height = 0; f.stealth.crouchStep(1.1);
    expect(f.ask(true).latched).toBe(false); f.ask(false); f.tame(); f.stealth.crouchStep(0);
    expect(f.ask(true).latched).toBe(true); f.scope.dispose();
  });
  it.each(['grass', 'sprint', 'jump', 'mounted'] as const)('drops the latch for %s', (reason) => {
    const f = setup(); f.ask(true); f.ask(false);
    if (reason === 'grass') { grass.height = 0; f.stealth.crouchStep(1.1); }
    if (reason === 'sprint') { f.player.inputService?.setHeld('sprint', true); f.player.inputService?.setHeld('move.forward', true); }
    if (reason === 'jump') f.player.touchJump = true;
    if (reason === 'mounted') { f.mount(); f.stealth.crouchStep(0); }
    expect(f.ask(false).latched).toBe(false); f.scope.dispose();
  });
});
