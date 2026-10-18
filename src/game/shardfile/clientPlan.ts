import { buildYield } from '@wildshard/engine/core/workSlice';
import type { Scope } from '@wildshard/engine/app/scope';
import { parseClientPlan, type ClientFeatureKind, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import { ProductError, type ShardProduct } from './shardProduct';
import { installWorldScenes } from './worldScenes';
import type { SceneHandles } from './sceneHandles';
import { installEnteredRuntimeService, retainsRuntimeServices } from '../shard/retainedHooks';

export type ClientPhase = 'world' | 'kit' | 'play';
interface ClientFeature {
  readonly phase: ClientPhase;
  readonly rank: number;
  readonly lifetime: 'resident' | 'entered';
  readonly sections: readonly ('ui/strings' | 'world/scenes')[];
  readonly install: (ctx: ShardContext, row: ClientFeatureRow, resident: Scope) => Promise<void> | void;
}
const scenes = new WeakMap<Scope, WeakMap<ShardProduct, SceneHandles>>();
/** Compiled-in client-only registry. Adding a kind requires its strict format schema and a reviewed platform host. */
export const CLIENT_FEATURES: Readonly<Record<ClientFeatureKind, ClientFeature>> = {
  'strings.register': { phase: 'world', rank: 0, lifetime: 'entered', sections: ['ui/strings'],
    install: ctx => {
      const rows = ctx.product.section('ui/strings');
      if (!retainsRuntimeServices(ctx)) { ctx.strings(rows); return; }
      installEnteredRuntimeService(ctx, scope => { ctx.app.levelRegistrations.strings(rows, scope); });
    } },
  'world.scenes': { phase: 'world', rank: 20, lifetime: 'resident', sections: ['world/scenes'],
    install: async (ctx, _row, resident) => {
      const value = await installWorldScenes(ctx, ctx.product.section('world/scenes'), resident);
      let products = scenes.get(resident);
      if (products === undefined) { products = new WeakMap(); scenes.set(resident, products); }
      products.set(ctx.product, value);
      resident.onDispose(() => { if (products.get(ctx.product) === value) products.delete(ctx.product); });
    } },
  'debug.expose': { phase: 'play', rank: 100, lifetime: 'entered', sections: [], install: (ctx, row) => {
    if (row.kind !== 'debug.expose' || ctx.game.runtime === undefined) throw new Error('Client debug feature requires its runtime');
    ctx.debug.expose(row.name, ctx.game.runtime);
  } },
};
export interface AdmittedClientPlan { readonly features: readonly ClientFeatureRow[] }
/** Validate the whole plan and all required sections before the first feature can mutate the page. */
export function admitClientPlan(input: unknown, product: ShardProduct): AdmittedClientPlan {
  try {
    const plan = parseClientPlan(input);
    for (const row of plan.features) for (const name of CLIENT_FEATURES[row.kind].sections) {
      if (!product.has(name)) throw new Error(`Missing feature section ${name}`);
      product.section(name); // A listed stream section is not an admitted boot dependency.
    }
    return { features: plan.features };
  } catch (error) { throw new ProductError(product.slug, 'client/plan', 'schema', error instanceof Error ? error.message : 'Invalid client plan'); }
}
/** Run a platform-ordered phase with bounded frame-budget pauses. Resident scene construction is cached by its host. */
export async function installClientPhase(ctx: ShardContext, plan: AdmittedClientPlan, phase: ClientPhase, resident: Scope, lifetime?: 'resident' | 'entered'): Promise<void> {
  const rows = plan.features.filter(row => CLIENT_FEATURES[row.kind].phase === phase && (lifetime === undefined || CLIENT_FEATURES[row.kind].lifetime === lifetime))
    .sort((a, b) => CLIENT_FEATURES[a.kind].rank - CLIENT_FEATURES[b.kind].rank || (a.kind === 'debug.expose' ? a.name : a.kind).localeCompare(b.kind === 'debug.expose' ? b.name : b.kind));
  for (const row of rows) {
    if (ctx.scope.disposed || resident.disposed) throw new Error('Client feature owner is disposed');
    await CLIENT_FEATURES[row.kind].install(ctx, row, resident);
    await buildYield(ctx.scope);
  }
}
/** Named scene results for remaining first-party view code; no object/property reflection is accepted. */
export function clientSceneHandles(product: ShardProduct, resident: Scope): SceneHandles {
  const value = scenes.get(resident)?.get(product); if (value === undefined) throw new Error('Client plan has not built world.scenes'); return value;
}
