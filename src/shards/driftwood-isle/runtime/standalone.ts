import type { ShardContext } from '@wildshard/game/plugin/context';
import { type ShardPlugin, standaloneHybridEntry } from '@wildshard/game/plugin/shardPlugin';
import { shardfileEntry } from '@wildshard/game/shard/runtimeVariant';

async function prepareHybrid(ctx: ShardContext): Promise<ShardPlugin> {
  const [{ prepareHybridShard }, { default: source }] = await Promise.all([
    import('@wildshard/game/shardfile/hybrid'), import('../shard.config'),
  ]);
  return prepareHybridShard(source, { firstParty: true }, {
    residencyContext: ctx, 
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
    icon: () => { throw new Error('Transitional Driftwood has no declared item icon'); },
  }, [{ slug: source.identity.slug, entry: 'runtime/hybrid.ts', load: () => import('./hybrid') }]);
}

/** Admit Driftwood's data and native runtime through the existing shared staged entry owner. */
export function standaloneEntry(Native: new () => ShardPlugin): new (
  Legacy?: new () => ShardPlugin, admit?: (ctx: ShardContext) => Promise<ShardPlugin>,
  shardfile?: (ctx: ShardContext) => boolean,
) => Required<ShardPlugin> {
  return standaloneHybridEntry(Native, prepareHybrid, shardfileEntry, 'Driftwood');
}
