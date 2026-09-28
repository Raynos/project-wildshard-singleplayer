import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressView } from '../src/boot/plan';

const capture = vi.hoisted(() => vi.fn());
const inbox = vi.hoisted(() => vi.fn());
vi.mock('../src/telemetry/browserErrors', () => ({ captureBrowserError: capture }));
vi.mock('../src/telemetry/bootInbox', () => ({ reportBootInterruption: inbox }));

const listeners = new Map<string, (event: { persisted?: boolean }) => void>();
const boot = () => { vi.resetModules(); return import('../src/boot/nineBootTrace'); };
const progress = (step: ProgressView['step'], setup: number, done = false): ProgressView => ({
  download: 1, setup, done, error: null, step, label: step, detail: '', bytes: null,
  bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, doneCount: 0, rows: [],
});

beforeEach(() => {
  capture.mockClear();
  inbox.mockClear();
  listeners.clear();
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  vi.stubGlobal('__BUILD_ID__', 'abc1234-test');
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: (type: string, fn: (event: { persisted?: boolean }) => void) => { listeners.set(`document:${type}`, fn); } });
  vi.stubGlobal('window', { addEventListener: (type: string, fn: (event: { persisted?: boolean }) => void) => { listeners.set(`window:${type}`, fn); } });
});

describe('Nine Dragon boot trace', () => {
  it('recovers the exact pending GPU operation and bounded evidence after a process disappears', async () => {
    const first = await boot();
    first.startNineBoot();
    for (let i = 0; i < 40; i++) first.recordNineBootCheckpoint(`step:${i}`);
    first.recordNineBootCheckpoint('post:before', { calls: 80, jsHeapBytes: null, gpuTextures: 'auto' });
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(next.previousNineBootLine()).toContain('at post:before');
    const tags: unknown = capture.mock.calls[0]?.[1];
    const diagnostic: unknown = typeof tags === 'object' && tags !== null ? Reflect.get(tags, 'diagnostic') : null;
    const checkpoints: unknown = typeof diagnostic === 'object' && diagnostic !== null ? Reflect.get(diagnostic, 'checkpoints') : null;
    expect(checkpoints).toHaveLength(32);
    if (!Array.isArray(checkpoints)) throw new Error('Missing checkpoints');
    expect(checkpoints.at(-1)).toEqual({ atMs: 0, operation: 'post:before', facts: { calls: 80, jsHeapBytes: null, gpuTextures: 'auto' } });
  });

  it('saves changes within the same progress percentage', async () => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress({ ...progress('firstFrame', 0.95), detail: 'world' });
    first.recordNineBootProgress({ ...progress('firstFrame', 0.95), detail: 'post chain' });
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(next.previousNineBootLine()).toContain('at post chain');
  });

  it('ignores checkpoints after world ready', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('document:ws:ready')?.({});
    first.recordNineBootCheckpoint('post:before');
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports one honest abrupt boot after the previous page vanishes at first frame', async () => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(next.previousNineBootLine()).toContain('Abrupt previous page: Nine Dragon first frame 95%');
    expect(next.previousNineBootLine()).toContain('cause unknown');
    expect(capture).toHaveBeenCalledOnce();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    const third = await boot();
    third.inspectPreviousNineBoot();
    expect(capture).toHaveBeenCalledOnce();
  });

  it.each(['planned', 'handled_error', 'context_lost'] as const)('does not call a known %s exit abrupt', async (status) => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    if (status === 'planned') first.markNineBootPlanned();
    else if (status === 'handled_error') first.markNineBootHandledError();
    else first.markNineBootContextLost();
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(next.previousNineBootLine()).toBe('');
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a page that reached world ready or exited through pagehide', async () => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 1, true));
    listeners.get('document:ws:ready')?.({});
    const ready = await boot();
    ready.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();

    ready.startNineBoot();
    listeners.get('window:pagehide')?.({});
    const closed = await boot();
    closed.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('resumes an in-progress record if iOS sends pagehide for an app switch', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('window:pagehide')?.({});
    listeners.get('document:visibilitychange')?.({});
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).toHaveBeenCalledOnce();
  });

  it('does not let an old title-navigation marker hide a later interrupted Nine boot', async () => {
    localStorage.setItem('ws.lastUnload', JSON.stringify({ reason: 'title chose nine-dragon-stack', t: Date.now() - 20_000 }));
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).toHaveBeenCalledOnce();
    expect(next.previousNineBootLine()).toContain('cause unknown');
  });
});
