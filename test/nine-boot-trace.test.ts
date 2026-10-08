import { saveStorageFixture } from './fake/saveFixture';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressView } from '../src/engine/boot/plan';
import { createBootTrace, type BootTrace, type BootTraceTransports } from '../src/engine/boot/bootTrace';

const fixtures = saveStorageFixture('device');

// the transports are the trace's inputs; each simulated page load builds a trace over them (no module mocks or reset, E422)
const capture = vi.fn<BootTraceTransports['deliver']>();
const inbox = vi.fn<BootTraceTransports['inbox']>();

const listeners = new Map<string, (event: { persisted?: boolean }) => void>();
const boot = (): Promise<BootTrace> => Promise.resolve(createBootTrace({ deliver: capture, inbox }));
const progress = (step: ProgressView['step'], setup: number, done = false): ProgressView => ({
  worldBytesReady: false, download: 1, setup, done, error: null, step, label: step, detail: '', bytes: null,
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

describe('level boot trace', () => {
  it('keeps tracing disabled without registering listeners or saving a record', async () => {
    const first = await boot();
    first.startBoot({ id: 'fixture-level', name: 'Fixture Level' }, false);
    first.recordBootCheckpoint('renderer:before');
    expect(first.bootTraceActive()).toBe(false);
    expect(listeners.size).toBe(0);
    expect(fixtures.getItem('boot.trace')).toBeNull();
  });

  it('carries the selected level identity into both interruption transports', async () => {
    const first = await boot();
    first.startBoot({ id: 'fixture-level', name: 'Fixture Level' });
    first.recordBootCheckpoint('post:before');
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    expect(next.previousBootLevel()).toBe('fixture-level');
    expect(next.previousBootLine()).toContain('Fixture Level');
    expect(capture.mock.calls[0]?.[1]).toMatchObject({ shard: 'fixture-level' });
    expect(inbox.mock.calls[0]?.[4]).toBe('fixture-level');
  });

  it('recovers the exact pending GPU operation and bounded evidence after a process disappears', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    for (let i = 0; i < 40; i++) first.recordBootCheckpoint(`step:${i}`);
    first.recordBootCheckpoint('post:before', { calls: 80, jsHeapBytes: null, gpuTextures: 'auto' });
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(next.previousBootLine()).toContain('at post:before');
    const tags: unknown = capture.mock.calls[0]?.[1];
    const diagnostic: unknown = typeof tags === 'object' && tags !== null ? Reflect.get(tags, 'diagnostic') : null;
    const checkpoints: unknown = typeof diagnostic === 'object' && diagnostic !== null ? Reflect.get(diagnostic, 'checkpoints') : null;
    expect(checkpoints).toHaveLength(32);
    if (!Array.isArray(checkpoints)) throw new Error('Missing checkpoints');
    expect(checkpoints.at(-1)).toEqual({ atMs: 0, operation: 'post:before', facts: { calls: 80, jsHeapBytes: null, gpuTextures: 'auto' } });
  });

  it('saves changes within the same progress percentage', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.recordBootProgress({ ...progress('firstFrame', 0.95), detail: 'world' });
    first.recordBootProgress({ ...progress('firstFrame', 0.95), detail: 'post chain' });
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(next.previousBootLine()).toContain('at post chain');
  });

  it('ignores checkpoints after world ready', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('document:ws:ready')?.({});
    first.recordBootCheckpoint('post:before');
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports one honest abrupt boot after the previous page vanishes at first frame', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.recordBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(next.previousBootLine()).toContain('Abrupt previous page: Nine Dragon first frame 95%');
    expect(next.previousBootLine()).toContain('cause unknown');
    expect(capture).toHaveBeenCalledOnce();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    const third = await boot();
    third.inspectPreviousBoot();
    expect(capture).toHaveBeenCalledOnce();
  });

  it.each(['planned', 'handled_error', 'context_lost'] as const)('does not call a known %s exit abrupt', async (status) => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.recordBootProgress(progress('firstFrame', 0.95));
    if (status === 'planned') first.markBootPlanned();
    else if (status === 'handled_error') first.markBootHandledError();
    else first.markBootContextLost();
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(next.previousBootLine()).toBe('');
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a page that reached world ready or exited through pagehide', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.recordBootProgress(progress('firstFrame', 1, true));
    listeners.get('document:ws:ready')?.({});
    const ready = await boot();
    ready.inspectPreviousBoot();
    expect(capture).not.toHaveBeenCalled();

    ready.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('window:pagehide')?.({});
    const closed = await boot();
    closed.inspectPreviousBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('resumes an in-progress record if iOS sends pagehide for an app switch', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('window:pagehide')?.({});
    listeners.get('document:visibilitychange')?.({});
    first.recordBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(capture).toHaveBeenCalledOnce();
  });

  it('does not let an old title-navigation marker hide a later interrupted Nine boot', async () => {
    fixtures.setItem('ws.lastUnload', JSON.stringify({ reason: 'title chose nine-dragon-stack', t: Date.now() - 20_000 }));
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.recordBootProgress(progress('firstFrame', 0.95));
    const next = await boot();
    next.inspectPreviousBoot();
    await next.flushBootReports();
    expect(capture).toHaveBeenCalledOnce();
    expect(next.previousBootLine()).toContain('cause unknown');
  });
});


