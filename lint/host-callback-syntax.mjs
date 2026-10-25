// G642: callback admission from syntax; the typed catalogue is a separate build tool.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { parseSync } from 'vite';
import { hostPlayFile } from './host-files.mjs';

const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'TSDeclareFunction',
  'TSFunctionType', 'TSMethodSignature', 'TSCallSignatureDeclaration']);
const classes = new Set(['ClassDeclaration', 'ClassExpression']);
const platform = file => /^src\/(?:engine|game|sdk)\//u.test(file);
const shard = file => file.startsWith('src/shards/');
const unwrap = input => {
  let node = input;
  while (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression', 'ChainExpression', 'TSInstantiationExpression'].includes(node?.type)) node = node.expression;
  return node;
};
const decorate = (ref, extra) => ({ ...ref, ...extra });
const child = (ref, node) => ({ unit: ref.unit, node, ...(ref.types ? { types: ref.types } : {}) });
const keyOf = node => node?.type === 'Identifier' ? node.name : node?.type === 'Literal' ? String(node.value) : null;
const children = node => Object.entries(node).flatMap(([key, value]) => ['parent', 'loc', 'range', 'tokens', 'comments'].includes(key) ? []
  : Array.isArray(value) ? value.filter(item => item && typeof item.type === 'string')
  : value && typeof value.type === 'string' ? [value] : []);
const parsedModules = new Map();

function moduleFile(root, from, source) {
  let path;
  if (source.startsWith('.')) path = resolve(root, dirname(from), source);
  else if (source.startsWith('/src/')) path = resolve(root, source.slice(1));
  else {
    const pkg = /^@wildshard\/(engine|game|sdk|format)\/(.+)$/u.exec(source);
    if (!pkg) return null;
    const manifest = resolve(root, 'src', pkg[1], 'package.json');
    const exports = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).exports ?? {} : {};
    let target = exports[`./${pkg[2]}`];
    while (target && typeof target === 'object') target = target.types ?? target.import ?? target.default;
    path = resolve(root, 'src', pkg[1], typeof target === 'string' ? target : pkg[2]);
  }
  const sourcePath = /\.[cm]?js$/u.test(path) ? path.replace(/\.js$/u, '.ts').replace(/\.mjs$/u, '.mts').replace(/\.cjs$/u, '.cts') : path;
  for (const candidate of [path, sourcePath, ...['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.d.ts'].map(ext => path + ext)]) {
    if (/\.[cm]?[jt]sx?$/u.test(candidate) && existsSync(candidate)) return relative(root, candidate).replaceAll('\\', '/');
  }
  return null;
}

