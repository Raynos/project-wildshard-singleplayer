// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a product build.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual consumer without writing source files.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('world scene declarations retain parsed defaults and imported contracts without validator metadata', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/worldScenes.ts', 'utf8'), {
    fileName: 'worldScenes.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(15_000);
  expect(emitted.outputText).not.toContain('VariantSchema');
  expect(emitted.outputText).not.toContain('StrictObjectSchema');
  expect(emitted.outputText).toContain('v.GenericSchema<unknown, ParsedWorldScenes>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof WorldSceneWeldMaterialSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof UniformRowsSchema>');
  expect(emitted.outputText).toContain('export interface ParsedWorldScenes');
  expect(emitted.outputText).toContain('placements:');
  expect(emitted.outputText).not.toContain('placements?: v.InferOutput');
});

test('a downstream scene export can name the defining parsed data type', () => {
  const consumer = resolve('src/format/t4-nameability-consumer.ts'), world = resolve('src/format/worldScenes.ts');
  const source = readFileSync(world, 'utf8');
  const diagnostics = (publicType: boolean): readonly number[] => {
    const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [], declaration: true, emitDeclarationOnly: true };
    const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
    host.fileExists = file => file === consumer || exists(file);
    host.readFile = file => file === consumer ? "import { WorldScenesSchema } from './worldScenes'; export const scene = { schema: WorldScenesSchema };"
      : file === world ? (publicType ? source : source.replace('export interface ParsedWorldScenes', 'interface ParsedWorldScenes')) : read(file);
    host.writeFile = () => undefined;
    const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
    if (file === undefined) throw new Error('Missing virtual declaration consumer');
    return program.getDeclarationDiagnostics(file).map(row => row.code);
  };
  expect(diagnostics(false)).toContain(4023);
  expect(diagnostics(true)).toEqual([]);
});
