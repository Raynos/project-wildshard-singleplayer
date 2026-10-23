/** Finite entry bindings over existing room and riding owners. */
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import { entryOwner, presentEntryOwner, publishEntryOwner } from './entryOwners';

/** Keep the original room, kit and reward model. An open arena still requires
 * its distinct equipment contract and refuses this room-only bind. */
export function installArenaRoomEntry(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'arena-room.entry' }>): void {
  if (ctx.scope.disposed || ctx.scope.disposing) throw new Error('Arena entry owner has ended');
  const arena = entryOwner(ctx.scope, 'arena-room', row.owner), claims = entryOwner(ctx.scope, 'claims', row.claims);
  const kit = claims.pageKit(ctx);
  if (kit === null || presentEntryOwner(ctx.scope, 'arena-room', row.publish) !== null) throw new Error('Arena entry requires its unbound original kit and owner');
  const reward = claims.model(row.reward);
  ctx.scope.run(() => { arena.bind(ctx, kit, reward); });
  publishEntryOwner(ctx.scope, 'arena-room', row.publish, arena);
}

/** Publish only the same mount/taming/view that native play already prepared.
 * The original riding host remains the sole body, clock and save authority. */
export function installTamingEntry(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'taming.entry' }>): void {
  const runtime = ctx.game.runtime;
  if (ctx.scope.disposed || ctx.scope.disposing || runtime === undefined) throw new Error('Taming entry owner has ended');
  const ride = entryOwner(ctx.scope, 'riding-view', row.riding);
  if (presentEntryOwner(ctx.scope, 'taming', row.publish) !== null || runtime.interactables.includes(ride.interactable)
    || row.object !== undefined && Object.hasOwn(runtime.objects, row.object)) throw new Error('Taming entry is already published');
  publishEntryOwner(ctx.scope, 'taming', row.publish, ride.taming);
  runtime.interactables.push(ride.interactable);
  ctx.scope.onDispose(() => { const at = runtime.interactables.indexOf(ride.interactable); if (at !== -1) runtime.interactables.splice(at, 1); });
  if (row.object !== undefined) ctx.scope.expose(runtime.objects, row.object, ride);
}
