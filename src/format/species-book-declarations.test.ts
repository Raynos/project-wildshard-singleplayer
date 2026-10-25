// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual schema consumer without writing a fixture module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('species book declarations isolate metadata while retaining defined body and brain data contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/speciesBookRows.ts', 'utf8'), {
    fileName: 'speciesBookRows.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(13_000);
  expect(emitted.outputText).toContain('v.ObjectSchema<');
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferOutput<typeof CompactSpeciesBodiesSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof SpeciesSchema>');
  expect(emitted.outputText).toContain('v.GenericSchema<CreatureGuestRowsInput, CreatureGuestRows>');
});

test('existing pick and omit consumers retain the presentation schema entries', () => {
  const consumer = resolve('src/format/t4-species-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? `import * as v from 'valibot';
    import { SpeciesPresentationSchema } from './speciesBookRows';
    export const catalogue = v.pick(SpeciesPresentationSchema, ['lookBook']);
    export const payload = v.omit(SpeciesPresentationSchema, ['lookBook']);` : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual species consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
});
