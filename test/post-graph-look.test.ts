import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { TextureEffect } from 'postprocessing';
import * as v from 'valibot';
import { bindPostGraphEvents, postGraphLook } from '../src/game/looks/postGraphLook';
import { PostGraphLookSchema, type PostGraphLookRow } from '../src/format/postGraphLook';
import type { ScaledPostRow } from '../src/format/scaledPost';
import { lendUniforms } from '../src/game/shardfile/lentLooks';
import { prepareScaledPost } from '../src/game/looks/scaledPost';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function renderer(pixelRatio: number): THREE.WebGLRenderer {
  const result: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(result instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    setNodesHandler: () => undefined, getDrawingBufferSize: (target: THREE.Vector2) => target.set(400, 800), getViewport: (target: THREE.Vector4) => target.set(0, 0, 400, 800),
    extensions: { has: () => false, get: () => null }, getContext: () => ({ getParameter: () => 65536 }), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
    getPixelRatio: () => pixelRatio, setRenderTarget: () => undefined, render: () => undefined,
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(result, key, value);
  return result;
}

/** an orchard's dusk: a half-size glow side on the desktop and a composite that reads it and the orchard's live air */
const copy = (param: string): ScaledPostRow['programs'][string] => ({ graph: { version: 1, kind: 'post', nodes: { uv: { op: 'screenUV' }, colour: { op: 'texture', in: ['uv'], param }, rgb: { op: 'swizzle', in: ['colour'], mask: 'xyz' } },
  params: { [param]: { type: 'texture', role: 'lent', value: param } }, stages: { post: { colour: 'rgb', alpha: 1 } } } });
const glow: ScaledPostRow = { name: 'OrchardGlow', programs: { copy: copy('tSrc') }, targets: { half: { name: 'Orchard.half', of: 'input', scale: .5, filter: 'linear' } },
  draws: [{ program: 'copy', to: 'half', textures: { tSrc: 'input' } }], settings: {}, outputs: { glow: 'half' } };
const frame: ScaledPostRow = { name: 'OrchardFrame', programs: { copy: { ...copy('tGlow'), links: ['tGlow'] } }, targets: { out: { name: 'Orchard.out', of: 'input', scale: 1, filter: 'nearest' } },
  draws: [{ program: 'copy', to: 'out' }], settings: {}, outputs: { frame: 'out' } };
const ROW = {
  passes: { glow, frame }, composite: { pass: 'frame', output: 'frame' }, live: 'orchard-air',
  sides: [{ pass: 'glow', tiers: ['desktop'], constants: { uDusk: { v4: [1, 2, 3, 4] } }, params: { time: 'uClock', ground: 3 } }],
  inputs: { tGlow: { side: 'glow', output: 'glow' } }, flags: { uHasGlow: { inputs: ['tGlow'], on: 4 } },
  uniforms: { uHasGlow: 0, uDrizzle: { v4: [0.5, 0, 0, 1] }, uSharp: 0 }, aliases: { mist: 'uMist' },
  pixel: [{ of: 'ratio', param: 'uLine', scale: 0.5, below: { at: 2.5, times: 1.5 } }, { of: 'ratio', param: 'uDrizzle', index: 3 },
    { of: 'step', param: 'uSharp', at: 2.5, below: 0.3, above: 0 }, { of: 'buffer', param: 'uRes' }],
  events: [{ event: 'explore.studio', on: { set: [{ param: 'uDrizzle', index: 0, value: 0 }], hold: [{ param: 'uMist', value: 0 }, { param: 'uRows', index: 2, each: true, value: 0 }], display: 0 },
    off: { set: [{ param: 'uDrizzle', index: 0, value: 0.5 }], display: 1 } }],
  sky: { clouds: true, planet: false },
} satisfies PostGraphLookRow;
const product = { slug: 'orchard', json: () => Promise.resolve(structuredClone({ look: { post: ROW } })) };
const air = () => ({ uClock: { value: 2 }, uMist: { value: 0.7 }, uLine: { value: 0 }, uRes: { value: new THREE.Vector2() },
  uRows: { value: [new THREE.Vector4(0, 0, 5, 0), new THREE.Vector4(0, 0, 6, 0)] } });

test('a post-graph look admits plain rows and refuses executable or unbounded ones', () => {
  expect(v.safeParse(PostGraphLookSchema, ROW).success).toBe(true);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, uniforms: { uHasGlow: Number.NaN } }).success).toBe(false);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, frame: () => undefined }).success).toBe(false);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, sides: [{ pass: 'glow', tiers: ['watch'] }] }).success).toBe(false);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, sides: [{ bloom: 'bloom', tiers: ['desktop'], threshold: 1, smoothing: 0.1, radius: 0.5 }], scene: {} }).success).toBe(true);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, sides: [{ bloom: 'bloom', tiers: ['desktop'], threshold: Number.POSITIVE_INFINITY, smoothing: 0.1, radius: 0.5 }] }).success).toBe(false);
  expect(v.safeParse(PostGraphLookSchema, { ...ROW, lut: { url: 'https://example.com/lut.bin', texture: 'uLut', amount: 'uLutAmt' } }).success).toBe(false);
});

