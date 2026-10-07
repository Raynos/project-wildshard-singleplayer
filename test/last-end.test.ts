/**
 * E179 (src/engine/boot/lastEnd.ts): the boot says how the previous page in this tab ended — the game navigated on purpose (a
 * reason written just before), the page died without a pagehide (a stale alive beat: iOS killing it for memory), or a
 * fresh launch — and the Debug readout's "Last reload" line reads it back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './setup';
import { PageLife } from '../src/engine/boot/lastEnd';
import { Scope } from '../src/engine/app/scope';

let session: MemoryStorage;
const listeners = new Map<string, (e: unknown) => void>();

/** a fresh page: a new life record reads how the last one ended (no module reload, E422) */
function boot(): Promise<PageLife> { return Promise.resolve(new PageLife(new Scope('page'))); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
  session = new MemoryStorage();
  listeners.clear();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('__BUILD_ID__', 'bcf12c4-mabc');
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: (t: string, fn: (e: unknown) => void) => { listeners.set(`doc:${t}`, fn); } });
  vi.stubGlobal('window', { addEventListener: (t: string, fn: (e: unknown) => void) => { listeners.set(`win:${t}`, fn); } });
});
afterEach(() => { vi.useRealTimers(); });

describe('lastEnd', () => {
  it('captures only explicit reloads, restores prior scoped callbacks and refuses failed capture safely', async () => {
    const life = await boot(), first = new Scope('first.reload'), second = new Scope('second.reload');
    const calls: string[] = [];
    life.registerBeforeReload(first, reason => { calls.push(`first.${reason}`); return true; });
    life.markUnload('ordinary travel'); expect(calls).toEqual([]);
    expect(life.markReload('update')).toBe(true);
    life.registerBeforeReload(second, reason => { calls.push(`second.${reason}`); return false; });
    expect(life.markReload('debug row')).toBe(false);
    second.dispose(); expect(life.markReload('GPU recovery', 'gpu')).toBe(true);
    expect(calls).toEqual(['first.reload', 'second.reload', 'first.gpu']);
    first.dispose(); expect(life.markReload('bare title')).toBe(true);
    expect(calls).toHaveLength(3);
    expect(() => life.registerBeforeReload(first, () => true)).toThrow('disposed');
    const failing = new Scope('throwing.reload');
    life.registerBeforeReload(failing, () => { throw new Error('Checkpoint failed'); });
    expect(life.markReload('load failure')).toBe(false); failing.dispose();
  });

  it('never revives an earlier disposed capture after a nested owner leaves', async () => {
    const life = await boot(), first = new Scope('old.capture'), second = new Scope('new.capture');
    let oldCalls = 0;
    life.registerBeforeReload(first, () => { oldCalls++; return true; });
    life.registerBeforeReload(second, () => true);
    first.dispose(); second.dispose();
    expect(life.markReload('after both dispose')).toBe(true); expect(oldCalls).toBe(0);
  });

  it('a reason written just before the load: intentional, with what was resident', async () => {
    const prev = await boot();
    prev.setAliveSource(() => ({ slug: 'pine-hollow', resident: 'nalati-grasslands ~87 MB · pine-hollow (playing) ~178 MB', mode: 'shard' }));
    prev.markUnload('build pill tap');
    listeners.get('win:pagehide')?.({}); // the navigation's pagehide takes the alive beat with it
    expect(session.getItem('ws.alive')).toBeNull();
    vi.advanceTimersByTime(1500);
    const next = await boot();
    const e = next.lastEnd();
    expect(e.kind).toBe('intentional');
    expect(e.reason).toBe('build pill tap');
    expect(e.resident).toContain('pine-hollow (playing)');
    expect(e.build).toBe('bcf12c4');
    expect(localStorage.getItem('ws.lastUnload')).toBeNull(); // read once
    expect(next.lastEndLine()).toMatch(/^Last reload: build pill tap · 2 s ago · resident nalati-grasslands ~87 MB · pine-hollow \(playing\) ~178 MB · build bcf12c4/);
  });

  it('a stale alive beat and no reason: the page ended unexpectedly (the iOS memory kill)', async () => {
    const prev = await boot();
    prev.setAliveSource(() => ({ slug: 'nalati-grasslands', resident: 'pine-hollow ~178 MB · nalati-grasslands (playing) ~87 MB', mode: 'grid' }));
    vi.advanceTimersByTime(3000); // a beat
    // no pagehide, no reason: the process is gone and the web view loads the page again
    vi.advanceTimersByTime(1000);
    const e = (await boot()).lastEnd();
    expect(e.kind).toBe('unexpected');
    expect(e.reason).toBe('page ended unexpectedly on screen (browser or system cause unknown)');
    expect(e.resident).toBe('pine-hollow ~178 MB · nalati-grasslands (playing) ~87 MB');
    expect(e.mode).toBe('grid'); // SF21a: the title reads this to add its one-line EXPERIMENTAL Wildshard note
  });

  it('a hidden page that dies says so', async () => {
    const prev = await boot();
    prev.setAliveSource(() => ({ slug: 'pine-hollow', resident: 'pine-hollow (playing) ~178 MB', mode: 'shard' }));
    vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: () => undefined });
    listeners.get('doc:visibilitychange')?.({});
    expect((await boot()).lastEnd().reason).toContain('in the background');
  });

  it('a fresh launch keeps showing the last recorded end', async () => {
    const prev = await boot();
    prev.markUnload('graphics recovery: the GPU process restarted');
    listeners.get('win:pagehide')?.({});
    await boot(); // the reload: recorded
    listeners.get('win:pagehide')?.({}); session.clear(); // the app is closed; a cold launch has a new session
    vi.advanceTimersByTime(5 * 60_000);
    const cold = await boot();
    expect(cold.lastEnd().kind).toBe('fresh');
    expect(cold.lastEndLine()).toMatch(/^Last reload: graphics recovery: the GPU process restarted \(before an earlier launch\) · 5 min ago/);
  });

  it('nothing ever recorded', async () => {
    expect((await boot()).lastEndLine()).toBe('Last reload: none recorded');
  });
});
