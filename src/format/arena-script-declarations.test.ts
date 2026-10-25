// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('arena script declarations bound validator metadata and retain defining imported contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/arenaScriptRows.ts', 'utf8'), {
    fileName: 'arenaScriptRows.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(18_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferInput<typeof ArenaEncounterSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof ArenaEncounterSchema>');
});

test('the existing fight composition keeps omit, programs and loose-file data contracts', () => {
  const consumer = resolve('src/format/t4-arena-script-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { ArenaScriptRowsSchema, ArenaScriptFightFileSchema,
      type ArenaScriptRowsInput, type ArenaScriptRows } from './arenaScriptRows';
    export const script = v.omit(ArenaScriptRowsSchema, ['programs', 'arenaFire']);
    export const programs: v.GenericSchema<ArenaScriptRowsInput['programs'], ArenaScriptRows['programs']>
      = ArenaScriptRowsSchema.entries.programs;
    export function extra(row: v.InferOutput<typeof ArenaScriptFightFileSchema>): unknown { return row.extra; }
    export function rows(row: v.InferOutput<typeof script>): Omit<ArenaScriptRows, 'programs' | 'arenaFire'> { return row; }`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual arena script consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
});