test('a grid cell runs the sides on their tiers, lends their outputs and raises the flags', async () => {
  const look = await postGraphLook(product, { file: 'look.json', field: ['look', 'post'] });
  expect(look.sky).toEqual({ clouds: true, planet: false });
  const scope = new Scope('orchard'), live = air(), camera = new THREE.PerspectiveCamera(), input = new THREE.WebGLRenderTarget(800, 1600);
  lendUniforms(scope, 'orchard-air', live);
  const render = renderer(2);
  await prepareScaledPost(render);
  try {
    expect(() => look.cell?.build({ root: new THREE.Group(), camera, renderer: render, tier: 'desktop', scope: new Scope('elsewhere') })).not.toThrow();
    for (const tier of ['desktop', 'phone'] as const) {
      const built = look.cell?.build({ root: new THREE.Group(), camera, renderer: render, tier, scope });
      if (built === undefined) throw new Error('Missing cell composite');
      const passes = built.passes ?? [];
      expect(passes.map(pass => pass.name)).toEqual(tier === 'desktop' ? ['PostGraphPoseView', 'OrchardGlow', 'PostGraphInputs', 'OrchardFrame'] : ['PostGraphPoseView', 'PostGraphInputs', 'OrchardFrame']);
      for (const pass of passes) { pass.setSize(800, 1600); pass.render(render, input, input); }
      const composite = passes.at(-1), inputs = passes.at(-2);
      if (composite === undefined || inputs === undefined) throw new Error('Missing composite passes');
      expect(built.display).toBeInstanceOf(TextureEffect);
    }
    look.frame?.(0, 0);
    expect(live.uLine.value).toBeCloseTo(2 * 0.5 * 1.5);
    expect(live.uRes.value.toArray()).toEqual([400, 800]);
  } finally { scope.dispose(); input.dispose(); }
});

test('the event edges write the bag, hold values and restore them when the look goes', () => {
  const bag: Record<string, THREE.IUniform> = { ...air(), uDrizzle: { value: new THREE.Vector4(0.5, 0, 0, 1) } };
  const events = new Events(), scope = new Scope('orchard-events'), display = new TextureEffect();
  bindPostGraphEvents(ROW.events, bag, display, events, scope);
  const rows = (): unknown[] => { const value: unknown = bag['uRows']?.value; return Array.isArray(value) ? value.map((row: unknown) => row instanceof THREE.Vector4 ? row.z : null) : []; };
  events.emit('explore.studio', true); events.flush('update');
  expect(bag['uMist']?.value).toBe(0);
  expect(rows()).toEqual([0, 0]);
  expect(display.blendMode.opacity.value).toBe(0);
  events.emit('explore.studio', true); events.flush('update');
  events.emit('explore.studio', false); events.flush('update');
  expect(bag['uMist']?.value).toBe(0.7);
  expect(rows()).toEqual([5, 6]);
  expect(display.blendMode.opacity.value).toBe(1);
  events.emit('explore.studio', true); events.flush('update');
  scope.dispose();
  expect(bag['uMist']?.value).toBe(0.7);
  display.dispose();
});

test('a look that names no lent uniforms or an unknown alias refuses at build', async () => {
  const look = await postGraphLook({ slug: 'orchard', json: () => Promise.resolve(structuredClone({ post: { ...ROW, live: 'nobody' } })) }, { file: 'look.json', field: ['post'] });
  const render = renderer(3);
  await prepareScaledPost(render);
  expect(() => look.cell?.build({ root: new THREE.Group(), camera: new THREE.PerspectiveCamera(), renderer: render, tier: 'phone', scope: new Scope('x') })).toThrow('No lent uniforms nobody');
});
