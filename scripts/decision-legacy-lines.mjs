// Repo-only build policy: the SDK receives a number and never reads lint or frozen source inventories.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync } from 'vite';
import * as v from 'valibot';
import { legacyInventory } from './legacy-shards.mjs';
import { discoverGeneration } from './generate.mjs';

const pathSchema = v.pipe(v.string(), v.check(path => path.length > 0 && !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')));
const sourceOutputs = v.strictObject({ schema: v.literal('source-generation-outputs/1'), producers: v.record(pathSchema, v.array(pathSchema)) });
/** Exact producer exclusions from the sealed denominator, projected onto each frozen inventory. */
export function legacyGeneratedPaths(root, frozen = legacyInventory(root)) {
  const generated = new Set(existsSync(resolve(root, 'scripts/generation-jobs.json')) ? discoverGeneration(root).jobs.flatMap(job => job.outputs) : []);
  const source = resolve(root, 'scripts/source-generation-outputs.json');
  if (existsSync(source)) for (const paths of Object.values(v.parse(sourceOutputs, JSON.parse(readFileSync(source, 'utf8'))).producers)) for (const path of paths) generated.add(path);
  for (const [folder, row] of Object.entries(frozen.shards)) {
    const prefix = `src/shards/${row.primary}/`;
    for (const path of generated) if (path.startsWith(prefix)) generated.add(`src/shards/${folder}/${path.slice(prefix.length)}`);
  }
  return generated;
}
function count(root, path) {
  const source = readFileSync(resolve(root, path), 'utf8'), parsed = parseSync(path, source), chunks = [];
  if (parsed.errors.length > 0) throw new Error(`Invalid frozen TypeScript: ${path}`);
  let cursor = 0;
  for (const {start, end} of parsed.comments) { chunks.push(source.slice(cursor, start), source.slice(start, end).replaceAll(/[^\n]/gu, ' ')); cursor = end; }
  chunks.push(source.slice(cursor)); return chunks.join('').split('\n').filter(line => line.trim()).length;
}
/** Same sealed denominator for the official build adapter and P4 ruler; no build or output measurement recursion. */
export function decisionLegacyLines(root, slug, options = {}) {
  const frozen = legacyInventory(root), pair = Object.entries(frozen.shards).find(([, row]) => row.primary === slug);
  if (pair === undefined) return undefined;
  if (!frozen.sealed) throw new Error('Decision budget requires a sealed legacy inventory');
  const [folder, row] = pair, generated = options.generated ?? legacyGeneratedPaths(root, frozen), reader = options.count ?? (path => count(root, path));
  const lines = Object.keys(row.files).filter(path => /\.tsx?$/u.test(path) && !path.endsWith('.d.ts') && !/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.tsx?$/u.test(path))
    .reduce((total, path) => { const file = `src/shards/${folder}/${path}`; return total + (generated.has(file) ? 0 : reader(file)); }, 0);
  if (lines <= 0) throw new Error(`${slug}: frozen legacy has no authored TypeScript lines`);
  return lines;
}
