import { vi } from 'vitest';
import { Group, Mesh, Vector3, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'postprocessing';
import { Game } from '../src/engine/core/Game';
import { SkyRig } from '../src/engine/world/skyRig';
import * as renderer from '../src/engine/render/renderer';
import type { Renderer } from '../src/engine/render/renderer';
import * as startup from '../src/engine/core/webglStartup';
import * as ktx from '../src/engine/core/ktx2';

/** GPU output only. Game construction, its loop/fault policy, scene ownership and every gameplay
 * component remain real. This deliberately provides no rendering or GPU acceptance evidence. */
function headlessRenderer(canvas: HTMLCanvasElement): Renderer {
  const candidate: unknown = Object.create(WebGLRenderer.prototype);
  if (!(candidate instanceof WebGLRenderer)) throw new Error('Missing renderer prototype');
  const properties = new WeakMap<object, object>();
  const size = new Vector2(804, 1748);
  Object.assign(candidate, {
    isWebGLRenderer: true, domElement: canvas,
    setPixelRatio: () => undefined, getPixelRatio: () => 1,
    setSize: (width: number, height: number) => { size.set(width, height); },
    getSize: (out: Vector2) => out.copy(size), getDrawingBufferSize: (out: Vector2) => out.copy(size),
    capabilities: { getMaxAnisotropy: () => 1 }, shadowMap: { render: () => undefined },
    properties: { get: (value: object) => { let stored = properties.get(value); if (stored === undefined) { stored = {}; properties.set(value, stored); } return stored; } },
    renderBufferDirect: () => undefined, compile: () => undefined, compileAsync: () => Promise.resolve(),
    info: { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0, triangles: 0 }, reset: () => undefined },
    renderLists: { dispose: () => undefined }, dispose: () => undefined, forceContextLoss: () => undefined,
    getContext: () => ({ isContextLost: () => false }), initTexture: () => undefined,
  });
  return candidate;
}



/** Deterministic browser-frame delivery, not a replacement for the Game scheduler. */
export function graphicsOnly(): { bind: (game: Game) => void; frame: (dt: number) => void; load: <T>(pending: Promise<T>) => Promise<T>; dispose: () => void } {
  const frames = new Map<number, FrameRequestCallback>(); let serial = 0, timestamp = 0, delta = 0;
  let game: Game | undefined;
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { const id = ++serial; frames.set(id, run); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  // Opaque GPU context is consumed only by the graphics renderer replacement, never gameplay.
  vi.spyOn(startup, 'readyWebGLContext').mockResolvedValue({} as WebGL2RenderingContext);
  vi.spyOn(renderer, 'createRenderer').mockImplementation(headlessRenderer);
  vi.spyOn(ktx, 'initKtx2').mockImplementation(() => undefined);
  vi.spyOn(SkyRig.prototype, 'build').mockImplementation(function buildHeadlessSky(this: SkyRig) {
    Object.assign(this, { setupMaterial: () => undefined, update: () => undefined, csm: { updateFrustums: () => undefined } });
    Object.defineProperties(this, {
      planet: { value: new Group() }, planetDir: { value: new Vector3(0, 1, 0) },
      sunDisc: { value: new Mesh() }, raysDir: { value: new Vector3(0, 1, 0) },
    });
    return Promise.resolve(this);
  });
  vi.spyOn(Game.prototype, 'buildComposer').mockImplementation(function buildHeadlessComposer(this: Game) {
    const composer: unknown = Object.create(EffectComposer.prototype);
    if (!(composer instanceof EffectComposer)) throw new Error('Missing composer prototype');
    Object.assign(composer, { render: () => undefined, dispose: () => undefined });
    Reflect.set(this, '_composer', composer);
  });
  const deliver = (dt: number): void => {
    delta = dt; timestamp += dt * 1000 + .001; game?.primeFrame();
    const pending = [...frames]; frames.clear();
    for (const [, run] of pending) run(timestamp);
  };
  return {
    bind: value => {
      game = value;
      vi.spyOn(value.clock, 'getDelta').mockImplementation(() => { value.clock.elapsedTime += delta; return delta; });
    },
    frame: deliver,
    load: async pending => {
      // A real browser continues delivering frames while admitted memory preparation awaits paint.
      const timer = setInterval(() => { deliver(0); }, 5);
      try { return await pending; } finally { clearInterval(timer); }
    },
    dispose: () => { frames.clear(); vi.unstubAllGlobals(); },
  };
}
