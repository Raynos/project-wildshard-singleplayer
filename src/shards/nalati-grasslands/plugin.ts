import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';
import RuntimePlugin from './runtime/index';

const DEBUG_ROWS = [{ id: 'nalatiHybrid', group: 'loading', label: 'Nalati hybrid boot',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-10-11', note: 'E435 SF48: transitional trusted home boot; retires under G112 after parity and residency proof.' }] as const;

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class NalatiPlugin extends RuntimePlugin {}

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

/** Admit the declared data only after the default-off choice; OFF uses the original context and staged runtime. */
class NalatiHybrid extends ShardPlugin {
  private composite: ShardPlugin | undefined;
  private readonly Legacy: new () => ShardPlugin;
  private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin>;
  constructor(Legacy: new () => ShardPlugin = RuntimePlugin, admit: (ctx: ShardContext) => Promise<ShardPlugin> = prepareNalatiHybrid) {
    super(); this.Legacy = Legacy; this.admit = admit;
  }
  override async world(ctx: ShardContext): Promise<void> {
    if (!runtimeVariantEnabled(ctx, DEBUG_ROWS[0])) {
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
