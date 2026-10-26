import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real Game method without constructing a GPU renderer.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Strip only the actual method's types for the controlled renderer fixture.
import { stripTypeScriptTypes } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute repository source with explicit preparation ports, never a copied implementation.
import { runInNewContext } from 'node:vm';
import { DataTexture, Group, Scene, type Object3D } from 'three';
import { Scope } from '../app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../app/scopeEnvironment';
import { boundEntryWarmup } from '../render/entryWarmupBound';

const original = scopeEnvironment();
afterEach(() => { installScopeEnvironment(original); });

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let finish: () => void = () => undefined;
  const promise = new Promise<void>(resolve => { finish = resolve; });
  return { promise, resolve: () => { finish(); } };
}

async function settled(promise: Promise<unknown>): Promise<unknown> {
  try { await promise; return null; } catch (error) { return error; }
}

type Prepare = (roots: readonly Object3D[]) => Promise<void>;
function fixture(early: () => Promise<void> = () => Promise.resolve(), final: () => Promise<void> = () => Promise.resolve()) {
  const source = readFileSync(new URL('Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  async warmEnteredFrame('), end = source.indexOf('\n  private async ', start);
  if (start === -1 || end < start) throw new Error('Entered-frame method missing');
  const method: unknown = runInNewContext(stripTypeScriptTypes(`class Harness { ${source.slice(start, end)} }\nHarness.prototype.warmEnteredFrame`),
    { boundEntryWarmup, diagnosticNow: () => 0 });
  if (typeof method !== 'function') throw new Error('Entered-frame method is not callable');
  const owner = new Scope('overlap'), root = new Group(), scene = new Scene();
  const calls: string[] = [];
  let fence: () => boolean = () => true;
  let now = 0, next = 0;
  const frames = new Map<number, (at: number) => void>();
  installScopeEnvironment({ ...original, frame: draw => { const id = ++next; frames.set(id, draw); return id; },
    cancelFrame: id => { frames.delete(id); } });
  const game = { _composer: {}, scene, frameCount: 1, postPreparation: Promise.resolve(),
    async warmEnteredRoots(actualOwner: Scope, _composer: unknown, roots: readonly Object3D[], lighting: Object3D, current: () => boolean): Promise<void> {
      expect(actualOwner).toBe(owner); expect(roots).toEqual([root]); expect(lighting).toBe(root);
      fence = current; calls.push('world'); await early();
    },
    async warmEnteredStages(): Promise<void> { calls.push('final'); await final(); },
  };
  return { owner, root, game, calls, current: () => fence(),
    run: (before?: (prepare: Prepare) => Promise<void> | void): Promise<unknown> => Promise.resolve(Reflect.apply(method, game, [owner, root, before])),
    frame: (): void => { game.frameCount++; now += 100; const due = [...frames.values()]; frames.clear(); for (const draw of due) draw(now); },
  };
}

test('world programs run while content is pending and final inventory still gates readiness', async () => {
  const content = deferred(), prepared = deferred(), f = fixture();
  let finished = false;
  const run = f.run(async prepare => { await prepare([f.root]); prepared.resolve(); await content.promise; f.calls.push('complete-content'); });
  const observed = settled((async () => { await run; finished = true; })());
  try {
    expect(await Promise.race([prepared.promise.then(() => 'prepared'), observed])).toBe('prepared');
    expect(f.calls).toEqual(['world']); expect(finished).toBe(false);
    content.resolve(); await run;
    expect(f.calls).toEqual(['world', 'complete-content', 'final']); expect(finished).toBe(true);
  } finally { content.resolve(); f.owner.dispose(); await observed; }
});

test('early preparation and final preparation share the original total deadline', async () => {
  const prepared = deferred(), content = deferred(), final = deferred(), enteredFinal = deferred();
  const f = fixture(() => prepared.promise, () => { enteredFinal.resolve(); return final.promise; });
  const run = f.run(async prepare => { await prepare([f.root]); await content.promise; });
  const observed = settled(run);
  try {
    for (let i = 0; i < 120; i++) f.frame();
    prepared.resolve(); content.resolve();
    expect(await Promise.race([enteredFinal.promise.then(() => 'final'), observed])).toBe('final');
    for (let i = 0; i < 185; i++) f.frame();
    expect(String(await observed)).toMatch(/stalled in shaders-and-composer.*over 30000 ms/u);
    expect(f.current()).toBe(false);
  } finally { prepared.resolve(); content.resolve(); final.resolve(); f.owner.dispose(); await observed; }
});

test('retirement during the content rendezvous fences the abandoned final warm-up', async () => {
  const prepared = deferred(), content = deferred(), f = fixture();
  const run = f.run(async prepare => { await prepare([f.root]); prepared.resolve(); await content.promise; });
  const observed = settled(run);
  try {
    expect(await Promise.race([prepared.promise.then(() => 'prepared'), observed])).toBe('prepared');
    f.owner.dispose();
    expect(String(await observed)).toMatch(/owner left/u); expect(f.current()).toBe(false);
    content.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(f.calls).toEqual(['world']);
  } finally { content.resolve(); f.owner.dispose(); await observed; }
});

test('an early program refusal propagates without publishing a final frame', async () => {
  const f = fixture(() => Promise.reject(new Error('exact program refused')));
  try {
    await expect(f.run(prepare => prepare([f.root]))).rejects.toThrow('exact program refused');
    expect(f.calls).toEqual(['world']);
  } finally { f.owner.dispose(); }
});

test('early programs use the rendered page scene and the installing region environment', async () => {
  const source = readFileSync(new URL('Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  private async warmEnteredRoots('), end = source.indexOf('\n  private async ', start + 1);
  if (start === -1 || end < start) throw new Error('Early-root method missing');
  const loader = "await import('../render/precompile')", body = source.slice(start, end);
  if (!body.includes(loader)) throw new Error('Early-root loader port missing');
  const calls: unknown[][] = [];
  // Replace only module loading; execute the actual caller and capture its render inputs.
  const method: unknown = runInNewContext(stripTypeScriptTypes(`class Harness { ${body.replace(loader, 'preparation')} }\nHarness.prototype.warmEnteredRoots`),
    { preparation: { prepareSceneRoots: (...args: unknown[]): Promise<void> => { calls.push(args); return Promise.resolve(); },
      waitForDrawnFrame: () => Promise.resolve(), LIVE_UPLOAD_BUDGET: { ms: 6, bytes: 1 } } });
  if (typeof method !== 'function') throw new Error('Early-root method is not callable');
  const rootScene = new Scene(), regional = new Scene(), root = new Group(), owner = new Scope('regional-programs');
  const environment = new DataTexture(new Uint8Array(8), 1, 2); regional.environment = environment;
  const composer = { inputBuffer: null }, game = { rootScene, scene: regional, renderer: {}, camera: {}, frameCount: 1, _composer: composer };
  try {
    await Reflect.apply(method, game, [owner, composer, [root], root, () => !owner.disposed]);
    expect(calls).toHaveLength(1); expect(calls[0]?.[2]).toBe(rootScene);
    expect(calls[0]?.[4]).toEqual([root]); expect(calls[0]?.[9]).toBe(root); expect(calls[0]?.[10]).toBe(environment);
  } finally { owner.dispose(); environment.dispose(); }
});
