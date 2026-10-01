// E357 F6: shared, pure codemod operations. Parse syntax without running or typechecking game code.
import path from 'node:path';
import ts from '@typescript/typescript6';

export function layer(file) {
  const match = /^src\/(engine|game|kit|shards\/[^/]+)(?:\/|$)/.exec(file);
  return match?.[1] ?? (file.startsWith('test/') ? 'test' : 'root');
}

export function sourceFile(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

export function imports(file, text) {
  const root = sourceFile(file, text);
  const result = [];
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
        : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
    if (specifier && ts.isStringLiteralLike(specifier)) {
      result.push({ specifier: specifier.text, start: specifier.getStart(root) + 1, end: specifier.getEnd() - 1,
        line: root.getLineAndCharacterOfPosition(specifier.getStart(root)).line + 1, node, root });
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  return result;
}

export function resolveImport(file, specifier, files) {
  const clean = specifier.replace(/[?#].*$/, '');
  // '#' at the start is an alias, not a URL fragment.
  const name = specifier.startsWith('#') ? specifier.split('?')[0] : clean;
  let base;
  if (name.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
  else if (name.startsWith('/src/')) base = name.slice(1);
  else if (/^#(engine|game|kit|shards)(\/|$)/.test(name)) base = `src/${name.slice(1)}`;
  else return null;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.d.ts`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`]
    .find((candidate) => files.has(candidate)) ?? null;
}

export function localSpecifier(specifier) {
  if (specifier.startsWith('.')) return true;
  if (specifier.startsWith('/src/')) return true;
  return /^#(engine|game|kit|shards)(\/|$)/.test(specifier);
}

export function rewriteImport(file, destination, specifier, files, moves) {
  const target = resolveImport(file, specifier, files);
  if (!target) return specifier;
  const after = moves.get(target) ?? target;
  const suffix = specifier.includes('?') ? specifier.slice(specifier.indexOf('?')) : '';
  const name = after.replace(/(?:\.d)?\.tsx?$/, '');
  if (layer(destination) === layer(after) && layer(destination) !== 'test') {
    const relative = path.posix.relative(path.posix.dirname(destination), name);
    return `${relative.startsWith('.') ? relative : `./${relative}`}${suffix}`;
  }
  // Composition roots have no alias; a test of the root must stay relative.
  return !after.startsWith('src/') || layer(after) === 'root' ? `${relativePath(destination, name)}${suffix}` : `#${name.slice(4)}${suffix}`;
}

function relativePath(file, target) {
  const relative = path.posix.relative(path.posix.dirname(file), target);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export function applyEdits(text, edits) {
  let end = text.length;
  let result = '';
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (edit.end > end) throw new Error('Overlapping syntax edits');
    result = edit.text + text.slice(edit.end, end) + result;
    end = edit.start;
  }
  return text.slice(0, end) + result;
}

export function rewriteImports(file, destination, text, files, moves) {
  return applyEdits(text, imports(file, text).map((entry) => ({ start: entry.start, end: entry.end,
    text: rewriteImport(file, destination, entry.specifier, files, moves) })));
}

export function pathRewriter(moves) {
  const keys = [...moves.keys()].filter((key) => key !== moves.get(key)).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return (text) => text;
  const escaped = keys.map((key) => key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).join('|');
  // A single replacement pass prevents a target from being rewritten twice. Match whole path tokens only.
  const pattern = new RegExp(`(?<![\\w./-])(/?)(${escaped})(?![\\w./-])`, 'g');
  return (text) => text.replaceAll(pattern, (match, prefix, key) => `${prefix}${moves.get(key) ?? key}`);
}

export function rewritePaths(text, moves) {
  return pathRewriter(moves)(text);
}

export function rewriteGlobs(file, text, globs, row) {
  const root = sourceFile(file, text);
  const edits = [];
  const applicable = globs.filter((glob) => glob.file === file && glob.row === row && Array.isArray(glob.to));
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(root) === 'import.meta.glob') {
      const argument = node.arguments.at(0);
      if (argument) {
        const patterns = ts.isArrayLiteralExpression(argument) ? argument.elements : [argument];
        const values = patterns.filter(ts.isStringLiteralLike).map((pattern) => pattern.text);
        const match = applicable.find((glob) => JSON.stringify(values) === JSON.stringify(glob.from));
        if (match) edits.push({ start: argument.getStart(root), end: argument.getEnd(), text: JSON.stringify(match.to) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  return applyEdits(text, edits);
}

export function collisions(moves, files) {
  const targets = new Map();
  const result = [];
  const foldedFiles = new Map([...files].map((file) => [file.toLowerCase(), file]));
  for (const [from, to] of moves) {
    const key = to.toLowerCase();
    const prior = targets.get(key);
    if (prior && prior !== from) result.push({ from, to, kind: 'duplicate destination', other: prior });
    const occupied = foldedFiles.get(key);
    if (occupied && occupied !== from && !moves.has(occupied)) result.push({ from, to, kind: 'occupied destination', other: occupied });
    if (from !== to && from.toLowerCase() === key) result.push({ from, to, kind: 'case-only rename', other: from });
    targets.set(key, from);
  }
  return result;
}

export function changedLines(before, after) {
  if (before === after) return 0;
  const a = before.split('\n');
  const b = after.split('\n');
  return Math.max(a.length, b.length) - a.filter((line, index) => line === b[index]).length;
}
