import type { Scope } from '@wildshard/engine/app/scope';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { yieldTask } from '@wildshard/engine/core/workSlice';
import { prepareScriptMemoryBank } from '@wildshard/engine/script/moduleV2';

const banks = new WeakMap<Scope, Promise<void>>();

/** Start after code arrives, overlap module setup, and join before admission.
 * The same entry owner gets one bank, including its original failure. */
export function prepareEntryMemoryBank(owner: Scope): Promise<void> {
  const pending = banks.get(owner);
  if (pending !== undefined) return pending;
  const work = prepare(owner);
  banks.set(owner, work);
  return work;
}

async function prepare(owner: Scope): Promise<void> {
  if (owner.disposed || owner.disposing) throw new Error('Entry memory preparation ended');
  const memoryStartedAt = diagnosticNow();
  let memoryTurns = 0, memoryWaitMs = 0;
  // Cover the full-ALL route's five observed misses; never recycle growables.
  await prepareScriptMemoryBank([35, 0, 1, 0], async () => {
    // Each native reserve gets its own task, even when the CPU budget is free.
    memoryTurns++; const at = diagnosticNow(); await yieldTask(owner); memoryWaitMs += diagnosticNow() - at;
    if (owner.disposed || owner.disposing) throw new Error('Entry memory preparation ended');
  }, [{ initial: 1, maximum: 2, count: 5 }, { initial: 1, maximum: 64, count: 4 }]);
  performance.measure('wildshard.prepare:boot.script-memory-bank', { start: memoryStartedAt, end: diagnosticNow(),
    detail: { memoryTurns, memoryWaitMs } });
}
