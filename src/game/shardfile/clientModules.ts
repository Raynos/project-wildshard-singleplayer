import { declareModuleGroups } from '@wildshard/engine/boot/download';
import { parseClientPlan, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardProduct } from './shardProduct';

/** Use the original parsed rows; a debug reader borrows dressing only when named. */
export function declareClientPlanModules(plan: {readonly features: readonly ClientFeatureRow[]}): void {
  declareModuleGroups(plan.features.filter(row => row.kind !== 'debug.expose' || row.source?.kind === 'dressing').map(row => row.kind));
}
/** The same admitted plan is available before the session fixes its loading total. */
export function declareProductClientModules(product: ShardProduct): void {
  if (!product.has('client/plan')) return;
  declareClientPlanModules(parseClientPlan(product.section('client/plan')));
}
