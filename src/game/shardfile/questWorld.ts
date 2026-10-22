import * as v from 'valibot';
import { QuestWorldSchema } from '@wildshard/format/questWorld';
import type { ShardContext } from '../plugin/context';
import { registerQuestPageWorld } from '../quest/pageResources';
import { entryOwner } from './entryOwners';

const ended = (ctx: ShardContext): boolean => ctx.scope.disposed || ctx.scope.disposing;
/** Publish admitted static POI anchors and borrow the original ambient owner
 * after ranged preparation and before quest-page composition. */
export async function prepareQuestWorldEntry(ctx: ShardContext, file: string, ambient?: string): Promise<void> {
  if (ended(ctx)) throw new Error('Quest world owner has ended');
  const flock = ambient === undefined ? null : entryOwner(ctx.scope, 'ambient', ambient);
  const input = await ctx.product.json<unknown>(file);
  if (ended(ctx)) throw new Error('Quest world owner ended during read');
  if (ambient !== undefined && entryOwner(ctx.scope, 'ambient', ambient) !== flock) throw new Error('Quest world ambient owner changed during read');
  const rows = v.parse(QuestWorldSchema, input);
  registerQuestPageWorld(ctx.scope, rows.id, { pois: rows.pois, flock });
}
