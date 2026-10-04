#!/usr/bin/env node
// SF2: count typed boundary reaches and engine inheritance, never comments or identifier spelling.
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';

const ROOT = resolve(import.meta.dirname, '..');
const LIST = 'lint/shard-coupling.json';
const CONTEXT_FILES = new Set(['src/game/shard/context.ts', 'src/engine/level/context.ts']);
const initial = () => ({ 'ctx.app': 0, 'ctx.game': 0, 'ctx.game.runtime': 0, engineSubclasses: 0 });

export function shardCoupling(root = ROOT) {
  const files = globSync('src/shards/**/*.{ts,tsx}', { cwd: root }).filter((file) => !file.endsWith('.d.ts') && !file.includes('.generated.'));
  const configPath = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
  const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, root);
  const program = ts.createProgram([...files.map((file) => resolve(root, file)), ...parsed.fileNames.filter((file) => file.endsWith('.merge.d.ts'))], { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker(), shards = {};
  const local = (file) => relative(root, file).replaceAll('\\', '/');
  const declarations = (symbol) => symbol?.declarations ?? [];
  const origin = (symbol, names) => declarations(symbol).some((decl) => CONTEXT_FILES.has(local(decl.getSourceFile().fileName)) && names.includes(decl.parent.name?.text));
  const data = (type, seen = new Set()) => {
    if (seen.has(type)) return false; // recursive objects cannot promise a JSON round-trip
    if (type.isUnion() || type.isIntersection()) return type.types.every((part) => data(part, seen));
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
    if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0 || (type.getSymbol()?.flags ?? 0) & ts.SymbolFlags.Class) return false;
    if (!(type.flags & ts.TypeFlags.Object)) return !(type.flags & (ts.TypeFlags.ESSymbol | ts.TypeFlags.BigInt | ts.TypeFlags.BigIntLiteral));
    const next = new Set(seen).add(type);
    if (checker.isArrayType(type) || checker.isTupleType(type)) return checker.getTypeArguments(type).every((part) => data(part, next));
    return checker.getIndexInfosOfType(type).every((info) => data(info.type, next)) && checker.getPropertiesOfType(type).every((prop) => {
      const decl = prop.valueDeclaration ?? prop.declarations?.[0];
      return decl !== undefined && data(checker.getTypeOfSymbolAtLocation(prop, decl), next);
    });
  };
  const engineBase = (type, seen = new Set()) => {
    if (seen.has(type)) return null;
    const next = new Set(seen).add(type), symbol = type.getSymbol();
    if (declarations(symbol).some((decl) => ts.isClassDeclaration(decl) && local(decl.getSourceFile().fileName).startsWith('src/engine/'))) return symbol.getName();
    if (declarations(symbol).some((decl) => ts.isClassDeclaration(decl))) {
      const declared = checker.getDeclaredTypeOfSymbol(symbol);
      if (declared !== type) return engineBase(declared, next);
    }
    if (!(type.flags & ts.TypeFlags.Object) || !(type.objectFlags & ts.ObjectFlags.ClassOrInterface)) return null;
    for (const base of checker.getBaseTypes(type)) { const name = engineBase(base, next); if (name !== null) return name; }
    return null;
  };
  for (const file of files.sort((a, b) => a.localeCompare(b))) {
    const slug = file.split('/')[2], source = program.getSourceFile(resolve(root, file));
    if (!slug || !source) throw new Error(`Cannot inspect ${file}`);
    const row = shards[slug] ??= { counts: initial(), sites: {} };
    const add = (metric, node) => {
      row.counts[metric] = (row.counts[metric] ?? 0) + 1;
      const at = source.getLineAndCharacterOfPosition(node.getStart(source));
      (row.sites[metric] ??= []).push(`${file}:${at.line + 1}:${at.character + 1}`);
    };
    const member = (type, name, node) => {
      const prop = checker.getPropertyOfType(type, name);
      if (origin(prop, ['ShardContext', 'LevelContext'])) {
        if (name === 'app' || name === 'game') add(`ctx.${name}`, node);
        const decl = prop.valueDeclaration ?? prop.declarations?.[0];
        if (decl && !data(checker.getTypeOfSymbolAtLocation(prop, decl))) add(`context.${name}`, node);
      }
      if (name === 'runtime' && origin(prop, ['GameServices'])) add('ctx.game.runtime', node);
    };
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node)) member(checker.getTypeAtLocation(node.expression), node.name.text, node);
      else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) member(checker.getTypeAtLocation(node.expression), node.argumentExpression.text, node);
      else if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
        for (const element of node.name.elements) {
          const key = element.propertyName ?? element.name;
          if (!element.dotDotDotToken && (ts.isIdentifier(key) || ts.isStringLiteralLike(key))) member(checker.getTypeAtLocation(node.initializer), key.text, element);
        }
      } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        for (const clause of node.heritageClauses ?? []) if (clause.token === ts.SyntaxKind.ExtendsKeyword) for (const base of clause.types) {
          const name = engineBase(checker.getTypeAtLocation(base));
          if (name !== null) { add('engineSubclasses', node); add(`subclass.${name}`, node); }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return shards;
}

/** A removed shard/member buys no allowance for another shard/member. */
export function compareCoupling(baseline, candidate) {
  const failures = [];
  for (const [slug, row] of Object.entries(candidate)) for (const [metric, count] of Object.entries(row.counts)) {
    const ceiling = baseline[slug]?.counts[metric] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count > ceiling) failures.push(`${slug}: ${metric} rose ${ceiling} → ${count}`);
  }
  return failures;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const current = shardCoupling();
  if (process.argv.includes('--update')) {
    writeFileSync(resolve(ROOT, LIST), `${JSON.stringify({ about: 'SF2: legacy, pre-SF2 typed coupling ceilings; counts only shrink.', shards: current }, null, 2)}\n`);
  }
  if (process.argv.includes('--check')) {
    const recorded = JSON.parse(readFileSync(resolve(ROOT, LIST), 'utf8'));
    const failures = compareCoupling(recorded.shards, current);
    for (const failure of failures) console.error(`shard-coupling: ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  }
  console.log('shard                  ctx.app  ctx.game  game.runtime  engine subclasses  non-data context');
  for (const [slug, row] of Object.entries(current)) {
    const nonData = Object.entries(row.counts).filter(([metric]) => metric.startsWith('context.')).map(([metric, count]) => `${metric.slice(8)}=${count}`).join(', ');
    console.log(`${slug.padEnd(22)} ${String(row.counts['ctx.app']).padStart(7)} ${String(row.counts['ctx.game']).padStart(9)} ${String(row.counts['ctx.game.runtime']).padStart(13)} ${String(row.counts.engineSubclasses).padStart(18)}  ${nonData}`);
  }
}
