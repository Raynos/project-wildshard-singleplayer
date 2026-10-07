import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';
import type { prepareHybridShard as prepareTrustedHybrid } from '@wildshard/game/shardfile/hybrid';
import RuntimePlugin from './runtime/index';
import { pineMemoryTrim } from './debug/options';
import { bindPineViewTrim } from './look/viewDistance';

const DEBUG_ROWS = [{ id: 'pineHybrid', group: 'loading', label: 'Pine Hollow hybrid boot',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-10-11', note: 'E435 SF47: transitional trusted home boot; retires under G112 after parity and residency proof.' }] as const;

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class PineHollow extends RuntimePlugin {}

/** Admit the retained ON home; fixtures can inject the same trusted preparation contract. */
export async function preparePineHybrid(ctx: ShardContext,
  prepare?: typeof prepareTrustedHybrid): Promise<ShardPlugin> {
  const [{ prepareHybridShard }, { default: source }] = await Promise.all([
    import('@wildshard/game/shardfile/hybrid'), import('./shard.config'),
  ]);
  return (prepare ?? prepareHybridShard)(source, { firstParty: true }, {
    residencyContext: ctx,
    retainHomeRuntime: true,
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(),
    icon: () => { throw new Error('Transitional Pine has no declared item icon'); },
  }, [{ slug: source.identity.slug, entry: 'runtime/index.ts', load: () => import('./runtime/index') }]);
}

/** Admit the declared data only after the default-off choice; OFF uses the original context and staged runtime. */
class PineHybrid extends ShardPlugin {
  private composite: ShardPlugin | undefined;
  private readonly Legacy: new () => ShardPlugin;
  private readonly admit: (ctx: ShardContext) => Promise<ShardPlugin>;
  constructor(Legacy: new () => ShardPlugin = RuntimePlugin, admit: (ctx: ShardContext) => Promise<ShardPlugin> = preparePineHybrid) {
    super(); this.Legacy = Legacy; this.admit = admit;
    bindPineViewTrim(pineMemoryTrim); // G187: before the level applies its tier row
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
    if (this.composite === undefined) throw new Error('Pine hybrid world is not admitted'); await this.composite.kit?.(ctx);
  }
  override async play(ctx: ShardContext): Promise<void> {
    if (this.composite === undefined) throw new Error('Pine hybrid kit is not admitted'); await this.composite.play?.(ctx);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHybrid;
