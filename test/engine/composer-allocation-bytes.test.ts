import { expect, it, vi } from 'vitest';
import { DataTexture, HalfFloatType, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { composerAllocationBytes } from '../../src/engine/render/textureBytes';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { Game } from '../../src/engine/core/Game';
import { legacyDouble } from '../fake/FakeGame';

it('counts only allocated composer native handles once and restores the renderbuffer binding', async () => {
  class Renderbuffer { readonly renderbuffer = true; }
  class Context { readonly webgl2 = true; }
  vi.stubGlobal('WebGLRenderbuffer', Renderbuffer); vi.stubGlobal('WebGL2RenderingContext', Context);
  const prior = new Renderbuffer(), depth = new Renderbuffer(), nativeTexture = {};
  let binding: unknown = prior;
  const context = legacyDouble<WebGL2RenderingContext>({
    RENDERBUFFER: 36161, RENDERBUFFER_BINDING: 36007, RENDERBUFFER_WIDTH: 36162, RENDERBUFFER_HEIGHT: 36163,
    RENDERBUFFER_INTERNAL_FORMAT: 36164, RENDERBUFFER_SAMPLES: 36011, DEPTH_COMPONENT16: 33189,
    RGBA32F: 34836, RGBA16F: 34842, DEPTH32F_STENCIL8: 36013, R16F: 33325, R8: 33321,
    getParameter: () => binding,
    bindRenderbuffer: (_target, next) => { binding = next; },
    getRenderbufferParameter: (_target, parameter) => parameter === 36164 ? 33189 : parameter === 36011 ? 1 : 4,
  });
  Object.setPrototypeOf(context, Context.prototype);
  const target = new WebGLRenderTarget(4, 4, { type: HalfFloatType }), spare = new WebGLRenderTarget(8, 8);
  const alias = target.texture.clone(), sampled = new DataTexture(new Uint8Array(4096), 32, 32);
  let allocated = true;
  const renderer = legacyDouble<WebGLRenderer & { isWebGLRenderer: boolean }>({
    isWebGLRenderer: true, getContext: () => context,
    properties: legacyDouble<WebGLRenderer['properties']>({ get: object => !allocated ? {} : object === sampled ? { __webglTexture: {} } : object === target.texture || object === alias ? { __webglTexture: nativeTexture }
      : object === target ? { __webglDepthbuffer: depth, __webglDepthRenderbuffer: depth } : {} }),
  });
  try {
    expect(composerAllocationBytes({ target, alias, sampled, spare, renderer }, renderer)).toBe(16 * 8 + 16 * 2);
    expect(binding).toBe(prior);
    const game: unknown = Object.create(Game.prototype);
    if (!(game instanceof Game)) throw new Error('Game prototype');
    const app = new App(), engineScope = new Scope('renderer'), levelScope = engineScope.child('level'), read = vi.fn<(bytes: number) => void>();
    Reflect.set(game, '_composer', { target, alias, sampled, spare, renderer });
    Reflect.set(game, 'renderer', renderer); Reflect.set(game, 'app', app);
    Reflect.set(game, 'levelScope', levelScope); Reflect.set(game, 'engineScope', engineScope); Reflect.set(game, 'compositionObservers', new Set());
    const detach = game.observeComposerAllocation(read);
    expect(read).toHaveBeenLastCalledWith(160);
    levelScope.onDispose(() => { allocated = false; }); levelScope.dispose();
    expect(read).toHaveBeenCalledTimes(1); await Promise.resolve();
    expect(read).toHaveBeenLastCalledWith(0);
    detach(); await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(2); expect(app.events.census().listeners).toBe(0);
    engineScope.dispose();
  } finally { vi.unstubAllGlobals(); target.dispose(); spare.dispose(); alias.dispose(); sampled.dispose(); }
});
