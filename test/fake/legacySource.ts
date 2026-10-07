// oxlint-disable-next-line import/no-nodejs-modules -- this adapter runs only in the Node combat tests and reads local production ASTs
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only test adapter executes selected local closures without booting WebGL
import { runInNewContext } from 'node:vm';
import ts from '@typescript/typescript6';

/** C1's temporary adapter for private tuning/boot closures. Executes selected production AST nodes, never copies
 * their logic into a fake pipeline. Replace the adapter with public row/service imports as S1.2/S1.3/S2.3 land. */
export function legacySource(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
export function descendants(root: ts.Node, match: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => { if (match(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(root); return found;
}
export function executeLegacy(code: string, globals: Record<string, unknown> = {}): unknown {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  // Trusted repository closures may build procedural models; parallel Linux CI can spend over 1 s here.
  // This 30 s runaway guard is not a performance assertion or an untrusted-shard execution budget.
  const result: unknown = runInNewContext(js, { ...globals }, { timeout: 30_000 });
  return result;
}
export function legacyConstants(file: string, names: readonly string[], globals: Record<string, unknown> = {}): Record<string, unknown> {
  const source = legacySource(file), defs = new Map<string, ts.VariableDeclaration>();
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer !== undefined) defs.set(d.name.text, d);
  }
  const selected = new Set<string>();
  const select = (name: string): void => {
    if (selected.has(name) || Object.hasOwn(globals, name)) return;
    const decl = defs.get(name);
    if (decl?.initializer === undefined) throw new Error(`${file}: missing top-level constant ${name}`);
    selected.add(name);
    const refs = descendants(decl.initializer, ts.isIdentifier);
    for (const ref of refs) if (ts.isIdentifier(ref) && defs.has(ref.text)) select(ref.text);
  };
  for (const name of names) select(name);
  // Keep declaration order so referenced constants have the same initialization order as production.
  const code = [...defs].filter(([name]) => selected.has(name)).map(([, d]) => `const ${d.getText(source)};`).join('\n');
  return executeLegacy(`${code}\n;({${names.join(',')}});`, globals) as Record<string, unknown>;
}

/** Private class methods without constructors/field initializers. The fixture explicitly supplies each read field. */
export function legacyMethods(file: string, className: string, globals: Record<string, unknown> = {}): object {
  const source = legacySource(file);
  const decl = source.statements.find((s) => ts.isClassDeclaration(s) && s.name?.text === className);
  if (decl === undefined || !ts.isClassDeclaration(decl)) throw new Error(`${file}: missing class ${className}`);
  const members = decl.members.filter((m) => ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m));
  const code = `class Legacy { ${members.map((m) => m.getText(source)).join('\n')} }\nLegacy.prototype;`;
  const result = executeLegacy(code, globals);
  if (typeof result !== 'object' || result === null) throw new Error('legacy class did not return a prototype');
  return result;
}

/** Private top-level helper, evaluated with its production body and explicit module globals. */
export function legacyFunction(file: string, name: string, globals: Record<string, unknown> = {}): (...args: unknown[]) => unknown {
  const source = legacySource(file);
  const decl = source.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name);
  if (decl === undefined) throw new Error(`${file}: missing function ${name}`);
  const fn = executeLegacy(`${decl.getText(source)}\n${name};`, globals);
  if (typeof fn !== 'function') throw new Error('legacy helper did not return a function');
  return (...args) => Reflect.apply(fn, undefined, args) as unknown;
}

/** Inline constructor tuning, read as data from the actual new-expression rather than copied into an oracle. */
export function legacyNewOptions(file: string, ctor: string, globals: Record<string, unknown> = {}): Record<string, number>[] {
  const source = legacySource(file);
  const calls = descendants(source, (n) => ts.isNewExpression(n) && n.expression.getText(source) === ctor);
  return calls.map((n) => {
    if (!ts.isNewExpression(n)) throw new Error('not a constructor');
    const option = n.arguments?.find(ts.isObjectLiteralExpression);
    if (option === undefined) throw new Error(`${file}: ${ctor} lacks options`);
    return executeLegacy(`(${option.getText(source)})`, globals) as Record<string, number>;
  });
}
