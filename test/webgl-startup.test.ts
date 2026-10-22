// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { scopeRegistrations } from '../src/engine/app/scope';
import { GAME_CONTEXT_ATTRIBUTES, readyWebGLContext, type ContextStartupState } from '../src/engine/core/webglStartup';

const unavailable = 'Graphics context did not recover during startup (context unavailable)';

function creationEvent(statusMessage: unknown): Event {
  return Object.assign(new Event('webglcontextcreationerror'), { statusMessage });
}

/** Only the GPU API is doubled; startup timing, events and Scope cleanup remain real. */
function readyContext() {
  return {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
    HIGH_FLOAT: 36338, MEDIUM_FLOAT: 36337, LOW_FLOAT: 36336,
    isContextLost: vi.fn(() => false),
    getShaderPrecisionFormat: vi.fn<() => WebGLShaderPrecisionFormat | null>(() => ({ rangeMin: 127, rangeMax: 127, precision: 23 })),
  };
}

function watchCleanup(canvas: HTMLCanvasElement): () => void {
  const add = vi.spyOn(canvas, 'addEventListener');
  const remove = vi.spyOn(canvas, 'removeEventListener');
  return () => {
    expect(add.mock.calls.map(([type]) => type)).toEqual(['webglcontextlost', 'webglcontextcreationerror']);
    expect(remove).toHaveBeenCalledTimes(2);
    for (const [type, listener] of add.mock.calls) expect(remove).toHaveBeenCalledWith(type, listener, undefined);
    expect(scopeRegistrations(scope => scope.name === 'webgl-startup')).toEqual({
      listeners: { window: 0, document: 0, canvas: 0, other: 0 },
      timers: { timeouts: 0, intervals: 0, raf: 0 },
    });
    expect(vi.getTimerCount()).toBe(0);
  };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }); });
afterEach(() => { vi.useRealTimers(); });

test('retains the latest nonempty creation reason without changing retries or context attributes', async () => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas);
  const getContext = vi.spyOn(canvas, 'getContext').mockImplementation(() => {
    canvas.dispatchEvent(creationEvent('   '));
    return null;
  });
  getContext.mockImplementationOnce(() => {
    canvas.dispatchEvent(creationEvent('First browser reason'));
    return null;
  }).mockImplementationOnce(() => {
    canvas.dispatchEvent(creationEvent('  Browser rejected context creation  '));
    return null;
  });
  const waiting = vi.fn<(state: ContextStartupState) => void>();
  const result = expect(readyWebGLContext(canvas, waiting)).rejects.toThrow(new Error(`${unavailable}: Browser rejected context creation`));
  await vi.advanceTimersByTimeAsync(9999);
  expect(waiting).toHaveBeenCalledTimes(40);
  expect(getContext).toHaveBeenCalledTimes(40);
  await vi.advanceTimersByTimeAsync(1);
  await result;
  expect(getContext).toHaveBeenCalledTimes(41);
  for (const args of getContext.mock.calls) expect(args).toEqual(['webgl2', GAME_CONTEXT_ATTRIBUTES]);
  expect(waiting.mock.calls.map(([state]) => state)).toEqual(Array.from({ length: 41 }, (_, index) => ({
    attempt: index + 1, elapsedMs: index * 250, contextLost: false, precisionReady: false, contextCreated: false,
  })));
  cleanup();
});

test.each([
  { name: 'no event', event: undefined },
  { name: 'empty status', event: creationEvent('') },
  { name: 'whitespace status', event: creationEvent(' \n\t ') },
  { name: 'absent status', event: new Event('webglcontextcreationerror') },
  { name: 'undefined status', event: creationEvent(undefined) },
  { name: 'non-string status', event: creationEvent(42) },
])('keeps the original fallback with $name', async ({ event }) => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas);
  vi.spyOn(canvas, 'getContext').mockImplementation(() => {
    if (event !== undefined) canvas.dispatchEvent(event);
    return null;
  });
  const result = expect(readyWebGLContext(canvas)).rejects.toThrow(new Error(unavailable));
  await vi.advanceTimersByTimeAsync(10_000);
  await result;
  cleanup();
});

test('bounds retained browser text rather than accumulating reasons across retries', async () => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockImplementation(() => {
    canvas.dispatchEvent(creationEvent('x'.repeat(2048)));
    return null;
  });
  const result = expect(readyWebGLContext(canvas)).rejects.toThrow(new Error(`${unavailable}: ${'x'.repeat(1024)}`));
  await vi.advanceTimersByTimeAsync(10_000);
  await result;
});

test('returns the same ready context immediately even after a creation event', async () => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas), gl = readyContext();
  const getContext = vi.mocked(vi.spyOn(canvas, 'getContext'), { partial: true }).mockImplementation(() => {
    canvas.dispatchEvent(creationEvent('Earlier creation warning'));
    return gl;
  });
  const waiting = vi.fn<(state: ContextStartupState) => void>();
  await expect(readyWebGLContext(canvas, waiting)).resolves.toBe(gl);
  expect(waiting).not.toHaveBeenCalled();
  expect(getContext).toHaveBeenCalledExactlyOnceWith('webgl2', GAME_CONTEXT_ATTRIBUTES);
  expect(gl.getShaderPrecisionFormat.mock.calls).toHaveLength(6);
  expect(gl.isContextLost).toHaveBeenCalledTimes(2);
  cleanup();
});

test('still recovers on the next 250ms retry and removes creation and loss listeners', async () => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas), gl = readyContext();
  const getContext = vi.mocked(vi.spyOn(canvas, 'getContext'), { partial: true }).mockReturnValue(gl);
  getContext.mockImplementationOnce(() => {
    canvas.dispatchEvent(creationEvent('Temporary creation failure'));
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    return null;
  });
  const waiting = vi.fn<(state: ContextStartupState) => void>(), pending = readyWebGLContext(canvas, waiting);
  await vi.advanceTimersByTimeAsync(249);
  expect(getContext).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  await expect(pending).resolves.toBe(gl);
  expect(waiting).toHaveBeenCalledTimes(1);
  expect(getContext).toHaveBeenCalledTimes(2);
  cleanup();
  const lostAfter = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(lostAfter);
  expect(lostAfter.defaultPrevented).toBe(false);
});

test.each(['context lost', 'shader capabilities unavailable'])('preserves the %s failure', async reason => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas), gl = readyContext();
  gl.isContextLost.mockReturnValue(reason === 'context lost');
  gl.getShaderPrecisionFormat.mockReturnValue(null);
  vi.mocked(vi.spyOn(canvas, 'getContext'), { partial: true }).mockReturnValue(gl);
  const result = expect(readyWebGLContext(canvas)).rejects.toThrow(new Error(`Graphics context did not recover during startup (${reason})`));
  await vi.advanceTimersByTimeAsync(10_000);
  await result;
  cleanup();
});

test.each(['getContext', 'waiting'])('cleans both listeners if %s throws', async source => {
  const canvas = document.createElement('canvas'), cleanup = watchCleanup(canvas), error = new Error('Startup callback failed');
  vi.spyOn(canvas, 'getContext').mockImplementation(() => {
    if (source === 'getContext') throw error;
    return null;
  });
  await expect(readyWebGLContext(canvas, () => { throw error; })).rejects.toBe(error);
  cleanup();
});
