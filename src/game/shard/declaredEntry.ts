import { standaloneHybridEntry, ShardPlugin, type ShardContext } from '../plugin/context';
import { prepareStandaloneHybrid, shardfileEntry } from './runtimeVariant';
import { admitClientPlan, installClientPhase, type AdmittedClientPlan, type ClientPhase } from '../shardfile/clientPlan';

/** Client-only build-generated first-party links, never shardfile data or a dynamic module lookup.
 * `nativePlan: false` keeps native-owned LEGACY phases; the admitted path still runs its plan.
 * This is transitional runtime scaffolding; client features themselves take only JSON rows. */
export function declaredRuntimeEntry(Runtime: new () => ShardPlugin, Native: new () => ShardPlugin,
  policy: { readonly entry: string; readonly retainHomeRuntime: boolean; readonly stagesOwner: 'declared' | 'runtime'; readonly nativePlan?: boolean }): {
    default: ReturnType<typeof standaloneHybridEntry>; resolveTrustedRuntime: (entry: string) => new () => ShardPlugin;
  } {
  const NativeEntry = clientPlanNative(Native);
  const Entry = standaloneHybridEntry(policy.nativePlan === false ? Native : NativeEntry, ctx => {
    if (!ctx.product.has('client/plan')) throw new Error('Declared runtime entry requires client/plan');
    return prepareStandaloneHybrid(ctx, { name: 'declared runtime', ...policy,
      runtime: { entry: policy.entry, load: () => Promise.resolve({ default: Runtime }) } });
  }, shardfileEntry, 'declared runtime');
  return { default: Entry, resolveTrustedRuntime: entry => {
    if (entry !== policy.entry) throw new Error('Unknown compiled runtime entry'); return Runtime;
  } };
}

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
      this.plan ??= admitClientPlan(ctx.product.section('client/plan'), ctx.product);
      await installClientPhase(ctx, this.plan, phase, ctx.scope);
    }
    override async world(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'world'); await super.world?.(ctx); await this.phase(ctx, 'world-bindings'); }
    override async kit(ctx: ShardContext): Promise<void> { await super.kit?.(ctx); await this.phase(ctx, 'kit'); }
    override async play(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'prepare-play'); await super.play?.(ctx); await this.phase(ctx, 'play'); }
  };
}
