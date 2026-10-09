#!/usr/bin/env node
// SF6: public SDK share and runtime ceiling (§1); the physical-line ratio remains labelled legacy TS.
// Converted shards join lint/shard-platform.json's enforced list (SF46–SF51); its baseline never changes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';
import { resolveSpecifier } from './check-graph.mjs';

// The compiler's declarations globally replace Array.at's optional return with T. Load its JS API
// behind a checked local contract, as compile-script.mjs does, so host JS keeps native Node types.
/** @typedef {{comments?: unknown, diagnostics: unknown[], sources: {statements: {kind:number,path?:{value:string}|null}[]}[], onComment: ((kind:number,text:string,range:{start:number,end:number})=>void)|null, parseFile:(source:string,path:string,entry:boolean)=>void}} AssemblyParser */
/** @typedef {{Parser:new()=>AssemblyParser,NodeKind:{Import:number,Export:number}}} AssemblyApi */
/** @param {unknown} value @returns {value is AssemblyApi} */
function isAssemblyApi(value) {
  return typeof value === 'object' && value !== null && 'Parser' in value && typeof value.Parser === 'function'
    && 'NodeKind' in value && typeof value.NodeKind === 'object' && value.NodeKind !== null
    && 'Import' in value.NodeKind && typeof value.NodeKind.Import === 'number'
    && 'Export' in value.NodeKind && typeof value.NodeKind.Export === 'number';
}
const compilerSpecifier = ['assembly', 'script'].join('');
/** @type {unknown} */
const compiler = await import(compilerSpecifier);
if (!isAssemblyApi(compiler)) throw new Error('AssemblyScript parser API unavailable');
const { Parser, NodeKind } = compiler;

const ROOT = resolve(import.meta.dirname, '..');
const LIST = 'lint/shard-platform.json';
const sourceFile = /\.(?:tsx?|as)$/u;
const publicFolder = /^(?:data|behaviour|quests)\//u;
const generated = /(?:^|\/)(?:generated|baked)(?:\/|\.)|\.(?:generated|baked)\./u;
// AssemblyScript permits function decorators that TypeScript parsers stop at. Use its own parser.
function assembly(source, path) {
  const parser = new Parser(), comments = new Map();
  parser.onComment = (_kind, _text, range) => { comments.set(range.start, { start: range.start, end: range.end }); };
  parser.parseFile(source, path.replace(/\.as$/u, '.ts'), true);
  if (parser.diagnostics.length > 0 || parser.sources.length !== 1) throw new Error(`Cannot measure invalid AssemblyScript: ${path}`);
  return { comments: [...comments.values()].sort((a, b) => a.start - b.start), statements: parser.sources[0].statements };
}

