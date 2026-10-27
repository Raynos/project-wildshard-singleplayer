// One candidate-only selection for commit and push gates. Adapters supply
// staged index bytes or the existing mirror index; loose files are never read.
import * as v from 'valibot';
import { candidateImportSources } from './precommit-imports.mjs';
import { selectRelatedSuites } from './precommit-selection.mjs';
import { stagedProjects } from './precommit-projects.mjs';

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const WIDE = /^(?:src\/(?:sdk|engine|format)\/|scripts\/(?:gen|build|bake|shardfile|product|compiler-code)[^/]*\.[cm]?[jt]s$)/u;
const RECIPE = new Set(['package.json','pnpm-lock.yaml','scripts/generation-jobs.json','scripts/test-products.json','scripts/source-generation-outputs.json']);
const Job = v.object({ id:v.string(), shard:v.nullable(v.string()), inputRoots:v.array(v.string()), outputs:v.array(v.string()) });
const Registry = v.record(v.string(),v.array(v.string()));
const sorted = (/** @type {Iterable<string>} */ names) => [...new Set(names)].sort();

/** Follow declared producer outputs transitively, not just source imports.
 * @param {string} root @param {import('./precommit-projects.mjs').StagedFiles} candidate
 * @param {readonly string[]} changed */
export function selectGateChecks(root, candidate, changed) {
  const read = (/** @type {string} */ file) => {
    const text = candidate.read(file);
    if (text === undefined) throw new Error(`Gate selection requires candidate ${file}`);
    return /** @type {unknown} */ (JSON.parse(text));
  };
  const jobs = v.parse(v.object({jobs:v.array(Job)}),read('scripts/generation-jobs.json')).jobs;
  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('Duplicate candidate generator id');
  const registry = v.parse(Registry,read('scripts/test-products.json'));
  const frozen = candidate.paths.includes('lint/legacy-shards.json')
    ? v.parse(v.object({shards:v.record(v.string(),v.unknown())}),read('lint/legacy-shards.json')).shards : {};
  const folders = sorted(candidate.paths.flatMap(file => {
    const folder = /^src\/shards\/([^/]+)\/shard\.config\.ts$/u.exec(file)?.[1];
    return folder === undefined || Object.hasOwn(frozen,folder) ? [] : [folder];
  }));
  /** @type {Map<string,string[]>} */
  const outputs = new Map();
  for (const folder of folders) {
    const path = `src/shards/${folder}/outputs.json`;
    const names = candidate.paths.includes(path)
      ? v.parse(v.object({outputs:v.pipe(v.array(v.object({slug:v.pipe(v.string(),v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))})),v.minLength(1))}),read(path)).outputs.map(row => row.slug)
      : [folder];
    if (new Set(names).size !== names.length || names.some(name => name === folder && candidate.paths.includes(path)))
      throw new Error(`Invalid candidate product outputs: ${folder}`);
    outputs.set(folder,names);
  }
  const allProducts = [...outputs.values()].flat();
  if (new Set(allProducts).size !== allProducts.length) throw new Error('Duplicate candidate product slug');
  const catalogueChanged = changed.includes('scripts/generation-jobs.json');
  const wide = changed.some(file => !TEST.test(file) && (WIDE.test(file) || RECIPE.has(file)));
  const inputs = new Set(changed);
  /** @type {Set<string>} */ const generators = new Set();
  /** @type {Set<string>} */ const touched = new Set();
  const addFolder = (/** @type {string} */ folder) => {
    const products = outputs.get(folder);
    if (products === undefined) throw new Error(`Unknown candidate product folder: ${folder}`);
    for (const product of products) touched.add(product);
  };
  if (wide) for (const folder of folders) addFolder(folder);
  for (const file of changed) {
    const folder = /^src\/shards\/([^/]+)\//u.exec(file)?.[1];
    if (folder !== undefined && !TEST.test(file) && outputs.has(folder)) addFolder(folder);
  }
  let advanced;
  do {
    advanced = false;
    for (const job of jobs) {
      if (generators.has(job.id) || !catalogueChanged && !job.inputRoots.some(input => [...inputs].some(file => file === input || file.startsWith(`${input}/`)))) continue;
      generators.add(job.id); advanced = true;
      for (const output of job.outputs) inputs.add(output);
      if (job.shard !== null) addFolder(job.shard);
    }
  } while (advanced);
  const syntax = candidateImportSources(root,candidate);
  const paths = sorted([...candidate.paths,...jobs.flatMap(job => job.outputs)]);
  const related = selectRelatedSuites(syntax.sources,[...inputs],paths,20,syntax.imports);
  const tests = sorted([...related.files,...Object.entries(registry).flatMap(([file,products]) =>
    products.some(product => touched.has(product)) && candidate.paths.includes(file) ? [file] : [])]);
  const products = sorted([...touched,...tests.flatMap(file => registry[file] ?? [])]);
  for (const product of products) if (!allProducts.includes(product)) throw new Error(`Unknown candidate test product: ${product}`);
  const {projects,project,name} = stagedProjects(root,candidate);
  const fullTypes = wide && candidate.paths.includes('tsconfig.json');
  if (fullTypes || candidate.paths.includes('tsconfig.json') && changed.some(file => file.startsWith('test/'))) project('tsconfig.json');
  const configs = fullTypes ? ['tsconfig.json'] : [...projects].filter(([,parsed]) => parsed.fileNames.some(file => changed.includes(name(file)))).map(([config]) => config);
  return {tests,projects:sorted(configs),products,touchedProducts:sorted(touched),generators:sorted(generators),related,wide};
}
