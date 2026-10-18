import { afterEach, describe, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment, type ScopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { boundEntryWarmup, EntryWarmupStallError } from '../src/engine/render/entryWarmupBound';
import { waitForDrawnFrame } from '../src/engine/render/precompile';

/** A hand-driven rAF: `frame(ms)` advances the clock and runs every queued callback once. */
function manualFrames(): { frame: (ms: number) => void } {
  let now = 0, next = 1;
  const queued = new Map<number, (time: number) => void>();
  installScopeEnvironment({ ...scopeEnvironment(), frame: render => { const id = next++; queued.set(id, render); return id; },
    cancelFrame: id => { queued.delete(id); } });
  return { frame: ms => { now += ms; const due = [...queued.values()]; queued.clear(); for (const render of due) render(now); } };
}

/** A stage that never settles (a link that never reports complete). */
const never = (): Promise<void> => new Promise<void>(() => { /* never settles */ });

const original: ScopeEnvironment = scopeEnvironment();
afterEach(() => { installScopeEnvironment(original); });

const limits = { noFrameMs: 500, totalMs: 2000 };
const settled = async <T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> => {
  try { return { value: await promise }; } catch (error) { return { error }; }
};

describe('entered-frame warm-up bound', () => {
  it('resolves with the work while frames are drawn', async () => {
    const frames = manualFrames(), owner = new Scope('owner');
    let drawn = 1, finish: () => void = () => undefined;
    const run = boundEntryWarmup(owner, () => drawn, () => 'shaders', () => new Promise<string>(resolve => { finish = () => { resolve('done'); }; }), limits);
    for (let i = 0; i < 20; i++) { drawn++; frames.frame(16); }
    finish();
    expect(await run).toBe('done');
  });

  it('rejects naming the stage when the loop stops drawing, and fences the abandoned work', async () => {
    const frames = manualFrames(), owner = new Scope('owner');
    let fence: () => boolean = () => true;
    const run = settled(boundEntryWarmup(owner, () => 3, () => 'parked-draws', current => { fence = current; return never(); }, limits));
    for (let i = 0; i < 40; i++) frames.frame(16);
    const { error } = await run;
    expect(error).toBeInstanceOf(EntryWarmupStallError);
    expect(String(error)).toMatch(/stalled in parked-draws: no drawn frame/u);
    expect(fence()).toBe(false);
  });

  it('rejects a warm-up that keeps drawing but never finishes, past the total bound', async () => {
    const frames = manualFrames(), owner = new Scope('owner');
    let drawn = 1;
    const run = settled(boundEntryWarmup(owner, () => drawn, () => 'link', () => never(), limits));
    for (let i = 0; i < 200; i++) { drawn++; frames.frame(16); }
    expect(String((await run).error)).toMatch(/stalled in link: over 2000 ms/u);
  });

  it('never counts a hidden page: long rAF gaps add at most a capped slice', async () => {
    const frames = manualFrames(), owner = new Scope('owner');
    let finish: () => void = () => undefined;
    const run = boundEntryWarmup(owner, () => 2, () => 'shaders', () => new Promise<void>(resolve => { finish = resolve; }), limits);
    // three rAFs 10 s apart (an app switch): 200 ms of presented time, under both limits
    for (let i = 0; i < 3; i++) frames.frame(10000);
    finish();
    await expect(run).resolves.toBeUndefined();
  });

  it('a loop that has not drawn yet is held only by the total bound', async () => {
    const frames = manualFrames(), owner = new Scope('owner');
    let finish: () => void = () => undefined;
    const run = boundEntryWarmup(owner, () => 0, () => 'shaders', () => new Promise<void>(resolve => { finish = resolve; }), limits);
    for (let i = 0; i < 60; i++) frames.frame(16);
    finish();
    await expect(run).resolves.toBeUndefined();
  });

  it('passes the work error through and stops watching when the owner leaves', async () => {
    manualFrames();
    const owner = new Scope('owner');
    await expect(boundEntryWarmup(owner, () => 1, () => 'shaders', () => Promise.reject(new Error('Shader warm-up owner left')), limits))
      .rejects.toThrow('Shader warm-up owner left');
    let fence: () => boolean = () => true;
    const left = new Scope('left');
    const cancelled = settled(boundEntryWarmup(left, () => 1, () => 'shaders', current => { fence = current; return never(); }, limits));
    left.dispose();
    expect(fence()).toBe(false);
    expect(String((await cancelled).error)).toMatch(/owner left/u);
  });

  it('does not start work for an owner that already left', async () => {
    manualFrames();
    const owner = new Scope('left'); owner.dispose();
    let started = false;
    await expect(boundEntryWarmup(owner, () => 1, () => 'streamed-scene-roots', () => { started = true; return never(); }, limits))
      .rejects.toThrow('Shader warm-up owner left');
    expect(started).toBe(false);
  });

  it('bounds a streamed draw barrier even without an entered-frame caller', async () => {
    const frames = manualFrames(), owner = new Scope('far-view');
    const run = settled(waitForDrawnFrame(owner, () => 22, () => true));
    for (let i = 0; i < 320; i++) frames.frame(16);
    const { error } = await run;
    expect(error).toBeInstanceOf(EntryWarmupStallError);
    expect(String(error)).toMatch(/stalled in drawn-frame: no drawn frame/u);
    expect(owner.disposed).toBe(false);
    owner.dispose();
  });

  it('keeps the original synchronous preparation error', async () => {
    manualFrames();
    const owner = new Scope('owner');
    await expect(boundEntryWarmup(owner, () => 1, () => 'streamed-scene-roots', () => { throw new Error('bad material'); }))
      .rejects.toThrow('bad material');
    owner.dispose();
  });
});
