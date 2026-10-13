#!/usr/bin/env node
// G291: authored runtime TS / the frozen legacy TS size is the primary 80/20 measure.
// The old SF6 public/custom measure remains secondary, explicitly labelled legacy-share.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';
import * as v from 'valibot';
import { resolveSpecifier } from './check-graph.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { shardContent } from './shard-platform-content.mjs';
import { discoverGeneration } from './generate.mjs';

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
const sourceFile = /\.(?:tsx?|as|glsl)$/u;
const publicFolder = /^(?:data|behaviour|quests)\//u;
const producerPath = v.pipe(v.string(), v.check(path => path.length > 0 && !path.startsWith('/') && !path.includes('\\')
  && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')));
const SourceOutputs = v.strictObject({ schema: v.literal('source-generation-outputs/1'),
  producers: v.record(producerPath, v.array(producerPath)) });
// G291/G294's classification table. Audit findings adjust these rules explicitly, never hidden import heuristics.
// Unit on BOTH sides: nonblank physical lines after parser comment removal, in .ts/.tsx only;
// .as, .d.ts and tests do not enter the G291 ratio. Declared generator outputs are excluded
// on BOTH sides, including their frozen copies. Names and headers never grant an exemption. Authored data/ and
// generators/ ARE included in the frozen denominator, but excluded from current runtime.
// G294 adds one-user platform modules to the numerator; relocating a helper into engine/game/SDK cannot reduce it.
// G294 per export (sp-o53): users are counted per top-level declaration, not only per file, so a one-shard export moved
// into an already shared file still counts. A file one shard reaches counts whole (unchanged, dead code included). In a
// file two or more shards reach, each top-level declaration (export or helper; type declarations too) that exactly one
// shard reaches counts its own span: nonblank lines after parser comment removal (the codeLines unit), each line once.
// Its users are the shards whose own files import it, directly or through declarations of other engine/game/SDK/commons
// modules they reach. Where the reading is ambiguous the rule picks the one that never hides a real use:
//   - names match top-level bindings lexically (no scope analysis): a local that shadows one still counts as a use;
//   - a bare namespace use, `import()`, `require()` or unqualified `import('x')` type uses every export of the target;
//   - a shard's own non-test files are roots in full: every declaration, named import and re-export in them is used;
//   - evaluating a module runs its non-declaration top-level statements, so what they reference is used by every shard
//     that reaches the file; a variable initialiser belongs to its binding. Import lines and top-level statements of a
//     shared file stay shared, and a declaration no shard reaches counts for no shard.
// The frozen denominator attributes no platform code (only the sealed legacy files), so no per-export rule applies there.
const RULES = {
  typescript: /\.tsx?$/u,
  runtimeExcludedFolders: new Set(['generators', 'data']),
  tests: /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.tsx?$/u,
  attributedLayers: /^src\/(?:engine|game|sdk)\//u,
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
/** Count raw GLSL statements without blank/comment padding, preserving quoted preprocessor paths. */
export function shaderCodeLines(source) {
  return source.replaceAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, value =>
    value.startsWith('/') ? value.replaceAll(/[^\n]/gu, ' ') : value).split('\n').filter(line => line.trim()).length;
}
/** Raw shader source remains custom even inside a data/generator TS file; SF59 graph nodes are ordinary data. */
export function rawShaderLines(source, path) {
  if (path.endsWith('.glsl')) return shaderCodeLines(source);
  if (!RULES.typescript.test(path)) return 0;
  let total = 0;
  const visit = (node, inheritedName = '') => {
    let name = inheritedName;
    if (node === null || typeof node !== 'object') return;
    if (node.type === 'Property') name = node.key?.name ?? node.key?.value ?? name;
    if (node.type === 'VariableDeclarator') name = node.id?.name ?? name;
    const value = node.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.raw).join('\n')
      : node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
    if (value !== null && (/\b(?:uniform|varying|attribute|precision)\s+|\b(?:vec[234]|mat[234]|sampler2D)\s+\w+|\bvoid\s+main\s*\(|#include\s*</u.test(value)
      || (/glsl|shader|^vertex|^fragment/iu.test(name) && /[;{}]/u.test(value))
      || /\/\*\s*glsl\s*\*\/\s*$/u.test(source.slice(Math.max(0, node.start - 24), node.start)))) {
      total += shaderCodeLines(value);
      return;
    }
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(part => { visit(part, name); }); else visit(child, name);
  };
  visit(parseSync(path, source).program);
  return total;
}
function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : sourceFile.test(path) && !path.endsWith('.d.ts') ? [path] : [];
  });
}
function sourceInfo(source, path) {
  if (path.endsWith('.glsl')) return { comments: [], specs: [] };
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
  return { comments: tree.comments, specs, tree };
}
// G294 per export: a module's top-level bindings, what each one's declaration references, and how its exports map
// onto them. `refs` holds local names, `ns\0member` for a namespace-import member, and `\0spec` (`\0spec\0name` with an
// import-type qualifier) for an expression or import-type module reference; a bare one is charged as every export. Matching is lexical, without scope analysis.
const MEMBER_KEYS = new Set(['Property', 'MethodDefinition', 'PropertyDefinition', 'AccessorProperty', 'TSPropertySignature',
  'TSMethodSignature', 'TSAbstractMethodDefinition', 'TSAbstractPropertyDefinition', 'TSAbstractAccessorProperty', 'ImportAttribute']);
