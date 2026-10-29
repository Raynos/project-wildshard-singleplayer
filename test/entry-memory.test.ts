import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { prepareEntryMemoryBank } from '../src/entryMemory';

test('overlapped startup joins one bank with a separate timer for all 45 native reservations', async () => {
  vi.useFakeTimers();
  const owner = new Scope('entry-memory'), memory = vi.spyOn(WebAssembly, 'Memory'), timers = vi.spyOn(owner, 'timeout');
  const measure = vi.spyOn(performance, 'measure');
  try {
    const first = prepareEntryMemoryBank(owner), second = prepareEntryMemoryBank(owner);
    expect(first).toBe(second);
    expect(memory).toHaveBeenCalledTimes(1);
    let ready = false;
    void first.then(() => { ready = true; return undefined; });
    expect(ready).toBe(false);
    await vi.runAllTimersAsync();
    await first;
    expect(ready).toBe(true);
    expect(memory).toHaveBeenCalledTimes(45);
    expect(timers).toHaveBeenCalledTimes(45);
    expect(timers.mock.calls.every(([ms]) => ms === 0)).toBe(true);
    expect(measure).toHaveBeenCalledWith('wildshard.prepare:boot.script-memory-bank', expect.objectContaining({
      detail: { memoryTurns: 45, memoryWaitMs: expect.any(Number) },
    }));
    expect(prepareEntryMemoryBank(owner)).toBe(first);
    expect(memory).toHaveBeenCalledTimes(45);
  } finally { owner.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); }
});

test('a retired entry keeps its original refusal and starts no native reservation', async () => {
  const owner = new Scope('retired-entry-memory'), memory = vi.spyOn(WebAssembly, 'Memory');
  owner.dispose();
  try {
    const first = prepareEntryMemoryBank(owner);
    expect(prepareEntryMemoryBank(owner)).toBe(first);
    await expect(first).rejects.toThrow('Entry memory preparation ended');
    expect(memory).not.toHaveBeenCalled();
  } finally { memory.mockRestore(); }
});
