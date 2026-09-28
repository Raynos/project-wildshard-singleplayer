import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressView } from '../src/boot/plan';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../src/telemetry/browserErrors', () => ({ captureBrowserError: capture }));

const listeners = new Map<string, (event: { persisted?: boolean }) => void>();
const boot = () => { vi.resetModules(); return import('../src/boot/nineBootTrace'); };
const progress = (step: ProgressView['step'], setup: number, done = false): ProgressView => ({
  download: 1, setup, done, error: null, step, label: step, detail: '', bytes: null,
  bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, doneCount: 0, rows: [],
});

beforeEach(() => {
  capture.mockClear();
  listeners.clear();
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  vi.stubGlobal('__BUILD_ID__', 'abc1234-test');
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: (type: string, fn: (event: { persisted?: boolean }) => void) => { listeners.set(`document:${type}`, fn); } });
  vi.stubGlobal('window', { addEventListener: (type: string, fn: (event: { persisted?: boolean }) => void) => { listeners.set(`window:${type}`, fn); } });
});

describe('Nine Dragon boot trace', () => {
  it('reports one honest abrupt boot after the previous page vanishes at first frame', async () => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(next.previousNineBootLine()).toContain('Abrupt previous page: Nine Dragon first frame 95%');
    expect(next.previousNineBootLine()).toContain('cause unknown');
    expect(capture).toHaveBeenCalledOnce();
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
