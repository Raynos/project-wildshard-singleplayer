import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, projectRuntimeFacts } from '@wildshard/game/plugin/headless';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { NineFacts } from '../world/feats';

/** G285: the page's sink for Nine Dragon's gameplay facts (world/feats.ts): the shardfile's ledger rows, bound to the
 *  profile (the platform grants each achievement once) and projected into Progress; nothing is granted here. */
export function bindNineFacts(ctx: Pick<ShardContext, 'app' | 'product'>, progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined,
  instance = ctx.product.slug): NineFacts {
  const facts = projectRuntimeFacts(bindRuntimeLedger(ctx, ctx.product.shardfile, instance), progress);
  return (name, entity) => { facts(name, entity); };
}
