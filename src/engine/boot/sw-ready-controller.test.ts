// @vitest-environment happy-dom
import {afterEach, beforeEach, expect, test, vi} from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('__BUILD_ID__', 'controller-ready');
  vi.stubGlobal('location', new URL('https://example.com/?sw=1'));
});

afterEach(async () => {
  (await import('../app/resources')).pageScope.dispose();
  Reflect.deleteProperty(window, '__ws_sw');
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

test('an existing controller is ready while registration remains pending, then update discovery attaches', async () => {
  const controller = Object.assign(new EventTarget(), {state: 'activated', postMessage: vi.fn()});
  const registration = Object.assign(new EventTarget(), {waiting: null, installing: null, update: vi.fn(() => Promise.resolve())});
  let finishRegistration = (_value: typeof registration): void => {throw new Error('Registration did not start');};
  const register = vi.fn(() => new Promise<typeof registration>(resolve => {finishRegistration = resolve;}));
  const listeners = vi.spyOn(registration, 'addEventListener');
  const container = Object.assign(new EventTarget(), {controller, register});
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: container});
  await import('./lastEnd');
  const pageTimers = vi.getTimerCount();
  const {wsSw} = await import('./sw');
  let ready = false;
  void wsSw.ready.then(() => {ready = true; return undefined;});
  await vi.advanceTimersByTimeAsync(0);
  expect(register).toHaveBeenCalledExactlyOnceWith(import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js', {scope: '/', updateViaCache: 'all'});
  expect(ready).toBe(true);
  expect(vi.getTimerCount()).toBe(pageTimers);
  expect(listeners).not.toHaveBeenCalled();
  finishRegistration(registration);
  await vi.advanceTimersByTimeAsync(0);
  expect(listeners.mock.calls.some(([name]) => name === 'updatefound')).toBe(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(registration.update).toHaveBeenCalledTimes(1);
  expect(wsSw.waiting).toBeNull();
});
