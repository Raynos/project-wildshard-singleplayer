/** Client-only concrete held-claim phases. Product rows own the rig and native
 * item catalogue; entered loans preserve the original preparation instance. */
import type { ShardContext } from '../plugin/context';
import { HeldClaims } from '../loadout/claims';
import { entryOwner, publishEntryOwner } from './entryOwners';

const ended = (ctx: ShardContext): boolean => ctx.scope.disposed || ctx.scope.disposing;

/** Kit preparation precedes creature rows; publication never transfers native
 * disposal or creates an item/save authority. */
export async function prepareHeldClaimsEntry(ctx: ShardContext, id: string): Promise<void> {
  if (ended(ctx)) throw new Error('Held claim entry owner has ended');
  const held = await ctx.scope.run(() => HeldClaims.prepare(ctx));
  if (ended(ctx)) throw new Error('Held claim entry owner ended during preparation');
  publishEntryOwner(ctx.scope, 'claims', id, held);
}

/** Install the same prepared claims after creature registration and before the
 * ordinary kit catalogue, retaining all original native item ids and order. */
export function installHeldClaimsEntry(ctx: ShardContext, id: string): void {
  entryOwner(ctx.scope, 'claims', id).install();
}
