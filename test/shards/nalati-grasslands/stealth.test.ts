// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events, Scope } from '#engine';
import { Stealth } from '#shards/nalati-grasslands/stealth';
import { fakeWorld } from '../../fake/world';

const grass = vi.hoisted(() => ({ height: 1 }));
vi.mock('#kit/looks/grassField', () => ({ grassBaseHeightAt: () => grass.height }));
beforeEach(() => { document.body.innerHTML = '<div id="hud"></div>'; grass.height = 1; });
function setup() {
  const { player } = fakeWorld();
  player.keys = new Set(); player.touchMove = { x: 0, y: 0 }; player.touchJump = false;
  player.hover = false; player.swimming = false; player.inputService = null;
  let mounted = false, taming = false;
  const stealth = new Stealth({ player, wildlife: () => null, isMounted: () => mounted, crouchHere: () => taming });
  const events = new Events(), scope = new Scope('stealth-test');
  events.answer('player.crouch', (request) => stealth.answerCrouch(request), scope);
  const ask = (want: boolean, via: 'toggle' | 'hold' = 'toggle') => events.ask('player.crouch', { want, via });
  stealth.crouchStep(0.3);
  return { stealth, player, ask, scope, mount: () => { mounted = true; }, tame: () => { taming = true; } };
}
describe('Nalati crouch through the motor ask', () => {
  it('defaults to held crouch on other shards', () => {
    expect(new Events().ask('player.crouch', { want: true, via: 'toggle' })).toEqual({ allowed: true, latched: false });
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
    if (reason === 'sprint') { f.player.keys.add('ShiftLeft'); f.player.keys.add('KeyW'); }
    if (reason === 'jump') f.player.touchJump = true;
    if (reason === 'mounted') { f.mount(); f.stealth.crouchStep(0); }
    expect(f.ask(false).latched).toBe(false); f.scope.dispose();
  });
});
