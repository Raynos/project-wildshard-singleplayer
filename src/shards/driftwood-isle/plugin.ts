import type { World } from '@wildshard/engine/core/bootstrap';
import type { Vector3 } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { prepareHybridShard, type HybridShardPlugin } from '@wildshard/game/shardfile/hybrid';
import type { DriftwoodWorld } from './world/build';
import type { DriftwoodPlugin as RuntimePlugin } from './runtime/index';
import source from './shard.config';

type WorldBuilder = (world: World, viewer: () => Vector3) => Promise<DriftwoodWorld>;

/** Compatibility fixture adapter delegates unchanged hooks to the declared trusted entry. */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly build: WorldBuilder | undefined;
  private runtime: Promise<RuntimePlugin> | undefined;
  constructor(build?: WorldBuilder) { super(); this.build = build; }
  private instance(): Promise<RuntimePlugin> {
    this.runtime ??= import('./runtime/index').then(({ default: Runtime }) => new Runtime(this.build));
    return this.runtime;
  }
  override async world(ctx: ShardContext): Promise<void> { await (await this.instance()).world(ctx); }
  override async kit(ctx: ShardContext): Promise<void> { (await this.instance()).kit(ctx); }
  override async play(ctx: ShardContext): Promise<void> { await (await this.instance()).play(ctx); }
}

/** The live standalone path admits its shardfile, then runs the unchanged trusted world, loadout and adventure. */
class DriftwoodHybrid extends ShardPlugin {
  private composite: HybridShardPlugin | undefined;
  override async world(ctx: ShardContext): Promise<void> {
    this.composite = await prepareHybridShard(source, { firstParty: true }, {
      catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
      icon: () => { throw new Error('Transitional Driftwood has no declared item icon'); },
    }, [{ slug: source.identity.slug, entry: 'runtime/index.ts', load: () => import('./runtime/index') }]);
    await this.composite.world(ctx);
  }
  override async kit(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Driftwood hybrid world is not admitted'); await this.composite.kit(ctx);
  }
  override async play(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Driftwood hybrid kit is not admitted'); await this.composite.play(ctx);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodHybrid;