describe('durable Explore and recovery evidence', () => {
  it('keeps Explore entry armed after a late boot-ready event until actual visible stable draws', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('document:ws:ready')?.({});
    first.beginExploreEntry('world');
    listeners.get('document:ws:ready')?.({});
    first.recordBootCheckpoint('explore:constructed');
    first.recordBootProgress(progress('firstFrame', 1, true));
    expect(first.exploreEntryPending()).toBe(true);
    const next = await boot();
    next.inspectPreviousBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    expect(next.previousBootLine()).toContain('explore:world');
  });

  it('finishes only after live draws over ten seconds and makes bounded storage writes', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('document:ws:ready')?.({});
    first.beginExploreEntry('world');
    const writes = vi.spyOn(localStorage, 'setItem');
    for (let i = 0; i < 120; i++) first.recordExploreFrame();
    expect(first.exploreEntryPending()).toBe(true);
    vi.setSystemTime(Date.now() + 10_000);
    first.recordExploreFrame();
    expect(first.exploreEntryPending()).toBe(false);
    expect(writes).toHaveBeenCalledTimes(4);
    const next = await boot();
    next.inspectPreviousBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('retains known GPU failure after ready, planned reload and pagehide', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    listeners.get('document:ws:ready')?.({});
    first.recordGpuRecovery('the context stayed lost');
    first.markBootPlanned();
    listeners.get('window:pagehide')?.({});
    const next = await boot();
    next.inspectPreviousBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    expect(next.previousBootLine()).toContain('graphics recovery: the context stayed lost');
    expect(inbox.mock.calls[0]?.[3]).toBe('gpu-recovery');
  });

  it('retains evidence through async import/send failure and retries only the unacknowledged channel', async () => {
    inbox.mockRejectedValue(new Error('offline'));
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.beginExploreEntry('world');
    const next = await boot();
    next.inspectPreviousBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledOnce(); });
    await vi.waitFor(() => { expect(fixtures.getItem('boot.reports')).toContain('"sentry":true'); });
    expect(fixtures.getItem('boot.reports')).toContain('explore:world');
    inbox.mockResolvedValue('ok');
    const third = await boot();
    third.inspectPreviousBoot();
    await vi.waitFor(() => { expect(inbox).toHaveBeenCalledTimes(2); });
    await vi.waitFor(() => { expect(fixtures.getItem('boot.reports')).toBe('[]'); });
    expect(capture).toHaveBeenCalledOnce();
  });

  it('retries Sentry independently without resending an acknowledged first-party report', async () => {
    capture.mockResolvedValue(false);
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    const next = await boot();
    next.inspectPreviousBoot();
    await vi.waitFor(() => { expect(fixtures.getItem('boot.reports')).toContain('"inbox":true'); });
    capture.mockResolvedValue(true);
    const third = await boot();
    third.inspectPreviousBoot();
    await vi.waitFor(() => { expect(fixtures.getItem('boot.reports')).toBe('[]'); });
    expect(inbox).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it.each(['navigation', 'background'] as const)('does not infer a crash from normal %s during Explore', async (exit) => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.beginExploreEntry('world');
    if (exit === 'navigation') first.markBootPlanned();
    else {
      vi.stubGlobal('document', { visibilityState: 'hidden' });
      listeners.get('document:visibilitychange')?.({});
    }
    const next = await boot();
    next.inspectPreviousBoot();
    expect(capture).not.toHaveBeenCalled();
  });

  it('bounds queued attempts and keeps them across a replacement boot while offline', async () => {
    inbox.mockResolvedValue('retry');
    capture.mockResolvedValue(false);
    for (let i = 0; i < 6; i++) {
      const page = await boot();
      page.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
      page.recordGpuRecovery(`lost ${i}`);
    }
    const pending: unknown = JSON.parse(fixtures.getItem('boot.reports') ?? 'null');
    expect(pending).toHaveLength(4);
    const next = await boot();
    next.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    expect(fixtures.getItem('boot.reports')).toContain('lost 5');
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60_000);
    await next.flushBootReports();
    expect(inbox).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });


  it('cancels an unfinished Explore watch after successful leave without hiding handled/lost failures', async () => {
    const first = await boot();
    first.startBoot({ id: 'nine-dragon-stack', name: 'Nine Dragon' });
    first.beginExploreEntry('hub');
    first.endExploreEntry();
    expect(first.exploreEntryPending()).toBe(false);
    expect(first.bootDiagnostic()['status']).toBe('ready');
    first.beginExploreEntry('world');
    first.markBootContextLost();
    first.endExploreEntry();
    expect(first.bootDiagnostic()['status']).toBe('context_lost');
    const next = await boot();
    next.inspectPreviousBoot();
    expect(capture).not.toHaveBeenCalled();
  });

});
