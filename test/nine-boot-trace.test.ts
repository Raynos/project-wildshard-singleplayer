import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressView } from '#engine/boot/plan';

const capture = vi.hoisted(() => vi.fn());
const inbox = vi.hoisted(() => vi.fn());
vi.mock('#engine/telemetry/browserErrors', () => ({ deliverBrowserError: capture }));
vi.mock('#engine/telemetry/bootInbox', () => ({ reportBootInterruption: inbox }));

const listeners = new Map<string, (event: { persisted?: boolean }) => void>();
const boot = () => { vi.resetModules(); return import('#engine/boot/nineBootTrace'); };
const progress = (step: ProgressView['step'], setup: number, done = false): ProgressView => ({
  download: 1, setup, done, error: null, step, label: step, detail: '', bytes: null,
  bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, doneCount: 0, rows: [],
});

beforeEach(() => {
  capture.mockReset().mockResolvedValue(true);
  inbox.mockReset().mockResolvedValue('ok');
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
    await next.flushNineBootReports();
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
    await next.flushNineBootReports();
    expect(next.previousNineBootLine()).toContain('at post chain');
  });

  it('ignores checkpoints after world ready', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('document:ws:ready')?.({});
    first.recordNineBootCheckpoint('post:before');
    const next = await boot();
    next.inspectPreviousNineBoot();
    await next.flushNineBootReports();
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports one honest abrupt boot after the previous page vanishes at first frame', async () => {
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    await next.flushNineBootReports();
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
    await next.flushNineBootReports();
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
    await next.flushNineBootReports();
    expect(capture).toHaveBeenCalledOnce();
  });

  it('does not let an old title-navigation marker hide a later interrupted Nine boot', async () => {
    localStorage.setItem('ws.lastUnload', JSON.stringify({ reason: 'title chose nine-dragon-stack', t: Date.now() - 20_000 }));
    const first = await boot();
    first.startNineBoot();
    first.recordNineBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousNineBoot();
    await next.flushNineBootReports();
    expect(capture).toHaveBeenCalledOnce();
    expect(next.previousNineBootLine()).toContain('cause unknown');
  });
});


describe('durable Explore and recovery evidence', () => {
  it('keeps Explore entry armed after a late boot-ready event until actual visible stable draws', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('document:ws:ready')?.({});
    first.beginNineExploreEntry('world');
    listeners.get('document:ws:ready')?.({});
    first.recordNineBootCheckpoint('explore:constructed');
    first.recordNineBootProgress(progress('firstFrame', 1, true));
    expect(first.nineExploreEntryPending()).toBe(true);
    const next = await boot();
    next.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    expect(next.previousNineBootLine()).toContain('explore:world');
  });

  it('finishes only after live draws over ten seconds and makes bounded storage writes', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('document:ws:ready')?.({});
    first.beginNineExploreEntry('world');
    const writes = vi.spyOn(localStorage, 'setItem');
    for (let i = 0; i < 120; i++) first.recordNineExploreFrame();
    expect(first.nineExploreEntryPending()).toBe(true);
    vi.setSystemTime(Date.now() + 10_000);
    first.recordNineExploreFrame();
    expect(first.nineExploreEntryPending()).toBe(false);
    expect(writes).toHaveBeenCalledTimes(4);
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('retains known GPU failure after ready, planned reload and pagehide', async () => {
    const first = await boot();
    first.startNineBoot();
    listeners.get('document:ws:ready')?.({});
    first.recordNineGpuRecovery('the context stayed lost');
    first.markNineBootPlanned();
    listeners.get('window:pagehide')?.({});
    const next = await boot();
    next.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    expect(next.previousNineBootLine()).toContain('graphics recovery: the context stayed lost');
    expect(inbox.mock.calls[0]?.[3]).toBe('gpu-recovery');
  });

  it('retains evidence through async import/send failure and retries only the unacknowledged channel', async () => {
    inbox.mockRejectedValue(new Error('offline'));
    const first = await boot();
    first.startNineBoot();
    first.beginNineExploreEntry('world');
    const next = await boot();
    next.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    await vi.waitFor(() => { expect(localStorage.getItem('wsNineReports')).toContain('"sentry":true'); });
    expect(localStorage.getItem('wsNineReports')).toContain('explore:world');
    inbox.mockResolvedValue('ok');
    const third = await boot();
    third.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledTimes(2); });
    await vi.waitFor(() => { expect(localStorage.getItem('wsNineReports')).toBe('[]'); });
    expect(capture).toHaveBeenCalledOnce();
  });

  it('retries Sentry independently without resending an acknowledged first-party report', async () => {
    capture.mockResolvedValue(false);
    const first = await boot();
    first.startNineBoot();
    const next = await boot();
    next.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(localStorage.getItem('wsNineReports')).toContain('"inbox":true'); });
    capture.mockResolvedValue(true);
    const third = await boot();
    third.inspectPreviousNineBoot();
    await vi.waitFor(() => { expect(localStorage.getItem('wsNineReports')).toBe('[]'); });
    expect(inbox).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it.each(['navigation', 'background'] as const)('does not infer a crash from normal %s during Explore', async (exit) => {
    const first = await boot();
    first.startNineBoot();
    first.beginNineExploreEntry('world');
    if (exit === 'navigation') first.markNineBootPlanned();
    else {
      vi.stubGlobal('document', { visibilityState: 'hidden' });
      listeners.get('document:visibilitychange')?.({});
    }
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('bounds queued attempts and keeps them across a replacement boot while offline', async () => {
    inbox.mockResolvedValue('retry');
    capture.mockResolvedValue(false);
    for (let i = 0; i < 6; i++) {
      const page = await boot();
      page.startNineBoot();
      page.recordNineGpuRecovery(`lost ${i}`);
    }
    const pending: unknown = JSON.parse(localStorage.getItem('wsNineReports') ?? 'null');
    expect(pending).toHaveLength(4);
    const next = await boot();
    next.startNineBoot();
    expect(localStorage.getItem('wsNineReports')).toContain('lost 5');
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60_000);
    await next.flushNineBootReports();
    expect(inbox).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });


  it('cancels an unfinished Explore watch after successful leave without hiding handled/lost failures', async () => {
    const first = await boot();
    first.startNineBoot();
    first.beginNineExploreEntry('hub');
    first.endNineExploreEntry();
    expect(first.nineExploreEntryPending()).toBe(false);
    expect(first.nineBootDiagnostic()['status']).toBe('ready');
    first.beginNineExploreEntry('world');
    first.markNineBootContextLost();
    first.endNineExploreEntry();
    expect(first.nineBootDiagnostic()['status']).toBe('context_lost');
    const next = await boot();
    next.inspectPreviousNineBoot();
    expect(capture).not.toHaveBeenCalled();
  });

});