// Bindings are lexical, not a file-wide name table: a local host or parameter
// must never accidentally resolve to an import with the same spelling.
function syntaxUnit(file, program) {
  const unit = { file, program, scopes: new Map(), parents: new Map(), exports: new Map(), stars: [], scope: null };
  const scope = { parent: null, names: new Map(), node: program };
  unit.scope = scope;
  const ref = (node, extra = {}) => ({ unit, node, ...extra });
  function bind(pattern, value, current, path = []) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') current.names.set(pattern.name, { ...value, path });
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, value, current, path);
    else if (pattern.type === 'RestElement') bind(pattern.argument, value, current, path);
    else if (pattern.type === 'ObjectPattern') for (const property of pattern.properties) {
      bind(property.value ?? property.argument, value, current, [...path, keyOf(property.key)]);
    }
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((entry, index) => bind(entry, value, current, [...path, String(index)]));
  }
  function walk(node, current, parent = null) {
    if (!node) return;
    unit.parents.set(node, parent);
    if (['FunctionDeclaration', 'TSDeclareFunction', 'ClassDeclaration', 'TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'].includes(node.type) && node.id) {
      bind(node.id, { refs: [ref(node)] }, current);
    }
    let active = current;
    if (functions.has(node.type) || classes.has(node.type) || ['TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'BlockStatement', 'CatchClause', 'ForStatement', 'ForOfStatement', 'ForInStatement'].includes(node.type)) {
      active = { parent: current, names: new Map(), node };
      if (node.id) bind(node.id, { refs: [ref(node)] }, active);
      for (const input of node.params ?? []) {
        const param = input.type === 'TSParameterProperty' ? input.parameter : input;
        bind(param, { refs: [ref(param.typeAnnotation ?? param.left?.typeAnnotation ?? param.right)] }, active);
      }
      if (node.type === 'CatchClause') bind(node.param, { refs: [] }, active);
      for (const param of node.typeParameters?.params ?? []) bind(param.name, { refs: [ref(param.constraint ?? param.default)] }, active);
    }
    unit.scopes.set(node, active);
    if (node.type === 'ImportDeclaration') for (const spec of node.specifiers) bind(spec.local,
      { source: node.source.value, imported: spec.type === 'ImportNamespaceSpecifier' ? '*' : spec.type === 'ImportDefaultSpecifier' ? 'default' : keyOf(spec.imported) }, active);
    if (node.type === 'VariableDeclarator') {
      let target = active;
      if (parent?.kind === 'var') while (target.parent && !functions.has(target.node.type) && target.node.type !== 'Program') target = target.parent;
      bind(node.id, { refs: [ref(node.init ?? node.id.typeAnnotation)] }, target);
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration?.id) unit.exports.set(keyOf(node.declaration.id), { local: keyOf(node.declaration.id) });
      for (const declaration of node.declaration?.declarations ?? []) if (declaration.id.type === 'Identifier') unit.exports.set(declaration.id.name, { local: declaration.id.name });
      for (const spec of node.specifiers) unit.exports.set(keyOf(spec.exported), node.source ? { source: node.source.value, imported: keyOf(spec.local) } : { local: keyOf(spec.local) });
    }
    if (node.type === 'ExportDefaultDeclaration') unit.exports.set('default', { refs: [ref(node.declaration)] });
    if (node.type === 'ExportAllDeclaration') unit.stars.push(node.source.value);
    for (const entry of children(node)) walk(entry, active, node);
  }
  walk(program, scope);
  return unit;
}

/** Follow only syntax reachable from the current file. No TypeScript program,
 * checker, emit, source-tree glob or generated catalogue is loaded here. */
