import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
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
  return class extends ShardPlugin {
    private composite: ShardPlugin | undefined;
    constructor(private readonly Legacy: new () => ShardPlugin = Native,
      private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin> = prepareHybrid,
      private readonly shardfile: (ctx: ShardContext) => boolean = shardfileEntry) { super(); }
    override async world(ctx: ShardContext): Promise<void> {
      this.composite = this.shardfile(ctx) ? await this.admit(ctx) : new this.Legacy();
      await this.composite.world?.(ctx);
    }
    override async kit(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error('Nine Dragon hybrid world is not admitted');
      await this.composite.kit?.(ctx);
    }
    override async play(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error('Nine Dragon hybrid world is not admitted');
      await this.composite.play?.(ctx);
    }
  };
}
