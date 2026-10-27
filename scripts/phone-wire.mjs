// iphone-downloads I12 (G792): each product's declared phone-tier wire, held under its ceiling at build time.
// The ceilings are `wire/<product>/phone` in lint/ratchet.json's budgets, beside J10's JS chunk-gzip ceilings, and are
// ratcheted down after each row that saves bytes. The sum is what admission reserves before a phone entry fetches:
// the phone selection's compressed files plus the commons the product requires. No boot-smoke request counting.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

await import('./bake-loader.mjs');
const { loadHeadlessProduct } = await import('../src/sdk/headlessProduct.ts');
const { tierProductWire } = await import('../src/game/shardfile/productCost.ts');

/** the budget key that holds `name`'s phone ceiling */
export const phoneWireKey = name => `wire/${name}/phone`;

/**
 * Measure `names` (built products under `<root>/out/`) against lint/ratchet.json's ceilings.
 * A product with no ceiling is reported, not refused, so a new shard's first build lands its row.
 * @param {string} root
 * @param {readonly string[]} names
 * @returns {Promise<{ rows: { name: string, bytes: number, ceiling: number | undefined }[], errors: string[] }>}
 */
export async function phoneWireReport(root, names) {
  const budgets = JSON.parse(readFileSync(resolve(root, 'lint/ratchet.json'), 'utf8')).budgets ?? {};
  const rows = [], errors = [];
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const bytes = await tierProductWire((await loadHeadlessProduct(resolve(root, 'out', name))).shardfile, 'phone');
    const ceiling = budgets[phoneWireKey(name)];
    rows.push({ name, bytes, ceiling: typeof ceiling === 'number' ? ceiling : undefined });
    if (typeof ceiling === 'number' && bytes > ceiling) {
      errors.push(`phone wire: ${name} declares ${bytes} B for a phone entry, past its ${ceiling} B ceiling (${phoneWireKey(name)} in lint/ratchet.json; a desktop-only file in the phone set, or new content that needs its own row)`);
    }
  }
  return { rows, errors };
}