/** Parser comment spans preserve strings, regexes and template literals containing comment-looking text. */
export function codeLines(source, path = 'measure.ts') {
  const chunks = [];
  let cursor = 0;
  const comments = path.endsWith('.as') ? assembly(source, path).comments : parseSync(path, source).comments;
  for (const { start, end } of comments) {
    chunks.push(source.slice(cursor, start), source.slice(start, end).replaceAll(/[^\n]/gu, ' '));
    cursor = end;
  }
  chunks.push(source.slice(cursor));
  return chunks.join('').split('\n').filter((line) => line.trim()).length;
}
function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : sourceFile.test(path) && !path.endsWith('.d.ts') ? [path] : [];
  });
}
function imports(source, path) {
  if (path.endsWith('.as')) return assembly(source, path).statements
    .filter((node) => node.kind === NodeKind.Import || node.kind === NodeKind.Export)
    .flatMap((node) => node.path ? [node.path.value] : []);
  const tree = parseSync(path, source), specs = [];
  const add = (node) => specs.push(node?.type === 'Literal' && typeof node.value === 'string' ? node.value
    : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : null);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'TSImportType', 'ImportExpression'].includes(node.type)) {
      if (node.source) add(node.source);
    } else if (node.type === 'TSExternalModuleReference') add(node.expression);
    else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') add(node.arguments[0]);
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
  };
  visit(tree.program);
  return specs;
}
export function shardLines(root = ROOT) {
  const exists = (path) => existsSync(resolve(root, path)), texts = new Map(), graphs = new Map();
  const text = (path) => {
    if (!texts.has(path)) texts.set(path, readFileSync(resolve(root, path), 'utf8'));
    return texts.get(path);
  };
  const ignored = (path) => generated.test(path) || /^\s*(?:\/\/|\/\*)[^\n]*(?:@generated|auto-generated|autogenerated|Generated by\b|DO NOT EDIT)/imu.test(text(path));
  const count = (path) => ignored(path) ? 0 : codeLines(text(path), path);
  const sdk = exists('src/sdk/package.json') ? JSON.parse(text('src/sdk/package.json')) : null;
  const hasSdk = sdk?.name === '@wildshard/sdk';
  const published = (pkg, spec) => {
    const name = `@wildshard/${pkg}`, manifest = pkg === 'sdk' ? sdk : exists(`src/${pkg}/package.json`) ? JSON.parse(text(`src/${pkg}/package.json`)) : null;
    if (manifest?.name !== name || !(spec === name || spec?.startsWith(`${name}/`))) return false;
    const key = spec === name ? '.' : `.${spec.slice(name.length)}`, target = manifest.exports?.[key];
    return typeof target === 'string' && exists(`src/${pkg}/${target}`);
  };
  const graph = (path) => {
    if (!graphs.has(path)) graphs.set(path, imports(text(path), path).map((spec) => {
      const to = spec === null ? null : resolveSpecifier(path, spec, exists);
      // Local AssemblyScript imports are part of the same authored closure, including extensionless imports.
      const base = spec?.startsWith('.') ? relative(root, resolve(root, path, '..', spec)).replaceAll('\\', '/') : null;
      const assemblyPath = base === null ? null : [base, `${base}.as`, `${base}/index.as`].find((candidate) => candidate.endsWith('.as') && exists(candidate));
      // Classify the resolved path's namespace components; an audited tree need not contain that namespace.
      const local = (to ?? '').split('/');
      const trustedLocal = local.length > 3 && local[0] === 'src' && local[1] === 'sdk' && local[2] === 'runtime';
      return { sdk: published('sdk', spec), trusted: /^@wildshard\/sdk\/runtime(?:\/|$)/u.test(spec ?? '') || trustedLocal, commons: published('commons', spec), to: to ?? assemblyPath ?? null };
    }));
    return graphs.get(path);
  };
  const shardFiles = Object.fromEntries(readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name, filesIn(resolve(root, 'src/shards', entry.name)).map((path) => relative(root, path))]));
  const classify = (slug, path) => {
    const prefix = `src/shards/${slug}/`, seen = new Set(), queue = [path], generator = path.startsWith(`${prefix}generators/`);
    let publicCode = true, trusted = false;
    while (queue.length > 0) {
      const current = queue.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      if (!current.startsWith(prefix)) { publicCode = false; continue; }
      const local = current.slice(prefix.length), author = /^(?:generators|data|quests)\//u.test(local) || local === 'shard.config.ts';
      if (!generator && !publicFolder.test(local) && !local.startsWith('generators/') && local !== 'shard.config.ts') publicCode = false;
      for (const edge of graph(current)) {
        if (edge.trusted) { trusted = true; publicCode = false; continue; }
        if (edge.sdk || (author && edge.commons)) continue;
        // Generator tools stay public; a trusted SDK runtime import still belongs to the custom bucket.
        if ((generator || local.startsWith('generators/')) && !edge.to?.startsWith(prefix)) continue;
        if (edge.to === null) { publicCode = false; continue; }
        queue.push(edge.to);
      }
    }
    return { publicCode, trusted };
  };
  const kitUsers = new Map();
  for (const [slug, files] of Object.entries(shardFiles)) {
    const seen = new Set(), queue = files.filter((path) => !ignored(path));
    while (queue.length > 0) {
      const path = queue.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      if (path.startsWith('src/kit/')) {
        if (!kitUsers.has(path)) kitUsers.set(path, new Set());
        kitUsers.get(path).add(slug);
      }
      for (const edge of graph(path)) if (!edge.sdk && edge.to !== null) queue.push(edge.to);
    }
  }
  const out = {};
  for (const [slug, files] of Object.entries(shardFiles)) {
    const row = { publicLines: 0, customLines: 0, runtimeLines: 0, trustedRuntimeLines: 0, uniqueKitLines: 0, publicShare: 0, legacy: { generators: 0, data: 0, runtime: 0 } };
    for (const path of files) {
      const local = path.slice(`src/shards/${slug}/`.length), top = local.split('/')[0];
      // Keep the historical physical TS-only comparison explicitly separate from the current authored measure.
      if (!path.endsWith('.as')) row.legacy[top === 'generators' || top === 'data' ? top : 'runtime'] += text(path).split('\n').length - 1;
      const lines = count(path);
      const category = classify(slug, path);
      row[category.publicCode ? 'publicLines' : 'customLines'] += lines;
      if (category.trusted) row.trustedRuntimeLines += lines;
      if (top === 'runtime' || category.trusted) row.runtimeLines += lines;
    }
    for (const [path, users] of kitUsers) if (users.size === 1 && users.has(slug) && sourceFile.test(path) && !path.endsWith('.d.ts')) row.uniqueKitLines += count(path);
    row.customLines += row.uniqueKitLines;
    row.publicShare = hasSdk && row.publicLines + row.customLines > 0 ? row.publicLines / (row.publicLines + row.customLines) : 0;
    out[slug] = row;
  }
  return out;
}
/**
 * Files are executable proofs, run by the push gate's vitest step; absence never masquerades as success. A shard with a
 * canonical witness result (`test/proof/<slug>/compatibility.json`, written only from a real run) reads its headless /
 * replay / ledger / compatible flags from that result: a fail-closed witness test file exists but proves a refusal, so
 * its presence alone must never read as a pass. `transitional` holds until the trusted runtime is gone AND the witnesses
 * pass.
 */
