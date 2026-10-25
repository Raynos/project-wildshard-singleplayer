// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual SDK metadata consumer without a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('client channel declarations bound visual data without validator implementation expansion', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/clientChannels.ts', 'utf8'), {
    fileName: 'clientChannels.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(37_000);
  expect(emitted.outputText).toContain('readonly scalars: v.OptionalSchema');
});

test('numeric pose metadata retains scalar paths, defaulted outputs and typed observation refusals', () => {
  const consumer = resolve('src/format/t4-client-channel-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { NumericPoseSchema, NumericPoseInputSchema, PrivateSceneSchema, type NumericPoseRowsInput,
      type NumericPoseRows, type PrivateScene, type WorldSceneBindingKind } from './clientChannels';
    export const scalarBridge = v.looseObject({ scalars: NumericPoseSchema.entries.scalars });
    export const input: NumericPoseRowsInput = {programs: [], group: 'body'};
    export function admitted(row: v.InferOutput<typeof NumericPoseSchema>): NumericPoseRows { return row; }
    export function states(row: NumericPoseRows): string[] { return row.states; }
    export function scalars(row: v.InferOutput<typeof scalarBridge>): NumericPoseRows['scalars'] { return row.scalars; }
    export function textures(row: v.InferOutput<typeof PrivateSceneSchema>): PrivateScene['textures'] { return row.textures; }
    export const observation: v.InferInput<typeof NumericPoseInputSchema> = {input: 'speed', kind: 'frame', field: 'speed'};
    export const binding: WorldSceneBindingKind = 'colliders';`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual numeric-pose consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const invalid = source.replace("field: 'speed'", "field: 'lives'");
  host.readFile = path => path === consumer ? invalid : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing invalid numeric-pose consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
