import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LIVE_PRECOMPILE_SLICE_MS, runPrecompile, type CompileJob } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

afterEach(() => { vi.restoreAllMocks(); });

/** `jobs` serial jobs that each cost `jobMs` of wall clock and issue one program; returns the pause index of each compile. */
async function compiledAt(jobs: number, jobMs: number, sliceMs?: number): Promise<number[]> {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  let now = 0, pauses = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const compiled: number[] = [], programs: unknown[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Expected renderer prototype');
  let target: THREE.WebGLRenderTarget | null = null;
  const commands = { extensions: { has: () => false }, info: { programs }, toneMapping: THREE.NoToneMapping,
    getRenderTarget: () => target, setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; },
    compile: () => { compiled.push(pauses); now += jobMs; programs.push({ isReady: () => true, getUniforms: () => undefined }); } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const list: CompileJob[] = Array.from({ length: jobs }, (_, i) => ({ label: `job ${String(i)}`, root: new THREE.Group(), target: null, rt: null }));
  try {
    await runPrecompile(renderer, new THREE.PerspectiveCamera(), list, 0, undefined, [], () => true, false,
      () => { pauses++; return Promise.resolve(); }, undefined, undefined, sliceMs);
  } finally { installScopeEnvironment(prior); }
  return compiled;
}

it('boot keeps the 12 ms slice: two 7 ms jobs share a painted slice', async () => {
  expect(await compiledAt(6, 7)).toEqual([0, 0, 1, 1, 2, 2]);
});

it('a live desktop warm-up ends its slice after each unit past its smaller bound', async () => {
  expect(LIVE_PRECOMPILE_SLICE_MS).toBeLessThan(12);
  expect(await compiledAt(6, 7, LIVE_PRECOMPILE_SLICE_MS)).toEqual([0, 1, 2, 3, 4, 5]);
  // cheap units still share a slice up to the bound
  expect(await compiledAt(6, 2, LIVE_PRECOMPILE_SLICE_MS)).toEqual([0, 0, 0, 0, 1, 1]);
});
