// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without a generated product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without writing a source module.
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { CreaturesSchema } from '../src/format/creatures';

test('creature declarations bound metadata while retaining imported brain and group contracts', () => {
  const emitted = ts.transpileDeclaration(readFileSync('src/format/creatures.ts', 'utf8'), {
    fileName: 'creatures.ts', reportDiagnostics: true,
    compilerOptions: { isolatedDeclarations: true, strict: true, exactOptionalPropertyTypes: true },
  });
  expect(emitted.diagnostics).toEqual([]);
  expect(emitted.outputText.length).toBeLessThan(18_000);
  expect(emitted.outputText).toContain('v.InferInput<typeof GroupBrainSchema>');
  expect(emitted.outputText).toContain('v.InferOutput<typeof GroupBrainSchema>');
  const parsed = v.parse(CreaturesSchema, { brains: [], spawns: [] });
  const groups: unknown[] = parsed.groups;
  expect(groups).toEqual([]);
});

test('the live strike-tag metadata path keeps template-string admission and exact optional keys', () => {
  const consumer = resolve('src/format/t4-creature-consumer.ts');
  const options: ts.CompilerOptions = { strict: true, exactOptionalPropertyTypes: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, types: [],
    declaration: true, emitDeclarationOnly: true };
  const source = `import * as v from 'valibot';
    import { CreatureStrikeSchema, CreaturesSchema, type CreatureStrikeRows, type ShardCreatures } from './creatures';
    export const tags = v.array(CreatureStrikeSchema.entries.tags.pipe[0].item);
    export const value: v.InferOutput<typeof tags> = ['creature.herd'];
    export const authored: v.InferInput<typeof CreaturesSchema> = { brains: [], spawns: [] };
    export const root = v.strictObject({ creatures: v.optional(CreaturesSchema, { brains: [], groups: [], spawns: [] }) });
    export function defaulted(row: v.InferOutput<typeof root>): ShardCreatures { return row.creatures; }
    export function units(row: CreatureStrikeRows): 'world' | 'actor' | undefined { return row.units; }`;
  const host = ts.createCompilerHost(options), read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.fileExists = file => file === consumer || exists(file);
  host.readFile = file => file === consumer ? source : read(file);
  host.writeFile = () => undefined;
  const program = ts.createProgram([consumer], options, host), file = program.getSourceFile(consumer);
  if (file === undefined) throw new Error('Missing virtual creature consumer');
  expect(program.getSemanticDiagnostics(file).map(row => row.code)).toEqual([]);
  expect(program.getDeclarationDiagnostics(file).map(row => row.code)).toEqual([]);
  const defining = resolve('src/format/creatures.ts');
  const interfaceInput = readFileSync(defining, 'utf8').replace(
    'export type ShardCreaturesInput = {', 'export interface ShardCreaturesInput {');
  host.readFile = path => path === consumer ? source : path === defining ? interfaceInput : read(path);
  const broken = ts.createProgram([consumer], options, host), brokenFile = broken.getSourceFile(consumer);
  if (brokenFile === undefined) throw new Error('Missing interface-default consumer');
  expect(broken.getSemanticDiagnostics(brokenFile).map(row => row.code)).toContain(2322);
});
