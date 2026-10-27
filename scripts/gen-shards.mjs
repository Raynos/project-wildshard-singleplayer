// E357 F9: folder discovery is the sole authored shard list.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';
import { productManifestPath, authoredManifestSource } from './authored-manifest.mjs';
import { outputManifest, shardProducts } from './shard-outputs.mjs';
import { genShardWords } from './gen-shard-words.mjs';
import { legacyInventory, legacyPrimary } from './legacy-shards.mjs';
import { readProgramDiscovery, usesProgramDiscovery } from './program-discovery.mjs';

/** Static runtime imports only: lazy plugin/look thunks and erased types stay out of the startup closure. */
export function manifestClosure(root) {
  const configPath = ts.findConfigFile(root, (file) => ts.sys.fileExists(file));
  const config = configPath ? ts.readConfigFile(configPath, (file) => ts.sys.readFile(file)).config : {};
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
  const result = {};
  for (const product of shardProducts(root, shardFolders(root))) {
    const slug = product.slug, seen = new Set();
    const visit = (file) => {
      const id = relative(root, file).replaceAll('\\', '/');
      if (seen.has(id)) return;
      seen.add(id);
      if (!/\.[cm]?[jt]sx?$/.test(file)) return;
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const node of source.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
        if (ts.isImportDeclaration(node)) {
          if (node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
          const bindings = node.importClause?.namedBindings;
          if (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly)) continue;
        } else if (node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((e) => e.isTypeOnly))) continue;
        const specifier = node.moduleSpecifier.text;
        const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
        if (target && !target.includes('/node_modules/') && !target.endsWith('.d.ts')) visit(target);
        // TypeScript intentionally does not resolve raster imports; include their bundler module ids too.
        else if (specifier.startsWith('.') && existsSync(resolve(dirname(file), specifier))) visit(resolve(dirname(file), specifier));
      }
    };
    visit(resolve(root, productManifestPath(root, product)));
    result[slug] = [...seen].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

/** Every product slug (SF88g: a folder's declared outputs, else the folder itself). */
export function shardSlugs(root) { return shardProducts(root, shardFolders(root)).map((row) => row.slug); }
export function shardFolders(root) {
  return readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && ['manifest.ts', 'manifest.json'].some(file => existsSync(resolve(root, 'src/shards', entry.name, file))))
    .map((entry) => entry.name).sort();
}


/** One defining generated composition module for JSON manifests; frozen authored
 * TypeScript manifests keep their existing path and loaders. */

/**
 * The shard list (E362 AG4): every manifest, imported by the composition root (src/shards.generated.ts, installed by
 * src/shardList.ts) so the game layer imports no shard, and its TypeScript project builds without them.
 */
export function shardSource(root) {
  const products = shardProducts(root, shardFolders(root)), slugs = products.map((row) => row.slug);
  const frozen = legacyInventory(root), primarySlugs = slugs.filter(slug => !Object.hasOwn(frozen.shards, slug));
  if (slugs.length === 0) throw new Error('gen-shards: no shard manifests');
  const catalogue = resolve(root, 'src/game/grid/singleplayer.json');
  const placements = existsSync(catalogue) ? JSON.parse(readFileSync(catalogue, 'utf8')).placements : null;
  if (placements !== null) {
    const seen = new Set();
    for (const p of placements) {
      if (!primarySlugs.includes(p.slug) || seen.has(p.slug) || !Array.isArray(p.cell) || p.cell.length !== 2 || !p.cell.every(Number.isSafeInteger) || !Array.isArray(p.size) || p.size.length !== 3 || !p.size.every((n) => n === 500) || typeof p.instance !== 'string') throw new Error('gen-shards: invalid grid placement');
      seen.add(p.slug);
    }
    if (seen.size !== primarySlugs.length) throw new Error('gen-shards: missing grid placement');
  }
  const placed = slugs.flatMap((slug, i) => {
    if (Object.hasOwn(frozen.shards, slug)) return [];
    if (placements === null) return [`m${i}`];
    const p = placements.find((entry) => entry.slug === slug);
    return [`{ ...m${i}, placement: { grid: ${JSON.stringify(p.cell)}, size: ${JSON.stringify(p.size)}, instance: ${JSON.stringify(p.instance)} } }`];
  });
  const standalone = slugs.flatMap((slug, i) => Object.hasOwn(frozen.shards, slug) ? [`m${i}`] : []);
  const metadata = placements === null ? '' : ' & { placement: { grid: [number, number]; size: [number, number, number]; instance: string } }';
  return `// Generated by scripts/gen-shards.mjs — do not edit or commit.
import type { ShardManifest } from './game/shard/manifest';
${products.map((product, i) => `import m${i} from './${productManifestPath(root, product).slice('src/'.length, -'.ts'.length)}';`).join('\n')}
const placed: (ShardManifest${metadata})[] = [${placed.join(', ')}];
export const SHARDS: typeof placed = placed.sort((a, b) => a.order - b.order);
export const LEGACY_SHARDS: ShardManifest[] = [${standalone.join(', ')}];
export const LEGACY_CONTENT_IDENTITIES: Readonly<Record<string, string>> = ${JSON.stringify(Object.fromEntries(Object.entries(frozen.shards).map(([copy, row]) => [copy, row.primary])))};
`;
}
/** The plain committed table owns both runtime enumeration and exact public slug types. */
export function slugSource(root) {
  return `// Generated by gen:source (scripts/gen-shards.mjs) from src/shards/*/manifest.*; do not edit.
import type { ValidatedShardSlug } from './slug';

export const BUILTIN_SHARD_SLUGS = ${JSON.stringify(shardSlugs(root))} as const;
export type BuiltinShardSlug = (typeof BUILTIN_SHARD_SLUGS)[number];
/** Built-ins are validated during generation; other names cross the branded parser. */
export type ShardSlug = BuiltinShardSlug | ValidatedShardSlug;
`;
}

