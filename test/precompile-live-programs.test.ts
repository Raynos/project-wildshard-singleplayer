import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LIVE_PROGRAMS_PER_FRAME, runPrecompile, type CompileJob } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

afterEach(() => { vi.restoreAllMocks(); });

/** Run `jobs` jobs that each issue `perJob` programs, on a frozen clock (the 12 ms box never closes). Returns the pause
 * index at which each job compiled and each program resolved. */
async function slices(jobs: number, perJob: number, live: boolean, linkDelay = 0): Promise<{ compiled: number[]; resolved: number[] }> {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let pauses = 0;
  const compiled: number[] = [], resolved: number[] = [], programs: unknown[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Expected renderer prototype');
  let target: THREE.WebGLRenderTarget | null = null;
  const commands = { extensions: { has: () => linkDelay > 0 }, info: { programs }, toneMapping: THREE.NoToneMapping,
    getRenderTarget: () => target, setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; },
    compile: () => {
      compiled.push(pauses);
      const issuedAt = pauses;
      for (let i = 0; i < perJob; i++) programs.push({ isReady: () => pauses >= issuedAt + linkDelay, getUniforms: () => { resolved.push(pauses); } });
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const list: CompileJob[] = Array.from({ length: jobs }, (_, i) => ({ label: `job ${String(i)}`, root: new THREE.Group(), target: null, rt: null }));
  try { await runPrecompile(renderer, new THREE.PerspectiveCamera(), list, 0, undefined, [], () => true, live, () => { pauses++; return Promise.resolve(); }); }
  finally { installScopeEnvironment(prior); }
  return { compiled, resolved };
}

it('a live WebKit warm-up separates jobs and resolves at most one ready link per painted slice', async () => {
  expect(LIVE_PROGRAMS_PER_FRAME).toBe(1);
  const { compiled, resolved } = await slices(5, 2, true);
  // A material may issue two side variants; no following job shares that slice.
  expect(compiled).toEqual([0, 1, 2, 3, 4]);
  // Query resolution is bounded independently of the clock and compile-job count.
  expect(resolved).toEqual(Array.from({ length: 10 }, (_, i) => i));
});

it('pipelines ready older links while issuing new jobs without resolving an incomplete link', async () => {
  const { compiled, resolved } = await slices(5, 1, true, 1);
  expect(compiled).toEqual([0, 1, 2, 3, 4]);
  expect(resolved).toEqual([1, 2, 3, 4, 5]);
});

it('boot and other browsers keep the 12 ms box alone', async () => {
  const { compiled, resolved } = await slices(5, 2, false);
  expect(compiled).toEqual([0, 0, 0, 0, 0]);
  expect(resolved).toEqual(Array.from({ length: 10 }, () => 1));
});


it('bounds parallel completion queries and never revisits resolved borrowed programs', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let frame = 0;
  const reads: number[] = [], resolutions: number[] = [];
  const programs = Array.from({ length: 3 }, () => ({ isReady: () => { reads.push(frame); return true; }, getUniforms: () => { resolutions.push(frame); } }));
  const material = new THREE.MeshBasicMaterial(), geometry = new THREE.PlaneGeometry();
  const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, material));
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Renderer prototype');
  const issued: typeof programs = [];
  const commands = { extensions: { has: () => true }, info: { programs: issued }, properties: { get: () => ({ currentProgram: programs[0] }) },
    getRenderTarget: () => null, setRenderTarget: () => undefined, compile: () => { for (const program of programs) if (!issued.includes(program)) issued.push(program); } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const run = () => runPrecompile(renderer, new THREE.PerspectiveCamera(), [{ label: 'parallel', root, target: null, rt: null }], 1, undefined, [], () => true, true, () => { frame++; return Promise.resolve(); });
  try {
    await run();
    expect(reads).toEqual([0, 1, 2]);
    expect(resolutions).toEqual([0, 1, 2]);
    await run();
    expect(reads).toEqual([0, 1, 2]);
    expect(resolutions).toEqual([0, 1, 2]);
  } finally { material.dispose(); geometry.dispose(); installScopeEnvironment(prior); }
});

it('waits for a pending parallel link before first use and fences a retired owner', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let frame = 0, alive = true;
  const reads: number[] = [], resolutions: number[] = [], programs: unknown[] = [];
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Renderer prototype');
  const commands = { extensions: { has: () => true }, info: { programs },
    getRenderTarget: () => null, setRenderTarget: () => undefined,
    compile: () => { programs.push({ isReady: () => { reads.push(frame); return false; }, getUniforms: () => { resolutions.push(frame); } }); } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try {
    await expect(runPrecompile(renderer, new THREE.PerspectiveCamera(), [{ label: 'pending', root: new THREE.Group(), target: null, rt: null }], 0,
      undefined, [], () => alive, true, () => { frame++; if (frame === 3) alive = false; return Promise.resolve(); })).rejects.toThrow('Shader warm-up owner left');
    expect(reads).toEqual([0, 1, 2]);
    expect(resolutions).toEqual([]);
  } finally { installScopeEnvironment(prior); }
});
