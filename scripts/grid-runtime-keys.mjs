// G557: products use their compiler-read B1 key; shared runtime uses committed bytes.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { readBuildKey } from './shardfile-cache.mjs';

const sha = v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u));
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
export const GridRuntimeBindingSchema = v.strictObject({ schema: v.literal('grid-runtime-keys/1'), source: sha,
  runtime: digest, products: v.record(v.string(), digest) });
/** @type {Map<string,string>} */
const runtimeKeys = new Map();

/** Hash all shared runtime sources, bundler inputs and dependency pins, excluding shard product sources and proof/docs.
 * A shard's source, generated reads and compiler inputs remain covered by its existing B1 product key.
 * @param {string} root @param {string} revision @returns {string|undefined} */
export function gridRuntimeKey(root, revision) {
  if (!v.is(sha, revision)) return undefined;
  const key = `${resolve(root)}\0${revision}`;
  if (runtimeKeys.has(key)) return runtimeKeys.get(key);
  try {
    const tree = execFileSync('git', ['ls-tree', '-r', '-z', revision, '--', 'src', 'vite', 'index.html',
      'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.layers.json', 'vite.config.ts'],
    { cwd: root, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const entries = tree.toString('utf8').split('\0').filter(entry => entry !== '' && !entry.split('\t')[1]?.startsWith('src/shards/'));
    if (entries.length === 0) return undefined;
    const result = createHash('sha256').update('grid-runtime/1\0').update(entries.join('\0')).digest('hex');
    runtimeKeys.set(key, result); return result;
  } catch { return undefined; }
}

/** Bind a fresh measurement to the exact served dist's validated B1 keys without rebuilding or admitting any product.
 * Existing receipts without this binding retain exact-SHA eligibility only.
 * @param {string} root @param {string} revision @param {string} products */
export function gridRuntimeBinding(root, revision, products) {
  const runtime = gridRuntimeKey(root, revision);
  if (runtime === undefined) throw new Error('Missing committed grid runtime key');
  /** @type {Record<string,string>} */
  const keys = {};
  for (const entry of readdirSync(products, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(products, entry.name);
    const bytes = readFileSync(resolve(directory, 'shard.json'));
    const index = JSON.parse(bytes.toString('utf8'));
    const validation = JSON.parse(readFileSync(resolve(directory, 'validation.json'), 'utf8'));
    const product = readBuildKey(directory);
    if (index.format !== 'wildshard.shardfile' || index.formatVersion !== 2 || !v.is(digest, index.build?.sourceHash)
      || !v.is(digest, product) || validation.buildKey !== product || validation.indexHash !== createHash('sha256').update(bytes).digest('hex')
      || validation.sourceHash !== index.build?.sourceHash || validation.revision !== index.build?.validator) throw new Error(`Unbound product key: ${entry.name}`);
    keys[entry.name] = product;
  }
  if (Object.keys(keys).length === 0) throw new Error('Missing measured product keys');
  return v.parse(GridRuntimeBindingSchema, { schema: 'grid-runtime-keys/1', source: revision, runtime, products: keys });
}