const LOAD = /\bload:\s*\(\)\s*=>\s*import\(\s*['"]\.\.?\/plugin(?:\.ts)?['"]\s*\)/u;
const BUDGET_FILE = 'lint/manifest-closure-budget.json';
/** Only the exported manifest object can opt into the data-descriptor contract. */
export function shardfileDescriptor(text) {
  const source = ts.createSourceFile('manifest.ts', text, ts.ScriptTarget.Latest, true);
  const variables = new Map(); let expression;
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) variables.set(declaration.name.text, declaration.initializer);
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) expression = statement.expression;
  }
  if (expression && ts.isIdentifier(expression)) expression = variables.get(expression.text);
  while (expression && (ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression;
  if (!expression || !ts.isObjectLiteralExpression(expression)) return null;
  const named = (property, name) => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === name;
  const property = expression.properties.find((row) => named(row, 'shardfile'));
  if (property === undefined) return null;
  return { path: ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) ? property.initializer.text : null,
    load: expression.properties.some((row) => named(row, 'load')) };
}
function descriptorContract(root, slug, text) {
  const descriptor = shardfileDescriptor(text);
  if (descriptor === null) return null;
  const failures = [];
  if (descriptor.path !== `/shardfiles/${slug}/shard.json`) failures.push('shardfile must be the literal canonical /shardfiles/<slug>/shard.json path');
  if (!existsSync(resolve(root, `src/shards/${slug}/shard.config.ts`))) failures.push('shardfile descriptor requires its buildable shard.config.ts project');
  if (descriptor.load) failures.push('shardfile descriptor cannot also load a runtime plugin');
  return failures;
}
/**
 * E362 AG10: a legacy `load` is `() => import('./plugin')`; a data descriptor has a canonical shardfile path and no load.
 * manifest's static closure stays inside its file budget (`lint/manifest-closure-budget.json`: one `default` limit for
 * every shard, not a ratchet); every `ShardManifest` field is read by the engine, the game or the tooling (`fields`).
 * Slug = folder is check-shards' (AG9).
 */
