import { standaloneHybridEntry, ShardPlugin, type ShardContext } from '../plugin/context';
import { prepareStandaloneHybrid, shardfileEntry } from './runtimeVariant';
import { admitClientPlan, installClientPhase, type AdmittedClientPlan, type ClientPhase } from '../shardfile/clientPlan';

/** Built-in client-plan entry. Its policy names ownership only; all content
 * arrives through admitted finite features and there is no trusted TS lookup. */
export function declaredClientPlanEntry(policy: { readonly retainHomeRuntime: boolean; readonly stagesOwner: 'declared' | 'runtime' }): {
  default: ReturnType<typeof standaloneHybridEntry>;
} {
  class EmptyRuntime extends ShardPlugin {}
  const Native = clientPlanNative(EmptyRuntime);
  return { default: standaloneHybridEntry(Native, ctx => {
    if (!ctx.product.has('client/plan') || ctx.product.shardfile.runtime === null || 'entry' in ctx.product.shardfile.runtime) throw new Error('Client-plan entry requires its compiled runtime declaration');
    return prepareStandaloneHybrid(ctx, { name: 'client-plan runtime', platform: 'client-plan', ...policy });
  }, shardfileEntry, 'client-plan runtime') };
}

function clientPlanNative(Native: new () => ShardPlugin): new () => ShardPlugin {
  return class extends Native {
    private plan: AdmittedClientPlan | undefined;
    private async phase(ctx: ShardContext, phase: ClientPhase): Promise<void> {
      if (this.plan === undefined) {
        const plan = admitClientPlan(ctx.product.section('client/plan'), ctx.product);
        this.plan = plan;
      }
      await installClientPhase(ctx, this.plan, phase, ctx.scope);
    }
    override async world(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'world'); await super.world?.(ctx); await this.phase(ctx, 'world-bindings'); }
    override async kit(ctx: ShardContext): Promise<void> { await super.kit?.(ctx); await this.phase(ctx, 'kit'); }
    override async play(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'prepare-play'); await super.play?.(ctx); await this.phase(ctx, 'play'); }
  };
}
