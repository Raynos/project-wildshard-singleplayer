import type { ShardContext } from './context';
import { ShardPlugin } from './plugin';
import { shardfileEntry } from './runtimeVariant';
import type { Shardfile } from '../shardfile/schema';
import type { TrustedRuntimeEntry } from '../shardfile/runtime';

/** Where a first-party primary's shardfile and trusted runtime load from, lazily (each its own chunk). */
export interface StandaloneSources {
  /** The shard's display name in its errors. */
  readonly name: string;
  readonly source: () => Promise<{ readonly default: Shardfile }>;
  /** The trusted runtime's declared entry (`runtime/index.ts`) and its loader. */
  readonly entry: string;
  readonly runtime: TrustedRuntimeEntry['load'];
}
/** A standalone entry's constructor: the native LEGACY plugin, the SHARDFILE admission and the switch between them. */
export type StandaloneEntry = new (Legacy?: new () => ShardPlugin, admit?: (ctx: ShardContext) => Promise<ShardPlugin>,
  shardfile?: (ctx: ShardContext) => boolean) => Required<ShardPlugin>;

/**
 * A first-party primary's standalone entry (SF73, generic since SF27): under SHARDFILE its shardfile's data and bound
 * trusted runtime are admitted as a hybrid (`prepareHybridShard`: retained home runtime, no declared catalogue, items,
 * recipes or voices; an item icon request refuses), else the supplied native LEGACY constructor runs.
 */
export function standaloneHybridEntry(Native: new () => ShardPlugin, sources: StandaloneSources): StandaloneEntry {
  const prepareHybrid = async (ctx: ShardContext): Promise<ShardPlugin> => {
    const [{ prepareHybridShard }, { default: source }] = await Promise.all([import('../shardfile/hybrid'), sources.source()]);
    return prepareHybridShard(source, { firstParty: true }, {
      residencyContext: ctx, retainHomeRuntime: true,
      catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
      icon: () => { throw new Error(`Transitional ${sources.name} has no declared item icon`); },
    }, [{ slug: source.identity.slug, entry: sources.entry, load: sources.runtime }]);
  };
  return class extends ShardPlugin {
    private composite: ShardPlugin | undefined;
    private readonly Legacy: new () => ShardPlugin;
    private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin>;
    private readonly shardfile: (ctx: ShardContext) => boolean;
    constructor(Legacy: new () => ShardPlugin = Native, admit: (ctx: ShardContext) => Promise<ShardPlugin> = prepareHybrid,
      shardfile: (ctx: ShardContext) => boolean = shardfileEntry) {
      super(); this.Legacy = Legacy; this.admit = admit; this.shardfile = shardfile;
    }
    override async world(ctx: ShardContext): Promise<void> {
      this.composite = this.shardfile(ctx) ? await this.admit(ctx) : new this.Legacy();
      await this.composite.world?.(ctx);
    }
    override async kit(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error(`${sources.name} hybrid world is not admitted`);
      await this.composite.kit?.(ctx);
    }
    override async play(ctx: ShardContext): Promise<void> {
      if (this.composite === undefined) throw new Error(`${sources.name} hybrid world is not admitted`);
      await this.composite.play?.(ctx);
    }
  };
}
