// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the actual title module graph under Node.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source entries for the Node graph check.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

/** Runtime imports only: erased types and lazy tap actions do not load the title. */
function titleGraph(entries: readonly string[]): string[] {
  const options = ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.json', file => ts.sys.readFile(file)).config, ts.sys, process.cwd()).options;
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.[cm]?[jt]sx?$/u.test(file)) return;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (node.moduleSpecifier === undefined || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause, bindings = clause?.namedBindings;
        if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword || (clause?.name === undefined && bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(row => row.isTypeOnly))) continue;
      } else if (node.isTypeOnly) continue;
      const name = node.moduleSpecifier.text;
      if (/^three(?:\/|$)/u.test(name)) { seen.add(name); continue; }
      const target = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (target !== undefined && !target.includes('/node_modules/') && !target.endsWith('.d.ts')) visit(target);
    }
  };
  for (const entry of entries) visit(resolve(entry));
  return [...seen];
}

test('title widgets and saved summaries do not initialize the app or renderer', () => {
  const files = titleGraph(['src/engine/ui/StartTitle.ts', 'src/game/titleDeck.ts', 'src/game/summary.ts']);
  expect(files.filter(file => /src\/engine\/(?:app\/(?:app|runtime)\.ts|render\/|world\/)|src\/shards\/|^three(?:\/|$)/u.test(file))).toEqual([]);
});