const OWN_IDS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression', 'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration', 'TSEnumDeclaration', 'TSModuleDeclaration']);
function moduleSymbols(program) {
  const imports = new Map(), exports = new Map(), stars = [], bindings = new Map(), init = { refs: new Set(), spans: [] }, statics = [];
  const namespaces = new Set();
  const literal = node => node?.type === 'Literal' && typeof node.value === 'string' ? node.value
    : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : null;
  const nameOf = node => node?.type === 'Identifier' ? node.name : literal(node);
  for (const node of program.body) if (node.source && /^(?:Import|ExportNamed|ExportAll)Declaration$/u.test(node.type)) statics.push(node.source.value);
  for (const node of program.body) if (node.type === 'ImportDeclaration') for (const spec of node.specifiers) {
    const name = spec.type === 'ImportSpecifier' ? nameOf(spec.imported) : spec.type === 'ImportDefaultSpecifier' ? 'default' : '*';
    imports.set(spec.local.name, { spec: node.source.value, name });
    if (name === '*') namespaces.add(spec.local.name);
  } else if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference.type === 'TSExternalModuleReference') {
    imports.set(node.id.name, { spec: literal(node.moduleReference.expression), name: '*' });
    statics.push(literal(node.moduleReference.expression));
    namespaces.add(node.id.name);
  }
  const collect = (root, refs) => {
    const visit = (node, parent, key, binding) => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const child of node) visit(child, parent, key, binding); return; }
      if (typeof node.type !== 'string') return;
      if (node.type === 'Identifier') {
        const skip = binding === true || (key === 'property' && parent.type === 'MemberExpression' && !parent.computed)
          || (key === 'key' && MEMBER_KEYS.has(parent.type) && !parent.computed) || (key === 'right' && parent.type === 'TSQualifiedName')
          || (key === 'label') || (key === 'id' && (parent.type === 'TSEnumMember' || OWN_IDS.has(parent.type)))
          || (key === 'name' && parent.type === 'TSTypeParameter');
        if (!skip) refs.add(node.name);
        visit(node.typeAnnotation, node, 'typeAnnotation', false);
        visit(node.decorators, node, 'decorators', false);
        return;
      }
      if (node.type === 'JSXIdentifier') {
        if ((key === 'name' && /^(?:JSXOpening|JSXClosing)Element$/u.test(parent.type)) || (key === 'object' && parent.type === 'JSXMemberExpression')) refs.add(node.name);
        return;
      }
      // Namespace members resolve to the one export they name; a bare namespace use charges every export.
      if ((node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier' && namespaces.has(node.object.name) && node.property.type === 'Identifier')
        || (node.type === 'TSQualifiedName' && node.left.type === 'Identifier' && namespaces.has(node.left.name))) {
        refs.add(`${node.object?.name ?? node.left.name}\0${node.property?.name ?? node.right.name}`);
        return;
      }
      if (node.type === 'ImportExpression' || node.type === 'TSImportType') {
        const spec = literal(node.source), member = node.qualifier?.type === 'Identifier' ? `\0${node.qualifier.name}` : '';
        if (spec !== null) refs.add(`\0${spec}${member}`);
        if (node.type === 'TSImportType') { visit(node.typeArguments, node, 'typeArguments', false); return; }
      }
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') { const spec = literal(node.arguments[0]); if (spec !== null) refs.add(`\0${spec}`); }
      for (const [childKey, child] of Object.entries(node)) {
        if (childKey === 'type' || childKey === 'start' || childKey === 'end' || childKey === 'range') continue;
        // Binding positions are not references; their defaults, computed keys and type annotations are.
        const childBinding = (childKey === 'id' && node.type === 'VariableDeclarator') || (childKey === 'params' && /Function|Arrow|TSMethodSignature|TSCallSignature|TSConstructSignature|TSFunctionType|TSConstructorType|TSDeclareFunction/u.test(node.type))
          || (childKey === 'param' && node.type === 'CatchClause') || (childKey === 'parameter' && node.type === 'TSParameterProperty')
          || (binding && ((node.type === 'Property' && childKey === 'value') || (node.type === 'RestElement' && childKey === 'argument')
            || (node.type === 'AssignmentPattern' && childKey === 'left') || (node.type === 'ArrayPattern' && childKey === 'elements')
            || (node.type === 'ObjectPattern' && childKey === 'properties')));
        visit(child, node, childKey, childBinding);
      }
    };
    visit(root, null, null, false);
  };
  const patternNames = (node, out) => {
    if (!node) return out;
    if (node.type === 'Identifier') out.push(node.name);
    else if (node.type === 'ObjectPattern') for (const prop of node.properties) patternNames(prop.type === 'RestElement' ? prop.argument : prop.value, out);
    else if (node.type === 'ArrayPattern') for (const element of node.elements) patternNames(element, out);
    else if (node.type === 'RestElement') patternNames(node.argument, out);
    else if (node.type === 'AssignmentPattern') patternNames(node.left, out);
    return out;
  };
  const bind = (name, span, declaration) => {
    if (!bindings.has(name)) bindings.set(name, { spans: [], refs: new Set() });
    const row = bindings.get(name);
    row.spans.push(span);
    collect(declaration, row.refs);
  };
  const declare = (declaration, statement) => {
    const span = { start: statement.start, end: statement.end };
    if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        const names = patternNames(declarator.id, []), own = declaration.declarations.length === 1 ? span : { start: declarator.start, end: declarator.end };
        for (const name of names) bind(name, own, declarator);
      }
      return declaration.declarations.flatMap(row => patternNames(row.id, []));
    }
    if (declaration.type === 'TSModuleDeclaration' && (declaration.id?.type !== 'Identifier' || declaration.kind === 'global')) { collect(declaration, init.refs); init.spans.push(span); return []; }
    if (declaration.type === 'TSImportEqualsDeclaration') { if (!imports.has(declaration.id.name)) bind(declaration.id.name, span, declaration.moduleReference); return [declaration.id.name]; }
    if (declaration.id?.type === 'Identifier') { bind(declaration.id.name, span, declaration); return [declaration.id.name]; }
    return null;
  };
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration' || (node.type === 'TSImportEqualsDeclaration' && imports.has(node.id.name))) continue;
    if (node.type === 'ExportAllDeclaration') {
      if (node.exported === null) stars.push(node.source.value);
      else exports.set(nameOf(node.exported), { spec: node.source.value, name: '*' });
      continue;
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) for (const name of declare(node.declaration, node) ?? []) exports.set(name, { local: name });
      for (const spec of node.specifiers) exports.set(nameOf(spec.exported), node.source ? { spec: node.source.value, name: nameOf(spec.local) } : { local: nameOf(spec.local) });
      continue;
    }
    if (node.type === 'ExportDefaultDeclaration') {
      const names = /Declaration$|^TSDeclareFunction$/u.test(node.declaration.type) ? declare(node.declaration, node) : null;
      if (names?.length === 1) exports.set('default', { local: names[0] });
      else { bind('\0default', { start: node.start, end: node.end }, node.declaration); exports.set('default', { local: '\0default' }); }
      continue;
    }
    if (node.type === 'TSExportAssignment') { bind('\0default', { start: node.start, end: node.end }, node.expression); exports.set('default', { local: '\0default' }); continue; }
    const names = /Declaration$|^TSDeclareFunction$/u.test(node.type) ? declare(node, node) : null;
    if (names === null) { collect(node, init.refs); init.spans.push({ start: node.start, end: node.end }); }
  }
  return { imports, exports, stars, bindings, init, statics };
}
/** Per line of `source`: does it hold code once parser comment spans are blanked (the codeLines unit)? */
function codeLineMask(source, comments) {
  const chunks = [];
  let cursor = 0;
  for (const { start, end } of comments) {
    chunks.push(source.slice(cursor, start), source.slice(start, end).replaceAll(/[^\n]/gu, ' '));
    cursor = end;
  }
  chunks.push(source.slice(cursor));
  const starts = [0], blanked = chunks.join('');
  for (let index = 0; index < blanked.length; index++) if (blanked[index] === '\n') starts.push(index + 1);
  const code = blanked.split('\n').map(line => line.trim() !== '');
  const lineOf = offset => { let low = 0, high = starts.length - 1; while (low < high) { const mid = (low + high + 1) >> 1; if (starts[mid] <= offset) low = mid; else high = mid - 1; } return low; };
  return { code, lineOf };
}
export function shardLines(root = ROOT) {
  const exists = (path) => existsSync(resolve(root, path)), texts = new Map(), graphs = new Map(), sources = new Map(), counts = new Map();
  const frozen = legacyInventory(root);
  const generated = new Set(exists('scripts/generation-jobs.json') ? discoverGeneration(root).jobs.flatMap(job => job.outputs) : []);
  // Retained source tables also have exact producer/output identities; older tooling predates generation jobs.
  const sourceOutputs = 'scripts/source-generation-outputs.json';
  if (exists(sourceOutputs)) {
    const catalogue = v.parse(SourceOutputs, JSON.parse(readFileSync(resolve(root, sourceOutputs), 'utf8')));
    for (const outputs of Object.values(catalogue.producers)) for (const path of outputs) generated.add(path);
  }
  // A sealed copy retains the same producer-output identity, never a basename-based exemption.
  for (const [folder, legacy] of Object.entries(frozen.shards)) {
    const prefix = `src/shards/${legacy.primary}/`;
    for (const path of generated) if (path.startsWith(prefix)) generated.add(`src/shards/${folder}/${path.slice(prefix.length)}`);
  }
  const text = (path) => {
    if (!texts.has(path)) texts.set(path, readFileSync(resolve(root, path), 'utf8'));
    return texts.get(path);
  };
  const ignored = (path) => generated.has(path);
  const info = path => { if (!sources.has(path)) sources.set(path, sourceInfo(text(path), path)); return sources.get(path); };
  const shaders = path => ignored(path) ? 0 : rawShaderLines(text(path), path);
  const count = path => { if (!counts.has(path)) counts.set(path, ignored(path) ? 0 : (path.endsWith('.glsl') ? shaderCodeLines(text(path)) : linesWithoutComments(text(path), info(path).comments))); return counts.get(path); };
  const sdk = exists('src/sdk/package.json') ? JSON.parse(text('src/sdk/package.json')) : null;
  const hasSdk = sdk?.name === '@wildshard/sdk';
  const publishedTarget = (pkg, spec) => {
    const name = `@wildshard/${pkg}`, manifest = pkg === 'sdk' ? sdk : exists(`src/${pkg}/package.json`) ? JSON.parse(text(`src/${pkg}/package.json`)) : null;
    if (manifest?.name !== name || !(spec === name || spec?.startsWith(`${name}/`))) return null;
    const key = spec === name ? '.' : `.${spec.slice(name.length)}`, target = manifest.exports?.[key];
    const path = typeof target === 'string' ? relative(root, resolve(root, `src/${pkg}`, target)).replaceAll('\\', '/') : null;
    return path !== null && exists(path) ? path : null;
  };
  const resolveEdge = (path, spec) => {
    const pkg = /^@wildshard\/(sdk|game|engine|commons)(?:\/|$)/u.exec(spec ?? '');
    const shaderBase = spec?.startsWith('.') ? relative(root, resolve(root, path, '..', spec.split('?')[0])).replaceAll('\\', '/') : null;
    const shaderPath = shaderBase?.endsWith('.glsl') && exists(shaderBase) ? shaderBase : null;
    const to = spec === null ? null : shaderPath ?? (pkg === null ? null : publishedTarget(pkg[1], spec)) ?? resolveSpecifier(path, spec, exists);
    // Local AssemblyScript imports are part of the same authored closure, including extensionless imports.
    const base = spec?.startsWith('.') ? relative(root, resolve(root, path, '..', spec)).replaceAll('\\', '/') : null;
    const assemblyPath = base === null ? null : [base, `${base}.as`, `${base}/index.as`].find((candidate) => candidate.endsWith('.as') && exists(candidate));
    // A local JSON import is data: it resolves to its file, which the folder rules then classify like any other.
    const jsonPath = base !== null && base.endsWith('.json') && exists(base) ? base : null;
    // Classify the resolved path's namespace components; an audited tree need not contain that namespace.
    const local = (to ?? '').split('/');
    const trustedLocal = local.length > 3 && local[0] === 'src' && local[1] === 'sdk' && local[2] === 'runtime';
    return { sdk: publishedTarget('sdk', spec) !== null, trusted: /^@wildshard\/sdk\/runtime(?:\/|$)/u.test(spec ?? '') || trustedLocal, commons: publishedTarget('commons', spec) !== null, to: to ?? assemblyPath ?? jsonPath ?? null };
  };
  const graph = (path) => {
    if (!graphs.has(path)) graphs.set(path, info(path).specs.map(spec => resolveEdge(path, spec)));
    return graphs.get(path);
  };
  const shardFiles = Object.fromEntries(readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !Object.hasOwn(frozen.shards, entry.name)).sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name, filesIn(resolve(root, 'src/shards', entry.name)).map((path) => relative(root, path))]));
  const moduleUsers = new Map();
  for (const [slug, files] of Object.entries(shardFiles)) {
    // G312: templates are authoring fixtures, never an independent consumer of a platform system.
    if (slug === RULES.template) continue;
    const prefix = `src/shards/${slug}/`, seen = new Set(), queue = files.filter(path => !RULES.tests.test(path));
    while (queue.length > 0) {
      const path = queue.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      if (!sourceFile.test(path) || path.endsWith('.d.ts') || RULES.tests.test(path) || !exists(path)) continue;
      // Other shards are never consumers of this one's closure; follow defining engine modules too (G303).
      if (!path.startsWith(prefix) && !/^src\/(?:engine|game|sdk|commons)\//u.test(path)) continue;
      if (RULES.attributedLayers.test(path)) {
        if (!moduleUsers.has(path)) moduleUsers.set(path, new Set());
        moduleUsers.get(path).add(slug);
      }
      for (const edge of graph(path)) if (edge.to !== null) queue.push(edge.to);
    }
  }
  const privateModules = new Map(Object.keys(shardFiles).map(slug => [slug, []]));
  for (const [path, users] of [...moduleUsers].sort(([a], [b]) => a.localeCompare(b))) {
    if (users.size >= RULES.publicUserCount || !(RULES.typescript.test(path) || path.endsWith('.glsl'))) continue;
    const lines = count(path);
    if (lines > 0) privateModules.get([...users][0]).push({ path, lines });
  }
  // G294 per export: a module that two or more shards reach as a file still charges every top-level declaration that
  // exactly one shard reaches, through its own imports or transitively through the platform code it reaches.
  const symbols = new Map(), masks = new Map(), bindingUsers = new Map();
  const parsedTs = path => RULES.typescript.test(path) && !path.endsWith('.d.ts');
  const symbolsOf = path => { if (!symbols.has(path)) symbols.set(path, moduleSymbols(info(path).tree.program)); return symbols.get(path); };
  for (const [slug, files] of Object.entries(shardFiles)) {
    if (slug === RULES.template) continue;
    const prefix = `src/shards/${slug}/`, seen = new Set(), queue = files.filter(path => !RULES.tests.test(path)).map(path => [path, null]);
    const follow = path => typeof path === 'string' && sourceFile.test(path) && !path.endsWith('.d.ts') && !RULES.tests.test(path) && exists(path)
      && (path.startsWith(prefix) || /^src\/(?:engine|game|sdk|commons)\//u.test(path));
    // Resolve an exported name (or `*`, every export) to the local declaration(s) behind it; reaching it evaluates the module.
    const exported = (path, name, stack = new Set()) => {
      if (path === null || !follow(path)) return;
      queue.push([path, null]);
      if (!parsedTs(path) || stack.has(`${path}\0${name}`)) return;
      stack.add(`${path}\0${name}`);
      const sym = symbolsOf(path), rows = name === '*' ? [...sym.exports.values()] : sym.exports.has(name) ? [sym.exports.get(name)] : [];
      for (const row of rows) {
        // `export { imported as name }` forwards to the imported module's export.
        const forward = row.local === undefined ? row : sym.imports.get(row.local);
        if (forward === undefined) queue.push([path, row.local]); else exported(resolveEdge(path, forward.spec).to, forward.name, stack);
      }
      if (name === '*' || rows.length === 0) for (const star of sym.stars) exported(resolveEdge(path, star).to, name, stack);
    };
    const reach = (path, sym, refs) => {
      for (const ref of refs) {
        const [head, member] = ref.split('\0', 2), parts = ref.split('\0');
        if (head === '') exported(resolveEdge(path, parts[1]).to, parts[2] ?? '*');
        else if (member !== undefined) { const row = sym.imports.get(head); if (row) exported(resolveEdge(path, row.spec).to, member); }
        else if (sym.bindings.has(ref)) queue.push([path, ref]);
        else if (sym.imports.has(ref)) { const row = sym.imports.get(ref); exported(resolveEdge(path, row.spec).to, row.name); }
      }
    };
    while (queue.length > 0) {
      const [path, local] = queue.pop(), key = `${path}\0${local ?? ''}`;
      if (seen.has(key) || !follow(path)) continue;
      seen.add(key);
      if (!parsedTs(path)) { for (const row of graph(path)) if (row.to !== null) queue.push([row.to, null]); continue; }
      const sym = symbolsOf(path);
      if (local === null) {
        // Evaluating a module runs its top-level statements and evaluates its static imports.
        for (const spec of sym.statics) { const to = resolveEdge(path, spec).to; if (to !== null) queue.push([to, null]); }
        reach(path, sym, sym.init.refs);
        // The shard's own folder is the root: every declaration, named import and re-export in it is used (a namespace
        // import reaches the members its declarations name, or every export when used bare).
        if (path.startsWith(prefix)) {
          for (const name of sym.bindings.keys()) queue.push([path, name]);
          for (const row of sym.imports.values()) if (row.name !== '*') exported(resolveEdge(path, row.spec).to, row.name);
          for (const row of sym.exports.values()) if (row.spec !== undefined) exported(resolveEdge(path, row.spec).to, row.name);
          for (const star of sym.stars) exported(resolveEdge(path, star).to, '*');
        }
        continue;
      }
      const row = sym.bindings.get(local);
      if (row === undefined) continue;
      if (RULES.attributedLayers.test(path)) {
        if (!bindingUsers.has(key)) bindingUsers.set(key, new Set());
        bindingUsers.get(key).add(slug);
      }
      reach(path, sym, row.refs);
    }
  }
  const privateExports = new Map(Object.keys(shardFiles).map(slug => [slug, []]));
  for (const [path, users] of [...moduleUsers].sort(([a], [b]) => a.localeCompare(b))) {
    if (users.size < RULES.publicUserCount || !parsedTs(path) || ignored(path)) continue;
    const sym = symbolsOf(path), claimed = new Set();
    if (!masks.has(path)) masks.set(path, codeLineMask(text(path), info(path).comments));
    const { code, lineOf } = masks.get(path), exportedLocals = new Set([...sym.exports.values()].flatMap(row => row.local ?? []));
    const sole = [...sym.bindings].map(([local, row]) => ({ local, row, owners: bindingUsers.get(`${path}\0${local}`) }))
      .filter(entry => entry.owners?.size === 1).sort((a, b) => a.row.spans[0].start - b.row.spans[0].start);
    for (const { local, row, owners } of sole) {
      let lines = 0;
      for (const span of row.spans) for (let line = lineOf(span.start); line <= lineOf(Math.max(span.start, span.end - 1)); line++) {
        if (!claimed.has(line) && code[line]) { claimed.add(line); lines++; }
      }
      if (lines > 0) privateExports.get([...owners][0]).push({ path, name: local === '\0default' ? 'default' : local, exported: exportedLocals.has(local), lines });
    }
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
    const row = { publicLines: 0, customLines: 0, runtimeLines: 0, trustedRuntimeLines: 0, assemblyScriptLines: 0, publicShare: 0, legacy: { generators: 0, data: 0, runtime: 0 }, legacyShare: 0, conversion: null };
    let shardRuntimeLines = 0, rawGlslLines = 0, additionalGlslLines = 0;
    for (const path of files) {
      const local = path.slice(`src/shards/${slug}/`.length), top = local.split('/')[0];
      // Keep the historical physical TS-only comparison explicitly separate from the current authored measure.
      if (RULES.typescript.test(path)) row.legacy[top === 'generators' || top === 'data' ? top : 'runtime'] += text(path).split('\n').length - 1;
      const lines = count(path);
      // G315: authored AS is reported separately, without a cap or an effect on the G291 TS ratio.
      if (path.endsWith('.as') && !RULES.tests.test(local)) row.assemblyScriptLines += lines;
      if (RULES.typescript.test(path) && !RULES.runtimeExcludedFolders.has(top) && !RULES.tests.test(local)) shardRuntimeLines += lines;
      const shaderLines = RULES.tests.test(local) ? 0 : shaders(path);
      rawGlslLines += shaderLines;
      if (!RULES.typescript.test(path) || RULES.runtimeExcludedFolders.has(top)) additionalGlslLines += shaderLines;
      const category = shaderLines > 0 ? { publicCode: false, trusted: false } : classify(slug, path);
      row[category.publicCode ? 'publicLines' : 'customLines'] += lines;
      if (!path.endsWith('.as') && category.trusted) row.trustedRuntimeLines += lines;
      if (!path.endsWith('.as') && (top === 'runtime' || category.trusted)) row.runtimeLines += lines;
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
    const modules = privateModules.get(slug), exports = privateExports.get(slug);
    const attributedLines = [...modules, ...exports].reduce((total, module) => total + module.lines, 0);
    const customRuntimeLines = shardRuntimeLines + additionalGlslLines + attributedLines;
    row.conversion = {
      metric: pair === undefined ? 'legacy-share' : 'runtime-vs-legacy', customRuntimeLines, shardRuntimeLines, rawGlslLines, additionalGlslLines,
      legacyLines, legacyFolder: pair?.[0] ?? null, legacyRevision: pair?.[1].source ?? null,
      runtimeShare: legacyLines === null ? null : customRuntimeLines / legacyLines,
      passed: legacyLines === null ? null : customRuntimeLines <= legacyLines * 0.2,
      gameSystemAttribution: { status: 'import-graph', review: 'G294-primary-reach', lines: attributedLines, modules, exports },
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
  const witnessCompatible = headless && replay && ledger && (witness === null || (witness.compatible === true && witness.audit?.exitStatus === 0));
  const trustedSimulation = row.runtimeLines > 0 || row.trustedRuntimeLines > 0 || typeof witness?.entry === 'string';
  const compatible = witnessCompatible && !trustedSimulation;
  return { boot: proof('boot'), headless, replay, ledger, gridReady: proof('grid-ready'), compatible, transitional: trustedSimulation || !compatible, witnessCompatible };
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
  const productArg = process.argv.find(value => value.startsWith('--products='));
  const products = productArg === undefined ? resolve(ROOT, 'public/shardfiles') : resolve(ROOT, productArg.slice('--products='.length));
  if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(Object.entries(lines).map(([slug, row]) => [slug, { ...row, baseline: recorded.baseline[slug], ceiling: recorded.enforced[slug] ?? Math.floor(recorded.baseline[slug] * 0.2), enforced: Object.hasOwn(recorded.enforced, slug), milestones: milestoneFlags(slug, row), content: shardContent(slug, ROOT, products) }])), null, 2));
  else {
    console.log('shard                  shard TS  sole SDK/game  frozen TS  custom / frozen  80/20       legacy-share  enforcement');
    for (const [slug, row] of Object.entries(lines)) {
      const base = recorded.baseline[slug], ceiling = recorded.enforced[slug] ?? Math.floor(base * 0.2);
      const measure = row.conversion, ratio = measure.runtimeShare === null ? 'no legacy folder' : `${(measure.runtimeShare * 100).toFixed(1)} %`;
      const passed = measure.passed ?? (row.publicShare >= 0.8 && row.runtimeLines <= ceiling);
      console.log(`${slug.padEnd(22)} ${String(measure.shardRuntimeLines).padStart(8)} ${String(measure.gameSystemAttribution.lines).padStart(14)} ${String(measure.legacyLines ?? '—').padStart(10)} ${ratio.padStart(16)}  ${(passed ? 'PASS' : 'FAIL').padEnd(10)} ${(row.legacyShare * 100).toFixed(1).padStart(7)} %  ${measure.metric === 'runtime-vs-legacy' ? RULES.enforcement : (slug in recorded.enforced ? 'old enforced' : 'old reported')}`);
      console.log(`  proofs ${JSON.stringify(milestoneFlags(slug, row))}`);
      const sole = measure.gameSystemAttribution, byModule = new Map();
      for (const entry of sole.exports) byModule.set(entry.path, [...byModule.get(entry.path) ?? [], entry]);
      const wholeLines = sole.modules.reduce((total, module) => total + module.lines, 0);
      const listed = (rows, separator) => rows.length > 0 ? rows.join(separator) : 'none';
      console.log(`  G294 sole whole modules ${wholeLines} lines (${listed(sole.modules.map(module => `${module.path} ${module.lines}`), ', ')}); sole exports ${sole.lines - wholeLines} lines (${listed([...byModule].map(([path, entries]) =>
        `${path} ${entries.reduce((total, entry) => total + entry.lines, 0)}: ${entries.map(entry => `${entry.exported ? '' : '~'}${entry.name} ${entry.lines}`).join(' ')}`), '; ')})`);
      console.log(`  raw GLSL ${measure.rawGlslLines} lines (${measure.additionalGlslLines} additional to runtime TS); AssemblyScript ${row.assemblyScriptLines} lines (report-only, no cap); content ${JSON.stringify(shardContent(slug, ROOT, products))}`);
    }
  }
  if (process.argv.includes('--check')) {
    const failures = checkShares(recorded, lines);
    for (const failure of failures) console.error(`shard-platform: ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  }
}
