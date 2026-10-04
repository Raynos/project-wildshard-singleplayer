import { afterEach, describe, expect, it, vi } from 'vitest';
import { readyWebGLContext } from '../src/engine/core/webglStartup';

afterEach(() => { vi.useRealTimers(); });

function fixture() {
  const canvas = new EventTarget();
  const precision = vi.fn((): object | null => ({ precision: 23 }));
  const lost = vi.fn(() => false);
  const gl = { isContextLost: lost, getShaderPrecisionFormat: precision, VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, HIGH_FLOAT: 3, MEDIUM_FLOAT: 4, LOW_FLOAT: 5 };
  const getContext = vi.fn((): typeof gl | null => gl);
  Object.assign(canvas, { getContext });
  return { canvas: canvas as HTMLCanvasElement, gl, precision, lost, getContext };
}

describe('graphics startup', () => {
  it('uses the existing live context without waiting or another canvas', async () => {
    const f = fixture(), waiting = vi.fn<() => void>();
    expect(await readyWebGLContext(f.canvas, waiting)).toBe(f.gl);
    expect(f.precision).toHaveBeenCalledTimes(6);
    expect(waiting).not.toHaveBeenCalled();
  });

  it('avoids the high-performance context path that fails on the physical iPhone', async () => {
    const f = fixture();
    f.getContext.mockImplementation((_kind?: string, attributes?: WebGLContextAttributes) => {
      f.lost.mockReturnValue(attributes?.powerPreference === 'high-performance');
      return f.gl;
    });
    expect(await readyWebGLContext(f.canvas)).toBe(f.gl);
    expect(f.getContext).toHaveBeenCalledOnce();
  });

  it('allows restoration when loss occurs inside getContext, then resumes on that context', async () => {
    vi.useFakeTimers();
    const f = fixture(), waiting = vi.fn<() => void>();
    f.lost.mockReturnValue(true);
    let prevented = false;
    f.getContext.mockImplementationOnce(() => {
      const event = new Event('webglcontextlost', { cancelable: true });
      f.canvas.dispatchEvent(event); prevented = event.defaultPrevented;
      return f.gl;
    });
    const pending = readyWebGLContext(f.canvas, waiting);
    expect(prevented).toBe(true);
    expect(f.precision).not.toHaveBeenCalled();
    f.lost.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toBe(f.gl);
    expect(waiting).toHaveBeenCalledOnce();
    const after = new Event('webglcontextlost', { cancelable: true });
    f.canvas.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false); // temporary handler was removed
  });

  it('retries null creation and null capability results before using the context', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.getContext.mockReturnValueOnce(null);
    f.precision.mockReturnValueOnce(null);
    const pending = readyWebGLContext(f.canvas);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(f.gl);
    expect(f.getContext).toHaveBeenCalledTimes(3);
  });

  it('stops after ten seconds instead of spinning or reloading forever', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.precision.mockReturnValue(null);
    const pending = expect(readyWebGLContext(f.canvas)).rejects.toThrow('Graphics context did not recover');
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    const after = new Event('webglcontextlost', { cancelable: true });
    f.canvas.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
