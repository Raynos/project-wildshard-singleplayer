import { afterEach, expect, it, vi } from 'vitest';
import { settlePresentationTerrain } from '../scripts/parity/terrain-settle.mjs';

const originalWindow = Reflect.get(globalThis, 'window');
afterEach(() => { Reflect.set(globalThis, 'window', originalWindow); });
function capture(refresh: unknown, frame: () => Promise<void> = () => Promise.resolve()): ReturnType<typeof vi.fn> {
  const advance = vi.fn(frame);
  Reflect.set(globalThis, 'window', {
    __wildshard: { requireWorld: () => ({ player: { position: { x: 60, z: -15 } } }), shard: { shardfileResidency: { tiles: { refresh } } } },
    __parity: { advance },
  });
  return advance;
}

it('awaits the real viewer queue and drives captured frames until completion', async () => {
  let finish: (() => void) | undefined;
  const queue = new Promise<void>(resolve => { finish = resolve; });
  const refresh = vi.fn(() => queue);
  const advance = capture(refresh, () => { finish?.(); return Promise.resolve(); });
  expect(await settlePresentationTerrain(4)).toEqual({ frames: 1 });
  expect(refresh).toHaveBeenCalledExactlyOnceWith(60, -15);
  expect(advance).toHaveBeenCalledExactlyOnceWith(1);
});

it('preserves actual queue rejection without claiming readiness', async () => {
  const failure = new Error('Tile bytes refused'), advance = capture(() => Promise.reject(failure));
  await expect(settlePresentationTerrain()).rejects.toBe(failure);
  expect(advance.mock.calls.length).toBeLessThanOrEqual(1);
});

it('refuses an unresolved queue at the original finite bound', async () => {
  const advance = capture(() => new Promise<void>(() => { /* deliberately unresolved real queue */ }));
  await expect(settlePresentationTerrain(3)).rejects.toThrow('frame bound');
  expect(advance).toHaveBeenCalledTimes(3);
});

it('preserves a failed captured frame', async () => {
  const failure = new Error('Render owner fault');
  capture(() => new Promise<void>(() => { /* deliberately unresolved real queue */ }), () => Promise.reject(failure));
  await expect(settlePresentationTerrain()).rejects.toBe(failure);
});

it.each([undefined, false, () => undefined])('refuses fabricated completion: %s', async value => {
  capture(value);
  await expect(settlePresentationTerrain()).rejects.toThrow(/refresh|completion promise/u);
});

it('refuses missing exposure instead of inventing an idle signal', async () => {
  capture(() => Promise.resolve());
  Reflect.set(globalThis, 'window', { __wildshard: { requireWorld: () => ({ player: { position: { x: 0, z: 0 } } }), shard: {} } });
  await expect(settlePresentationTerrain()).rejects.toThrow('actual shardfile residency');
});

it.each([0, -1, 1201, Infinity, 1.5])('refuses invalid frame bounds: %s', async bound => {
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

it('refuses a frame driver that fabricates completion', async () => {
  capture(() => new Promise<void>(() => { /* unresolved owner queue */ }));
  const holder: unknown = Reflect.get(globalThis, 'window');
  if (holder === null || typeof holder !== 'object') throw new Error('Missing fixture window');
  Reflect.set(holder, '__parity', { advance: () => undefined });
  await expect(settlePresentationTerrain()).rejects.toThrow('frame driver must return');
});
