// iphone-downloads I12 (G792): each product's phone-tier download, held under its ceiling at build time.
// The ceilings are `wire/<product>/phone` in lint/ratchet.json's budgets, beside J10's JS chunk-gzip ceilings, and are
// ratcheted down after each row that saves bytes. The bytes are what the deploy serves a phone entry (I3, 2026-10-27):
// every file of the phone selection at the deploy's own brotli (quality 3, which matches Vercel's responses byte for
// byte), never more than the file itself, plus the declared wire of the commons the product requires. Only this wire
// total reads the brotli size: admission, memory, decoded and GPU charges keep the raw `compressed` and decoded bytes.
// No boot-smoke request counting.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

await import('./bake-loader.mjs');
const { loadHeadlessProduct } = await import('../src/sdk/headlessProduct.ts');
const { tierProductFilesPaced } = await import('../src/game/shardfile/productCost.ts');

/** the budget key that holds `name`'s phone ceiling */
export const phoneWireKey = name => `wire/${name}/phone`;

/**
 * The bytes the deploy sends for `bytes`: its brotli at quality 3 (Vercel's on-the-fly encoding; measured equal to
 * the live responses of Driftwood's GLB, bin, JSON and WASM files, 2026-10-27), or the file itself when that is smaller.
 * @param {Uint8Array} bytes
 */
export function servedBytes(bytes) {
  const encoded = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 3, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } });
  return Math.min(encoded.length, bytes.length);
}

/**
 * Measure `names` (built products under `<root>/out/`, or `products` when given) against lint/ratchet.json's ceilings.
 * A product with no ceiling is reported, not refused, so a new shard's first build lands its row.
 * @param {string} root
 * @param {readonly string[]} names
 * @param {string} [products] the folder that holds the built products (default `<root>/out`)
 * @returns {Promise<{ rows: { name: string, bytes: number, raw: number, ceiling: number | undefined }[], errors: string[] }>}
 */
export async function phoneWireReport(root, names, products = resolve(root, 'out')) {
  const budgets = JSON.parse(readFileSync(resolve(root, 'lint/ratchet.json'), 'utf8')).budgets ?? {};
  const rows = [], errors = [];
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const folder = resolve(products, name), source = (await loadHeadlessProduct(folder)).shardfile;
    const paths = new Map(JSON.parse(readFileSync(resolve(folder, 'shard.json'), 'utf8')).files.map(file => [file.hash, file.path]));
    const commons = source.requires.commons.reduce((sum, hash) => sum + (source.requires.commonsWire[hash] ?? 0), 0);
    let bytes = commons, raw = commons;
    for (const file of await tierProductFilesPaced(source, 'phone')) {
      const path = paths.get(file.hash);
      if (path === undefined) throw new Error(`phone wire: ${name} selects ${file.hash}, which its index does not list`);
      bytes += servedBytes(readFileSync(resolve(folder, path)));
      raw += file.compressed;
    }
    const ceiling = budgets[phoneWireKey(name)];
    rows.push({ name, bytes, raw, ceiling: typeof ceiling === 'number' ? ceiling : undefined });
    if (typeof ceiling === 'number' && bytes > ceiling) {
      errors.push(`phone wire: ${name} serves ${bytes} B (brotli) to a phone entry, past its ${ceiling} B ceiling (${phoneWireKey(name)} in lint/ratchet.json; a desktop-only file in the phone set, or new content that needs its own row)`);
    }
  }
  return { rows, errors };
}

if (process.argv[1] === import.meta.filename) {
  // node scripts/phone-wire.mjs [products folder]: every built product there, raw and served, against its ceiling
  const root = resolve(import.meta.dirname, '..'), products = resolve(process.argv[2] ?? resolve(root, 'out'));
  const { readdirSync, existsSync } = await import('node:fs');
  const names = readdirSync(products).filter(name => existsSync(resolve(products, name, 'shard.json')));
  const report = await phoneWireReport(root, names, products);
  for (const row of report.rows) console.info(`phone wire: ${row.name} ${(row.bytes / 1e6).toFixed(2)} MB served (raw ${(row.raw / 1e6).toFixed(2)} MB)${row.ceiling === undefined ? ' (no ceiling)' : ` of ${(row.ceiling / 1e6).toFixed(2)} MB`}`);
  for (const error of report.errors) console.error(error);
}
