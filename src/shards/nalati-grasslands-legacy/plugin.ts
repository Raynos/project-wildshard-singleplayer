import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { shardfileEntry } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class NalatiPlugin extends RuntimePlugin {}

/** Resolve only this module's declared regional entry after the ordinary lazy plugin admission. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return RuntimePlugin;
}

async function prepareNalatiHybrid(ctx: ShardContext): Promise<ShardPlugin> {
  const [{ prepareHybridShard }, { default: source }] = await Promise.all([
    import('@wildshard/game/shardfile/hybrid'), import('./shard.config'),
  ]);
  return prepareHybridShard(source, { firstParty: true }, {
    residencyContext: ctx,
    retainHomeRuntime: true,
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
    icon: () => { throw new Error('Transitional Nalati has no declared item icon'); },
  }, [{ slug: source.identity.slug, entry: 'runtime/index.ts', load: () => import('./runtime/index') }]);
}

/** SF65 (G237–G239): SHARD SELECT's SHARDFILE admits the declared data (SF48 hybrid); LEGACY (the public entry) runs the
 *  original context and staged runtime. */
class NalatiHybrid extends ShardPlugin {
  private composite: ShardPlugin | undefined;
  private readonly Legacy: new () => ShardPlugin;
  private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin>;
  private readonly shardfile: (ctx: ShardContext) => boolean;
  constructor(Legacy: new () => ShardPlugin = RuntimePlugin, admit: (ctx: ShardContext) => Promise<ShardPlugin> = prepareNalatiHybrid,
    shardfile: (ctx: ShardContext) => boolean = shardfileEntry) {
    super(); this.Legacy = Legacy; this.admit = admit; this.shardfile = shardfile;
  }
  override async world(ctx: ShardContext): Promise<void> {
    if (!this.shardfile(ctx)) {
      this.composite = new this.Legacy();
      await this.composite.world?.(ctx);
      return;
    }
    this.composite = await this.admit(ctx);
    await this.composite.world?.(ctx);
  }
  override async kit(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Nalati hybrid world is not admitted'); await this.composite.kit?.(ctx);
  }
  override async play(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Nalati hybrid kit is not admitted'); await this.composite.play?.(ctx);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiHybrid;