export function manifestContract(root, closure, fields = false) {
  const failures = [];
  const budgetPath = resolve(root, BUDGET_FILE);
  const budgets = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')).budgets : {};
  for (const product of shardProducts(root, shardFolders(root))) {
    const slug = product.slug, folder = product.folder;
    const json = existsSync(resolve(root, `src/shards/${folder}/manifest.json`));
    const source = readFileSync(resolve(root, json ? `src/shards/${folder}/manifest.json` : `src/shards/${folder}/manifest.ts`), 'utf8');
    const descriptor = json ? null : descriptorContract(root, slug, source);
    const authored = !json ? null : product.output === null ? JSON.parse(source) : outputManifest(root, folder, product.output);
    const dataOnly = json && authored.shardfile === `/shardfiles/${slug}/shard.json` && authored.bindings?.load === undefined && authored.bindings?.entry === undefined && existsSync(resolve(root, `src/shards/${folder}/shard.config.ts`));
    if (descriptor !== null) failures.push(...descriptor.map((message) => `src/shards/${slug}/manifest.ts: ${message}`));
    else if (!dataOnly && (json ? authored.bindings?.entry === undefined && authored.bindings?.load?.module !== './plugin' : !LOAD.test(source))) failures.push(`src/shards/${slug}/manifest.ts: load must be \`() => import('./plugin')\` (a lazy plugin, never a static import)`);
    if (/^import\s[^;]*['"]\.\.?\/plugin(?:\.ts)?['"]/mu.test(source)) failures.push(`src/shards/${slug}/manifest.ts imports ./plugin statically: it would ride in cold boot`);
    const budget = budgets[legacyPrimary(root, slug) ?? slug] ?? budgets.default, size = closure[slug]?.length ?? 0;
    if (typeof budget === 'number' && size > budget) failures.push(`src/shards/${slug}/manifest.ts: its static closure is ${size} files, over its budget ${budget} (${BUDGET_FILE}); move the new imports behind load / a lazy thunk`);
  }
  if (fields) {
    const file = resolve(root, 'src/game/shard/manifest.ts');
    const decl = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    let names = [];
    decl.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === 'ShardManifest') names = n.members.filter(ts.isPropertySignature).map((m) => m.name.getText(decl)); });
    const texts = [];
    const scan = (dir) => {
      if (!existsSync(resolve(root, dir))) return;
      for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) scan(path);
        else if (/\.[cm]?[jt]s$/u.test(entry.name) && !entry.name.endsWith('.generated.ts')) texts.push(readFileSync(resolve(root, path), 'utf8'));
      }
    };
    for (const dir of ['src/engine', 'src/game', 'lint', 'scripts']) scan(dir);
    const all = texts.join('\n');
    for (const name of names) if (!new RegExp(`\\.${name}\\b|['"]${name}['"]`, 'u').test(all)) failures.push(`ShardManifest.${name}: nothing in the engine, the game or the tooling reads it; drop the field`);
  }
  return failures;
}

/** A product's discovery module source (its manifest.json bindings, its composed output when it declares one). */
function discoverySource(root, product) {
  const composed = product.output === null ? null : outputManifest(root, product.folder, product.output);
  const metadata = composed ?? JSON.parse(readFileSync(resolve(root, `src/shards/${product.folder}/manifest.json`), 'utf8'));
  const program = usesProgramDiscovery(metadata);
  return authoredManifestSource(root, product.slug, { folder: product.folder, composed,
    ...(program ? { discovery: readProgramDiscovery(root, product.slug) } : {}) });
}

/** Publish a complete replacement without truncating the module concurrent readers hold.
 * @param {string} path @param {string} source */
function writeDiscovery(path, source) {
  if (existsSync(path) && readFileSync(path, 'utf8') === source) return;
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, source, { flag: 'wx' }); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}

/** Refresh every provider whose receipt/bindings are available. A missing or stale
 * product never deletes its last published module: a later generation failure must
 * not break concurrent source readers. genShards still requires current products and
 * strictly replaces these modules after program construction; no placeholder is emitted. */
export function refreshDiscovery(root = resolve(import.meta.dirname, '..')) {
  for (const product of shardProducts(root, shardFolders(root))) {
    if (!existsSync(resolve(root, `src/shards/${product.folder}/manifest.json`))) continue;
    const path = resolve(root, productManifestPath(root, product));
    let source;
    try { source = discoverySource(root, product); } catch { continue; }
    writeDiscovery(path, source);
  }
}

/** The committed slug tables (TS and JSON; GS3) by output path, from the shard folders' manifests alone. */
export function slugTables(root) {
  return { 'src/game/shard/slugs.generated.ts': slugSource(root), 'src/game/shard/slugs.generated.json': `${JSON.stringify(Object.fromEntries(shardSlugs(root).map(slug=>[slug,true])),null,2)}\n` };
}
/** The build-written shard tables (the shard list, the manifest closure), which import and walk every product's
 *  discovery module, by output path. genShards writes them and the slug tables; gen:source registers both. */
export function shardTables(root) {
  const closure = manifestClosure(root);
  return { 'src/shards.generated.ts': shardSource(root), 'src/game/shard/manifest-closure.generated.json': `${JSON.stringify(closure, null, 2)}\n` };
}

