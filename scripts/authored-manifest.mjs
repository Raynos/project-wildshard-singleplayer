import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export function shardManifestPath(root, slug) {
  return `src/shards/${slug}/${existsSync(resolve(root, `src/shards/${slug}/manifest.json`)) ? 'discovery.generated.ts' : 'manifest.ts'}`;
}
/** Literal imports keep authored image strings inside the bundler's asset graph. */
export function authoredManifestSource(root, slug) {
  const file = `src/shards/${slug}/manifest.json`;
  if (existsSync(resolve(root, `src/shards/${slug}/manifest.ts`))) throw new Error(`${file}: duplicate authored manifest authority`);
  const data = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  if (data.slug !== slug) throw new Error(`${file}: identity differs from its folder`);
  const images = new Set();
  const visit = value => {
    if (typeof value === 'string' && value.startsWith('/src/')) {
      if (!value.startsWith(`/src/shards/${slug}/`) || !/^\/src\/shards\/[a-z0-9_-]+\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp|svg|hdr)$/u.test(value) || value.includes('..') || !existsSync(resolve(root, value.slice(1)))) throw new Error(`${file}: missing or invalid source image ${value}`);
      images.add(value);
    } else if (typeof value === 'string' && value.startsWith('/assets/') && !existsSync(resolve(root, 'public', value.slice(1).split('?')[0]))) throw new Error(`${file}: missing public image ${value}`);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const value of [data.card, data.sky, data.minimap, data.explore, data.horizonStrips]) visit(value);
  const paths = [...images], imports = [], bound = new Map();
  const modulePath = value => {
    if (typeof value !== 'string' || !/^\.\/[a-zA-Z0-9_./-]+$/u.test(value) || value.split('/').includes('..')) throw new Error(`${file}: invalid binding module`);
    if (![value, `${value}.ts`, `${value}.js`, `${value}/index.ts`].some(path => existsSync(resolve(root, `src/shards/${slug}`, path)))) throw new Error(`${file}: unknown binding module ${value}`);
    return value;
  };
  const value = ref => {
    const path = modulePath(ref?.module), name = ref?.export;
    if (typeof name !== 'string' || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(name)) throw new Error(`${file}: invalid binding export`);
    const key = JSON.stringify([path, name]);
    if (bound.has(key)) return bound.get(key);
    const id = `binding${bound.size}`;
    if (path.endsWith('.json')) {
      imports.push(`import ${id} from ${JSON.stringify(path)} with { type: 'json' };`);
      if (name !== 'default') throw new Error(`${file}: JSON bindings name their default export`);
    } else imports.push(`import { ${name} as ${id} } from ${JSON.stringify(path)};`);
    bound.set(key, id);return id;
  };
  const lazy = (ref, call) => {
    if (typeof ref.export !== 'string' || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(ref.export)) throw new Error(`${file}: invalid lazy binding export`);
    return `(await import(${JSON.stringify(modulePath(ref.module))}))[${JSON.stringify(ref.export)}]${call ? '()' : ''}`;
  };
  const b = data.bindings;
  if (!b || typeof b.accent !== 'string') throw new Error(`${file}: missing binding declarations`);
  // Build-only budget bindings become checked literals. Generated runtime discovery
  // never imports data/. Remove this bridge with catalog activation (P3).
  const budgetPath = modulePath(b.budgets?.module);
  if (budgetPath.endsWith('.json') && b.budgets.export !== 'default') throw new Error(`${file}: JSON bindings name their default export`);
  const budget = budgetPath.endsWith('.json')
    ? JSON.stringify(JSON.parse(readFileSync(resolve(root, `src/shards/${slug}`, budgetPath), 'utf8')))
    : budgetPath.startsWith('./data/')
    ? execFileSync(process.execPath, [resolve(import.meta.dirname, 'manifest-budget.mjs'), resolve(root, `src/shards/${slug}`, budgetPath.endsWith('.ts') ? budgetPath : `${budgetPath}.ts`), b.budgets.export], { cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 65_536 }).trim()
    : value(b.budgets);
  const rows = [`accent: ${JSON.stringify(b.accent)}`, `budgets: ${budget}`];
  for (const key of ['runtimeCost', 'mapPalette', 'poses', 'forestQueries', 'tierPolicy', 'pondClip']) if (b[key]) {
    // Fixed palette JSON becomes a contextually checked literal, preserving tuple
    // arity without importing an executable coordinate recipe into discovery.
    const palette = key === 'mapPalette' && modulePath(b[key].module).endsWith('.json');
    if (palette && b[key].export !== 'default') throw new Error(`${file}: JSON bindings name their default export`);
    rows.push(`${key}: ${palette ? JSON.stringify(JSON.parse(readFileSync(resolve(root, `src/shards/${slug}`, b[key].module), 'utf8'))) : value(b[key])}`);
  }
  if (b.spawns) {
    const path = modulePath(b.spawns.module);
    const spawns = path.startsWith('./generators/')
      ? execFileSync(process.execPath, [resolve(import.meta.dirname, 'manifest-spawns.mjs'), resolve(root, `src/shards/${slug}`, path.endsWith('.ts') ? path : `${path}.ts`), b.spawns.export], { cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 65_536 }).trim()
      : value(b.spawns);
    rows.push(`spawns: ${spawns}`);
  }
  if (b.navigation) { const id = value(b.navigation);rows.push(`navigation: { row: ${id}.navigation, url: ${id}.url }`); }
  if (b.audioCues || b.audioPreload) rows.push(`audioBindings: { ${[...(b.audioCues ? [`cues: ${value(b.audioCues)}`] : []), ...(b.audioPreload ? [`preload: async () => ${lazy(b.audioPreload, true)}`] : [])].join(', ')} }`);
  if (b.treeFactory) rows.push(`treeFactory: async () => ${lazy(b.treeFactory, false)}`);
  if (b.sword?.rows) {
    const heldRows = value({ module: b.sword.rows, export: 'default' });
    rows.push(`sword: async () => (await import('@wildshard/game/systems/viewmodel/toonArms')).ToonArms.admit(${heldRows}.look).load()`);
  } else if (b.sword) rows.push(`sword: async () => ${lazy(b.sword, true)}`);
  if (b.boot) rows.push(`bootBindings: { ${['files', 'sources', 'lateReads', 'bakedUnread', 'audio'].filter(key => b.boot[key]).map(key => key === 'audio' ? `audio: async () => ${lazy(b.boot[key], true)}` : `${key}: ${value(b.boot[key])}`).join(', ')} }`);
  const native = [];
  if (b.ground) native.push(`ground: ${value(b.ground)}`);
  for (const key of ['render', 'roster']) if (b[key]) {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(b[key].export)) throw new Error(`${file}: invalid lazy binding export`);
    // a called look or roster factory gets the shard's product (toLevelSpec binds it; product-in-look-o272)
    native.push(key === 'render' || b[key].call === true ? `${key}: async (product) => callWithProduct(${lazy(b[key], false)}, product)` : `${key}: async () => ${lazy(b[key], false)}`);
  }
  if (b.entry) {
    if (b.load) throw new Error(`${file}: entry and load are mutually exclusive`);
    const entry = data.runtimeEntry;
    if (!['runtime/index.ts', 'runtime/hybrid.ts'].includes(entry)) throw new Error(`${file}: missing declared runtime entry`);
    const runtime = modulePath(`./${entry.slice(0, -3)}`), legacy = modulePath(b.entry.legacy);
    if (!legacy.startsWith('./runtime/')) throw new Error(`${file}: legacy constructor must belong to runtime/`);
    if (typeof b.entry.retainHomeRuntime !== 'boolean' || !['declared', 'runtime'].includes(b.entry.stagesOwner)) throw new Error(`${file}: invalid entry ownership`);
    const policy = JSON.stringify({ entry, retainHomeRuntime: b.entry.retainHomeRuntime, stagesOwner: b.entry.stagesOwner });
    // Runtime and native entries share a linked module graph. Finish each namespace
    // before reading its constructor; never snapshot exports from concurrent loads.
    native.push(`load: async () => { const runtimeModule = await import(${JSON.stringify(runtime)}); const nativeModule = await import(${JSON.stringify(legacy)}); const entryModule = await import('@wildshard/game/shard/declaredEntry'); return entryModule.declaredRuntimeEntry(runtimeModule.default, nativeModule.default, ${policy}); }`);
  }
  for (const key of ['load', 'ktx2']) if (b[key]) native.push(b[key].export ? `${key}: async () => ${lazy(b[key], true)}` : `${key}: () => import(${JSON.stringify(modulePath(b[key].module))})`);
  if (b.posesLoader) native.push(`dev: {poses: async () => ${lazy(b.posesLoader, true)}}`);
  // The helper lives in the generated file behind a type-only import, so a build of an older revision that meets this file
  // in a mirror (its generators import it before gen-shards rewrites it) still loads.
  const forwards = native.some(row => row.includes('callWithProduct('));
  return `// Generated by scripts/gen-shards.mjs — do not edit or commit.
import { defineAuthoredShard } from '../../game/shard/manifest';
import data from './manifest.json' with { type: 'json' };${forwards ? `
import type { ShardProduct } from '../../game/shardfile/shardProduct';` : ''}
${imports.join('\n')}
${paths.map((path, i) => `import image${i} from ${JSON.stringify(`./${relative(resolve(root, `src/shards/${slug}`), resolve(root, path.slice(1))).replaceAll('\\', '/')}`)};`).join('\n')}
${forwards ? `/** A look or roster factory called with the shard's product; a factory that takes none is accepted as it is. */
const callWithProduct = <T>(make: (product: ShardProduct) => T, product: ShardProduct): T => make(product);
` : ''}const rows: Parameters<typeof defineAuthoredShard>[2] = { ${rows.join(', ')} };
const native: Parameters<typeof defineAuthoredShard>[3] = { ${native.join(', ')} };
export const MANIFEST = defineAuthoredShard(data, ${JSON.stringify(slug)}, rows, native, {${paths.map((path, i) => `${JSON.stringify(path)}: image${i}`).join(', ')}});
// oxlint-disable-next-line import/no-default-export -- Generated folder discovery composes the defining manifest.
export default MANIFEST;
`;
}
