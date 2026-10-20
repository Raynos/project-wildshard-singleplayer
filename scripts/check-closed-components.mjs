import { existsSync, globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMPONENTS, COMPONENT_SHARDS, componentInventory } from './shard-components.mjs';
import { codeLines, declarationOnlyConfig, declarationOnlyManifest, shaderCodeLines, sourceProgressInventory } from './shard-platform.mjs';
import { discoverGeneration } from './generate.mjs';

/** Closed component policy contains identities only: no adjustable line budgets.
 * @param {unknown} [input] */
export function closedComponents(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid closedComponents policy');
  for (const [shard, components] of Object.entries(input)) {
    if (!COMPONENT_SHARDS.includes(shard) || !Array.isArray(components) || components.length === 0
      || new Set(components).size !== components.length || components.some(id => !Object.hasOwn(COMPONENTS, id)))
      throw new Error(`Invalid closedComponents policy for ${shard}`);
  }
  return input;
}
/** Shrink-only counts retain the charged owner until its last line is removed.
 * @param {unknown} [input] */
export function closingComponents(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid closingComponents policy');
  for (const [shard, counts] of Object.entries(input)) {
    if (!COMPONENT_SHARDS.includes(shard) || counts === null || typeof counts !== 'object' || Array.isArray(counts)
      || Object.keys(counts).length === 0 || Object.entries(counts).some(([id, lines]) => !Object.hasOwn(COMPONENTS, id) || !Number.isSafeInteger(lines) || lines < 0))
      throw new Error(`Invalid closingComponents policy for ${shard}`);
  }
  return input;
}
/** Locks only accumulate; deleting a lock is a policy regression too. */
export function compareClosedComponents(before, after, beforeClosing = {}, afterClosing = {}) {
  const previous = closedComponents(before), next = closedComponents(after), failures = [];
  for (const [shard, components] of Object.entries(previous)) for (const id of components)
    if (!next[shard]?.includes(id)) failures.push(`${shard}: closed component ${id} lock removed`);
  const oldClosing = closingComponents(beforeClosing), nextClosing = closingComponents(afterClosing);
  for (const [shard, counts] of Object.entries(oldClosing)) for (const [id, lines] of Object.entries(counts)) {
    const nextLines = nextClosing[shard]?.[id];
    if (nextLines === undefined || nextLines > lines) failures.push(`${shard}: shrink-only component ${id} lock raised or removed`);
  }
  return failures;
}
/** The official component inventories also include sole-user platform charges. */
export function closedComponentFailures(rows, input, closing = {}) {
  const failures = [];
  for (const [shard, components] of Object.entries(closedComponents(input))) {
    const row = rows[shard]?.components;
    if (row === undefined) { failures.push(`${shard}: closed component inventory missing`); continue; }
    for (const id of components) {
      const lines = row.counts[id];
      if (lines !== 0) failures.push(`${shard}: CLOSED ${id} ${COMPONENTS[id]} has ${lines} custom lines`);
    }
  }
  for (const [shard, counts] of Object.entries(closingComponents(closing))) {
    const row = rows[shard]?.components;
    if (row === undefined) { failures.push(`${shard}: shrink-only component inventory missing`); continue; }
    for (const [id, limit] of Object.entries(counts)) {
      const lines = row.counts[id];
      if (lines > limit) failures.push(`${shard}: SHRINK-ONLY ${id} ${COMPONENTS[id]} has ${lines} custom lines, locked at ${limit}`);
      else if (lines < limit) failures.push(`${shard}: lower shrink-only ${id} lock from ${limit} to measured ${lines}`);
    }
  }
  return failures;
}
/** Fast staged-source check. The push check adds G294's verified product/host census. */
export function closedComponentSources(root, input, closing = {}) {
  const locks = structuredClone(closedComponents(input)), rows = {};
  // All local source tails are gone before a component enters closing. Its
  // remaining counts are platform chargebacks, checked by the full ruler.
  for (const [shard, counts] of Object.entries(closingComponents(closing)))
    locks[shard] = [...new Set([...(locks[shard] ?? []), ...Object.keys(counts)])];
  if (Object.keys(locks).length === 0) return [];
  const generated = new Set(existsSync(resolve(root, 'scripts/generation-jobs.json'))
    ? discoverGeneration(root).jobs.flatMap(job => job.outputs) : []);
  for (const shard of Object.keys(locks)) {
    const sources = [];
    for (const path of globSync(`src/shards/${shard}/**/*.{ts,tsx,glsl}`, { cwd: root })) {
      if (generated.has(path) || /(?:\/generators\/|\.d\.ts$|\.(?:test|spec)\.tsx?$|\/test\/)/u.test(path)) continue;
      const source = readFileSync(resolve(root, path), 'utf8');
      if (path.endsWith('/manifest.ts') && declarationOnlyManifest(source, path)
        || path.endsWith('/shard.config.ts') && declarationOnlyConfig(source, path)) continue;
      const shader = path.endsWith('.glsl'), lines = shader ? shaderCodeLines(source) : codeLines(source, path);
      if (lines > 0) sources.push({ path, kind: shader ? 'additional-glsl' : 'runtime-ts', lines });
    }
    rows[shard] = { components: componentInventory(root, shard, sources, sources.reduce((sum, row) => sum + row.lines, 0)) };
  }
  return closedComponentFailures(rows, locks);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '..');
  const policy = JSON.parse(readFileSync(resolve(root, 'lint/ratchet.json'), 'utf8'));
  const locks = closedComponents(policy.closedComponents), closing = closingComponents(policy.closingComponents);
  const failures = Object.keys(locks).length + Object.keys(closing).length === 0 ? [] : process.argv.includes('--source-only') ? closedComponentSources(root, locks, closing)
    : closedComponentFailures(sourceProgressInventory(root), locks, closing);
  if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Closed components: no custom lines reintroduced');
}
