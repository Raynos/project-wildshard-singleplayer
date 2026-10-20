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
/** Locks only accumulate; deleting a lock is a policy regression too. */
export function compareClosedComponents(before, after) {
  const previous = closedComponents(before), next = closedComponents(after), failures = [];
  for (const [shard, components] of Object.entries(previous)) for (const id of components)
    if (!next[shard]?.includes(id)) failures.push(`${shard}: closed component ${id} lock removed`);
  return failures;
}
/** The official component inventories also include sole-user platform charges. */
export function closedComponentFailures(rows, input) {
  const failures = [];
  for (const [shard, components] of Object.entries(closedComponents(input))) {
    const row = rows[shard]?.components;
    if (row === undefined) { failures.push(`${shard}: closed component inventory missing`); continue; }
    for (const id of components) {
      const lines = row.counts[id];
      if (lines !== 0) failures.push(`${shard}: CLOSED ${id} ${COMPONENTS[id]} has ${lines} custom lines`);
    }
  }
  return failures;
}
/** Fast staged-source check. The push check adds G294's verified product/host census. */
export function closedComponentSources(root, input) {
  const locks = closedComponents(input), rows = {};
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
  const locks = closedComponents(JSON.parse(readFileSync(resolve(root, 'lint/ratchet.json'), 'utf8')).closedComponents);
  const failures = Object.keys(locks).length === 0 ? [] : process.argv.includes('--source-only') ? closedComponentSources(root, locks)
    : closedComponentFailures(sourceProgressInventory(root), locks);
  if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Closed components: no custom lines reintroduced');
}
