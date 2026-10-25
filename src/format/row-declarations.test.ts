// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual section/JSON Schema consumer without a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('author row declarations bound validators and retain the defining journal and economy contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/rows.ts', 'utf8'), {
    fileName: 'rows.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(13_000);
  expect(emitted.outputText).toContain('v.InferOutput<typeof JournalRowSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof BarterEconomySchema>');
});

test('row section entries, namespaced strike tags and dictionary iteration remain typed', () => {
  const consumer = resolve('src/format/t4-row-consumer.ts');
  const defining = resolve('src/format/rows.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { RowsSchema, type ShardRows } from './rows';
    export const entries = RowsSchema.pipe[2].entries;
    export const tags = entries.strikes.pipe[0].item.entries.tags.pipe[0].item;
    export const tag: v.InferOutput<typeof tags> = 'creature.herd';
    export function section(key: keyof typeof entries, value: unknown): void { v.parse(entries[key], value); }
    export function identifiers(row: ShardRows): string[] {
      return Object.values(row).flatMap(list => list.map(entry => entry.id));
    }
    export function materials(row: ShardRows): (string | null)[] { return row.looks.map(look => look.material); }`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual row consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const invalid = source.replace("= 'creature.herd';", "= 'herd';");
  host.readFile = path => path === consumer ? invalid : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing invalid row-tag consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
  const interfaceRows = readFileSync(defining, 'utf8').replace('export type ShardRows = {', 'export interface ShardRows {');
  host.readFile = path => path === consumer ? source : path === defining ? interfaceRows : read(path);
  const dictionary = ts.createProgram([consumer], options, host), dictionaryFile = dictionary.getSourceFile(consumer);
  if (dictionaryFile === undefined) throw new Error('Missing interface-row consumer');
  expect(dictionary.getSemanticDiagnostics(dictionaryFile).map(row => row.code)).toContain(7006);
});
