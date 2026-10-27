import type { Shardfile } from '@wildshard/format/shardSchema';
import { SKIN_LOOK_RECIPE } from '@wildshard/format/skins';
import { declareModuleGroups, preloadModuleGroups } from '@wildshard/engine/boot/download';
import { parseClientPlan, clientPlanModuleGroups, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardProduct } from './shardProduct';

/** Use the original parsed rows; a debug reader borrows dressing only when named. */
export function declareClientPlanModules(plan: {readonly features: readonly ClientFeatureRow[]}): void {
  declareModuleGroups(clientPlanModuleGroups(plan));
}
/** The same admitted plan is available before the session fixes its loading total. */
export function declareProductClientModules(product: ShardProduct): void {
  if (!product.has('client/plan')) return;
  declareClientPlanModules(parseClientPlan(product.section('client/plan')));
}

/** Verified metadata selects only code its existing world/kit/loadout calls need.
 * Prepare reads while asset admission runs; installation remains at the original sites. */
export function prepareClientModuleGroups(source: Pick<Shardfile, 'rows' | 'items'>, sections: ReadonlyMap<string, unknown>): void {
  const plan = sections.get('client/plan'), groups = plan === undefined ? [] : clientPlanModuleGroups(parseClientPlan(plan));
  // An Explorer catalogue is metadata, not a spawn-view request. Its code loads at the original Explorer entry.
  if (source.rows.looks.some(look => look.recipe === SKIN_LOOK_RECIPE) || source.items.rows.some(row => row.view.asset !== undefined)) groups.push('models.gltf');
  preloadModuleGroups(groups);
}
