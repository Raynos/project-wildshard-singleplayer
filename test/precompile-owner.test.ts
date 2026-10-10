import { expect, it, vi } from 'vitest';
import { CubeUVReflectionMapping, DataTexture, Group, PointLight, PerspectiveCamera, Scene, WebGLRenderTarget, WebGLRenderer } from 'three';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import type { ProgramLike } from '../src/engine/boot/perflog';
import { collectTextures, includeFutureLights, runPrecompile, type CompileJob } from '../src/engine/render/precompile';

it('cancels a yielded compile before resolving programs or uploading textures, restoring scene and target', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const uniforms = vi.fn(), programs: ProgramLike[] = [], scene = new Scene(), fog = scene.fog;
  const roadEnvironment = new DataTexture(), futureEnvironment = new DataTexture();
  scene.environment = roadEnvironment;
  const previous = new WebGLRenderTarget(), setTarget = vi.fn(); let current = true;
  // The real batching/cancellation path uses this renderer command recorder, not a WebGL context.
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  const commands = { extensions: { has: () => false }, info: { programs }, getRenderTarget: () => previous,
    setRenderTarget: setTarget, compile: () => { expect(scene.environment).toBe(futureEnvironment); programs.push({ type: 'ShaderMaterial', name: 'fixture', cacheKey: 'fixture', usedTimes: 1, id: 1,
      isReady: () => true, program: {}, getUniforms: uniforms }); } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try {
    await expect(runPrecompile(renderer, new PerspectiveCamera(), [{ label: 'fixture', root: new Group(), target: scene, rt: null, fogOff: true, environment: futureEnvironment }], 0,
      () => { expect(scene.environment).toBe(roadEnvironment); current = false; }, [], () => current)).rejects.toThrow('Shader warm-up owner left');
    expect(uniforms).not.toHaveBeenCalled(); expect(setTarget).toHaveBeenLastCalledWith(previous); expect(scene.fog).toBe(fog);
    expect(scene.environment).toBe(roadEnvironment);
  } finally { installScopeEnvironment(prior); previous.dispose(); roadEnvironment.dispose(); futureEnvironment.dispose(); }
});

it('borrows the admitted future PMREM layout for world jobs without changing the road or unrelated targets', async () => {
  const page = new Scene(), future = new Scene(), post = new Scene();
  const road = new DataTexture(new Uint8Array(4), 1, 256), entered = new DataTexture(new Uint8Array(4), 1, 512);
  road.mapping = CubeUVReflectionMapping; entered.mapping = CubeUVReflectionMapping;
  page.environment = road; future.environment = entered;
  const jobs: CompileJob[] = [{ label: 'world', root: new Group(), target: page, rt: null },
    { label: 'post', root: new Group(), target: post, rt: null }];
  includeFutureLights(jobs, page, future);
  expect(jobs[0]?.environment).toBe(entered); expect(jobs[1]?.environment).toBeUndefined();
  expect(page.environment).toBe(road); expect(future.environment).toBe(entered);
  expect(collectTextures(jobs)).toEqual([road, entered]);
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  const failure = new Error('driver compile failed');
  const commands = { extensions: { has: () => false }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget: () => undefined, compile: () => { expect(page.environment).toBe(entered); throw failure; } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try { await expect(runPrecompile(renderer, new PerspectiveCamera(), jobs, 0)).rejects.toBe(failure); }
  finally { expect(page.environment).toBe(road); road.dispose(); entered.dispose(); }
});

it('warms the whole parked view while borrowing the bound native scene environment', () => {
  const page = new Scene(), view = new Group(), native = new Scene(), authored = new Group(), environment = new DataTexture();
  page.add(new PointLight(), new PointLight(), view); view.visible = false; view.add(native, authored);
  native.environment = environment; authored.add(new PointLight());
  const hidden = new Group(); hidden.visible = false; hidden.add(new PointLight()); authored.add(hidden);
  const root = new Group(), job: CompileJob = { label: 'world', root, target: page, rt: null };
  includeFutureLights([job], page, view, native.environment);
  expect(root.children.filter(object => object instanceof PointLight)).toHaveLength(1);
  expect(job.environment).toBe(environment); expect(view.visible).toBe(false); expect(page.environment).toBeNull();
  expect(authored.children[0]?.parent).toBe(authored); expect(native.environment).toBe(environment);
  environment.dispose();
});
