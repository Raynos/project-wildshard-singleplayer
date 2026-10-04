import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';

const DEBUG_ROWS = [{ id: 'driftwoodHybrid', group: 'loading', label: 'Driftwood hybrid boot',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-10-11', note: 'E435 SF46: scoped runtime boot under parity verification.' }] as const;

/** Compatibility fixture adapter delegates unchanged hooks to the declared trusted entry. */
export class DriftwoodPlugin extends RuntimePlugin {}

/** The opt-in path admits data, then runs the trusted world, loadout and adventure. */
class DriftwoodHybrid extends ShardPlugin {
  private composite: ShardPlugin | undefined;
  override async world(ctx: ShardContext): Promise<void> {
    if (!runtimeVariantEnabled(ctx, DEBUG_ROWS[0])) {
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
