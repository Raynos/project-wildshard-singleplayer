import type { Scope } from '@wildshard/engine/app/scope';
import { buildHeld, frameBudgetSpent, frameDue, presenting } from '@wildshard/engine/core/framePacing';
import { buildYield, WORK_SLICE_MS } from '@wildshard/engine/core/workSlice';

function requireOwner(owner: Scope): void {
  if (owner.disposed || owner.disposing) throw new Error('build stopped: its scope has closed');
}

/** A completion checkpoint, not a read/decode pause. Callers await only a
 * returned promise: cheap live rows remain synchronous under the shared budget.
 * Loading/Node keep the original task turn; a queued yield keeps buildYield's
 * delivery-time frame check and refuses a retired or retiring owner. */
export function constructionCheckpoint(owner: Scope): Promise<void> | undefined {
  requireOwner(owner);
  if (presenting() && (buildHeld() || !frameDue()) && !frameBudgetSpent(WORK_SLICE_MS)) return undefined;
  return buildYield(owner).then(() => { requireOwner(owner); return undefined; });
}
