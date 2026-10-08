// SHARD-PLATFORM SF57: a grid region builds Driftwood's sky backdrop as a layer each time Driftwood is admitted (G223).
// Its PMREM environment target and its generator (whose ping-pong target is a second cube-UV atlas) were never freed when
// the region left: +2 colour atlases and +1 depth buffer of 336 × 256 every circuit on the iPhone soak (e632fe913). This
// drives N simulated crossings through the real backdrop, layer and region sky, with PMREM's own target allocation (the
// GPU passes stubbed), and holds the live cube-UV targets flat.
import { expect, it, vi } from 'vitest';
import {
  BoxGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, PMREMGenerator, Scene, Sprite,
  SpriteMaterial, Vector3, WebGLRenderTarget, type WebGLRenderer,
} from 'three';
import { Scope } from '../src/engine/app/scope';
import type { LevelSpec } from '../src/engine/level/spec';
import type { SkyBackdropTargets } from '../src/engine/render/look';
import { BackdropLayer } from '../src/engine/world/backdropLayer';
import type { SkyRig } from '../src/engine/world/skyRig';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import type { FrameSkyLayer } from '../src/game/grid/frameLook';
import { buildRegionSky, regionSkyClaimId } from '../src/game/grid/regionSky';

import { STYLIZED_BACKDROP } from '../src/shards/driftwood-isle/look/backdrop';

const isTarget = (value: unknown): value is WebGLRenderTarget => value instanceof WebGLRenderTarget;
/** the GPU bytes a target holds: RGBA half float, plus a depth buffer at 4 bytes a texel */
const targetBytes = (t: WebGLRenderTarget): number => t.width * t.height * (8 + (t.depthBuffer ? 4 : 0));

/** PMREM's own target allocation (`_setSize`, `_allocateTargets`) without its GPU passes; every target it makes is tracked */
function stubPmrem(): Map<WebGLRenderTarget, number> {
  const live = new Map<WebGLRenderTarget, number>();
  const track = (t: unknown): void => {
    if (!isTarget(t) || live.has(t)) return;
    live.set(t, targetBytes(t));
    t.addEventListener('dispose', () => { live.delete(t); });
  };
  vi.spyOn(PMREMGenerator.prototype, 'fromScene').mockImplementation(function fromSceneTargets(this: PMREMGenerator, _scene, _sigma, _near, _far, options) {
    const setSize: unknown = Reflect.get(this, '_setSize'), allocate: unknown = Reflect.get(this, '_allocateTargets');
    if (typeof setSize !== 'function' || typeof allocate !== 'function') throw new Error('three PMREMGenerator internals moved');
    Reflect.apply(setSize, this, [options?.size ?? 256]);
    const rt: unknown = Reflect.apply(allocate, this, []);
    if (!isTarget(rt)) throw new Error('PMREM allocated no target');
    rt.depthBuffer = true; // as fromScene
    track(rt); track(Reflect.get(this, '_pingPongRenderTarget'));
    return rt;
  });
  return live;
}

/** a page's shared sky state, as SkyRig binds it */
function pageTargets(): SkyBackdropTargets {
  return {
    sunDir: new Vector3(0, 1, 0), sunColor: new Color(1, 1, 1), lights: [new DirectionalLight(0xffffff, 3)],
    lightDirection: new Vector3(0, -1, 0), hemi: new HemisphereLight(0x8899aa, 0x443322, 1), fog: new Fog(0xaabbcc, 1, 1e6),
    fogU: { fogSunDir: { value: new Vector3(0, 1, 0) }, fogSunColor: { value: new Color(1, 0.9, 0.8) }, fogDistDensity: { value: 0.001 }, fogHeightDensity: { value: 0.02 } },
    underwater: () => false, disc: new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xffffee })), halo: new Sprite(new SpriteMaterial({ color: 0xffeecc, opacity: 0.5 })),
    cloud: { uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color(1, 1, 1) }, uCloudLit: { value: new Color(1, 1, 1) }, uCloudAlpha: { value: 0.6 } },
    far: { uHazeCol: { value: new Color(0.6, 0.7, 0.8) }, uSeaSky: { value: new Color(0.5, 0.6, 0.7) }, uSeaSun: { value: new Color(1, 1, 1) }, uSeaSunDir: { value: new Vector3(0, 1, 0) } },
    planet: { uSunDir: { value: new Vector3(0, 1, 0) }, uHaze: { value: new Color(0.2, 0.2, 0.3) }, uCrisp: { value: 1 } },
    shadowBusy: () => false,
  };
}

it('frees Driftwood\'s PMREM environment and generator with its region: live cube-UV targets stay flat over N crossings', async () => {
  const live = stubPmrem();
  const liveBytes = (): number => [...live.values()].reduce((sum, b) => sum + b, 0);
  const page = new Scene(), targets = pageTargets(), camera = new PerspectiveCamera(), allocator = new ResidencyAllocator();
  const sky = { sunDir: new Vector3(0, 1, 0) } as SkyRig;
  const renderer = {} as WebGLRenderer;
  const level = { id: 'sf57-pmrem', /* no learned LUT to fetch */ sky: { envIntensity: 0.6, sunIntensity: 2.7 } } as LevelSpec;
  const hung: FrameSkyLayer[] = [];
  const port = { contribute: () => () => undefined, sky: (_: string, layer: FrameSkyLayer) => { hung.push(layer); return () => { hung.splice(hung.indexOf(layer), 1); }; } };
  const perVisit: { peak: number; peakBytes: number; reserved: number; census: number }[] = [];
  for (let crossing = 0; crossing < 6; crossing++) {
    const scope = new Scope('resident');
    const made: { layer: BackdropLayer | null } = { layer: null };
    const outcome = await buildRegionSky({
      instance: 'driftwood', look: port, allocator, scope,
      layered: async () => {
        const layer = new BackdropLayer({ targets, scene: page }, { owner: scope, onDispose: () => undefined });
        made.layer = layer;
        const backdrop = await STYLIZED_BACKDROP({ sky, scene: layer.holder, renderer, level, tier: 'phone', look: null });
        return { layer, backdrop };
      },
    });
    expect(outcome).toBe('drawn');
    const reserved = allocator.entries().find((e) => e.id === regionSkyClaimId('driftwood'))?.bytes ?? 0;
    let peak = live.size, peakBytes = liveBytes();
    // inside the cell: the clock re-renders its environment every 15 s
    hung[0]?.weight(1);
    const drawn = made.layer;
    if (drawn === null) throw new Error('no layer');
    for (let frame = 0; frame < 4; frame++) {
      drawn.apply(16, camera)?.();
      peak = Math.max(peak, live.size); peakBytes = Math.max(peakBytes, liveBytes());
    }
    perVisit.push({ peak, peakBytes, reserved, census: drawn.bytes() });
    scope.dispose(); // the region leaves
    expect(live.size, `crossing ${crossing}: PMREM targets left behind`).toBe(0);
    expect(liveBytes()).toBe(0);
    expect(hung).toHaveLength(0);
  }
  // each visit holds one environment target (colour + depth) and the generator's ping-pong, never more; the region's claim covers it
  for (const v of perVisit) {
    expect(v.peak).toBe(2);
    expect(v.peakBytes).toBe(336 * 256 * 12 + 336 * 256 * 8);
    expect(v.census).toBe(v.peakBytes); // its census is the targets it holds
    expect(v.reserved).toBeGreaterThanOrEqual(v.peakBytes);
  }
});
