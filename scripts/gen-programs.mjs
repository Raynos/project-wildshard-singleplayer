// GR2: converted author programs do not load the legacy producer scheduler.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync } from 'vite';
import { legacyInventory } from './legacy-shards.mjs';
import { shardProducts } from './shard-outputs.mjs';

/** The SDK's named, value-level generate export is the conversion boundary.
 * Never execute a config just to discover its build mode.
 * @param {string} source */
export function hasProjectGenerator(source) {
  const parsed = parseSync('shard.config.ts', source);
  if (parsed.errors.length > 0) throw new Error('Generation config does not parse');
  return parsed.program.body.some(node => {
    if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type') return false;
    const own = node.declaration;
    return own?.type === 'VariableDeclaration' && own.declarations.some(row => row.id.type === 'Identifier' && row.id.name === 'generate')
      || own?.type === 'FunctionDeclaration' && own.id?.name === 'generate'
      || node.specifiers.some(row => row.exportKind !== 'type' && (row.exported.name ?? row.exported.value) === 'generate');
  });
}

/** @typedef {{products:string[],folders:string[],legacy:string[],scoped:boolean}} GenerationPlan */
/** Resolve product slugs to source folders once; frozen legacy is never built.
 * Partial conversions retain the scheduler until their last catalogue row goes.
 * @param {string} root @param {string} [requested] @returns {GenerationPlan} */
export function generationPlan(root, requested) {
  const frozen = legacyInventory(root), directory = resolve(root, 'src/shards');
  const folders = readdirSync(directory, { withFileTypes: true }).filter(row => row.isDirectory()
    && !Object.hasOwn(frozen.shards, row.name) && existsSync(resolve(directory, row.name, 'shard.config.ts'))).map(row => row.name).sort();
  const products = shardProducts(root, folders);
  const selected = requested === undefined ? products.map(row => row.slug) : requested.split(',');
  if (selected.length === 0 || new Set(selected).size !== selected.length
    || selected.some(slug => !/^[a-z0-9_-]+$/u.test(slug) || !products.some(row => row.slug === slug))) throw new Error(`Generation unknown or duplicate shard: ${requested}`);
  const selectedFolders = [...new Set(products.filter(row => selected.includes(row.slug)).map(row => row.folder))];
  const programs = selectedFolders.filter(folder => hasProjectGenerator(readFileSync(resolve(directory, folder, 'shard.config.ts'), 'utf8')));
  const catalogue = resolve(root, 'scripts/generation-jobs.json');
  const remaining = new Set();
  if (existsSync(catalogue)) {
    const data = JSON.parse(readFileSync(catalogue, 'utf8'));
    if (!Array.isArray(data.jobs)) throw new Error('Generation catalogue needs jobs');
    for (const job of data.jobs) remaining.add(job.shard);
  }
  const converted = new Set(programs.filter(folder => !remaining.has(folder)));
  return { products: selected, folders: selectedFolders, legacy: selectedFolders.filter(folder => !converted.has(folder)), scoped: requested !== undefined };
}

/** Only the legacy branch imports generate.mjs. The ordinary builder retains
 * its pool, byte validation, maps, cache receipts and failure propagation.
 * @param {string} root @param {GenerationPlan} plan @param {number} concurrency */
export async function prepareProgramInputs(root, plan, concurrency) {
  if (plan.legacy.length === 0) return;
  const { prepareGeneration } = await import('./generate.mjs');
  await prepareGeneration(root, { concurrency, ...(plan.scoped ? { shards: plan.legacy } : {}) });
}

/** @param {string} root @param {GenerationPlan} plan @param {boolean} [reuse] */
export async function buildPrograms(root, plan, reuse = false) {
  const { buildShardfiles } = await import('./build-shardfiles.mjs');
  return buildShardfiles(root, { reuse, ...(plan.scoped ? { scope: plan.products } : {}) });
}
