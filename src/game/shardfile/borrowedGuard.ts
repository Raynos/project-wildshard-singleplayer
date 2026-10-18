import type { Scope } from '@wildshard/engine/app/scope';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { Events } from '@wildshard/engine/events/events';
import type { BorrowedDecision } from '@wildshard/format/decisionScripts';

/** Scope-owned, exact-body damage window. The admitted actor field is sampled for each incoming hit. */
export function bindBorrowedGuard(events: Events, scope: Scope, actor: Actor, memory: Readonly<Record<string, number>>,
  guard: NonNullable<BorrowedDecision['guard']>): void {
  if (scope.disposed) throw new Error('Guard owner is retired');
  if (!Number.isFinite(guard.activeValue) || !Number.isFinite(guard.multiplier) || guard.multiplier < 0 || guard.multiplier > 4)
    throw new Error('Invalid guard values');
  events.answer('damage.modify', req => {
    if (req === null || req.target !== actor || memory[guard.field] !== guard.activeValue) return req;
    return { ...req, amount: Math.max(0, req.amount * guard.multiplier) };
  }, scope, { order: 60 });
}
