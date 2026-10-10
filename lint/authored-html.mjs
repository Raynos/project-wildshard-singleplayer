// SF58: unknown runtime strings are text, not markup. Follow typed numeric values,
// lexical aliases and local helpers; only static platform markup and the audited
// icon ports are HTML. No shardfile field can select one of these trusted ports.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';

const cache = new Map();
const SINKS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
const normalized = (path) => path.replaceAll('\\', '/');
const functionLike = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
function unwrapped(node) {
  let value = node;
  while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value) || ts.isNonNullExpression(value))) value = value.expression;
  return value;
}
function property(node, checker) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) return node.argumentExpression.text;
  if (ts.isElementAccessExpression(node) && checker) {
    const type = checker.getTypeAtLocation(node.argumentExpression);
    if (type.isStringLiteral()) return type.value;
    if (type.isUnion()) return type.types.find((part) => part.isStringLiteral() && SINKS.has(part.value))?.value ?? null;
  }
  return null;
}
// E454: every file the rule's AST pass can send here (a sink word, or a call named write / writeln / assign), so one
// program serves the whole lint run. A file outside it used to rebuild the program from scratch: 24 of the ratchet's
// 50 s. Extra root files never change another file's types (src files are modules; the merge files are always in).
const CANDIDATE = /innerHTML|outerHTML|srcdoc|__html|insertAdjacentHTML|createContextualFragment|\bwrite(?:ln)?\b|\bassign\b/u;
function checkerFor(root, filename) {
  const key = resolve(root), file = resolve(filename), text = readFileSync(file, 'utf8');
  const cached = cache.get(key);
  if (cached?.program.getSourceFile(file)?.text === text) return cached;
  const config = ts.findConfigFile(key, existsSync);
  const parsed = config ? ts.parseJsonConfigFileContent(ts.readConfigFile(config, (path) => ts.sys.readFile(path)).config, ts.sys, key) : null;
  const names = cached?.names ?? new Set(globSync('src/**/*.{ts,tsx}', { cwd: key }).map((path) => resolve(key, path)).filter((path) => path.endsWith('.merge.d.ts') ? true : CANDIDATE.test(readFileSync(path, 'utf8'))));
  names.add(file);
  const options = { ...parsed?.options, noEmit: true, strict: true, skipLibCheck: true, allowJs: true };
  // A rebuild (an edited file in a long-lived process) reparses only what changed.
  const parsedFiles = cached?.parsedFiles ?? new Map(), base = ts.createCompilerHost(options);
  const host = { ...base, getSourceFile: (name, language, onError, fresh) => {
    const hit = parsedFiles.get(name);
    if (hit !== undefined && !fresh && ts.sys.readFile(name) === hit.text) return hit;
    const parsedFile = base.getSourceFile(name, language, onError, fresh);
    if (parsedFile !== undefined) parsedFiles.set(name, parsedFile);
    return parsedFile;
  } };
  const program = ts.createProgram([...names], options, host);
  const entry = { program, checker: program.getTypeChecker(), names, parsedFiles }; cache.set(key, entry); return entry;
}

