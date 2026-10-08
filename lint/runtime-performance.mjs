// SF62: one syntax-only pass. No TypeScript program or renderer is created by this guard.
import { parseSync } from 'vite';
import { createHash } from 'node:crypto';

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const HOT = /^(?:update|tick|think|step|frame|advance|run|render|onTick|onUpdate)/u;
const SCHEDULERS = new Set(['system', 'onUpdate', 'onInput', 'onLate', 'onFixed', 'onStep', 'watchFrames']);
const ALLOCATING = new Set(['clone', 'map', 'flatMap', 'filter', 'slice', 'concat', 'split', 'match', 'matchAll', 'replace', 'replaceAll', 'toArray', 'toSorted', 'toReversed', 'keys', 'values', 'entries', 'from', 'of']);
const RAW = new Set(['renderer', 'rootScene', 'scene', 'getContext', 'WebGLRenderer', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'Scene']);
const DOM = new Set(['window', 'document', 'createElement', 'querySelector', 'querySelectorAll', 'getElementById', 'innerHTML', 'outerHTML', 'appendChild']);
const ASYNC = new Set(['fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'timeout', 'interval', 'raf']);
const unwrap = node => {
  let value = node;
  while (['TSAsExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression', 'TSNonNullExpression', 'ChainExpression'].includes(value?.type)) value = value.expression;
  return value;
};
const children = node => Object.entries(node).flatMap(([key, value]) => key === 'parent' ? [] : Array.isArray(value) ? value.filter(item => item && typeof item.type === 'string') : value && typeof value.type === 'string' ? [value] : []);
const walk = (node, visit, parent = null) => { if (!node || typeof node.type !== 'string') return; visit(node, parent); for (const child of children(node)) walk(child, visit, node); };

/** Exact source-site identities survive line moves, but never allow new code or another copy of a violation. */
export function runtimePerformanceSites(source, filename = 'runtime.ts') {
  const parsed = parseSync(filename, source), issues = [], constants = new Map(), funcs = [], parents = new Map();
  if (parsed.errors.length > 0) return [{ kind: 'syntax', start: 0, end: source.length, line: 1, site: 'syntax', message: 'Runtime source must parse before it can be checked' }];
  const ambiguous = new Set();
  walk(parsed.program, (node, parent) => {
    parents.set(node, parent);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      if (constants.has(node.id.name) || parent?.kind !== 'const') ambiguous.add(node.id.name);
      constants.set(node.id.name, node.init);
    }
    if (FUNCTIONS.has(node.type)) for (const param of node.params) if (param.type === 'Identifier') ambiguous.add(param.name);
  });
  const constant = (raw, seen = new Set()) => {
    const node = unwrap(raw); if (!node) return undefined;
    if (node.type === 'Literal') return node.value;
    if (node.type === 'Identifier' && !seen.has(node.name) && !ambiguous.has(node.name)) { const next = new Set(seen); next.add(node.name); return constant(constants.get(node.name), next); }
    if (node.type === 'UnaryExpression' && node.operator === '-') { const value = constant(node.argument, seen); return typeof value === 'number' ? -value : undefined; }
    return undefined;
  };
  const name = raw => {
    const node = unwrap(raw); if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') return node.computed ? constant(node.property) : node.property.name;
    return null;
  };
  walk(parsed.program, node => {
    if (!FUNCTIONS.has(node.type)) return;
    const parent = parents.get(node), grand = parents.get(parent);
    const id = node.id?.name ?? (parent?.type === 'VariableDeclarator' ? name(parent.id) : ['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent?.type) ? name(parent.key) ?? constant(parent.key) : null);
    const call = parent?.type === 'CallExpression' ? parent : grand?.type === 'CallExpression' ? grand : null;
    const scheduled = call !== null && SCHEDULERS.has(name(call.callee));
    funcs.push({ node, id, hot: scheduled || (typeof id === 'string' && HOT.test(id)), calls: new Set() });
  });
  const alias = (id, seen = new Set()) => {
    if (seen.has(id)) return id; seen.add(id);
    const initial = unwrap(constants.get(id)); return initial?.type === 'Identifier' ? alias(initial.name, seen) : id;
  };
  walk(parsed.program, node => { if (node.type === 'Property' && HOT.test(name(node.key) ?? constant(node.key) ?? '')) for (const fn of funcs) if (fn.id !== null && alias(name(node.value)) === fn.id) fn.hot = true; });
  walk(parsed.program, node => { if (node.type === 'CallExpression' && SCHEDULERS.has(name(node.callee))) for (const arg of node.arguments) for (const fn of funcs) if (fn.id !== null && alias(name(arg)) === fn.id) fn.hot = true; });
  for (const fn of funcs) walk(fn.node.body, node => { if (node.type === 'CallExpression') fn.calls.add(alias(name(node.callee))); });
  // Local helpers called by a frame callback are hot too; aliasing a local helper does not hide its body.
  for (let round = 0; round < funcs.length; round++) for (const fn of funcs) if (fn.hot) for (const target of funcs) if (target.id !== null && fn.calls.has(target.id)) target.hot = true;
  const inside = node => funcs.some(fn => fn.hot && node.start >= fn.node.body.start && node.end <= fn.node.body.end);
  const issue = (node, kind, message) => {
    const text = source.slice(node.start, node.end).replaceAll(/\s+/gu, ' ').trim();
    const site = createHash('sha256').update(`${kind}:${text}`).digest('hex');
    issues.push({ kind, start: node.start, end: node.end, line: source.slice(0, node.start).split('\n').length, site, message });
  };
  const bound = raw => {
    const node = unwrap(raw), value = constant(node);
    if (Number.isSafeInteger(value)) return true;
    return node?.type === 'CallExpression' && name(node.callee) === 'min' && name(node.callee.object) === 'Math' && node.arguments.some(arg => Number.isSafeInteger(constant(arg)));
  };
  const bounded = node => {
    if (['WhileStatement', 'DoWhileStatement'].includes(node.type)) return constant(node.test) === false;
    if (node.type === 'ForOfStatement') { const right = unwrap(node.right); return right?.type === 'ArrayExpression' && right.elements.every(item => item !== null && constant(item) !== undefined); }
    if (node.type !== 'ForStatement') return false;
    const init = node.init?.declarations?.[0], id = init?.id?.name, test = unwrap(node.test), update = unwrap(node.update);
    if (!id || !bound(init.init) || test?.type !== 'BinaryExpression' || name(test.left) !== id || !bound(test.right)) return false;
    const ascending = ['<', '<='].includes(test.operator), descending = ['>', '>='].includes(test.operator);
    const progress = update?.type === 'UpdateExpression' && name(update.argument) === id && ((ascending && update.operator === '++') || (descending && update.operator === '--'));
    if (!progress) return false;
    let changed = false;
    walk(node.body, body => { if ((body.type === 'AssignmentExpression' && name(body.left) === id) || (body.type === 'UpdateExpression' && name(body.argument) === id)) changed = true; });
    return !changed;
  };
  walk(parsed.program, (node, parent) => {
    // Type-only imports/declarations do not acquire a runtime renderer or DOM handle.
    let ancestor = node;
    while (ancestor) { if (ancestor.type.startsWith('TS') && !['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSInstantiationExpression'].includes(ancestor.type)) return; ancestor = parents.get(ancestor); }
    if (parent?.importKind === 'type' || parents.get(parent)?.importKind === 'type') return;
    const member = node.type === 'MemberExpression' ? name(node) : null;
    const identifier = node.type === 'Identifier' && !(parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) && !(parent?.type === 'Property' && parent.key === node && !parent.computed && parents.get(parent)?.type !== 'ObjectPattern') ? node.name : null;
    const access = member ?? identifier;
    if (RAW.has(access)) issue(node, 'raw-render', 'Runtime must use engine tiles, recipes and registry instead of raw scene/renderer/WebGL');
    if (DOM.has(access)) issue(node, 'dom', 'Runtime cannot access DOM; use the owned platform UI ports');
    if (ASYNC.has(access)) issue(node, 'async', 'Runtime uses fixed-step state, not timers or fetch');
    if (['ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement'].includes(node.type) && !bounded(node)) issue(node, 'unbounded-loop', 'Runtime loops require a statically finite counter or literal collection');
    if (!inside(node)) return;
    if (['NewExpression', 'ArrayExpression', 'ObjectExpression', 'ArrowFunctionExpression', 'FunctionExpression'].includes(node.type)) issue(node, 'frame-allocation', 'Reuse state and buffers instead of allocating inside frame callbacks');
    if (node.type === 'TemplateLiteral' && node.expressions.length > 0) issue(node, 'frame-allocation', 'Move dynamic strings out of the frame loop');
    if (node.type === 'CallExpression' && ALLOCATING.has(name(node.callee))) issue(node, 'frame-allocation', 'Allocating collection/string methods belong outside frame callbacks');
    if (node.type === 'BinaryExpression' && node.operator === '+' && (typeof constant(node.left) === 'string' || typeof constant(node.right) === 'string') && !(constant(node.left) !== undefined && constant(node.right) !== undefined)) issue(node, 'frame-allocation', 'Move dynamic strings out of the frame loop');
  });
  // Recursive helpers have no finite runtime bound. Include mutual recursion, not just direct self calls.
  const reaches = (from, to, seen = new Set()) => {
    if (seen.has(from)) return false; seen.add(from);
    for (const target of funcs) if (target.id !== null && from.calls.has(target.id) && (target === to || reaches(target, to, seen))) return true;
    return false;
  };
  for (const fn of funcs) if (fn.hot && reaches(fn, fn)) issue(fn.node, 'unbounded-loop', 'Recursive frame helpers have no statically finite bound');
  return issues.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
}

/** Existing transition debt is exact by path, syntax hash and multiplicity; outside projects receive no allowance. */
export function runtimePerformanceViolations(source, filename, baseline = {}) {
  const counts = new Map();
  return runtimePerformanceSites(source, filename).filter(issue => {
    const key = `${filename}:${issue.kind}:${issue.site}`, count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
    return count > (baseline[key]?.count ?? 0);
  });
}
