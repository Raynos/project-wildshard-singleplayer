import { expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, WebGLRenderTarget, WebGLRenderer } from 'three';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import type { ProgramLike } from '../src/engine/boot/perflog';
import { runPrecompile } from '../src/engine/render/precompile';

it('cancels a yielded compile before resolving programs or uploading textures, restoring scene and target', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const uniforms = vi.fn(), programs: ProgramLike[] = [], scene = new Scene(), fog = scene.fog;
  const previous = new WebGLRenderTarget(), setTarget = vi.fn(); let current = true;
  // The real batching/cancellation path uses this renderer command recorder, not a WebGL context.
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  const commands = { extensions: { has: () => false }, info: { programs }, getRenderTarget: () => previous,
    setRenderTarget: setTarget, compile: () => { programs.push({ type: 'ShaderMaterial', name: 'fixture', cacheKey: 'fixture', usedTimes: 1, id: 1,
      isReady: () => true, program: {}, getUniforms: uniforms }); } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try {
    await expect(runPrecompile(renderer, new PerspectiveCamera(), [{ label: 'fixture', root: new Group(), target: scene, rt: null, fogOff: true }], 0,
      () => { current = false; }, [], () => current)).rejects.toThrow('Shader warm-up owner left');
    expect(uniforms).not.toHaveBeenCalled(); expect(setTarget).toHaveBeenLastCalledWith(previous); expect(scene.fog).toBe(fog);
  } finally { installScopeEnvironment(prior); previous.dispose(); }
});