/** Conservative HTML-sink analysis; diagnostics point at the unsafe caller for a local markup helper. */
export function authoredHtmlSites(root, filename) {
  const { program, checker } = checkerFor(root, filename), source = program.getSourceFile(resolve(filename));
  if (source === undefined) throw new Error(`Missing HTML lint source: ${filename}`);
  const calls = [], sinks = [], sites = new Map(), writes = new Map();
  const symbol = (node) => {
    const value = checker.getSymbolAtLocation(node);
    return value && (value.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(value) : value;
  };
  const symbolOfFunction = (node) => node.name ? symbol(node.name) : ts.isVariableDeclaration(node.parent) ? symbol(node.parent.name) : undefined;
  const returned = (fn) => {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const values = [];
    const visit = (node) => {
      if (node !== fn.body && functionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) values.push(node.expression);
      ts.forEachChild(node, visit);
    };
    visit(fn.body); return values;
  };
  const privateHelper = (fn) => {
    if (ts.isMethodDeclaration(fn) || ts.isConstructorDeclaration(fn)) return fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword) === true;
    let at = fn;
    while (at && !ts.isSourceFile(at)) {
      if (at.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return false;
      if (ts.isVariableStatement(at) || ts.isFunctionDeclaration(at)) return true;
      at = at.parent;
    }
    return true;
  };
  const scalar = (type) => {
    if (type.isUnion()) return type.types.every(scalar);
    return Boolean(type.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.StringLiteral | ts.TypeFlags.Undefined | ts.TypeFlags.Null));
  };
  function staticMarkup(input, env = new Map(), trail = new Set()) {
    if (input === undefined) return true; // An omitted optional helper argument writes no HTML.
    const node = unwrapped(input);
    if (!node || trail.has(node) || trail.size > 96) return false;
    const next = new Set(trail); next.add(node);
    const safe = (value) => staticMarkup(value, env, next);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
    if (ts.isIdentifier(node)) {
      const binding = symbol(node);
      if (env.has(binding)) return staticMarkup(env.get(binding), env, next);
      if (scalar(checker.getTypeAtLocation(node))) return true;
      if ((writes.get(binding) ?? []).some((value) => !safe(value))) return false;
      const declaration = binding?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return safe(declaration.initializer);
      let parameter = declaration;
      while (parameter && (ts.isBindingElement(parameter) || ts.isArrayBindingPattern(parameter) || ts.isObjectBindingPattern(parameter))) parameter = parameter.parent;
      if (parameter && ts.isParameter(parameter) && functionLike(parameter.parent)) {
        const callback = parameter.parent, call = callback.parent;
        if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && ['map', 'flatMap', 'filter'].includes(call.expression.name.text)) return safe(call.expression.expression);
      }
      if (declaration && ts.isParameter(declaration) && functionLike(declaration.parent) && privateHelper(declaration.parent)) {
        const fn = declaration.parent, index = fn.parameters.indexOf(declaration);
        const callers = calls.filter((call) => checker.getResolvedSignature(call)?.declaration === fn);
        return callers.length > 0 && callers.every((call) => safe(call.arguments[index] ?? declaration.initializer));
      }
      return false;
    }
    if (scalar(checker.getTypeAtLocation(node))) return true;
    if (ts.isTemplateExpression(node)) return node.templateSpans.every((span) => safe(span.expression));
    if (ts.isBinaryExpression(node)) return safe(node.left) && safe(node.right);
    if (ts.isConditionalExpression(node)) return safe(node.whenTrue) && safe(node.whenFalse);
    if (ts.isArrayLiteralExpression(node)) return node.elements.every(safe);
    if (ts.isObjectLiteralExpression(node)) return node.properties.every((entry) => ts.isPropertyAssignment(entry) && safe(entry.initializer));
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const binding = symbol(ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression);
      if ((writes.get(binding) ?? []).some((value) => !safe(value))) return false;
      const declaration = binding?.valueDeclaration;
      if (declaration && ts.isPropertySignature(declaration)) {
        const file = normalized(declaration.getSourceFile().fileName), owner = declaration.parent.name?.text;
        if ((file.endsWith('/src/engine/combat/Equipment.ts') && owner === 'WeaponUi' && property(node) === 'swapIcon')
          || (file.endsWith('/src/engine/ui/hudSlots.ts') && owner === 'DiscOpts' && property(node) === 'icon')
          || (file.endsWith('/src/engine/ui/hudSlots.ts') && owner === 'TouchRelabel' && property(node) === 'icon')
          || (file.endsWith('/src/engine/input/InputService.ts') && owner === 'TouchVerb' && property(node) === 'icon')
          || (file.endsWith('/src/engine/practice/playground/catalog.ts') && owner === 'PlaygroundCard' && property(node) === 'icon')
          || (file.endsWith('/src/engine/app/identity.ts') && owner === 'AppIdentity' && property(node) === 'wordmark')) return true;
      }
      if (declaration && normalized(declaration.getSourceFile().fileName).endsWith('/lib.dom.d.ts') && property(node) === 'innerHTML') return true;
      if (declaration && ts.isPropertyAssignment(declaration)) return safe(declaration.initializer);
      return safe(node.expression); // Dynamic lookup in a table whose every value is static.
    }
    if (ts.isCallExpression(node)) {
      if (node.arguments.some(ts.isSpreadElement)) return false;
      const declaration = checker.getResolvedSignature(node)?.declaration;
      const file = declaration ? normalized(declaration.getSourceFile().fileName) : '';
      if (file.endsWith('/src/engine/ui/icons.ts') && declaration?.name?.text === 'icon') return true;
      if (file.endsWith('/src/engine/strings.ts') && declaration?.name?.text === 'engineString') return node.arguments.every(safe);
      if (ts.isPropertyAccessExpression(node.expression) && ['map', 'flatMap'].includes(node.expression.name.text) && node.arguments.length > 0 && functionLike(node.arguments[0])) {
        const values = returned(node.arguments[0]); return values.length > 0 && values.every(safe);
      }
      if (declaration && functionLike(declaration)) {
        const bindings = new Map(env);
        declaration.parameters.forEach((parameter, index) => { bindings.set(symbol(parameter.name), node.arguments[index] ?? parameter.initializer); });
        const values = returned(declaration);
        return values.length > 0 && values.every((value) => staticMarkup(value, bindings, next));
      }
      // String methods preserve provenance. Escaping an authored value is not textContent.
      if (ts.isPropertyAccessExpression(node.expression)) return safe(node.expression.expression) && node.arguments.every(safe);
      return false;
    }
    return false;
  }
  const callTarget = (input, trail = new Set()) => {
    const node = unwrapped(input); if (!node || trail.has(node)) return null;
    const next = new Set(trail); next.add(node);
    if (ts.isIdentifier(node)) {
      const declaration = symbol(node)?.valueDeclaration;
      return declaration && ts.isVariableDeclaration(declaration) ? callTarget(declaration.initializer, next) : null;
    }
    if (ts.isCallExpression(node) && property(node.expression, checker) === 'bind' && ts.isPropertyAccessExpression(node.expression)) return callTarget(node.expression.expression, next);
    return property(node, checker);
  };
  const scan = (node) => {
    if (ts.isCallExpression(node)) {
      calls.push(node);
      const invoked = property(node.expression, checker);
      const forwarding = invoked === 'call' || invoked === 'apply';
      const target = forwarding && ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : node.expression;
      // SF74 speed 3: resolve the signature only when the answer needs it (an unnamed target, or write / writeln's
      // declaring file); resolving every call of every candidate file was ~45 % of this pass.
      const named = callTarget(target);
      const declaration = named === null || named === 'write' || named === 'writeln' ? checker.getResolvedSignature(node)?.declaration : undefined;
      const name = named ?? declaration?.name?.text;
      const args = forwarding ? node.arguments.slice(1) : node.arguments;
      if (name === 'insertAdjacentHTML') sinks.push({ node, value: invoked === 'apply' ? args[0] : args[1] });
      if (name === 'createContextualFragment' || ((name === 'write' || name === 'writeln') && (normalized(declaration?.getSourceFile().fileName ?? '').endsWith('/lib.dom.d.ts') || /\bdocument\.(write|writeln)\b/u.test(target.getText(source))))) {
        for (const value of args) sinks.push({ node, value });
      }
      if (name === 'set' && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'Reflect' && args.length > 2 && ts.isStringLiteralLike(args[1]) && SINKS.has(args[1].text)) sinks.push({ node, value: args[2] });
      if (name === 'defineProperty' && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'Object' && args.length > 2 && ts.isStringLiteralLike(args[1]) && SINKS.has(args[1].text)) {
        const descriptor = args[2]; if (ts.isObjectLiteralExpression(descriptor)) {
          for (const entry of descriptor.properties) if (ts.isPropertyAssignment(entry) && entry.name.getText(source) === 'value') sinks.push({ node, value: entry.initializer });
        }
      }
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(node.operatorToken.kind)) {
      const key = ts.isPropertyAccessExpression(node.left) ? symbol(node.left.name) : symbol(node.left);
      const values = writes.get(key) ?? []; values.push(node.right); writes.set(key, values);
      if (SINKS.has(property(node.left, checker))) sinks.push({ node, value: node.right });
    }
    if (ts.isPropertyAssignment(node) && [...SINKS, '__html'].includes(node.name.getText(source).replaceAll(/["']/gu, ''))) sinks.push({ node, value: node.initializer });
    ts.forEachChild(node, scan);
  };
  scan(source);
  const record = (node) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    sites.set(node.getStart(source), { line: line + 1, column: character, message: 'Authored or unknown runtime text reaches an HTML sink. Put it in textContent beside static platform markup (SF58).' });
  };
  for (const sink of sinks) {
    let fn = sink.node.parent;
    while (fn && !functionLike(fn)) fn = fn.parent;
    const id = fn ? symbolOfFunction(fn) : undefined;
    const callers = id && privateHelper(fn) ? calls.filter((call) => symbol(call.expression) === id) : [];
    if (callers.length === 0) { if (!staticMarkup(sink.value)) record(sink.node); continue; }
    for (const caller of callers) {
      if (caller.arguments.some(ts.isSpreadElement) || fn.parameters.some((parameter) => parameter.dotDotDotToken)) { record(caller); continue; }
      const env = new Map(); fn.parameters.forEach((parameter, index) => { env.set(symbol(parameter.name), caller.arguments[index] ?? parameter.initializer); });
      if (!staticMarkup(sink.value, env)) record(caller);
    }
  }
  return [...sites.values()].sort((a, b) => a.line - b.line || a.column - b.column);
}
