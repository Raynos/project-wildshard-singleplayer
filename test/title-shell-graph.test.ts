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
      } else if (node.isTypeOnly || (node.exportClause !== undefined && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(row => row.isTypeOnly))) continue;
      const name = node.moduleSpecifier.text;
      if (/\?(?:raw|url)$/u.test(name)) continue; // Vite data imports do not execute a JavaScript module.
      if (/^three(?:\/|$)/u.test(name)) { seen.add(name); continue; }
      const target = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (target === undefined && (name.startsWith('.') || name.startsWith('@wildshard/')) && !/\.(?:css|png|jpe?g|webp|svg|hdr)(?:\?|$)/u.test(name)) throw new Error(`Unresolved title import: ${file}: ${name}`);
      if (target !== undefined && !target.includes('/node_modules/') && !target.endsWith('.d.ts')) visit(target);
    }
  };
  for (const entry of entries) visit(resolve(entry));
  return [...seen];
}

test('cold title, recovery, navigation and prefetch stay off the world graph', () => {
  const files = titleGraph(['src/entry.ts', 'src/engine/ui/StartTitle.ts', 'src/game/mainMenu.ts', 'src/game/grid/pageEntry.ts', 'src/game/travel/travel.ts']);
  expect(files.filter(file => /src\/engine\/(?:app\/(?:app|runtime)\.ts|render\/|world\/|anim\/|physics\/)|src\/game\/(?:looks\/|shardfile\/(?:product|runtimeProduct)\.ts)|src\/shards\/|^three(?:\/|$)/u.test(file))).toEqual([]);
});

test('standalone session bootstrap leaves grid construction behind its assembly import', () => {
  const files = titleGraph(['src/game/session/session.ts', 'src/game/shardfile/client.ts']);
  expect(files.filter(file => /src\/game\/grid\/(?:session|liveSession|roadLookPlatform|roadCull|crossing)\.ts$/u.test(file))).toEqual([]);
});

test('client phase admission keeps unused feature constructors outside its static graph', () => {
  const files = titleGraph(['src/game/session/session.ts', 'src/game/shardfile/client.ts']);
  expect(files.filter(file => /src\/game\/shardfile\/(?:clientCatalogue|clientMeadow|clientHeldMelee|clientSpeciesProgram|clientQuestPage|clientPopulation|clientBossFight|clientBossTelegraph|clientPlayerEnter)\.ts$/u.test(file))).toEqual([]);
});

test('selected discovery composition has no static shard or complete-list dependency',()=>{
  const files=titleGraph(['src/shardSelection.ts']);
  expect(files.filter(file=>/src\/(?:shards\/|shardList\.ts$|shards\.generated\.ts$)/u.test(file))).toEqual([]);
});

test('standalone sessions leave grid presentation and equipment behind grid-only imports', () => {
  const files = titleGraph(['src/game/session/session.ts']);
  expect(files.filter(file => /src\/game\/grid\/(?:reveal|gridHud|budgetOverlay|budgetPoints|memoryRows|minimapBlend|enteredEquipment)\.ts$/u.test(file))).toEqual([]);
});
