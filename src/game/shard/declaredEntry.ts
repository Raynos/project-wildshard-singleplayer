import type { ClientFeatureKind } from '@wildshard/format/clientPlan';
import { standaloneHybridEntry, ShardPlugin, type ShardContext } from '../plugin/context';
import { prepareStandaloneHybrid, shardfileEntry } from './runtimeVariant';
import { admitClientPlan, installClientPhase, type AdmittedClientPlan, type ClientPhase } from '../shardfile/clientPlan';

/** Client-only build-generated first-party links, never shardfile data or a dynamic module lookup.
 * `nativePlan: false` keeps native-owned LEGACY phases; the admitted path still runs its plan.
 * A finite `nativePlan.phases` selection adds only migrated phases to native hooks.
 * This is transitional runtime scaffolding; client features themselves take only JSON rows. */
export function declaredRuntimeEntry(Runtime: new () => ShardPlugin, Native: new () => ShardPlugin,
  policy: { readonly entry: string; readonly retainHomeRuntime: boolean; readonly stagesOwner: 'declared' | 'runtime'; readonly nativePlan?: boolean | { readonly phases: readonly ClientPhase[]; readonly features?: readonly ClientFeatureKind[] } }): {
    default: ReturnType<typeof standaloneHybridEntry>; resolveTrustedRuntime: (entry: string) => new () => ShardPlugin;
  } {
  const selection = typeof policy.nativePlan === 'object' ? policy.nativePlan : undefined;
  const NativeEntry = clientPlanNative(Native, selection?.phases, selection?.features);
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

function clientPlanNative(Native: new () => ShardPlugin, phases?: readonly ClientPhase[], features?: readonly ClientFeatureKind[]): new () => ShardPlugin {
  const selected = phases === undefined ? undefined : new Set(phases);
  if (phases !== undefined && selected?.size !== phases.length) throw new Error('Duplicate native client phase');
  const kinds = features === undefined ? undefined : new Set(features);
  if (features !== undefined && (features.length === 0 || kinds?.size !== features.length)) throw new Error('Invalid native client feature selection');
  return class extends Native {
    private plan: AdmittedClientPlan | undefined;
    private async phase(ctx: ShardContext, phase: ClientPhase): Promise<void> {
      if (selected !== undefined && !selected.has(phase)) return;
      if (this.plan === undefined) {
        const plan = admitClientPlan(ctx.product.section('client/plan'), ctx.product);
        if (kinds !== undefined && [...kinds].some(kind => !plan.features.some(row => row.kind === kind))) throw new Error('Missing selected native client feature');
        this.plan = kinds === undefined ? plan : { features: plan.features.filter(row => kinds.has(row.kind)) };
      }
      await installClientPhase(ctx, this.plan, phase, ctx.scope);
    }
    override async world(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'world'); await super.world?.(ctx); await this.phase(ctx, 'world-bindings'); }
    override async kit(ctx: ShardContext): Promise<void> { await super.kit?.(ctx); await this.phase(ctx, 'kit'); }
    override async play(ctx: ShardContext): Promise<void> { await this.phase(ctx, 'prepare-play'); await super.play?.(ctx); await this.phase(ctx, 'play'); }
  };
}
