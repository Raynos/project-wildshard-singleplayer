import { expect, it } from 'vitest';
import { DataTexture, PerspectiveCamera, WebGLRenderer, WebGLRenderTarget } from 'three';
import { VolumetricsEffect } from '../src/engine/core/Volumetrics';

it('warms the march in its own render target and restores the caller target on success and failure', () => {
  const noise = new DataTexture(), effect = new VolumetricsEffect(new PerspectiveCamera(), noise, 8, 0.5);
  const value: unknown = Object.create(WebGLRenderer.prototype);
  if (!(value instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  const caller = new WebGLRenderTarget(3, 5);
  let target: WebGLRenderTarget | null = caller, compiled: WebGLRenderTarget | null = null;
  Reflect.set(value, 'getRenderTarget', () => target);
  Reflect.set(value, 'setRenderTarget', (next: WebGLRenderTarget | null) => { target = next; });
  Reflect.set(value, 'compile', () => { compiled = target; });
  try {
    effect.warm(value);
    expect(compiled).toBeInstanceOf(WebGLRenderTarget); expect(compiled).not.toBe(caller);
    expect(target).toBe(caller);
    Reflect.set(value, 'compile', () => { expect(target).toBe(compiled); throw new Error('Driver failure'); });
    expect(() => effect.warm(value)).toThrow('Driver failure'); expect(target).toBe(caller);
  } finally { effect.dispose(); caller.dispose(); noise.dispose(); }
});
