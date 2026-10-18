import { expect, test, vi } from 'vitest';
import { EncounterSession } from '../src/game/practice/EncounterSession';

interface Actor { readonly id: string }

function deferred<Value>() {
  let resolveValue: (value: Value) => void = () => { throw new Error('Promise not initialized'); };
  let rejectValue: (reason: Error) => void = () => { throw new Error('Promise not initialized'); };
  const promise = new Promise<Value>((resolve, reject) => { resolveValue = resolve; rejectValue = reject; });
  return { promise, resolve: resolveValue, reject: rejectValue };
}

function fixture() {
  const requests: { selection: string; signal: AbortSignal; result: ReturnType<typeof deferred<Actor>> }[] = [];
  const dispose = vi.fn<(actor: Actor) => void>();
  const session = new EncounterSession<string, Actor>({
    load: (selection, signal) => {
      const result = deferred<Actor>();
      requests.push({ selection, signal, result });
      return result.promise;
    },
    dispose,
  });
  function request(index: number) {
    const value = requests[index];
    if (value === undefined) throw new Error(`Missing request ${index}`);
    return value;
  }
  return { session, dispose, requests, request };
}

test('starts empty and owns exactly the selected actor after loading', async () => {
  const f = fixture(), actor = { id: 'first' };
  expect(f.session.snapshot).toMatchObject({ scope: 'practice', phase: 'idle', actor: null, rewardCount: 0 });
  expect(await f.session.retry()).toBe(false);
  const loading = f.session.select('one');
  expect(f.session.snapshot).toMatchObject({ phase: 'loading', selection: 'one', actor: null });
  expect(f.request(0).signal.aborted).toBe(false);
  f.request(0).result.resolve(actor);
  expect(await loading).toBe(true);
  expect(f.session.snapshot).toMatchObject({ phase: 'active', selection: 'one', actor, error: null });
  expect(Object.isFrozen(f.session.snapshot)).toBe(true);
  expect(f.dispose).not.toHaveBeenCalled();
  f.session.dispose();
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(actor);
});

test('replacement disposes the active actor before requesting its successor', async () => {
  const f = fixture(), first = { id: 'first' }, second = { id: 'second' };
  const loading = f.session.select('one');
  f.request(0).result.resolve(first); await loading;
  const replacing = f.session.select('two');
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(first);
  expect(f.session.snapshot.actor).toBeNull();
  f.request(1).result.resolve(second); await replacing;
  expect(f.session.snapshot.actor).toBe(second);
  expect(f.session.defeat(first)).toBeNull();
  f.session.exit(); f.session.exit();
  expect(f.dispose.mock.calls).toEqual([[first], [second]]);
});

test('out-of-order loads abort the superseded request and dispose its late actor', async () => {
  const f = fixture(), stale = { id: 'stale' }, current = { id: 'current' };
  const first = f.session.select('one'), second = f.session.select('two');
  expect(f.request(0).signal.aborted).toBe(true);
  f.request(1).result.resolve(current);
  expect(await second).toBe(true);
  f.request(0).result.resolve(stale);
  expect(await first).toBe(false);
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(stale);
  expect(f.session.snapshot).toMatchObject({ phase: 'active', actor: current, selection: 'two' });
  f.session.dispose();
});

test('a late rejected load cannot change the newer attempt', async () => {
  const f = fixture(), current = { id: 'current' };
  const first = f.session.select('one'), second = f.session.select('two');
  f.request(1).result.resolve(current); await second;
  const before = f.session.snapshot;
  f.request(0).result.reject(new Error('Old request failed'));
  expect(await first).toBe(false);
  expect(f.session.snapshot).toBe(before);
  f.session.dispose();
});

test('a failed current load reports its error and retries the same selection', async () => {
  const f = fixture(), failure = new Error('Model unavailable'), actor = { id: 'retry' };
  const failed = f.session.select('one');
  f.request(0).result.reject(failure);
  expect(await failed).toBe(false);
  expect(f.session.snapshot).toMatchObject({ phase: 'error', error: failure, actor: null, selection: 'one' });
  const retry = f.session.retry();
  expect(f.request(1).selection).toBe('one');
  expect(f.session.snapshot).toMatchObject({ phase: 'loading', error: null });
  f.request(1).result.resolve(actor);
  expect(await retry).toBe(true);
  f.session.dispose();
});

test('retry during a pending load invalidates and retires its late result', async () => {
  const f = fixture(), stale = { id: 'stale' }, fresh = { id: 'fresh' };
  const loading = f.session.select('one'), retry = f.session.retry();
  expect(f.request(0).signal.aborted).toBe(true);
  expect(f.request(1).selection).toBe('one');
  f.request(0).result.resolve(stale);
  expect(await loading).toBe(false);
  expect(f.session.snapshot.phase).toBe('loading');
  f.request(1).result.resolve(fresh);
  expect(await retry).toBe(true);
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(stale);
  f.session.dispose();
});

test.each(['exit', 'dispose'] as const)('%s while loading rejects late publication and releases its actor', async action => {
  const f = fixture(), actor = { id: 'late' }, loading = f.session.select('one');
  f.session[action]();
  expect(f.request(0).signal.aborted).toBe(true);
  f.request(0).result.resolve(actor);
  expect(await loading).toBe(false);
  expect(f.session.snapshot).toMatchObject({ phase: action === 'exit' ? 'idle' : 'disposed', actor: null, selection: null });
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(actor);
  f.session.dispose(); f.session.dispose();
  expect(f.dispose).toHaveBeenCalledTimes(1);
});

test('reopening after exit works while terminal disposal cannot restart', async () => {
  const f = fixture(), actor = { id: 'reopened' };
  f.session.exit();
  const loading = f.session.select('one');
  f.request(0).result.resolve(actor);
  expect(await loading).toBe(true);
  f.session.dispose();
  expect(await f.session.select('two')).toBe(false);
  expect(await f.session.retry()).toBe(false);
  f.session.exit();
  expect(f.session.snapshot.phase).toBe('disposed');
  expect(f.requests).toHaveLength(1);
});

test('victory is practice-only, once per actor attempt, and exit clears all rewards', async () => {
  const f = fixture(), first = { id: 'first' }, second = { id: 'second' };
  const save = vi.spyOn(localStorage, 'setItem');
  const loading = f.session.select('one');
  expect(f.session.defeat(first)).toBeNull();
  f.request(0).result.resolve(first); await loading;
  const reward = f.session.defeat(first);
  expect(reward).toEqual({ scope: 'practice', attempt: 1, selection: 'one' });
  expect(f.session.snapshot).toMatchObject({ phase: 'defeated', actor: first, reward, rewardCount: 1 });
  expect(f.session.defeat(first)).toBeNull();
  expect(f.dispose).not.toHaveBeenCalled();
  const retry = f.session.retry();
  expect(f.dispose).toHaveBeenCalledExactlyOnceWith(first);
  expect(f.session.snapshot.reward).toBeNull();
  f.request(1).result.resolve(second); await retry;
  expect(f.session.defeat(first)).toBeNull();
  expect(f.session.defeat(second)).toEqual({ scope: 'practice', attempt: 2, selection: 'one' });
  expect(f.session.defeat(second)).toBeNull();
  expect(f.session.snapshot.rewardCount).toBe(2);
  f.session.exit();
  expect(f.session.snapshot).toMatchObject({ phase: 'idle', reward: null, rewardCount: 0 });
  expect(f.session.defeat(second)).toBeNull();
  expect(save).not.toHaveBeenCalled();
  expect(f.dispose.mock.calls).toEqual([[first], [second]]);
});
