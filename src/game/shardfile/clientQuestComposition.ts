/** Finite entry preparation over the existing equipment and quest owners. */
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { QuestPageRows } from '@wildshard/format/questPageComposition';
import type { RangedPageRows } from '@wildshard/format/rangedPage';
import { pageModeValue } from '../shard/pagePolicy';
import { installRangedPage, rangedPage } from '../loadout/rangedPage';
import { prepareQuestPageComposition, installQuestPageComposition } from '../quest/pageComposition';
import type { ShardContext } from '../plugin/context';
import { publishEntryOwner } from './entryOwners';

const ended = (ctx: ShardContext): boolean => ctx.scope.disposed || ctx.scope.disposing;

/** Equipment installation precedes composition and uses the authored mode row. */
export async function installEntryRangedPage(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'held.ranged-page' }>): Promise<void> {
  const input = await ctx.product.json<RangedPageRows>(row.file);
  if (ended(ctx)) throw new Error('Entry left during ranged admission');
  await installRangedPage(ctx, { ...input, shadowBatch: row.shadowBatch === undefined ? input.shadowBatch : pageModeValue(row.shadowBatch) });
}
/** Publish concrete loans only after the same composition has finished. The
 * entry owns visibility; the existing manager, sound and quest hosts dispose. */
export async function installEntryQuestComposition(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'quest.composition' }>): Promise<void> {
  const rows = await ctx.product.json<QuestPageRows>(row.file);
  if (ended(ctx)) throw new Error('Entry left during quest admission');
  if (rows.id !== row.id) throw new Error('Quest composition identity differs from its entry row');
  const equipment = rangedPage(ctx.scope, row.ranged), animals = ctx.game.runtime?.play?.animals;
  if (animals === undefined) throw new Error('Quest composition requires its entered animals');
  await prepareQuestPageComposition(ctx, rows);
  if (ended(ctx)) throw new Error('Entry left during quest preparation');
  const quest = await installQuestPageComposition(ctx, rows);
  if (ended(ctx)) throw new Error('Entry left during quest installation');
  publishEntryOwner(ctx.scope, 'quest', row.id, quest);
  publishEntryOwner(ctx.scope, 'animals', row.animals, animals);
  publishEntryOwner(ctx.scope, 'sounds', row.sounds, equipment.ambience.sfx);
}
