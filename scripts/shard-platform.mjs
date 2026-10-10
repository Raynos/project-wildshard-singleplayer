#!/usr/bin/env node
// G291: authored runtime TS / the frozen legacy TS size is the primary 80/20 measure.
// The old SF6 public/custom measure remains secondary, explicitly labelled legacy-share.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';
import { resolveSpecifier } from './check-graph.mjs';
import { legacyInventory } from './legacy-shards.mjs';

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
// G291/G294's classification table. Audit findings adjust these rules explicitly, never hidden import heuristics.
const RULES = {
  typescript: /\.tsx?$/u,
  runtimeExcludedFolders: new Set(['generators', 'data']),
  tests: /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.tsx?$/u,
  generated: /(?:^|\/)(?:generated|baked)(?:\/|\.)|\.(?:generated|baked)\./u,
  attributedLayers: /^src\/(?:game|sdk)\//u,
  publicUserCount: 2,
  template: '_template',
  enforcement: 'report-only',
};
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
  const comments = path.endsWith('.as') ? assembly(source, path).comments : parseSync(path, source).comments;
  return linesWithoutComments(source, comments);
}
function linesWithoutComments(source, comments) {
  const chunks = [];
  let cursor = 0;
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
function sourceInfo(source, path) {
  if (path.endsWith('.as')) {
    const parsed = assembly(source, path);
    return { comments: parsed.comments, specs: parsed.statements
      .filter(node => node.kind === NodeKind.Import || node.kind === NodeKind.Export)
      .flatMap(node => node.path ? [node.path.value] : []) };
  }
  const tree = parseSync(path, source), specs = [];
  for (const row of tree.module.staticImports) specs.push(row.moduleRequest.value);
  for (const row of tree.module.staticExports) for (const entry of row.entries) if (entry.moduleRequest) specs.push(entry.moduleRequest.value);
  // Ordinary imports use the parser's module index. Walk only files with expression/import-type/CommonJS edges.
  if (/\b(?:import|require)(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*\(/u.test(source)
    || tree.program.body.some(node => node.type === 'TSImportEqualsDeclaration')) {
    const add = node => specs.push(node?.type === 'Literal' && typeof node.value === 'string' ? node.value
      : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : null);
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (['TSImportType', 'ImportExpression'].includes(node.type) && node.source) add(node.source);
      else if (node.type === 'TSExternalModuleReference') add(node.expression);
      else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') add(node.arguments[0]);
      for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
    };
    visit(tree.program);
  }
  return { comments: tree.comments, specs };
}
export function shardLines(root = ROOT) {
  const exists = (path) => existsSync(resolve(root, path)), texts = new Map(), graphs = new Map(), sources = new Map(), counts = new Map();
  const text = (path) => {
    if (!texts.has(path)) texts.set(path, readFileSync(resolve(root, path), 'utf8'));
    return texts.get(path);
  };
  const ignored = (path) => RULES.generated.test(path) || /^\s*(?:\/\/|\/\*)[^\n]*(?:@generated|auto-generated|autogenerated|Generated by\b|DO[- ]NOT[- ]EDIT)/imu.test(text(path));
  const info = path => { if (!sources.has(path)) sources.set(path, sourceInfo(text(path), path)); return sources.get(path); };
  const count = path => { if (!counts.has(path)) counts.set(path, ignored(path) ? 0 : linesWithoutComments(text(path), info(path).comments)); return counts.get(path); };
  const sdk = exists('src/sdk/package.json') ? JSON.parse(text('src/sdk/package.json')) : null;
  const hasSdk = sdk?.name === '@wildshard/sdk';
  const publishedTarget = (pkg, spec) => {
    const name = `@wildshard/${pkg}`, manifest = pkg === 'sdk' ? sdk : exists(`src/${pkg}/package.json`) ? JSON.parse(text(`src/${pkg}/package.json`)) : null;
    if (manifest?.name !== name || !(spec === name || spec?.startsWith(`${name}/`))) return null;
    const key = spec === name ? '.' : `.${spec.slice(name.length)}`, target = manifest.exports?.[key];
    const path = typeof target === 'string' ? relative(root, resolve(root, `src/${pkg}`, target)).replaceAll('\\', '/') : null;
    return path !== null && exists(path) ? path : null;
  };
  const graph = (path) => {
    if (!graphs.has(path)) graphs.set(path, info(path).specs.map((spec) => {
      const pkg = /^@wildshard\/(sdk|game|engine|commons)(?:\/|$)/u.exec(spec ?? '');
      const to = spec === null ? null : (pkg === null ? null : publishedTarget(pkg[1], spec)) ?? resolveSpecifier(path, spec, exists);
      // Local AssemblyScript imports are part of the same authored closure, including extensionless imports.
      const base = spec?.startsWith('.') ? relative(root, resolve(root, path, '..', spec)).replaceAll('\\', '/') : null;
      const assemblyPath = base === null ? null : [base, `${base}.as`, `${base}/index.as`].find((candidate) => candidate.endsWith('.as') && exists(candidate));
      // A local JSON import is data: it resolves to its file, which the folder rules then classify like any other.
      const jsonPath = base !== null && base.endsWith('.json') && exists(base) ? base : null;
      // Classify the resolved path's namespace components; an audited tree need not contain that namespace.
      const local = (to ?? '').split('/');
      const trustedLocal = local.length > 3 && local[0] === 'src' && local[1] === 'sdk' && local[2] === 'runtime';
      return { sdk: publishedTarget('sdk', spec) !== null, trusted: /^@wildshard\/sdk\/runtime(?:\/|$)/u.test(spec ?? '') || trustedLocal, commons: publishedTarget('commons', spec) !== null, to: to ?? assemblyPath ?? jsonPath ?? null };
    }));
    return graphs.get(path);
  };
  const frozen = legacyInventory(root);
  const shardFiles = Object.fromEntries(readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !Object.hasOwn(frozen.shards, entry.name)).sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name, filesIn(resolve(root, 'src/shards', entry.name)).map((path) => relative(root, path))]));
  const moduleUsers = new Map();
  for (const [slug, files] of Object.entries(shardFiles)) {
    const prefix = `src/shards/${slug}/`, seen = new Set(), queue = files.filter(path => !RULES.tests.test(path));
    while (queue.length > 0) {
      const path = queue.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      if (!sourceFile.test(path) || path.endsWith('.d.ts') || RULES.tests.test(path) || !exists(path)) continue;
      // Engine infrastructure cannot import up into game/SDK. Other shards are never consumers of this one's closure.
      if (!path.startsWith(prefix) && !/^src\/(?:game|sdk|commons)\//u.test(path)) continue;
      if (RULES.attributedLayers.test(path)) {
        if (!moduleUsers.has(path)) moduleUsers.set(path, new Set());
        moduleUsers.get(path).add(slug);
      }
      for (const edge of graph(path)) if (edge.to !== null) queue.push(edge.to);
    }
  }
  const privateModules = new Map(Object.keys(shardFiles).map(slug => [slug, []]));
  for (const [path, users] of [...moduleUsers].sort(([a], [b]) => a.localeCompare(b))) {
    if (users.size >= RULES.publicUserCount || users.has(RULES.template) || !RULES.typescript.test(path)) continue;
    const lines = count(path);
    if (lines > 0) privateModules.get([...users][0]).push({ path, lines });
  }
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
  // SF54 dissolved the kit, so no shard-unique kit lines remain to count as custom (the former kit-only column).
  const out = {};
  for (const [slug, files] of Object.entries(shardFiles)) {
    const row = { publicLines: 0, customLines: 0, runtimeLines: 0, trustedRuntimeLines: 0, publicShare: 0, legacy: { generators: 0, data: 0, runtime: 0 }, legacyShare: 0, conversion: null };
    let shardRuntimeLines = 0;
    for (const path of files) {
      const local = path.slice(`src/shards/${slug}/`.length), top = local.split('/')[0];
      // Keep the historical physical TS-only comparison explicitly separate from the current authored measure.
      if (!path.endsWith('.as')) row.legacy[top === 'generators' || top === 'data' ? top : 'runtime'] += text(path).split('\n').length - 1;
      const lines = count(path);
      if (RULES.typescript.test(path) && !RULES.runtimeExcludedFolders.has(top) && !RULES.tests.test(local)) shardRuntimeLines += lines;
      const category = classify(slug, path);
      row[category.publicCode ? 'publicLines' : 'customLines'] += lines;
      if (category.trusted) row.trustedRuntimeLines += lines;
      if (top === 'runtime' || category.trusted) row.runtimeLines += lines;
    }
    row.publicShare = hasSdk && row.publicLines + row.customLines > 0 ? row.publicLines / (row.publicLines + row.customLines) : 0;
    row.legacyShare = row.publicShare;
    const pair = Object.entries(frozen.shards).find(([, legacy]) => legacy.primary === slug);
    let legacyLines = null;
    if (pair !== undefined) {
      const [folder, legacy] = pair;
      // The sealed file inventory is the denominator; unrelated suffix folders cannot pad it.
      legacyLines = Object.keys(legacy.files).filter(path => RULES.typescript.test(path) && !path.endsWith('.d.ts') && !RULES.tests.test(path))
        .reduce((total, path) => total + count(`src/shards/${folder}/${path}`), 0);
      if (legacyLines <= 0) throw new Error(`${slug}: frozen legacy has no authored TypeScript lines`);
    }
    const modules = privateModules.get(slug), attributedLines = modules.reduce((total, module) => total + module.lines, 0);
    const customRuntimeLines = shardRuntimeLines + attributedLines;
    row.conversion = {
      metric: pair === undefined ? 'legacy-share' : 'runtime-vs-legacy', customRuntimeLines, shardRuntimeLines,
      legacyLines, legacyFolder: pair?.[0] ?? null, legacyRevision: pair?.[1].source ?? null,
      runtimeShare: legacyLines === null ? null : customRuntimeLines / legacyLines,
      passed: legacyLines === null ? null : customRuntimeLines <= legacyLines * 0.2,
      gameSystemAttribution: { status: 'import-graph', review: 'pending-opus-audit', lines: attributedLines, modules },
    };
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
    // G291/G294 is report-only initially: preserve exactly the predecessor gate, no new failures.
    // The coordinator can promote the new measure after reviewing the audit and current table.
    if (row.runtimeLines > ceiling) failures.push(`${slug}: ${row.runtimeLines} runtime/ or trusted-SDK lines, ceiling ${ceiling}`);
    if (row.publicShare < 0.8) failures.push(`${slug}: public SDK share ${(row.publicShare * 100).toFixed(1)} %, floor 80 %`);
  }
  return failures;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const recorded = JSON.parse(readFileSync(resolve(ROOT, LIST), 'utf8')), lines = shardLines();
  if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(Object.entries(lines).map(([slug, row]) => [slug, { ...row, baseline: recorded.baseline[slug], ceiling: recorded.enforced[slug] ?? Math.floor(recorded.baseline[slug] * 0.2), enforced: Object.hasOwn(recorded.enforced, slug), milestones: milestoneFlags(slug, row) }])), null, 2));
  else {
    console.log('shard                  shard TS  sole SDK/game  frozen TS  custom / frozen  80/20       legacy-share  enforcement');
    for (const [slug, row] of Object.entries(lines)) {
      const base = recorded.baseline[slug], ceiling = recorded.enforced[slug] ?? Math.floor(base * 0.2);
      const measure = row.conversion, ratio = measure.runtimeShare === null ? 'no legacy folder' : `${(measure.runtimeShare * 100).toFixed(1)} %`;
      const passed = measure.passed ?? (row.publicShare >= 0.8 && row.runtimeLines <= ceiling);
      console.log(`${slug.padEnd(22)} ${String(measure.shardRuntimeLines).padStart(8)} ${String(measure.gameSystemAttribution.lines).padStart(14)} ${String(measure.legacyLines ?? '—').padStart(10)} ${ratio.padStart(16)}  ${(passed ? 'PASS' : 'FAIL').padEnd(10)} ${(row.legacyShare * 100).toFixed(1).padStart(7)} %  ${measure.metric === 'runtime-vs-legacy' ? RULES.enforcement : (slug in recorded.enforced ? 'old enforced' : 'old reported')}`);
      console.log(`  proofs ${JSON.stringify(milestoneFlags(slug, row))}`);
    }
  }
  if (process.argv.includes('--check')) {
    const failures = checkShares(recorded, lines);
    for (const failure of failures) console.error(`shard-platform: ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  }
}