export function hostCallbackSites(root, file, program) {
  if (!hostPlayFile(root, file)) return [];
  const units = new Map(), primary = syntaxUnit(file, program);
  units.set(file, primary);
  function load(target) {
    if (target === null) return null;
    if (units.has(target)) return units.get(target);
    const text = readFileSync(resolve(root, target), 'utf8'), cached = parsedModules.get(resolve(root, target));
    let ast = cached?.text === text ? cached.program : null;
    if (ast === null) {
      const result = parseSync(target, text);
      if (result.errors.length > 0) throw new Error(`Host callback dependency must parse: ${target}`);
      ast = result.program;
      parsedModules.set(resolve(root, target), { text, program: ast });
    }
    const unit = syntaxUnit(target, ast);
    units.set(target, unit);
    return unit;
  }
  const make = (unit, node, extra = {}) => ({ unit, node, ...extra });
  function lookup(unit, node, name) {
    for (let scope = unit.scopes.get(node) ?? unit.scope; scope; scope = scope.parent) if (scope.names.has(name)) return scope.names.get(name);
    return null;
  }
  function binding(unit, value, seen) {
    if (!value) return [];
    let refs;
    if (value.source) {
      const other = load(moduleFile(root, unit.file, value.source));
      refs = other === null ? [] : value.imported === '*' ? [make(other, other.program, { namespace: true })] : exported(other, value.imported, seen);
    } else if (value.local) return binding(unit, unit.scope.names.get(value.local), seen);
    else refs = (value.refs ?? []).flatMap(ref => values(ref, seen));
    for (const name of value.path ?? []) refs = refs.flatMap(ref => property(ref, name, seen));
    return refs;
  }
  function exported(unit, name, seen) {
    const marker = `${unit.file}#${name}`;
    if (seen.has(marker)) return [];
    const next = new Set(seen).add(marker), own = unit.exports.get(name);
    if (own) return binding(unit, own, next).map(ref => decorate(ref, { exportName: ref.exportName ?? name }));
    return unit.stars.flatMap(source => {
      const other = load(moduleFile(root, unit.file, source));
      return other === null ? [] : exported(other, name, next);
    });
  }
  function property(ref, name, seen) {
    if (name === null || !ref.node) return [];
    const { node, unit } = ref;
    if (ref.namespace) return exported(unit, name, seen);
    if (node.type === 'TSTypeAliasDeclaration') return values(child(ref, node.typeAnnotation), seen).flatMap(value => property(value, name, seen));
    if (node.type === 'ObjectExpression') {
      const out = [];
      for (const entry of node.properties) {
        if (entry.type === 'SpreadElement') out.push(...values(child(ref, entry.argument), seen).flatMap(value => property(value, name, seen)));
        else if (keyOf(entry.key) === name) out.push(...values(child(ref, entry.value), seen));
      }
      return out;
    }
    if (node.type === 'ArrayExpression') return values(child(ref, node.elements[Number(name)]), seen);
    const members = classes.has(node.type) ? node.body.body : node.type === 'TSInterfaceDeclaration' ? node.body.body : node.type === 'TSTypeLiteral' ? node.members : [];
    const own = members.filter(entry => keyOf(entry.key) === name).flatMap(entry => {
      const member = make(unit, entry.value ?? entry.typeAnnotation ?? entry, { ownerName: ref.exportName ?? node.id?.name, member: name, types: ref.types });
      return values(member, seen).map(value => decorate(value, { ownerName: member.ownerName ?? value.ownerName, member: name }));
    });
    if (own.length > 0) return own;
    const bases = classes.has(node.type) ? [node.superClass] : (node.extends ?? []).map(entry => entry.expression);
    return bases.flatMap(base => values(child(ref, base), seen).flatMap(value => property(value, name, seen)));
  }
  function returns(ref, seen) {
    const { node } = ref;
    if (node.returnType) return values(child(ref, node.returnType), seen);
    if (!node.body) return [];
    if (node.body.type !== 'BlockStatement') return values(child(ref, node.body), seen);
    const found = [];
    function findReturns(current) {
      if (functions.has(current.type) || classes.has(current.type)) return;
      if (current.type === 'ReturnStatement') found.push(...values(child(ref, current.argument), seen));
      else for (const entry of children(current)) findReturns(entry);
    }
    findReturns(node.body);
    return found;
  }
  function values(ref, seen = new Set()) {
    const { unit } = ref, node = unwrap(ref.node);
    if (!node || seen.has(node)) return [];
    const next = new Set(seen).add(node);
    if (node.type === 'Identifier') {
      const type = ref.types?.get(node.name);
      return type ? values(type, next) : binding(unit, lookup(unit, node, node.name), next);
    }
    if (node.type === 'ThisExpression') {
      for (let parent = unit.parents.get(node); parent; parent = unit.parents.get(parent)) if (classes.has(parent.type)) return [make(unit, parent, { instance: true })];
      return [];
    }
    if (node.type === 'TSTypeAnnotation') return values({ ...ref, node: node.typeAnnotation }, next);
    if (node.type === 'TSTypeAliasDeclaration') return [{ ...ref, node }];
    if (node.type === 'TSTypeReference') {
      const args = node.typeArguments?.params ?? node.typeParameters?.params ?? [];
      if (node.typeName.type === 'Identifier' && ['Readonly', 'Partial', 'Required', 'NonNullable'].includes(node.typeName.name)
        && lookup(unit, node, node.typeName.name) === null) return args.flatMap(arg => values(child(ref, arg), next));
      return values(child(ref, node.typeName), next).map(value => {
        const types = new Map(value.types);
        for (const [index, param] of (value.node.typeParameters?.params ?? []).entries()) {
          const arg = args[index];
          if (arg) types.set(keyOf(param.name), child(ref, arg));
          else if (param.default ?? param.constraint) types.set(keyOf(param.name), child(value, param.default ?? param.constraint));
        }
        return decorate(value, { types });
      });
    }
    if (node.type === 'TSQualifiedName') return values(child(ref, node.left), next).flatMap(value => property(value, keyOf(node.right), next));
    if (['TSUnionType', 'TSIntersectionType'].includes(node.type)) return node.types.flatMap(type => values(child(ref, type), next));
    if (node.type === 'MemberExpression') return values(child(ref, node.object), next).flatMap(value => property(value, node.computed && node.property.type !== 'Literal' ? null : keyOf(node.property), next));
    if (node.type === 'ConditionalExpression') return [node.consequent, node.alternate].flatMap(value => values(child(ref, value), next));
    if (node.type === 'LogicalExpression') return [node.left, node.right].flatMap(value => values(child(ref, value), next));
    if (node.type === 'NewExpression') return values(child(ref, node.callee), next).map(value => decorate(value, { instance: true }));
    if (node.type === 'CallExpression') {
      const callee = unwrap(node.callee);
      if (callee.type === 'MemberExpression' && keyOf(callee.property) === 'bind') return values(child(ref, callee.object), next);
      return values(child(ref, callee), next).flatMap(value => returns(value, next));
    }
    return [{ ...ref, node }];
  }
  function leaves(ref, label, seen = new Set()) {
    const node = unwrap(ref.node);
    if (!node || seen.has(node)) return [];
    const next = new Set(seen).add(node), { unit } = ref;
    if (functions.has(node.type)) return [label];
    if (node.type === 'ConditionalExpression') return [...leaves(child(ref, node.consequent), `${label}.true`, next), ...leaves(child(ref, node.alternate), `${label}.false`, next)];
    if (node.type === 'ObjectExpression') return node.properties.flatMap(entry => entry.type === 'SpreadElement' ? leaves(child(ref, entry.argument), `${label}.*`, next)
      : leaves(child(ref, entry.value), `${label}.${keyOf(entry.key)}`, next));
    if (node.type === 'ArrayExpression') return node.elements.flatMap((entry, index) => leaves(child(ref, entry?.type === 'SpreadElement' ? entry.argument : entry), `${label}[${index}]`, next));
    // Follow shard-authored value/type bags, but do not expand an opaque
    // platform service into every callback-shaped method on its prototype.
    if (node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeLiteral') {
      if (!shard(unit.file)) return [];
      const members = node.type === 'TSTypeLiteral' ? node.members : node.body.body;
      return members.flatMap(entry => entry.type === 'TSCallSignatureDeclaration' ? [label]
        : leaves(child(ref, entry.type === 'TSMethodSignature' ? entry : entry.typeAnnotation), `${label}.${keyOf(entry.key)}`, next));
    }
    if (node.type === 'TSTypeAliasDeclaration') return leaves(child(ref, node.typeAnnotation), label, next);
    if (classes.has(node.type)) return [];
    return values(ref).flatMap(value => value.node === node ? [] : leaves(value, label, next));
  }
  const issues = [];
  function visit(node) {
    if (['CallExpression', 'NewExpression'].includes(node.type)) {
      const callee = unwrap(node.callee), indirect = callee.type === 'MemberExpression' && ['call', 'apply', 'bind'].includes(keyOf(callee.property));
      const hosts = values(make(primary, indirect ? callee.object : callee)).filter(ref => platform(ref.unit.file)
        && (functions.has(ref.node.type) || node.type === 'NewExpression' && classes.has(ref.node.type)));
      const identities = new Set();
      for (const ref of hosts) {
        const host = { module: ref.unit.file, export: ref.ownerName ?? ref.exportName ?? ref.node.id?.name ?? 'default', ...(ref.member ? { member: ref.member } : {}) };
        const identity = JSON.stringify(host);
        if (identities.has(identity)) continue;
        identities.add(identity);
        for (const [index, argument] of node.arguments.entries()) {
          if (indirect && index === 0) continue;
          for (const path of new Set(leaves(make(primary, argument), `arg${index}`))) issues.push({ ...host, file, start: argument.start ?? argument.range[0], end: argument.end ?? argument.range[1], path,
            message: `Shard TS callback ${path} crosses ${host.module}#${host.export}${host.member ? `.${host.member}` : ''}; pass data or a Wasm reference (G454)` });
        }
      }
    }
    for (const entry of children(node)) visit(entry);
  }
  visit(program);
  return issues;
}
