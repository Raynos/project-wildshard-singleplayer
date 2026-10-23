import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseOutputIndex } from '../src/format/outputIndex';

/** Compact compiler facts, not a second product admission or a file inventory.
 * Sections and blobs still pass their original size/hash/schema checks at runtime. */
export function productDownloadTotal(input: unknown, indexBytes: number): readonly [number, number] {
  const index = parseOutputIndex(input);
  const total = [...index.sections, ...index.schemas].reduce((sum, row) => sum + row.bytes, indexBytes)
    + index.files.reduce((sum, row) => sum + row.compressed, 0);
  if (!Number.isSafeInteger(indexBytes) || indexBytes < 0 || !Number.isSafeInteger(total)) throw new Error('Invalid product download total');
  return [indexBytes, total];
}

/** Only two sizes per shipped home ride the shell; full per-file rows stay in
 * that home's descriptor. Missing output roots in isolated web fixtures are empty. */
export function bootProductTotals(root: string): Readonly<Record<string, readonly [number, number]>> {
  const output = resolve(root, 'out'), rows: Record<string, readonly [number, number]> = {};
  if (!existsSync(output)) return rows;
  for (const entry of readdirSync(output, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const file = resolve(output, entry.name, 'shard.json');
    if (!existsSync(file)) continue;
    if (!/^[a-zA-Z0-9_-]+$/u.test(entry.name)) throw new Error('Invalid product download directory');
    const bytes = readFileSync(file), input: unknown = JSON.parse(bytes.toString('utf8'));
    rows[`/shardfiles/${entry.name}/`] = productDownloadTotal(input, bytes.byteLength);
  }
  return rows;
}
