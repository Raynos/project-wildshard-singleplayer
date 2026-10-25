// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('specimen declarations isolate validator metadata and retain binary-file contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/specimenCatalogue.ts', 'utf8'), {
    fileName: 'specimenCatalogue.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(18_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferInput<typeof BinaryFileSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof BinaryFileSchema>');
});

test('existing model pick and spread readers preserve optional authored and parsed fields', () => {
  const consumer = resolve('src/format/t4-specimen-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { SpecimenModelMetadataSchema, type SpecimenModelMetadataRows } from './specimenCatalogue';
    export const model = v.pick(SpecimenModelMetadataSchema, ['id', 'file', 'pipeline', 'surface']);
    export const figure = v.strictObject({ ...v.pick(SpecimenModelMetadataSchema,
      ['id', 'name', 'file', 'category', 'pipeline', 'surface']).entries, defaults: v.strictObject({}) });
    export const minimal: v.InferOutput<typeof model> = { id: 'bird', file: 'bird', pipeline: 'code' };
    export const explicitUndefined: v.InferInput<typeof model> = { ...minimal, surface: undefined };
    export const metadata: SpecimenModelMetadataRows = {
      id: 'bird', name: 'Bird', file: 'bird', category: 'creatures', pipeline: ['code'], defaults: {}
    };`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual specimen consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
});
