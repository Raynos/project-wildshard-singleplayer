// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';

test('species program declarations isolate validator metadata behind exact data contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/speciesPrograms.ts', 'utf8'), {
    fileName: 'speciesPrograms.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(14_000);
  expect(emitted.outputText).not.toContain('SchemaWithPipe');
  expect(emitted.outputText).toContain('v.InferOutput<typeof CreatureBodyRecipeSchema>');
});

test('live species pick, spread and nested variant readers keep exact optional fields', () => {
  const consumer = resolve('src/format/t4-species-program-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { SpeciesSchema, type SpeciesData } from './speciesPrograms';
    export const population = v.pick(SpeciesSchema, ['kind', 'variants', 'spawnOnly']);
    export const coat = v.object({ ...SpeciesSchema.entries.variants.item.entries, colour: v.string() });
    export const looks = v.object({ ...SpeciesSchema.entries, variants: v.array(coat) });
    const populationRow: v.InferOutput<typeof population> = { kind: 'herd', variants: [] };
    const variant: v.InferOutput<typeof coat> = {
      id: 'plain', label: 'Plain', weight: 1, rarity: 'common', scale: [1, 1], colour: 'white'
    };
    export const optionalHp: number | undefined = variant.hp;
    export const variants: SpeciesData['variants'] = [variant];
    export const row = populationRow;`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual species program consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
});
