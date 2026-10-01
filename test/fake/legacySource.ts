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
  const result: unknown = runInNewContext(js, globals, { timeout: 1000 });
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
