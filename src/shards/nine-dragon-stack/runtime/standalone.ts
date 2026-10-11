import type { ShardContext } from '@wildshard/game/plugin/context';
import { type ShardPlugin, standaloneHybridEntry } from '@wildshard/game/plugin/shardPlugin';
import { shardfileEntry } from '@wildshard/game/shard/runtimeVariant';

async function prepareHybrid(ctx: ShardContext): Promise<ShardPlugin> {
  const [{ prepareHybridShard }, { default: source }] = await Promise.all([
    import('@wildshard/game/shardfile/hybrid'), import('../shard.config'),
  ]);
  return prepareHybridShard(source, { firstParty: true }, {
    residencyContext: ctx, retainHomeRuntime: true,
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
    icon: () => { throw new Error('Transitional Nine Dragon has no declared item icon'); },
  }, [{ slug: source.identity.slug, entry: 'runtime/index.ts', load: () => import('./index') }]);
}

/** SF73: admit this primary's data and bound runtime for SHARDFILE, preserving the supplied native LEGACY constructor. */
export function standaloneEntry(Native: new () => ShardPlugin): new (
  Legacy?: new () => ShardPlugin, admit?: (ctx: ShardContext) => Promise<ShardPlugin>,
  shardfile?: (ctx: ShardContext) => boolean,
) => Required<ShardPlugin> {
  return standaloneHybridEntry(Native, prepareHybrid, shardfileEntry, 'Nine Dragon');
}
