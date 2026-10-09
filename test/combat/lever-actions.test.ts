import { describe, expect, it, vi } from 'vitest';
import { LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { LeverAction } from '../../src/shards/pine-hollow/weapons/leverAction';
import { legacyActor, invokeLegacy } from '../fake/legacyActor';
import { FakeGame } from '../fake/FakeGame';

function fixture(tube = 0, chambered = false, reserve = 21) {
  const game = new FakeGame(), fired = vi.fn(), rounds = vi.fn(), ended = vi.fn(), cycles = vi.fn();
  const state = { reserve, ammo: tube + (chambered ? 1 : 0), reloadProgress: 0, loaded: chambered, reloading: false };
  const act = new LeverAction(state); act.tube = tube; act.chambered = chambered; act.hammerCocked = false;
  const lever = legacyActor(LeverRifle.prototype, { equipEvents: undefined, state, act, freezeCycle: null,
    sinceEmpty: 99, active: true, enabled: true,
    onDry: undefined, onReloadStart: undefined, onReloadEnd: ended, onRoundIn: rounds, onCycle: cycles,
    fire: fired, ejectCase: () => undefined,
  });
  // the action's hooks are the rifle's own (a field initializer the legacy actor skips)
  Reflect.set(lever, 'hooks', { cycle: () => { cycles(); }, eject: () => undefined, chambered: () => { invokeLegacy(lever, 'syncState'); },
    reloadStart: () => { state.reloadProgress = 0; invokeLegacy(lever, 'syncState'); }, round: () => { rounds(); },
    reloadEnd: () => { state.reloadProgress = 0; invokeLegacy(lever, 'syncState'); ended(); } });
  game.onUpdate((dt) => { invokeLegacy(lever, 'stepAction', dt); });
  const advance = (seconds: number): void => { for (let n = 0; n < Math.round(seconds * 60); n++) game.advance(1 / 60); };
  return { lever, game, fired, rounds, ended, cycles, advance };
}

/** the rifle's action (weapons/leverAction.ts), read through the legacy double */
const actOf = (lever: LeverRifle): LeverAction => { const act: unknown = Reflect.get(lever, 'act'); if (!(act instanceof LeverAction)) throw new Error('no action'); return act; };

describe('lever action traces (09 W13)', () => {
  it.each([[0, false, 21, 6, 15], [3, true, 21, 3, 18], [0, false, 2, 2, 0]] as const)('reload tube=%s chamber=%s reserve=%s feeds %s rounds', (tube, chambered, reserve, fed, left) => {
      const f = fixture(tube, chambered, reserve); f.lever.reload(); f.advance(0.61); expect(f.rounds).not.toHaveBeenCalled();
      f.advance(3); expect(f.rounds).toHaveBeenCalledTimes(fed); expect(f.ended).toHaveBeenCalledOnce();
      expect(f.lever.state.reserve).toBe(left); expect(f.lever.state.loaded).toBe(true);
      expect(f.lever.state.ammo).toBe(tube + fed + (chambered ? 1 : 0)); expect(f.game.dead).toBe(false);
    });
  it('trigger before any round is fed does nothing; trigger with one fed stops after the next round, without firing', () => {
    const f = fixture(); f.lever.reload(); f.lever.tryFire(); expect(actOf(f.lever).stopAfter).toBe(false);
    f.advance(0.65); expect(f.rounds).toHaveBeenCalledOnce(); f.lever.tryFire(); expect(actOf(f.lever).stopAfter).toBe(true);
    f.advance(1); expect(f.rounds).toHaveBeenCalledTimes(2); expect(f.fired).not.toHaveBeenCalled(); expect(f.ended).toHaveBeenCalledOnce();
  });
  it('dry trigger with rounds in the tube works the lever; no tube rounds starts a reload', () => {
    const withTube = fixture(2); withTube.lever.tryFire(); expect(withTube.cycles).toHaveBeenCalledOnce();
    withTube.advance(0.6); expect(withTube.lever.state.loaded).toBe(true); expect(withTube.lever.state.ammo).toBe(2);
    const empty = fixture(); empty.lever.tryFire(); expect(empty.lever.state.reloading).toBe(true); expect(empty.fired).not.toHaveBeenCalled();
  });
  it.each([[0.3, false], [0.4, true], [5.1, false]] as const)('auto reload window at %ss → %s', (elapsed, expected) => {
    const f = fixture(); Reflect.set(f.lever, 'sinceEmpty', elapsed); f.advance(1 / 60); expect(f.lever.state.reloading).toBe(expected);
  });
  it('stowed reload completes and the debug freeze holds the action clock', () => {
    const f = fixture(4, true); f.lever.reload(); Reflect.set(f.lever, 'active', false); f.lever.enabled = false;
    f.advance(2); expect(f.rounds).toHaveBeenCalledTimes(2); expect(f.lever.state.ammo).toBe(7);
    const frozen = fixture(0, true); frozen.lever.reload(); Reflect.set(frozen.lever, 'freezeCycle', 0.45); frozen.advance(3);
    expect(frozen.rounds).not.toHaveBeenCalled(); Reflect.set(frozen.lever, 'freezeCycle', null); frozen.advance(3);
    expect(frozen.rounds).toHaveBeenCalledTimes(6);
  });
});
