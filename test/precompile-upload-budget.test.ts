import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { imageUploadBytes, runPrecompile, type UploadBudget } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

afterEach(() => { vi.restoreAllMocks(); });

/** Upload `sizes` (square RGBA data textures, side in texels) under isolation; each upload costs `msPerMiB` of fake
 * clock per MiB (isolated unless told). Returns each upload's pause index (how many pauses ran before it) and the pause count. */
async function batched(sizes: number[], budget: UploadBudget | undefined, msPerMiB = 1, isolated = true): Promise<{ batches: number[]; pauses: number }> {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  let now = 0, pauses = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const textures = sizes.map(side => {
    const texture = new THREE.DataTexture(new Uint8Array(side * side * 4), side, side);
    texture.generateMipmaps = false; texture.needsUpdate = true;
    return texture;
  });
  const batches: number[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Expected renderer prototype');
  const commands = { extensions: { has: () => false }, info: { programs: [] },
    initTexture: (texture: THREE.Texture) => { batches.push(pauses); now += imageUploadBytes(texture) / (1024 * 1024) * msPerMiB; } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const pause = (): Promise<void> => { pauses++; return Promise.resolve(); };
  try { await runPrecompile(renderer, new THREE.PerspectiveCamera(), [], 0, undefined, textures, () => true, isolated, pause, budget); }
  finally { installScopeEnvironment(prior); for (const texture of textures) texture.dispose(); }
  return { batches, pauses };
}

it('without a budget, isolation keeps one image per drawn frame', async () => {
  const { batches, pauses } = await batched([256, 256, 256], undefined);
  expect(batches).toEqual([0, 1, 2]); expect(pauses).toBe(3);
});

it('batches small images per drawn frame under the measured budget, with a frame after the last batch', async () => {
  // 256² RGBA = 0.25 MiB = 2.5 ms at 10 ms / MiB: the first measures the rate, then three fit an 8 ms frame.
  const { batches, pauses } = await batched([256, 256, 256, 256, 256, 256, 256], { ms: 8, bytes: 8 * 1024 * 1024 }, 10);
  expect(batches).toEqual([0, 0, 0, 1, 1, 1, 2]); expect(pauses).toBe(3);
});

it('uploads an image predicted over the budget alone, before and after', async () => {
  // 1024² = 4 MiB = 8 ms at 2 ms / MiB: over what is left after a small one, so it waits for a fresh frame.
  const { batches } = await batched([256, 1024, 256], { ms: 8, bytes: 64 * 1024 * 1024 }, 2);
  expect(batches).toEqual([0, 1, 2]);
});

it('caps a frame by decoded bytes whatever the measured time', async () => {
  const { batches } = await batched([512, 512, 512], { ms: 1000, bytes: 1.5 * 1024 * 1024 }, 0.01);
  expect(batches).toEqual([0, 1, 2]);
});

it('measures decoded bytes from image sizes, typed data, depth, faces and generated mips', () => {
  const sized = new THREE.Texture({ width: 64, height: 32 }); sized.generateMipmaps = false;
  expect(imageUploadBytes(sized)).toBe(64 * 32 * 4);
  const mipped = new THREE.Texture({ width: 64, height: 32 });
  expect(imageUploadBytes(mipped)).toBe(Math.round(64 * 32 * 4 * 4 / 3));
  const natural = new THREE.Texture({ naturalWidth: 10, naturalHeight: 10, width: 0, height: 0 }); natural.generateMipmaps = false;
  expect(imageUploadBytes(natural)).toBe(400);
  const data = new THREE.DataTexture(new Float32Array(16), 2, 2); data.generateMipmaps = false;
  expect(imageUploadBytes(data)).toBe(64);
  const layered = new THREE.Texture({ width: 8, height: 8, depth: 3 }); layered.generateMipmaps = false;
  expect(imageUploadBytes(layered)).toBe(8 * 8 * 3 * 4);
  const cube = new THREE.CubeTexture(Array.from({ length: 6 }, () => ({ width: 4, height: 4 }))); cube.generateMipmaps = false;
  expect(imageUploadBytes(cube)).toBe(6 * 4 * 4 * 4);
  expect(imageUploadBytes(new THREE.Texture())).toBe(0);
});

it('without isolation, a budget refuses to start an upload the slice cannot fit instead of checking 12 ms after it', async () => {
  const sliced = await batched([256, 256, 256, 256, 256], { ms: 10, bytes: 64 * 1024 * 1024 }, 10, false);
  expect(sliced.batches).toEqual([0, 0, 0, 0, 1]);
  const ordinary = await batched([256, 256, 256, 256, 256], undefined, 10, false);
  expect(ordinary.batches).toEqual([0, 0, 0, 0, 0]); expect(ordinary.pauses).toBe(1);
});
