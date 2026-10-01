// F8: these phase/clock contracts move to the real engine scheduler, keeping their expectations unchanged.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FAULT_STREAK, loopState, setLoopState } from '#engine/core/faults';
import { Game } from '#engine/core/Game';
import { worldTime } from '#engine/core/time';
import { FakeGame, seedRandom } from '../fake/FakeGame';
import { FakePhysics } from '../fake/world';

afterEach(() => { setLoopState('boot'); worldTime.scale = 1; worldTime.realDt = 0; });

describe('manual game loop contract', () => {
  it('matches the production fixed-step accumulator at 30, 60 and 144 Hz, including a stalled frame', () => {
    const runFixed: unknown = Reflect.get(Game.prototype, 'runFixed');
    if (typeof runFixed !== 'function') throw new Error('F8 must port this contract to the new scheduler');
    for (const fps of [30, 60, 144]) {
      const game = new FakeGame(), phases: string[] = [];
      for (const phase of ['pre', 'step', 'post'] as const) game.onFixed(phase, () => { phases.push(phase); });
      const actual: string[] = [];
      const state = {
        fixedAcc: 0, alpha: 0, fixedSteps: 0,
        fixed: { pre: 'pre', step: 'step', post: 'post' },
        runPhase: (phase: string): void => { actual.push(phase); },
      };
      // Invoke the real accumulator without constructing WebGLRenderer; all private state it reads is explicit.
      const step = runFixed as (this: typeof state, dt: number) => void;
      for (let i = 0; i <= fps; i++) {
        game.advance(1 / fps); step.call(state, 1 / fps);
        expect(state.fixedSteps).toBe(game.fixedSteps); expect(state.alpha).toBe(game.alpha);
      }
      game.advance(1); step.call(state, 0.1);
      expect(state.fixedSteps).toBe(game.fixedSteps); expect(state.alpha).toBe(game.alpha);
      expect(actual).toEqual(phases);
    }
  });
  it('runs input, each fixed pre/step/post, update, late, then render', () => {
    const game = new FakeGame(), order: string[] = [];
    game.onInput(() => { order.push('input'); });
    for (const phase of ['pre', 'step', 'post'] as const) game.onFixed(phase, () => { order.push(phase); });
    game.onUpdate(() => { order.push('update'); expect(game.renderer.info.render.calls).toBe(0); });
    game.onLate(() => { order.push('late'); expect(game.renderer.info.render.calls).toBe(0); });
    game.advance(1 / 30);
    expect(order).toEqual(['input', 'pre', 'step', 'post', 'pre', 'step', 'post', 'update', 'late']);
    expect(game.renderer.info.render.calls).toBe(1);
  });

  it.each([30, 60, 144])('accumulates 60 fixed steps at %i rendered frames per second', (fps) => {
    const game = new FakeGame();
    let steps = 0, updates = 0, elapsed = 0;
    game.onFixed('step', (dt) => { expect(dt).toBe(1 / 60); steps++; elapsed += dt; });
    game.onUpdate(() => { updates++; });
    // End one frame beyond a second so IEEE remainder cannot lose the exact endpoint at 144 Hz.
    for (let i = 0; i <= fps; i++) game.advance(1 / fps);
    expect(steps).toBe(Math.floor((fps + 1) * 60 / fps));
    expect(elapsed).toBeCloseTo(steps / 60, 12);
    expect(updates).toBe(fps + 1);
    expect(game.alpha).toBeGreaterThanOrEqual(0);
    expect(game.alpha).toBeLessThan(1);
  });

  it('drops stalled-frame backlog after three steps', () => {
    const game = new FakeGame();
    game.advance(1);
    expect(game.fixedSteps).toBe(3);
    game.advance(0);
    expect(game.fixedSteps).toBe(0);
  });

  it('slows all simulation phases to 4% while real time keeps advancing; overlapping stops take the longer', () => {
    const game = new FakeGame(), dts: number[] = [], times: number[] = [];
    game.onInput((dt) => { dts.push(dt); });
    game.onUpdate((dt, t) => { dts.push(dt); times.push(t); });
    game.onLate((dt) => { dts.push(dt); });
    game.hitStop(0.1); game.hitStop(0.01);
    for (let i = 0; i < 6; i++) game.advance(0.02);
    expect(dts.slice(0, 15)).toEqual(Array.from({ length: 15 }, () => 0.0008));
    expect(dts.slice(15)).toEqual([0.02, 0.02, 0.02]);
    expect(times.at(-1)).toBeCloseTo(0.12);
    expect(game.fixedSteps).toBe(1);
    expect(worldTime).toEqual({ realDt: 0.02, scale: 1 });
  });

  it.each(['input', 'pre', 'step', 'post', 'update', 'late'] as const)('isolates a throwing %s system after the production fault streak', (phase) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const game = new FakeGame(), bad = vi.fn(() => { throw new Error('actor fault'); }), good = vi.fn<() => void>();
    if (phase === 'input') game.onInput(bad);
    else if (phase === 'update') game.onUpdate(bad);
    else if (phase === 'late') game.onLate(bad);
    else game.onFixed(phase, bad);
    game.onLate(good);
    for (let i = 0; i < 10; i++) game.advance(1 / 60);
    expect(bad).toHaveBeenCalledTimes(FAULT_STREAK);
    expect(good).toHaveBeenCalledTimes(10);
    expect(game.dead).toBe(false);
    expect(game.renderer.info.render.frame).toBe(10);
  });

  it('stops drawing and advancing after a core system trips', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const game = new FakeGame(), bad = vi.fn(() => { throw new Error('physics'); });
    game.onFixed('step', bad, 'physics.step', true);
    for (let i = 0; i < 10; i++) game.advance(1 / 60);
    expect(bad).toHaveBeenCalledTimes(FAULT_STREAK);
    expect(game.dead).toBe(true);
    expect(game.frameCount).toBe(FAULT_STREAK);
    expect(game.renderer.info.render.frame).toBe(FAULT_STREAK - 1);
    expect(loopState()).toBe('dead');
  });

  it('repeats seeded random streams and restores Math.random', () => {
    const original = Math.random, restore = seedRandom();
    try {
      const first = [Math.random(), Math.random(), Math.random()];
      restore();
      const restoreAgain = seedRandom();
      try { expect([Math.random(), Math.random(), Math.random()]).toEqual(first); } finally { restoreAgain(); }
    } finally { restore(); }
    expect(Math.random).toBe(original);
  });

  it('answers box queries without Rapier or WebGL', () => {
    const physics = new FakePhysics([new THREE.Box3(new THREE.Vector3(-1, -1, 2), new THREE.Vector3(1, 1, 3))]);
    const from = new THREE.Vector3(), direction = new THREE.Vector3(0, 0, 1);
    expect(physics.castRay(from, direction, 10)?.distance).toBe(2);
    expect(physics.castRay(from, direction, 1)).toBeNull();
    expect(physics.lineOfSight(from, new THREE.Vector3(0, 0, 5))).toBe(false);
    expect(physics.lineOfSight(from, new THREE.Vector3(4, 0, 5))).toBe(true);
  });
});
