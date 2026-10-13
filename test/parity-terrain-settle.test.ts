import { afterEach, expect, it, vi } from 'vitest';
import { GameClock } from '../src/engine/core/clock';
import { settlePresentationTerrain } from '../scripts/parity/terrain-settle.mjs';

const originalWindow = Reflect.get(globalThis, 'window');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); vi.useRealTimers(); });
function capture(refresh: unknown): { advance: ReturnType<typeof vi.fn>; clock: GameClock; player: { position: { x: number; y: number; z: number }; yaw: number; pitch: number }; game: { frameGate: () => boolean }; gate: () => boolean } {
  const advance = vi.fn(() => Promise.reject(new Error('Frozen terrain must not advance gameplay')));
  const clock = new GameClock(); clock.setCapture(30); clock.tick(1 / 30);
  const player = { position: { x: 60, y: 22.1, z: -15 }, yaw: 1, pitch: -0.1 };
  const gate = vi.fn(() => true), game = { frameGate: gate, app: { clock } };
  Reflect.set(globalThis, 'window', {
    __wildshard: { requireWorld: () => ({ player, game }), shard: { shardfileResidency: { tiles: { refresh } } } },
    __parity: { advance, free: false, remaining: 0 },
  });
  return { advance, clock, player, game, gate };
}

it('awaits real asynchronous viewer work with zero gameplay or effect frames', async () => {
  let finish: (() => void) | undefined;
  const queue = new Promise<void>(resolve => { finish = resolve; });
  const refresh = vi.fn(() => queue), fixture = capture(refresh);
  const before = fixture.clock.snapshot(), pose = { ...fixture.player.position };
  const settling = settlePresentationTerrain();
  expect(fixture.game.frameGate()).toBe(false);
  await Promise.resolve(); finish?.();
  expect(await settling).toEqual({ frames: 0 });
  expect(refresh).toHaveBeenCalledExactlyOnceWith(60, -15);
  expect(fixture.advance).not.toHaveBeenCalled();
  expect(fixture.clock.snapshot()).toEqual(before);
  expect(fixture.player.position).toEqual(pose);
  expect(fixture.game.frameGate).toBe(fixture.gate);
});

it('preserves queue rejection and restores the original capture gate', async () => {
  const failure = new Error('Tile bytes refused'), fixture = capture(() => Promise.reject(failure));
  await expect(settlePresentationTerrain()).rejects.toBe(failure);
  expect(fixture.advance).not.toHaveBeenCalled();
  expect(fixture.game.frameGate).toBe(fixture.gate);
});

it('refuses an unresolved queue at a finite wall-time bound without gameplay frames', async () => {
  vi.useFakeTimers();
  const fixture = capture(() => new Promise<void>(() => { /* deliberately unresolved real queue */ }));
  const refusal = expect(settlePresentationTerrain(3)).rejects.toThrow('wall-time bound');
  await vi.advanceTimersByTimeAsync(3); await refusal;
  expect(fixture.advance).not.toHaveBeenCalled();
  expect(fixture.game.frameGate).toBe(fixture.gate);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['pose', 'simulation', 'wall', 'frames', 'paused', 'scale', 'captureFps'] as const)('refuses %s drift while residency is settling', async field => {
  const fixture = capture(() => {
    if (field === 'pose') fixture.player.position.y -= 0.1;
    else {
      const state = fixture.clock.snapshot();
      if (field === 'simulation') state.elapsed += 1;
      else if (field === 'wall') state.wall += 1;
      else if (field === 'frames') state.frames += 1;
      else if (field === 'paused') state.paused = true;
      else if (field === 'scale') state.scale = 0.5;
      else state.captureFps = 60;
      fixture.clock.restore(state);
    }
    return Promise.resolve();
  });
  await expect(settlePresentationTerrain()).rejects.toThrow('pose or clock');
  expect(fixture.game.frameGate).toBe(fixture.gate);
});

it.each([undefined, false, () => undefined])('refuses fabricated completion: %s', async value => {
  const fixture = capture(value);
  await expect(settlePresentationTerrain()).rejects.toThrow(/refresh|completion promise/u);
  expect(fixture.game.frameGate).toBe(fixture.gate);
});

it('refuses missing exposure instead of inventing an idle signal', async () => {
  capture(() => Promise.resolve());
  Reflect.set(globalThis, 'window', { __wildshard: { requireWorld: () => ({ player: { position: { x: 0, z: 0 } } }), shard: {} } });
  await expect(settlePresentationTerrain()).rejects.toThrow('actual shardfile residency');
});

it.each([0, -1, 120001, Infinity, 1.5])('refuses invalid wall-time bounds: %s', async bound => {
  capture(() => Promise.resolve());
  await expect(settlePresentationTerrain(bound)).rejects.toThrow('Invalid terrain capture bound');
});

it('refuses missing captured-frame authority before requesting terrain', async () => {
  const refresh = vi.fn(() => Promise.resolve()); capture(refresh);
  const holder: unknown = Reflect.get(globalThis, 'window');
  if (holder === null || typeof holder !== 'object') throw new Error('Missing fixture window');
  Reflect.deleteProperty(holder, '__parity');
  await expect(settlePresentationTerrain()).rejects.toThrow('captured frame owner');
  expect(refresh).not.toHaveBeenCalled();
});

it.each([{ free: true, remaining: 0 }, { free: false, remaining: 1 }])('refuses outstanding gameplay frames: %s', async control => {
  const refresh = vi.fn(() => Promise.resolve()); capture(refresh);
  const holder: unknown = Reflect.get(globalThis, 'window');
  if (holder === null || typeof holder !== 'object') throw new Error('Missing fixture window');
  Reflect.set(holder, '__parity', control);
  await expect(settlePresentationTerrain()).rejects.toThrow('frozen captured frames');
  expect(refresh).not.toHaveBeenCalled();
});
