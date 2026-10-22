/** H4 effects borrow the original concrete owners. This adapter has no queue,
 * tick, registry, contact law, body, RNG or save state of its own. */
import { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SimHost } from '@wildshard/engine/sim';
import type { Player } from '@wildshard/engine/player/Player';
import type { V2WorldAction } from '@wildshard/format/scriptActionsV2';
import type { NativeMountedPlayer } from '../riding/native';

/** Cell-field storage lends its SAME concrete activate method. Its AS law,
 * delayed writes and update cadence remain with that field owner. */
interface CellFieldPort { activate: (x: number,z: number) => void }
interface Identity { readonly binding: string; readonly target: string; readonly scope: Scope }
export type V2WorldActionLoan = Identity & (
  { readonly kind: 'mount'; readonly owner: Pick<NativeMountedPlayer,'mounted' | 'dismount'> }
  | { readonly kind: 'cell-field'; readonly owner: CellFieldPort }
  | { readonly kind: 'native-player'; readonly owner: SimHost }
  | { readonly kind: 'page-player'; readonly owner: Pick<Player,'impulse'> }
);
function key(binding: string,target: string): string { return JSON.stringify([binding,target]); }
function live(scope: Scope): void { if (scope.disposed || scope.disposing) throw new Error('Retired v2 action owner'); }
/** Prepared by the original authority alongside other command families.
 * No effect runs until every candidate bank has passed its own preparation. */
export interface PreparedV2WorldActions {
  readonly validate: () => void;
  readonly operations: readonly (() => void)[];
}
/** Snapshot scalar operands and concrete loans without applying effects. The
 * combined caller validates every family before interleaving these operations
 * in emitted order. Each operation also fences retirement by an earlier effect.
 * This creates no queue, scheduler, continuation or authored callback surface. */
export function prepareV2WorldActions(actions: readonly V2WorldAction[],loans: readonly V2WorldActionLoan[]): PreparedV2WorldActions {
  if (actions.length > 128 || loans.length > 256) throw new Error('V2 action owner capacity');
  const owners = new Map<string,V2WorldActionLoan>();
  for (const loan of loans) {
    live(loan.scope);const id = key(loan.binding,loan.target);
    if (loan.binding.length === 0 || loan.target.length === 0 || owners.has(id)) throw new Error('Duplicate or empty v2 action loan');
    if (loan.kind === 'native-player' && (loan.owner.scope !== loan.scope || loan.owner.embedded)) throw new Error('Borrowed v2 player impulse authority');
    owners.set(id,{ ...loan });
  }
  const prepared = actions.map(input => {
    const action = { ...input },loan = owners.get(key(action.binding,action.target));
    if (loan === undefined || (action.kind === 'dismount' ? loan.kind !== 'mount' : action.kind === 'ignite' ? loan.kind !== 'cell-field' : loan.kind !== 'native-player' && loan.kind !== 'page-player')) throw new Error('Unowned v2 world action');
    if (action.kind !== 'dismount' && (!Number.isFinite(action.x) || !Number.isFinite(action.z) || (action.kind === 'impulse' && !Number.isFinite(action.y)))) throw new Error('Non-finite v2 world action');
    const current = (same: boolean): void => { live(loan.scope);if (!same) throw new Error('Changed v2 action authority'); };
    if (action.kind === 'dismount' && loan.kind === 'mount') {
      const owner = loan.owner,method = owner.dismount;
      const validate = (): void => { current(owner.dismount === method); };
      return { validate,apply: (): void => { validate();if (owner.mounted) method.call(owner,action.thrown); } };
    }
    if (action.kind === 'ignite' && loan.kind === 'cell-field') {
      const owner = loan.owner,method = owner.activate;
      const validate = (): void => { current(owner.activate === method); };
      return { validate,apply: (): void => { validate();method.call(owner,action.x,action.z); } };
    }
    if (action.kind === 'impulse' && loan.kind === 'native-player') {
      const owner = loan.owner,apply = owner.impulsePlayer.bind(owner);
      const validate = (): void => { current(owner.scope === loan.scope && !owner.embedded); };
      return { validate,apply: (): void => { validate();apply(new Vector3(action.x,action.y,action.z)); } };
    }
    if (action.kind === 'impulse' && loan.kind === 'page-player') {
      const owner = loan.owner,method = owner.impulse;
      const validate = (): void => { current(owner.impulse === method); };
      return { validate,apply: (): void => { validate();method.call(owner,new Vector3(action.x,action.y,action.z)); } };
    }
    throw new Error('Unowned v2 world action');
  });
  return { validate: (): void => {
    for (const loan of owners.values()) live(loan.scope);
    for (const row of prepared) row.validate();
  },operations: Object.freeze(prepared.map(row => row.apply)) };
}
/** Existing direct application remains a whole-bank prepare/validate/apply.
 * Dismount reads mounted at each application and never adds an impulse. */
export function applyV2WorldActions(actions: readonly V2WorldAction[],loans: readonly V2WorldActionLoan[]): void {
  const prepared = prepareV2WorldActions(actions,loans);prepared.validate();
  for (const operation of prepared.operations) operation();
}