export function milestoneFlags(slug, row, root = ROOT) {
  const proof = (name) => existsSync(resolve(root, `test/proof/${slug}/${name}.test.ts`));
  const witnessPath = resolve(root, `test/proof/${slug}/compatibility.json`);
  const witness = existsSync(witnessPath) ? JSON.parse(readFileSync(witnessPath, 'utf8')) : null;
  const passed = (name) => proof(name) && (witness === null || (witness[name]?.status === 'passed'
    && (name !== 'ledger' || witness.ledger.gameplayEmissionProven === true)));
  const headless = passed('headless'), replay = passed('replay'), ledger = passed('ledger');
  const compatible = headless && replay && ledger && (witness === null || (witness.compatible === true && witness.audit?.exitStatus === 0));
  return { boot: proof('boot'), headless, replay, ledger, gridReady: proof('grid-ready'), compatible, transitional: row.runtimeLines > 0 || !compatible };
}
export function checkShares(recorded, lines) {
  const failures = [];
  for (const slug of Object.keys(lines)) if (!Object.hasOwn(recorded.baseline, slug)) failures.push(`${slug}: unknown shard (no baseline in ${LIST})`);
  for (const slug of [...Object.keys(recorded.baseline), ...Object.keys(recorded.enforced)]) if (!lines[slug]) failures.push(`${slug} is recorded in ${LIST} but src/shards/${slug} doesn't exist`);
  for (const [slug, ceiling] of Object.entries(recorded.enforced)) {
    const row = lines[slug];
    if (!row) continue;
    if (row.runtimeLines > ceiling) failures.push(`${slug}: ${row.runtimeLines} runtime/ or trusted-SDK lines, ceiling ${ceiling}`);
    if (row.publicShare < 0.8) failures.push(`${slug}: public SDK share ${(row.publicShare * 100).toFixed(1)} %, floor 80 % (unique-kit lines are custom)`);
  }
  return failures;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const recorded = JSON.parse(readFileSync(resolve(ROOT, LIST), 'utf8')), lines = shardLines();
  if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(Object.entries(lines).map(([slug, row]) => [slug, { ...row, baseline: recorded.baseline[slug], milestones: milestoneFlags(slug, row) }])), null, 2));
  else {
    console.log('shard                  public   custom   kit-only  public SDK    runtime+trusted ceiling    legacy TS');
    for (const [slug, row] of Object.entries(lines)) {
      const base = recorded.baseline[slug], ceiling = recorded.enforced[slug] ?? Math.floor(base * 0.2);
      console.log(`${slug.padEnd(22)} ${String(row.publicLines).padStart(6)} ${String(row.customLines).padStart(8)} ${String(row.uniqueKitLines).padStart(10)} ${(row.publicShare * 100).toFixed(1).padStart(9)} %  ${String(row.runtimeLines).padStart(8)} / ${String(ceiling).padEnd(7)} ${(row.legacy.runtime / base * 100).toFixed(1)} %${slug in recorded.enforced ? ' enforced' : ' reported'}`);
      console.log(`  proofs ${JSON.stringify(milestoneFlags(slug, row))}`);
    }
  }
  if (process.argv.includes('--check')) {
    const failures = checkShares(recorded, lines);
    for (const failure of failures) console.error(`shard-platform: ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  }
}
