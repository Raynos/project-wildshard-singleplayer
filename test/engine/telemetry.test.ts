import { describe, expect, it, vi } from 'vitest';
import { SaveStore } from '../../src/engine/saves/store';
import { SessionHealth } from '../../src/engine/telemetry/health';
import { AnalyticsSink, classifySession, type Heartbeat } from '../../src/engine/telemetry/model';

const heartbeat: Heartbeat = { session: 'previous', build: 'old', level: 'world', stage: 'play', at: 1, fps: 30, clean: false, error: false, contextLost: false };
describe('session health', () => {
  it('distinguishes clean exits, explicit crashes, context loss and mid-play OOM guesses', () => {
    expect(classifySession(heartbeat)).toBe('likely-oom');
    expect(classifySession({ ...heartbeat, error: true })).toBe('crash');
    expect(classifySession({ ...heartbeat, contextLost: true })).toBe('context-loss');
    expect(classifySession({ ...heartbeat, clean: true, error: true })).toBe('clean');
    expect(classifySession({ ...heartbeat, stage: 'title' })).toBe('clean');
  });
  it('reports the preceding build once, preserves install identity across resets and excludes it from exports', () => {
    const local = new Map<string, string>(), tab = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({ get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } });
    const store = () => new SaveStore({ local: storage(local), session: storage(tab) });
    const send = vi.fn();
    const firstStore = store(), first = new SessionHealth(firstStore, 'old', (report) => { send(report); }, 1, () => 'installation');
    first.beat('world', 'play', 30, 2); first.contextLoss();
    expect(firstStore.exportAll()).not.toContain('telemetry');

    const second = new SessionHealth(store(), 'new', (report) => { send(report); }, 30_000, () => 'next');
    expect(second.install).toBe('installation');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ build: 'old', end: 'context-loss' }));
    expect(send).toHaveBeenCalledTimes(1);
  });
});
describe('analytics sink', () => {
  it('batches events, does not send empty batches, and flushes bounded requests', () => {
    const send = vi.fn(), sink = new AnalyticsSink('build', 'random-install', (batch) => { send(batch); });
    sink.flush(); expect(send).not.toHaveBeenCalled();
    sink.record('weapon.used', { level: 'world', weapon: 'bow' });
    sink.record('death.cause', { level: 'world', cause: 'fall' });
    sink.flush(); expect(send).toHaveBeenCalledWith({ kind: 'analytics', build: 'build', install: 'random-install', events: [
      { name: 'weapon.used', data: { level: 'world', weapon: 'bow' } }, { name: 'death.cause', data: { level: 'world', cause: 'fall' } },
    ] });
    sink.flush(); expect(send).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 50; i++) sink.record('weapon.used', { level: 'world', weapon: 'bow' });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
