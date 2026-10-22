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
/** Called by the existing authority at its original apply slot, AFTER complete
 * wire/contact validation. Resolve every loan before effects, then apply in
 * emitted order synchronously. A dismount re-reads mounted each time; it never
 * adds another impulse. Bond replacement/hurt/contact ordering stays in the
 * caller. Native player authority refuses an embedded borrowed-player host. */
export function applyV2WorldActions(actions: readonly V2WorldAction[],loans: readonly V2WorldActionLoan[]): void {
  if (actions.length > 128 || loans.length > 256) throw new Error('V2 action owner capacity');
  const owners = new Map<string,V2WorldActionLoan>();
  for (const loan of loans) {
    live(loan.scope);const id = key(loan.binding,loan.target);
    if (loan.binding.length === 0 || loan.target.length === 0 || owners.has(id)) throw new Error('Duplicate or empty v2 action loan');
    if (loan.kind === 'native-player' && (loan.owner.scope !== loan.scope || loan.owner.embedded)) throw new Error('Borrowed v2 player impulse authority');
    owners.set(id,{ ...loan });
  }
  const prepared = actions.map(action => {
    const loan = owners.get(key(action.binding,action.target));
    if (loan === undefined || (action.kind === 'dismount' ? loan.kind !== 'mount' : action.kind === 'ignite' ? loan.kind !== 'cell-field' : loan.kind !== 'native-player' && loan.kind !== 'page-player')) throw new Error('Unowned v2 world action');
    if (action.kind !== 'dismount' && (!Number.isFinite(action.x) || !Number.isFinite(action.z) || (action.kind === 'impulse' && !Number.isFinite(action.y)))) throw new Error('Non-finite v2 world action');
    return { action,loan };
  });
  for (const { action,loan } of prepared) {
    live(loan.scope);
    if (action.kind === 'dismount' && loan.kind === 'mount') { if (loan.owner.mounted) loan.owner.dismount(action.thrown); }
    else if (action.kind === 'ignite' && loan.kind === 'cell-field') loan.owner.activate(action.x,action.z);
    else if (action.kind === 'impulse') {
      const velocity = new Vector3(action.x,action.y,action.z);
      if (loan.kind === 'native-player') loan.owner.impulsePlayer(velocity);
      else if (loan.kind === 'page-player') loan.owner.impulse(velocity);
    }
  }
}
