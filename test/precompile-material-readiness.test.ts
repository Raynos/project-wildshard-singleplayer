import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { registerMaterialPreparation, waitMaterialPreparations } from '../src/engine/render/materialPreparation';
import { collectTextures, runPrecompile, sceneJobs } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { createFireFx } from '../src/game/systems/looks/fireFx';
import { FIRE_STYLE } from '../src/shards/sunscar-dunes/data/fire';

function deferred(): { work: Promise<void>; finish: () => void } {
  let finish = (): void => { throw new Error('Uninitialized deferred work'); };
  const work = new Promise<void>(resolve => { finish = resolve; });
  return { work, finish };
}

function installBitmapDecoder(decode: () => Promise<object>): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: decode });
  return () => { if (previous === undefined) Reflect.deleteProperty(globalThis, 'createImageBitmap');
    else Object.defineProperty(globalThis, 'createImageBitmap', previous); };
}

it('uploads a delayed uniform resource before compiling/drawing, with the exact texture and sampler', async () => {
  const previous = scopeEnvironment(), events: string[] = [], fetched = deferred();
  const bitmap = { width: 2048, height: 2048 };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { await fetched.work; return new Response(new Blob(['fixture'])); });
  const decode = vi.fn().mockResolvedValue(bitmap), restoreDecoder = installBitmapDecoder(decode);
  installScopeEnvironment({ targetKind: () => 'other', frame: render => {
    queueMicrotask(() => { render(0); }); return 1;
  }, cancelFrame: () => undefined });
  const fx = createFireFx(FIRE_STYLE), dispose = fx.loadBook();
  const material = fx.resources[0];
  if (!(material instanceof THREE.ShaderMaterial)) throw new Error('Expected flame shader');
  const shader = [material.vertexShader, material.fragmentShader];
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
  const plan = sceneJobs(scene, null), uploaded: THREE.Texture[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
  Reflect.set(renderer, 'extensions', { has: () => false });
  Reflect.set(renderer, 'info', { programs: [] });
  Reflect.set(renderer, 'getRenderTarget', () => null); Reflect.set(renderer, 'setRenderTarget', () => undefined);
  Reflect.set(renderer, 'compile', () => { events.push('compile'); expect(collectTextures(plan.jobs)).toHaveLength(1); });
  Reflect.set(renderer, 'initTexture', (texture: THREE.Texture) => { events.push('upload'); uploaded.push(texture); });
  try {
    expect(collectTextures(plan.jobs)).toEqual([]);
    const warming = runPrecompile(renderer, new THREE.PerspectiveCamera(), plan.jobs, plan.materials);
    await Promise.resolve(); expect(events).toEqual([]);
    fetched.finish(); await warming;
    expect(events).toEqual(['compile', 'upload']);
    const texture = uploaded[0]; if (texture === undefined) throw new Error('Missing flipbook upload');
    expect(texture.name).toBe('sunscar.fire.book');
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter); expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.generateMipmaps).toBe(true);
    const book: unknown = material.uniforms['uBook']?.value; expect(book).toBe(texture);
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: 'flipY' });
    expect([material.vertexShader, material.fragmentShader]).toEqual(shader);
    await waitMaterialPreparations([material], () => true);
  } finally { dispose(); fetcher.mockRestore(); restoreDecoder(); installScopeEnvironment(previous); }
});

it('keeps the procedural fallback on failure and never publishes a retired fetch', async () => {
  const fetched = deferred(), warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { await fetched.work; return new Response(null, { status: 404 }); });
  const fx = createFireFx(FIRE_STYLE), dispose = fx.loadBook();
  try {
    dispose(); fetched.finish();
    const materials = fx.resources.filter((material): material is THREE.ShaderMaterial => material instanceof THREE.ShaderMaterial);
    await waitMaterialPreparations(materials, () => true);
    expect(materials[0]?.uniforms['uBook']?.value).toBeNull(); expect(materials[0]?.uniforms['uHasBook']?.value).toBe(0);
    expect(warned).toHaveBeenCalledOnce();
  } finally { fetcher.mockRestore(); warned.mockRestore(); }
});

it('discards a successful decode if its effect retired before publication', async () => {
  const fetched = deferred();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { await fetched.work; return new Response(new Blob(['fixture'])); });
  const restoreDecoder = installBitmapDecoder(() => Promise.resolve({ width: 2048, height: 2048 }));
  const fx = createFireFx(FIRE_STYLE), dispose = fx.loadBook();
  try {
    dispose(); fetched.finish();
    const materials = fx.resources.filter((material): material is THREE.ShaderMaterial => material instanceof THREE.ShaderMaterial);
    await waitMaterialPreparations(materials, () => true);
    expect(materials[0]?.uniforms['uBook']?.value).toBeNull(); expect(materials[0]?.uniforms['uHasBook']?.value).toBe(0);
  } finally { fetcher.mockRestore(); restoreDecoder(); }
});

it('fences an owner leaving during a successful pending load', async () => {
  const material = new THREE.MeshBasicMaterial(), pending = deferred(); let current = true;
  registerMaterialPreparation(material, pending.work);
  const waiting = waitMaterialPreparations([material], () => current);
  current = false; pending.finish();
  await expect(waiting).rejects.toThrow('Shader warm-up owner left');
});

it('waits for a second resource published by the first load and propagates strict failure', async () => {
  const material = new THREE.MeshBasicMaterial(), first = deferred(), second = deferred();
  registerMaterialPreparation(material, first.work.then(() => { registerMaterialPreparation(material, second.work); return undefined; }));
  let ready = false;
  const waiting = waitMaterialPreparations([material], () => true).then(() => { ready = true; return undefined; });
  first.finish(); await first.work; await Promise.resolve(); expect(ready).toBe(false);
  second.finish(); await waiting; expect(ready).toBe(true);
  registerMaterialPreparation(material, Promise.reject(new Error('Missing required resource')));
  await expect(waitMaterialPreparations([material], () => true)).rejects.toThrow('Missing required resource');
  await waitMaterialPreparations([material], () => true);
});
