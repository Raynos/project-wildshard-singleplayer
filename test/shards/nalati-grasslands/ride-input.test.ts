// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { App, Scope, type LevelContext, type InputContextDef } from '#engine';
import * as THREE from 'three';
import { installRide } from '#shards/nalati-grasslands/ride/input';
import type { Ride } from '#shards/nalati-grasslands/ride/ride';
import { Mount } from '#shards/nalati-grasslands/ride/Mount';
import type { Taming } from '#shards/nalati-grasslands/ride/Taming';
import { legacyDouble } from '../../fake/FakeGame';
import { damageTarget } from '../../fake/legacyActor';
import { fakeWorld } from '../../fake/world';

function fixture() {
  const app = new App(), scope = new Scope('ride-test');
  const whistle = vi.fn<() => null>(() => null), gallop = vi.fn<() => void>();
  const mount = legacyDouble<Mount>({ input: null, equipment: null, breaking: false, onMountChange: undefined,
    whistle, gallopTap: gallop, dismount: () => { mount.onMountChange?.(null); } });
  const taming = legacyDouble<Taming>({ input: null, onBreaking: undefined });
  app.addSystem({ id: 'engine.player.input', phase: 'input', run: () => undefined }, scope);
  const ctx = legacyDouble<LevelContext>({ app, scope,
    inputContext: (def: InputContextDef) => { app.input.register(def, scope); },
    system: (spec) => { app.addSystem(spec, scope); }, debug: { expose: () => undefined } });
  installRide(ctx, legacyDouble<Ride>({ mount, taming }));
  const tick = () => { for (const s of app.systemsByPhase().input) s.run(1 / 60, 0); };
  const key = (type: 'keydown' | 'keyup', code: string) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  return { app, scope, mount, taming, whistle, gallop, tick, key };
}

describe('scoped riding controls', () => {
  it('the real saddle publishes mount ownership without hiding the horse, then clears it on dismount', () => {
    const f = fakeWorld(), horse = damageTarget().animal;
    f.player.camera = f.game.camera; f.player.velocity = new THREE.Vector3();
    f.player.setHover = () => undefined; f.player.setBodyEnabled = () => undefined;
    horse.mem = {}; horse.hidden = false; Object.defineProperty(horse, 'gaitPhase', { value: 0 }); horse.yaw = 0; horse.setMotion = () => undefined;
    const mount = new Mount({ player: f.player, forest: f.forest });
    expect(mount.mount(horse)).toBe(true); expect(f.player.mountedOn).toBe(horse); expect(f.player.ride).toBe(mount);
    expect(horse.hidden).toBe(false); expect(horse.driven).toBe(true);
    mount.dismount(); expect(f.player.mountedOn).toBeNull(); expect(f.player.ride).toBeNull(); expect(horse.driven).toBe(false);
  });
  it('keeps foot verbs additive, scores a buffered spur and blocks combat only during breaking', () => {
    const f = fixture(), horse = damageTarget().animal;
    expect(f.app.input.top).toBe('ride.foot'); f.key('keydown', 'KeyX'); f.tick(); f.tick();
    expect(f.whistle).toHaveBeenCalledTimes(1); f.key('keyup', 'KeyX');
    f.key('keydown', 'KeyG'); expect(f.app.input.held('ride.offer')).toBe(true);
    f.mount.onMountChange?.(horse); expect(f.app.input.top).toBe('ride');
    f.key('keydown', 'ShiftLeft'); f.key('keyup', 'ShiftLeft'); f.tick();
    expect(f.gallop).toHaveBeenCalledTimes(1); expect(f.app.input.held('ride.gallop')).toBe(false);
    f.app.input.press('attack'); expect(f.app.input.consume('attack')).toBe(true);
    f.taming.onBreaking?.(true); f.app.input.press('attack'); f.app.input.press('aim'); f.app.input.press('swap');
    for (const action of ['attack', 'aim', 'swap'] as const) expect(f.app.input.consume(action)).toBe(false);
    f.key('keydown', 'KeyA'); expect(f.app.input.held('lean.left')).toBe(true);
    f.taming.onBreaking?.(false); expect(f.app.input.held('lean.left')).toBe(false); expect(f.app.input.consume('attack')).toBe(true);
    f.mount.dismount(); expect(f.app.input.top).toBe('ride.foot');
    f.scope.dispose(); expect(f.app.input.top).toBe(''); expect(f.scope.census.listeners).toBe(0);
    f.key('keydown', 'KeyX'); expect(f.app.input.held('ride.whistle')).toBe(false); f.app.engineScope.dispose();
  });
  it('resamples already held saddle controls and does not retain listeners or context disposers across remounts', () => {
    const f = fixture(), horse = damageTarget().animal;
    f.key('keydown', 'KeyW'); expect(f.app.input.held('move.forward')).toBe(false);
    const census = f.scope.census;
    for (let i = 0; i < 50; i++) {
      f.mount.onMountChange?.(horse); expect(f.app.input.held('move.forward')).toBe(true);
      f.mount.dismount(); expect(f.app.input.held('move.forward')).toBe(false);
    }
    expect(f.scope.census.listeners).toBe(census.listeners); expect(f.scope.census.disposers).toBe(census.disposers);
    f.scope.dispose(); f.app.engineScope.dispose();
  });
});
