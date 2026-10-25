// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { FamilyMaterialSchema } from './materialFamilies';

test('material-family declarations isolate validator internals while retaining defaulted data', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/materialFamilies.ts', 'utf8'), {
    fileName: 'materialFamilies.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(40_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  const toon = v.parse(FamilyMaterialSchema, { family: 'toon' });
  expect(toon).toMatchObject({ family: 'toon', colour: [1, 1, 1], roughness: 0.88, faceted: true });
  const emissive = v.parse(FamilyMaterialSchema, { family: 'emissive' });
  expect(emissive).toMatchObject({ tube: null, sky: null, blend: 'opaque', intensity: 1 });
});

test('family dispatch and readonly default tuples keep required parsed fields', () => {
  const consumer = resolve('src/format/t4-material-family-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { ToonMaterialSchema, PbrMaterialSchema, PainterlyMaterialSchema, EmissiveMaterialSchema,
      type FamilyMaterialParams } from './materialFamilies';
    export const family = v.variant('family', [ToonMaterialSchema, PbrMaterialSchema, PainterlyMaterialSchema, EmissiveMaterialSchema]);
    export const input: v.InferInput<typeof family> = { family: 'pbr' };
    export const authored = v.optional(v.tuple([v.number(), v.number(), v.number()]), ToonMaterialSchema.entries.colour.default);
    export function parsed(row: v.InferOutput<typeof family>): FamilyMaterialParams { return row; }
    export function colour(row: v.InferOutput<typeof family>): [number, number, number] { return row.colour; }
    export function record(row: FamilyMaterialParams): Readonly<Record<string, unknown>> { return row; }`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual material-family consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const defining = resolve('src/format/materialFamilies.ts');
  const interfaceMaterial = readFileSync(defining, 'utf8').replace(
    'export type EmissiveMaterialParams = {', 'export interface EmissiveMaterialParams {');
  host.readFile = path => path === consumer ? source : path === defining ? interfaceMaterial : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing interface-material consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
