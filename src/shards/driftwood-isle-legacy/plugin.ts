import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { shardfileEntry } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';
import HybridRuntimePlugin from './runtime/hybrid';

/** Compatibility fixture adapter delegates unchanged hooks to the declared trusted entry. */
export class DriftwoodPlugin extends RuntimePlugin {}

/** Resolve the admitted regional entry after the ordinary lazy plugin import; standalone still uses its default. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/hybrid.ts') throw new Error('Unknown trusted runtime entry');
  return HybridRuntimePlugin;
}

/** Driftwood's public boot (SF46, G112 / G172): admit the shardfile, then run the trusted world, loadout and adventure.
 *  SF65 (G237): SHARD SELECT's LEGACY (Developer on) runs the original TypeScript runtime alone, no shardfile admitted. */
class DriftwoodHybrid extends ShardPlugin {
  private composite: ShardPlugin | undefined;
  private readonly shardfile: (ctx: ShardContext) => boolean;
  constructor(shardfile: (ctx: ShardContext) => boolean = shardfileEntry) { super(); this.shardfile = shardfile; }
  override async world(ctx: ShardContext): Promise<void> {
    if (!this.shardfile(ctx)) {
      this.composite = new RuntimePlugin();
      await this.composite.world?.(ctx);
      return;
    }
    const [{ prepareHybridShard }, { default: source }] = await Promise.all([
      import('@wildshard/game/shardfile/hybrid'), import('./shard.config'),
    ]);
    this.composite = await prepareHybridShard(source, { firstParty: true }, {
      residencyContext: ctx,
      catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
      icon: () => { throw new Error('Transitional Driftwood has no declared item icon'); },
    }, [{ slug: source.identity.slug, entry: 'runtime/hybrid.ts', load: () => import('./runtime/hybrid') }]);
    await this.composite.world?.(ctx);
  }
  override async kit(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Driftwood hybrid world is not admitted'); await this.composite.kit?.(ctx);
  }
  override async play(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Driftwood hybrid kit is not admitted'); await this.composite.play?.(ctx);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodHybrid;
