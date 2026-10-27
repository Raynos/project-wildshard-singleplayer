import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import * as pacing from '../src/engine/core/framePacing';
import * as work from '../src/engine/core/workSlice';
import { constructionCheckpoint } from '../src/game/shardfile/constructionCheckpoint';

beforeEach(() => {
  vi.spyOn(pacing, 'buildHeld').mockReturnValue(false);
  vi.spyOn(pacing, 'frameDue').mockReturnValue(false);
});
afterEach(() => { vi.restoreAllMocks(); });

test('cheap live completions stay synchronous and check the shared budget at every row', async () => {
  const owner = new Scope('checkpoint'), turn = vi.spyOn(work, 'buildYield').mockResolvedValue();
  vi.spyOn(pacing, 'presenting').mockReturnValue(true);
  const spent = vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(false);
  try {
    const events: string[] = [];
    void Promise.resolve().then(() => { events.push('other microtask'); return undefined; });
    for (let i = 0; i < 3; i++) {
      const pause = constructionCheckpoint(owner); if (pause !== undefined) await pause;
      events.push(String(i));
    }
    expect(events).toEqual(['0', '1', '2']);
    expect(turn).not.toHaveBeenCalled();
    expect(spent.mock.calls).toEqual([[work.WORK_SLICE_MS], [work.WORK_SLICE_MS], [work.WORK_SLICE_MS]]);
    spent.mockReturnValue(true);
    await constructionCheckpoint(owner);
    expect(turn).toHaveBeenCalledExactlyOnceWith(owner);
    expect(events).toEqual(['0', '1', '2', 'other microtask']);
  } finally { owner.dispose(); }
});

test('loading and Node keep the original turn even with an unspent CPU clock', async () => {
  const owner = new Scope('checkpoint-loading');
  vi.spyOn(pacing, 'presenting').mockReturnValue(false);
  const spent = vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(false);
  const turn = vi.spyOn(work, 'buildYield').mockResolvedValue();
  try {
    const pause = constructionCheckpoint(owner); expect(pause).toBeInstanceOf(Promise);
    await pause;
    expect(turn).toHaveBeenCalledExactlyOnceWith(owner);
    expect(spent).not.toHaveBeenCalled();
  } finally { owner.dispose(); }
});

test('retirement during a spent-budget turn refuses the continuation', async () => {
  const owner = new Scope('checkpoint-retire'); let release = (): void => undefined;
  vi.spyOn(pacing, 'presenting').mockReturnValue(true);
  vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(true);
  vi.spyOn(work, 'buildYield').mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const pending = constructionCheckpoint(owner); owner.dispose(); release();
  await expect(pending).rejects.toThrow('scope has closed');
  expect(() => constructionCheckpoint(owner)).toThrow('scope has closed');
});

test('a retiring owner refuses before any checkpoint task is started', () => {
  const owner = new Scope('checkpoint-disposing'), turn = vi.spyOn(work, 'buildYield').mockResolvedValue();
  owner.onDispose(() => { expect(() => constructionCheckpoint(owner)).toThrow('scope has closed'); });
  owner.dispose(); expect(turn).not.toHaveBeenCalled();
});

test('the original budget turn failure propagates without an extra task', async () => {
  const owner = new Scope('checkpoint-failure'), failure = new Error('original frame failure');
  vi.spyOn(pacing, 'presenting').mockReturnValue(true);
  vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(true);
  const turn = vi.spyOn(work, 'buildYield').mockRejectedValue(failure);
  try { await expect(constructionCheckpoint(owner)).rejects.toBe(failure); expect(turn).toHaveBeenCalledOnce(); }
  finally { owner.dispose(); }
});


test('an unheld due frame yields even when an overrun leaves CPU budget', async () => {
  const owner = new Scope('checkpoint-due');
  vi.spyOn(pacing, 'presenting').mockReturnValue(true);
  vi.spyOn(pacing, 'frameDue').mockReturnValue(true);
  const spent = vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(false);
  const turn = vi.spyOn(work, 'buildYield').mockResolvedValue();
  try {
    await constructionCheckpoint(owner);
    expect(turn).toHaveBeenCalledExactlyOnceWith(owner);
    expect(spent).not.toHaveBeenCalled();
  } finally { owner.dispose(); }
});

test('held completion uses the shared held budget instead of ordinary frame due', () => {
  const owner = new Scope('checkpoint-held');
  vi.spyOn(pacing, 'presenting').mockReturnValue(true);
  vi.spyOn(pacing, 'buildHeld').mockReturnValue(true);
  const due = vi.spyOn(pacing, 'frameDue').mockReturnValue(true);
  const spent = vi.spyOn(pacing, 'frameBudgetSpent').mockReturnValue(false);
  const turn = vi.spyOn(work, 'buildYield').mockResolvedValue();
  try {
    expect(constructionCheckpoint(owner)).toBeUndefined();
    expect(spent).toHaveBeenCalledExactlyOnceWith(work.WORK_SLICE_MS);
    expect(due).not.toHaveBeenCalled();
    expect(turn).not.toHaveBeenCalled();
  } finally { owner.dispose(); }
});