export function genShards(root = resolve(import.meta.dirname, '..'), check = false, initializeMissing = false, shard = '') {
  genShardWords(root, check, shard);
  for (const product of shardProducts(root, shardFolders(root))) {
    if (!existsSync(resolve(root, `src/shards/${product.folder}/manifest.json`))) continue;
    const path = resolve(root, productManifestPath(root, product)), source = discoverySource(root, product);
    if (check && existsSync(path) && readFileSync(path, 'utf8') !== source) throw new Error(`gen-shards: stale ${path}`);
    if (!check || !existsSync(path)) writeDiscovery(path, source);
  }
  // SF88g: a discovery module no product owns any more (a folder that now declares outputs, a dropped output) is removed,
  // so no tree, mirror or loader keeps importing a retired product's manifest
  const owned = new Set(shardProducts(root, shardFolders(root)).map((product) => resolve(root, productManifestPath(root, product))));
  for (const folder of shardFolders(root)) for (const file of readdirSync(resolve(root, 'src/shards', folder))) {
    const path = resolve(root, 'src/shards', folder, file);
    if (!/^discovery(?:\.[a-z0-9-]+)?\.generated\.ts$/u.test(file) || owned.has(path)) continue;
    if (check) throw new Error(`gen-shards: stale ${relative(root, path)} (run pnpm gen)`);
    rmSync(path);
  }
  const write = (outputs) => {
    for (const [name, source] of Object.entries(outputs)) {
      const out = resolve(root, name);
      const exists = existsSync(out), same = exists && readFileSync(out, 'utf8') === source;
      // A staged-tree export lacks these untracked tables. Only that caller initializes missing outputs;
      // committed vocabulary above and any existing runtime table still have strict --check semantics.
      const initialize = initializeMissing && !exists;
      if (check && !same && !initialize) throw new Error(`gen-shards: stale ${name} (run pnpm gen)`);
      if ((!check || initialize) && !same) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, source); }
    }
  };
  write({ ...shardTables(root), ...slugTables(root) });
  // the title tables read the shard list just written
  write(titleTables(root));
}

/**
 * D25 (G799: no virtual module, no Vite plugin): the title's catalogue and the selected discovery loaders, as two
 * build-written, typed modules beside the products (out/.app/titleCatalogue.generated.ts,
 * out/.app/shardSelection.generated.ts). They are not committed: their rows come from every product's
 * discovery module (open-plot outputs composed per output, legacy rows, derived entries), which this script writes from
 * the built products, so a committed copy would follow local product state rather than the commit. Generated products
 * leave src (GR0), so they live under out/ (a dot folder, which no product scan reads); the app's imports of them
 * still count as generated imports.
 */
export function titleTables(root) {
  const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/title-catalogue.mjs'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const read = (prefix) => {
    const row = output.split('\n').reverse().find(line => line.startsWith(prefix));
    if (row === undefined) throw new Error(`gen-shards: the title catalogue printed no ${prefix.trim()}`);
    const value = JSON.parse(row.slice(prefix.length));
    if (typeof value !== 'string') throw new Error(`gen-shards: invalid ${prefix.trim()}`);
    return value;
  };
  // typed modules beside the products (relative specifiers into src, so the app's type check resolves them)
  const swap = (text, from, to) => { if (!text.includes(from)) throw new Error(`gen-shards: the title tables lost ${from}`); return text.replaceAll(from, to); };
  const catalogue = swap(swap(read('TITLE-CATALOGUE '), ' from "/src/', ' from "../../src/'), 'export const TITLE_MANIFESTS=[', 'export const TITLE_MANIFESTS: readonly TitleManifest[] = [');
  const selection = swap(swap(swap(swap(read('TITLE-SELECTION '), 'import("/src/', 'import("../../src/'), '.ts")', '")'),
    'export const LEGACY_CONTENT_IDENTITIES=', 'export const LEGACY_CONTENT_IDENTITIES: Readonly<Record<string, string>> = '),
    'export const SHARD_LOADERS=', 'export const SHARD_LOADERS: Readonly<Record<string, () => Promise<ShardManifest>>> = ');
  return { 'out/.app/titleCatalogue.generated.ts': `import type { TitleManifest } from '../../src/game/shard/titleList';\n${catalogue}`,
    'out/.app/shardSelection.generated.ts': `import type { ShardManifest } from '../../src/game/shard/manifest';\n${selection}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const shard = process.argv.find((arg) => arg.startsWith('--shard='))?.slice(8);
    genShards(undefined, process.argv.includes('--check'), false, shard);
    // Vite runs discovery before boot byte tables exist. Budget generation belongs to pnpm gen after those tables.
    if (process.argv.includes('--check')) {
      const root = resolve(import.meta.dirname, '..'), failures = manifestContract(root, manifestClosure(root), true);
      if (failures.length > 0) throw new Error(`gen-shards: the manifest contract (AG10):\n  ${failures.join('\n  ')}`);
      const { genBudgetDerivations } = await import('./gen-budget-derivations.mjs');
      await genBudgetDerivations(undefined, true, shard);
    }
  }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
