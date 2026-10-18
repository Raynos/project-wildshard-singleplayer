// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { app } from '../src/engine/app/runtime';
import { FreeCam } from '../src/engine/explore/FreeCam';

const cameras: FreeCam[] = [];
afterEach(() => { for (const camera of cameras.splice(0)) camera.dispose(); });
function fixture() {
  const canvas = document.createElement('canvas');
  let locked: Element | null = null;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
  const change = (element: Element | null): void => { locked = element; document.dispatchEvent(new Event('pointerlockchange')); };
  const exit = vi.fn(() => { change(null); });
  Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: exit });
  const request = vi.fn(() => { change(canvas); return Promise.resolve(); });
  Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: request });
  const camera = new FreeCam(new PerspectiveCamera(), canvas); cameras.push(camera);
  const down = (): void => { canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, pointerType: 'mouse' })); };
  return { canvas, camera, change, exit, request, down };
}

test('inactive camera does not release the player shared-canvas lock on reset or disposal', () => {
  const f = fixture(); f.camera.enabled = false; f.change(f.canvas);
  app.input.clear(); f.camera.dispose();
  expect(f.exit).not.toHaveBeenCalled(); expect(document.pointerLockElement).toBe(f.canvas);
});
test('enabled camera also cannot claim a lock it never requested', () => {
  const f = fixture(); f.change(f.canvas); app.input.clear();
  expect(f.exit).not.toHaveBeenCalled();
});
test('a genuine free-camera request is released once on reset', async () => {
  const f = fixture(); f.down(); await Promise.resolve(); app.input.clear();
  expect(f.request).toHaveBeenCalledOnce(); expect(f.exit).toHaveBeenCalledOnce();
  f.camera.dispose(); expect(f.exit).toHaveBeenCalledOnce();
});
test('an unrelated element lock is never released', async () => {
  const f = fixture(); f.down(); await Promise.resolve(); f.change(document.createElement('div')); app.input.clear();
  expect(f.exit).not.toHaveBeenCalled();
});
test('a cancelled pending request releases its eventual acquisition', async () => {
  const f = fixture(); let complete = (): void => { throw new Error('No pending request'); };
  f.request.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  f.down(); app.input.clear(); f.change(f.canvas); complete(); await Promise.resolve();
  expect(f.exit).toHaveBeenCalledOnce(); expect(document.pointerLockElement).toBeNull();
});
test('a refused request does not acquire later player locks', async () => {
  const f = fixture(); f.request.mockRejectedValue(new Error('Refused')); f.down();
  await Promise.resolve(); await Promise.resolve(); f.change(f.canvas); app.input.clear();
  expect(f.exit).not.toHaveBeenCalled();
});
test('disposal cancels a pending request and releases a late grant', async () => {
  const f = fixture(); let complete = (): void => { throw new Error('No pending request'); };
  f.request.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  f.down(); f.camera.dispose(); f.change(f.canvas); complete(); await Promise.resolve();
  expect(f.exit).toHaveBeenCalledOnce(); expect(document.pointerLockElement).toBeNull();
});
