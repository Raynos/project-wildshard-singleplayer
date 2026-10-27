import { expect, test, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { ProgramLike } from '../boot/perflog';
import { noteFrameDrawn, setBuildHeld } from '../core/framePacing';
import { runPrecompile, type CompileJob, type PrecompileStage } from './precompile';
import { linkedGl } from '../test/linkedGl';

async function schedule(options: { held?: boolean; cost?: number; prepare?: boolean; cancel?: boolean; retireTarget?: boolean }) {
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing renderer');
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), root = new Scene();
  root.add(new Mesh(geometry, material));
  let now = 1000, frame = 0, cost = 0, current = true, uniforms = 0;
  const issued: number[] = [], stages: { phase: string; units: number }[] = [];
  const target = options.retireTarget === true ? new WebGLRenderTarget(1, 1) : null;
  let activeTarget: WebGLRenderTarget | null = null;
  const program: ProgramLike = { type: 'test', name: 'cached', cacheKey: 'cached', usedTimes: 1, id: 1,
    program: {}, isReady: () => true, getUniforms: () => { uniforms++; return {}; } };
  const fields: Record<string, unknown> = {
    info: { programs: [program], render: { frame: 0 } }, extensions: { has: () => false },
    properties: { get: () => ({ programs: new Map([['cached', program]]) }), has: () => true },
    getContext: linkedGl, getRenderTarget: () => activeTarget,
    setRenderTarget: (value: WebGLRenderTarget | null) => { activeTarget = value; },
    compile: () => { issued.push(frame); now += cost; },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const pause = (): Promise<void> => {
    frame++; now = 1000 + frame * (1000 / 30); noteFrameDrawn(now, now, 30);
    if (options.cancel === true) current = false;
    if (options.retireTarget === true) target?.dispose();
    return Promise.resolve();
  };
  const observe: PrecompileStage = (phase, _ms, units) => { stages.push({ phase, units }); };
  const job: CompileJob = { label: 'cached', root, target: null, rt: target };
  try {
    noteFrameDrawn(now, now, 30); setBuildHeld(true);
    // Only a completed first-use/link fence can qualify an existing program.
    await runPrecompile(renderer, new PerspectiveCamera(), [job], 1, undefined, [], () => true, true, pause);
    expect(uniforms).toBe(1);
    now = 1000; frame = 0; current = true; issued.length = 0;
    cost = options.cost ?? 3; noteFrameDrawn(now, now, 30); setBuildHeld(options.held ?? true);
    const jobs = Array.from({ length: 9 }, () => ({ ...job, ...(options.prepare === true ? { prepare: () => undefined } : {}) }));
    const warming = runPrecompile(renderer, new PerspectiveCamera(), jobs, 1, undefined, [], () => current, true,
      pause, undefined, observe, 6);
    await (options.cancel === true ? expect(warming).rejects.toThrow('Shader warm-up owner left') : warming);
    expect(uniforms).toBe(1);
    expect(activeTarget).toBeNull();
    return { issued, cached: stages.find(stage => stage.phase === 'cached-compile')?.units ?? 0 };
  } finally {
    setBuildHeld(false); clock.mockRestore(); noteFrameDrawn(Number.NEGATIVE_INFINITY);
    geometry.dispose(); material.dispose(); target?.dispose();
  }
}

test('held cached jobs share a frame only until its unchanged 24 ms native budget', async () => {
  const result = await schedule({});
  expect(result.issued).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1]);
  expect(result.cached).toBe(9);
});

test('moving frames retain the explicit shader slice', async () => {
  const result = await schedule({ held: false });
  expect(result.issued).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  expect(result.cached).toBe(0);
});

test('slow cached jobs retain one native unit per completed frame', async () => {
  const result = await schedule({ cost: 12 });
  expect(result.issued).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(result.cached).toBe(0);
});

test('custom preparation never qualifies as a cached-only job', async () => {
  const result = await schedule({ prepare: true });
  expect(result.issued).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  expect(result.cached).toBe(0);
});

test('the shared native-budget pause retains the owner cancellation fence', async () => {
  const result = await schedule({ cancel: true });
  expect(result.issued).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
});

test('a disposed target cannot retain its cached preparation receipt', async () => {
  const result = await schedule({ retireTarget: true });
  expect(result.issued).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  expect(result.cached).toBe(0);
});
