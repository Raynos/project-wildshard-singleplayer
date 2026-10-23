import { declareModuleFiles, readModuleFiles } from '@wildshard/engine/boot/download';
import { parseClientPlan, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardProduct } from './shardProduct';

/** Reserve only selected compiler-owned graphs before their original imports.
 * This publishes byte facts into the existing ledger and fetches nothing. */
export function declareClientModules(kinds: readonly string[]): void {
  if (typeof document === 'undefined' || kinds.length === 0) return;
  const text = document.getElementById('boot-module-files')?.textContent;
  if (text === undefined) return; // Source and isolated fixtures have no compiler inventory.
  const input: unknown = JSON.parse(text);
  if (typeof input !== 'object' || input === null) throw new Error('Missing client module inventory');
  const bank: unknown = Reflect.get(input, 'optional');
  if (typeof bank !== 'object' || bank === null) throw new Error('Missing optional client module inventory');
  const files = readModuleFiles(Reflect.get(bank, 'files')), groups: unknown = Reflect.get(bank, 'groups');
  if (typeof groups !== 'object' || groups === null) throw new Error('Missing client module groups');
  const selected = new Map<number, readonly [string, number]>();
  for (const kind of new Set(kinds)) {
    const rows: unknown = Reflect.get(groups, kind);
    if (!Object.hasOwn(groups, kind) || !Array.isArray(rows) || rows.length > 4096) throw new Error('Missing selected client module group');
    for (const index of rows) {
      if (typeof index !== 'number' || !Number.isSafeInteger(index)) throw new Error('Invalid selected client module index');
      const file = files[index]; if (file === undefined) throw new Error('Missing selected client module file');
      selected.set(index, file);
    }
  }
  declareModuleFiles([...selected.values()]);
}
/** Use the original parsed rows; a debug reader borrows dressing only when named. */
export function declareClientPlanModules(plan: {readonly features: readonly ClientFeatureRow[]}): void {
  declareClientModules(plan.features.filter(row => row.kind !== 'debug.expose' || row.source?.kind === 'dressing').map(row => row.kind));
}
/** The same admitted plan is available before the session fixes its loading total. */
export function declareProductClientModules(product: ShardProduct): void {
  if (!product.has('client/plan')) return;
  declareClientPlanModules(parseClientPlan(product.section('client/plan')));
}
