import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LIVE_PROGRAMS_PER_FRAME, runPrecompile, type CompileJob } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

afterEach(() => { vi.restoreAllMocks(); });

/** Run `jobs` jobs that each issue `perJob` programs, on a frozen clock (the 12 ms box never closes). Returns the pause
 * index at which each job compiled and each program resolved. */
async function slices(jobs: number, perJob: number, live: boolean): Promise<{ compiled: number[]; resolved: number[] }> {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let pauses = 0;
  const compiled: number[] = [], resolved: number[] = [], programs: unknown[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Expected renderer prototype');
  let target: THREE.WebGLRenderTarget | null = null;
  const commands = { extensions: { has: () => false }, info: { programs }, toneMapping: THREE.NoToneMapping,
    getRenderTarget: () => target, setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; },
    compile: () => {
      compiled.push(pauses);
      for (let i = 0; i < perJob; i++) programs.push({ isReady: () => true, getUniforms: () => { resolved.push(pauses); } });
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const list: CompileJob[] = Array.from({ length: jobs }, (_, i) => ({ label: `job ${String(i)}`, root: new THREE.Group(), target: null, rt: null }));
  try { await runPrecompile(renderer, new THREE.PerspectiveCamera(), list, 0, undefined, [], () => true, live, () => { pauses++; return Promise.resolve(); }); }
  finally { installScopeEnvironment(prior); }
  return { compiled, resolved };
}

it('a live WebKit warm-up issues and resolves at most LIVE_PROGRAMS_PER_FRAME programs a painted slice', async () => {
  expect(LIVE_PROGRAMS_PER_FRAME).toBe(4);
  const { compiled, resolved } = await slices(5, 2, true);
  // 2 programs a job: a slice closes once 4 are issued (jobs 1-2, 3-4, then the last job)
  expect(compiled).toEqual([0, 0, 1, 1, 2]);
  // 10 programs resolved 4 a slice, after the issue slices' 3 pauses
  expect(resolved).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 5, 5]);
});

it('boot and other browsers keep the 12 ms box alone', async () => {
  const { compiled, resolved } = await slices(5, 2, false);
  expect(compiled).toEqual([0, 0, 0, 0, 0]);
  expect(resolved).toEqual(Array.from({ length: 10 }, () => 1));
});
